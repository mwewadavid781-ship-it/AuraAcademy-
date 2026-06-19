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
    const isCEO = email === 'mwewadavid781@gmail.com';
    res.json({ success: true, student: data, isCEO });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const { data, error } = await supabase.from('courses').select('*');
    if (error) throw error;
    res.json({ courses: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/groups/:courseId/:year', async (req, res) => {
  try {
    const { courseId, year } = req.params;
    const { data, error } = await supabase.from('study_groups').select('*').eq('course_id', courseId).eq('year', year);
    if (error) throw error;
    res.json({ groups: data || [] });
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
    res.json({ messages: data || [] });
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
    const { data, error } = await supabase.from('documents').insert([{
      student_email: studentEmail, file_name: req.file.originalname, summary: 'Summary', extracted_text: text, questions_count: 30
    }]).select();
    if (error) throw error;
    res.json({ success: true, document: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

app.get('/ceo/students', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ students: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/ceo/unlock/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').update({
      is_locked: false,
      trial_end_date: new Date(Date.now() + 7*24*60*60*1000).toISOString()
    }).eq('id', req.params.studentId).select();
    if (error) throw error;
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9}input,select{width:100%;padding:14px;margin:12px 0;border:1.5px solid #334155;border-radius:12px;font-size:15px;background:#1e293b;color:#f1f5f9}input:focus,select:focus{outline:none;border-color:#fbbf24;box-shadow:0 0 0 4px rgba(251,191,36,0.1)}.btn-primary{width:100%;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0f172a;padding:14px;border:none;border-radius:12px;cursor:pointer;font-weight:700;margin-top:12px}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(251,191,36,0.3)}#loginScreen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a,#1e293b);padding:20px}.login-box{background:#1e293b;padding:50px;border-radius:25px;border:1px solid #334155;box-shadow:0 25px 60px rgba(0,0,0,0.5);width:100%;max-width:450px}.logo{display:flex;align-items:center;gap:10px;font-size:32px;font-weight:800;color:#fbbf24;margin-bottom:12px}p{color:#cbd5e1;margin-bottom:24px}a{color:#fbbf24;cursor:pointer;text-decoration:none;font-weight:600}.toggle{text-align:center;margin-top:24px}.hidden{display:none!important}#appScreen{display:none;flex-direction:column;min-height:100vh}#appScreen.active{display:flex}.top-bar{background:linear-gradient(135deg,#1e293b,#334155);padding:16px 20px;border-bottom:2px solid #fbbf24;display:flex;justify-content:space-between;align-items:center}.top-bar h1{font-size:22px;color:#fbbf24}.stats{display:flex;gap:12px}.stat-badge{background:rgba(251,191,36,0.1);border:1px solid #fbbf24;padding:8px 14px;border-radius:20px;font-size:12px;color:#fbbf24;font-weight:600}.app-content{flex:1;overflow-y:auto;padding:20px;padding-bottom:100px}.section{display:none}.section.active{display:block}.page-title{font-size:28px;font-weight:800;color:#fbbf24;margin-bottom:8px}.page-subtitle{color:#cbd5e1;font-size:14px;margin-bottom:24px}.card{background:#1e293b;padding:20px;border-radius:16px;border:1px solid #334155;margin-bottom:12px}.card:hover{border-color:#fbbf24}.group-icon{font-size:32px;margin-bottom:8px}.group-name{font-weight:700;color:#fbbf24}.group-meta{font-size:13px;color:#94a3b8}.ceo-card{background:#1e293b;padding:16px;border-radius:12px;border-left:4px solid #fbbf24;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}.student-name{color:#f1f5f9;font-weight:600}.student-email{font-size:12px;color:#94a3b8;margin-top:4px}.unlock-btn{background:#fbbf24;color:#0f172a;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#1e293b;border-top:1px solid #334155;display:flex;justify-content:space-around;padding:12px 0}.nav-btn{background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px}.nav-btn.active{color:#fbbf24}.nav-emoji{font-size:22px}</style></head><body><div id="loginScreen"><div class="login-box"><div class="logo">📚 AURA</div><p>Study Companion for University Students</p><div id="signIn"><form onsubmit="app.login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button class="btn-primary">Sign In</button></form><div class="toggle">New? <a onclick="app.toggleAuth()">Create account</a></div></div><div id="signUp" class="hidden"><form onsubmit="app.register(event)"><input type="text" id="name" placeholder="Full Name" required><input type="email" id="regEmail" placeholder="Email" required><select id="courseId" required><option value="">Loading courses...</option></select><select id="year" required><option value="">Select Year</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select><input type="password" id="regPass" placeholder="Password" required><button class="btn-primary">Create Account</button></form><div class="toggle"><a onclick="app.toggleAuth()">Back</a></div></div></div></div><div id="appScreen"><div class="top-bar"><h1>📚 AURA</h1><div class="stats"><div class="stat-badge">L<span id="lvl">1</span></div><div class="stat-badge" id="pts">0pts</div><button class="btn-primary" style="padding:8px 16px;font-size:12px;margin:0;width:auto" onclick="app.logout()">Logout</button></div></div><div class="app-content"><div id="home" class="section active"><div class="page-title">Welcome! 👋</div><p class="page-subtitle">Ready to level up?</p><div style="background:#1e293b;padding:20px;border-radius:16px;border:1px solid #334155"><div style="text-align:center"><div style="font-size:48px;font-weight:800;color:#fbbf24" id="homeLevel">1</div><div style="color:#cbd5e1">Level</div></div></div></div><div id="groups" class="section"><div class="page-title">Study Groups 👥</div><div id="groupsList"></div></div><div id="ceo" class="section"><div class="page-title">CEO Dashboard 👑</div><p class="page-subtitle">Manage students</p><div id="studentsList"></div></div></div><nav class="bottom-nav"><button class="nav-btn active" onclick="app.goTo('home')"><span class="nav-emoji">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('groups')"><span class="nav-emoji">👥</span>Groups</button><button class="nav-btn" id="ceoNavBtn" class="hidden" onclick="app.goTo('ceo')"><span class="nav-emoji">👑</span>CEO</button></nav></div><script>class App{constructor(){this.user=null;this.API=window.location.origin;this.isCEO=false}async init(){const saved=localStorage.getItem('aura_user');if(saved){this.user=JSON.parse(saved);this.isCEO=localStorage.getItem('isCEO')==='true';await this.loadStats();this.showApp()}await this.loadCourses()}async loadCourses(){try{const res=await fetch(this.API+'/api/courses');const data=await res.json();const select=document.getElementById('courseId');select.innerHTML='<option value="">Select Course</option>';(data.courses||[]).forEach(c=>{const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.name;select.appendChild(opt)})}catch(e){console.error('Courses load failed',e)}}toggleAuth(){document.getElementById('signIn').classList.toggle('hidden');document.getElementById('signUp').classList.toggle('hidden')}async register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regEmail').value;const courseId=parseInt(document.getElementById('courseId').value);const year=parseInt(document.getElementById('year').value);const res=await fetch(this.API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,courseId,year,university:'Zambia'})});const data=await res.json();if(data.success){this.user={email,name,course_id:courseId,year,id:data.student.id};localStorage.setItem('aura_user',JSON.stringify(this.user));this.isCEO=false;this.showApp()}else alert('Error: '+data.error)}async login(e){e.preventDefault();const email=document.getElementById('email').value;const res=await fetch(this.API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await res.json();if(data.success){this.user=data.student;this.isCEO=data.isCEO;localStorage.setItem('aura_user',JSON.stringify(this.user));localStorage.setItem('isCEO',this.isCEO);this.showApp()}else alert('Login failed')}showApp(){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('appScreen').classList.add('active');if(this.isCEO){document.getElementById('ceoNavBtn').classList.remove('hidden');this.loadStudents()}else{this.loadGroups()}this.loadStats()}async loadGroups(){try{const res=await fetch(this.API+\`/api/groups/\${this.user.course_id}/\${this.user.year}\`);const data=await res.json();const html=(data.groups||[]).map(g=>\`<div class="card"><div style="font-size:32px">👥</div><div style="color:#fbbf24;font-weight:700">\${g.group_name}</div><div style="font-size:13px;color:#94a3b8">\${g.member_count||0} members</div></div>\`).join('');document.getElementById('groupsList').innerHTML=html}catch(e){console.error('Groups load failed',e)}}async loadStudents(){try{const res=await fetch(this.API+'/ceo/students');const data=await res.json();const html=(data.students||[]).map(s=>\`<div class="ceo-card"><div><div class="student-name">\${s.name}</div><div class="student-email">\${s.email}</div></div><button class="unlock-btn" onclick="app.unlockStudent(\${s.id})">Unlock</button></div>\`).join('');document.getElementById('studentsList').innerHTML=html}catch(e){console.error('Students load failed',e)}}async unlockStudent(id){const res=await fetch(this.API+\`/ceo/unlock/\${id}\`,{method:'POST'});if((await res.json()).success){alert('✅ Unlocked!');this.loadStudents()}}async loadStats(){try{const res=await fetch(this.API+\`/api/stats/\${this.user.id}\`);const data=await res.json();document.getElementById('lvl').textContent=data.level;document.getElementById('pts').textContent=data.aura_points+'pts';document.getElementById('homeLevel').textContent=data.level}catch(e){console.error('Stats load failed',e)}}goTo(section){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(section)?.classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}logout(){localStorage.removeItem('aura_user');localStorage.removeItem('isCEO');location.reload()}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA COMPLETE on ' + PORT));
