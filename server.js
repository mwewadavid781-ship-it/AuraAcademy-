const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk').default;
const pdfParse = require('pdf-parse');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// AUTH
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, university, courseId, year } = req.body;
    const { data, error } = await supabase.from('students').insert([{
      name, email, university, course_id: courseId, year,
      trial_end_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      is_locked: false
    }]).select();
    if (error) throw error;
    await supabase.from('student_stats').insert([{ student_id: data[0].id }]);
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    if (error) throw error;
    res.json({ success: true, student: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const { data, error } = await supabase.from('courses').select('*');
    if (error) throw error;
    res.json({ courses: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/groups/:courseId/:year', async (req, res) => {
  try {
    const { courseId, year } = req.params;
    const { data, error } = await supabase.from('study_groups').select('*').eq('course_id', courseId).eq('year', year);
    if (error) throw error;
    res.json({ groups: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { groupId, studentId, messageText } = req.body;
    const { data, error } = await supabase.from('messages').insert([{
      group_id: groupId, student_id: studentId, message_text: messageText, message_type: 'text'
    }]).select();
    if (error) throw error;
    res.json({ success: true, message: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/messages/:groupId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('messages').select('*').eq('group_id', req.params.groupId).order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ messages: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file' });
    let text = '';
    try {
      const pdf = await pdfParse(req.file.buffer);
      text = pdf.text.substring(0, 3000);
    } catch (e) {
      text = 'Study material';
    }
    const summary = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `Summarize: ${text}` }],
      max_tokens: 150
    }).then(r => r.choices[0]?.message?.content || 'Summary');
    const qRes = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `30 questions from: ${text}. JSON: [{q:"", opts:["A","B","C","D"], correct:0}]` }],
      max_tokens: 2000
    }).then(r => r.choices[0]?.message?.content || '[]');
    let questions = [];
    try {
      questions = JSON.parse(qRes);
    } catch {
      questions = Array(30).fill(0).map((_, i) => ({ q: `Q${i+1}`, opts: ['A', 'B', 'C', 'D'], correct: 0 }));
    }
    const { data, error } = await supabase.from('documents').insert([{
      student_email: studentEmail, file_name: req.file.originalname, summary, extracted_text: text, questions_count: questions.length
    }]).select();
    if (error) throw error;
    if (data?.[0]) {
      await supabase.from('questions').insert(questions.map(q => ({
        document_id: data[0].id, question: q.q, options: q.opts, correct_answer: q.correct || 0, explanation: 'Review'
      })));
    }
    res.json({ success: true, document: data[0], questions: questions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/answer', async (req, res) => {
  try {
    const { studentId, questionId, answerGiven, timeTaken } = req.body;
    const { data: qData } = await supabase.from('questions').select('correct_answer').eq('id', questionId).single();
    const isCorrect = qData.correct_answer === answerGiven;
    await supabase.from('answer_history').insert([{
      student_id: studentId, question_id: questionId, answer_given: answerGiven, is_correct: isCorrect, time_taken_seconds: timeTaken
    }]);
    if (isCorrect) {
      const points = timeTaken < 30 ? 50 : timeTaken < 60 ? 35 : 20;
      const { data: stats } = await supabase.from('student_stats').select('aura_points, correct_answers').eq('student_id', studentId).single();
      const newPoints = (stats?.aura_points || 0) + points;
      const newLevel = Math.floor(newPoints / 500) + 1;
      await supabase.from('student_stats').update({ aura_points: newPoints, correct_answers: (stats?.correct_answers || 0) + 1, level: newLevel }).eq('student_id', studentId);
      res.json({ success: true, correct: true, points, newLevel });
    } else {
      res.json({ success: true, correct: false, points: 0 });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/stats/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_stats').select('*').eq('student_id', req.params.studentId).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9}input,select{width:100%;padding:14px;margin:12px 0;border:1.5px solid #334155;border-radius:12px;font-size:15px;background:#1e293b;color:#f1f5f9}input:focus,select:focus{outline:none;border-color:#fbbf24;box-shadow:0 0 0 4px rgba(251,191,36,0.1)}.btn-primary{width:100%;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0f172a;padding:14px;border:none;border-radius:12px;cursor:pointer;font-weight:700;margin-top:12px}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(251,191,36,0.3)}#loginScreen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a,#1e293b);padding:20px}.login-box{background:#1e293b;padding:50px;border-radius:25px;border:1px solid #334155;box-shadow:0 25px 60px rgba(0,0,0,0.5);width:100%;max-width:450px}.logo{display:flex;align-items:center;gap:10px;font-size:32px;font-weight:800;color:#fbbf24;margin-bottom:12px}p{color:#cbd5e1;margin-bottom:24px}a{color:#fbbf24;cursor:pointer;text-decoration:none;font-weight:600}.toggle{text-align:center;margin-top:24px}.hidden{display:none!important}#appScreen{display:none;flex-direction:column;min-height:100vh;background:#0f172a}#appScreen.active{display:flex}.top-bar{background:linear-gradient(135deg,#1e293b,#334155);padding:16px 20px;border-bottom:1px solid #fbbf24;display:flex;justify-content:space-between;align-items:center}.top-bar h1{font-size:22px;color:#fbbf24}.stats-bar{display:flex;gap:12px}.stat-badge{background:rgba(251,191,36,0.1);border:1px solid #fbbf24;padding:8px 14px;border-radius:20px;font-size:12px;color:#fbbf24;font-weight:600}.app-content{flex:1;overflow-y:auto;padding:20px;padding-bottom:100px}.section{display:none}.section.active{display:block}.page-title{font-size:28px;font-weight:800;color:#fbbf24;margin-bottom:8px}.page-subtitle{color:#cbd5e1;font-size:14px;margin-bottom:24px}.group-card{background:#1e293b;padding:20px;border-radius:16px;cursor:pointer;border:1px solid #334155;transition:all 0.2s;margin-bottom:12px}.group-card:hover{border-color:#fbbf24;transform:translateX(8px)}.group-icon{font-size:32px;margin-bottom:8px}.group-name{font-weight:700;color:#fbbf24}.group-meta{font-size:13px;color:#94a3b8}.chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}.message{padding:12px 16px;border-radius:12px;max-width:80%;word-wrap:break-word}.message.own{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0f172a}.message.other{background:#1e293b;border:1px solid #334155;color:#f1f5f9}.chat-input{background:#1e293b;padding:16px 20px;border-top:1px solid #334155;display:flex;gap:12px}.chat-input input{flex:1}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#1e293b;border-top:1px solid #334155;display:flex;justify-content:space-around;padding:12px 0}.nav-btn{background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px}.nav-btn.active{color:#fbbf24}.nav-emoji{font-size:22px}</style></head><body><div id="loginScreen"><div class="login-box"><div class="logo">📚 AURA</div><p>Study Companion for University Students</p><div id="signIn"><form onsubmit="app.login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button class="btn-primary">Sign In</button></form><div class="toggle">New here? <a onclick="app.toggleAuth()">Create account</a></div></div><div id="signUp" class="hidden"><form onsubmit="app.register(event)"><input type="text" id="name" placeholder="Full Name" required><input type="email" id="regEmail" placeholder="Email" required><select id="courseId" required><option>Select Course</option></select><select id="year" required><option>Select Year</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select><input type="password" id="regPass" placeholder="Password" required><button class="btn-primary">Create Account</button></form><div class="toggle"><a onclick="app.toggleAuth()">Back</a></div></div></div></div><div id="appScreen"><div class="top-bar"><h1>📚 AURA</h1><div class="stats-bar"><div class="stat-badge"><span id="levelDisplay">L1</span></div><div class="stat-badge"><span id="pointsDisplay">0pts</span></div><button class="btn-primary" style="padding:8px 16px;font-size:12px;margin:0;width:auto" onclick="app.logout()">Logout</button></div></div><div class="app-content"><div id="home" class="section active"><div class="page-title">Welcome! 👋</div><p class="page-subtitle">Ready to level up?</p></div><div id="groups" class="section"><div class="page-title">Study Groups 👥</div><div id="groupsList"></div></div><div id="study" class="section"><div class="page-title">Study 📖</div><div id="studyContent"></div></div></div><nav class="bottom-nav"><button class="nav-btn active" onclick="app.goTo('home')"><span class="nav-emoji">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('groups')"><span class="nav-emoji">👥</span>Groups</button><button class="nav-btn" onclick="app.goTo('study')"><span class="nav-emoji">📖</span>Study</button></nav></div><script>class App{constructor(){this.user=null;this.API=window.location.origin}async init(){const saved=localStorage.getItem('aura_user');if(saved){this.user=JSON.parse(saved);this.showApp()}await this.loadCourses()}async loadCourses(){const res=await fetch(this.API+'/api/courses');const data=await res.json();const select=document.getElementById('courseId');data.courses?.forEach(c=>{const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.name;select.appendChild(opt)})}toggleAuth(){document.getElementById('signIn').classList.toggle('hidden');document.getElementById('signUp').classList.toggle('hidden')}async register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regEmail').value;const courseId=parseInt(document.getElementById('courseId').value);const year=parseInt(document.getElementById('year').value);const res=await fetch(this.API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,courseId,year,university:'Zambia'})});const data=await res.json();if(data.success){this.user={email,name,course_id:courseId,year,id:data.student.id};localStorage.setItem('aura_user',JSON.stringify(this.user));this.showApp()}else alert('Error: '+data.error)}async login(e){e.preventDefault();const email=document.getElementById('email').value;const res=await fetch(this.API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await res.json();if(data.success){this.user=data.student;localStorage.setItem('aura_user',JSON.stringify(this.user));this.showApp()}else alert('Login failed')}showApp(){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('appScreen').classList.add('active');this.loadGroups();this.loadStats()}async loadGroups(){const res=await fetch(this.API+\`/api/groups/\${this.user.course_id}/\${this.user.year}\`);const data=await res.json();const html=(data.groups||[]).map(g=>\`<div class="group-card"><div class="group-icon">👥</div><div class="group-name">\${g.group_name}</div><div class="group-meta">\${g.member_count||0} members</div></div>\`).join('');document.getElementById('groupsList').innerHTML=html}async loadStats(){const res=await fetch(this.API+\`/api/stats/\${this.user.id}\`);const data=await res.json();document.getElementById('levelDisplay').textContent='L'+data.level;document.getElementById('pointsDisplay').textContent=data.aura_points+'pts'}goTo(section){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(section).classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}logout(){localStorage.removeItem('aura_user');location.reload()}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA LUXURY on ' + PORT));
