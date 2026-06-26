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

// CHECK SUBSCRIPTION (SERVER-SIDE PAYWALL)
async function checkSubscription(studentId) {
  try {
    const { data, error } = await supabase.from('students').select('trial_end_date, subscription_status').eq('id', studentId).single();
    if (error) throw error;
    const now = new Date();
    const trialEnd = new Date(data.trial_end_date);
    const isPremium = data.subscription_status === 'active' || now < trialEnd;
    return { isPremium, status: data.subscription_status, daysLeft: Math.ceil((trialEnd - now) / (1000*60*60*24)) };
  } catch (error) {
    return { isPremium: false, status: 'error', daysLeft: 0 };
  }
}

// AUTH
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, course, year } = req.body;
    const trialEnd = new Date(Date.now() + 7*24*60*60*1000);
    const { data, error } = await supabase.from('students').insert([{
      name, email, university: 'Zambia', course_id: null, year,
      trial_start_date: new Date().toISOString(),
      trial_end_date: trialEnd.toISOString(),
      subscription_status: 'trial',
      is_locked: false,
      study_streak: 0
    }]).select();
    if (error) throw error;
    await supabase.from('student_stats').insert([{ student_id: data[0].id, aura_points: 0, level: 1, correct_answers: 0 }]);
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
    const subStatus = await checkSubscription(data.id);
    res.json({ success: true, student: data, isPremium: subStatus.isPremium, daysLeft: subStatus.daysLeft });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PDF UPLOAD & SIMPLIFY
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentId, studentEmail } = req.body;
    const subStatus = await checkSubscription(studentId);
    if (!subStatus.isPremium) return res.status(403).json({ error: 'Premium feature - upgrade to continue', code: 'PREMIUM_ONLY' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    let text = '';
    try {
      const pdf = await pdfParse(req.file.buffer);
      text = pdf.text.replace(/\n\n+/g, '\n').replace(/\f/g, '').substring(0, 5000);
    } catch (e) {
      text = 'Study material';
    }

    const simplified = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `SIMPLIFY this into 5 KEY POINTS for exam revision:\n${text}\n\nFormat: Use bullet points, simple language, highlight definitions.` }],
      max_tokens: 600
    }).then(r => r.choices[0]?.message?.content || 'Summary generated');

    const { data, error } = await supabase.from('documents').insert([{
      student_email: studentEmail,
      file_name: req.file.originalname,
      summary: simplified,
      extracted_text: text,
      questions_count: 0,
      created_at: new Date().toISOString()
    }]).select();
    
    if (error) throw error;
    res.json({ success: true, document: data[0], summary: simplified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// EXPLAIN FEATURE (Premium)
app.post('/api/explain', async (req, res) => {
  try {
    const { studentId, topic } = req.body;
    const subStatus = await checkSubscription(studentId);
    if (!subStatus.isPremium) return res.status(403).json({ error: 'Premium feature', code: 'PREMIUM_ONLY' });
    
    const explanation = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `Explain "${topic}" like a tutor. Include:\n1. Simple explanation\n2. Real example\n3. Quick summary\n4. Likely exam question\n\nKeep it SHORT and clear.` }],
      max_tokens: 500
    }).then(r => r.choices[0]?.message?.content || 'Explanation');
    
    res.json({ success: true, explanation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// QUIZ GENERATION (Premium)
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { studentId, documentText, difficulty } = req.body;
    const subStatus = await checkSubscription(studentId);
    if (!subStatus.isPremium) return res.status(403).json({ error: 'Premium feature', code: 'PREMIUM_ONLY' });
    
    const prompt = difficulty === 'exam' 
      ? `Generate 5 HARD exam-style questions:\n${documentText.substring(0, 2000)}\n\nFormat: Q1) question? A) B) C) D) [Answer: X]`
      : `Generate 5 study questions:\n${documentText.substring(0, 2000)}\n\nFormat: Q1) question? A) B) C) D) [Answer: X]`;
    
    const questions = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800
    }).then(r => r.choices[0]?.message?.content || '');
    
    res.json({ success: true, questions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET RECENT UPLOADS
app.get('/api/documents/:studentEmail', async (req, res) => {
  try {
    const { data, error } = await supabase.from('documents').select('*').eq('student_email', req.params.studentEmail).order('created_at', { ascending: false }).limit(5);
    if (error) throw error;
    res.json({ documents: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PROGRESS & ANALYTICS
app.get('/api/progress/:studentId', async (req, res) => {
  try {
    const { data: stats } = await supabase.from('student_stats').select('*').eq('student_id', req.params.studentId).single();
    const { data: docs } = await supabase.from('documents').select('*');
    const { data: quizzes } = await supabase.from('answer_history').select('*').eq('student_id', req.params.studentId);
    
    const totalQuizzes = (quizzes || []).length;
    const correctAnswers = (quizzes || []).filter(q => q.is_correct).length;
    const score = totalQuizzes > 0 ? Math.round((correctAnswers / totalQuizzes) * 100) : 0;
    
    res.json({
      level: stats.level || 1,
      points: stats.aura_points || 0,
      uploads: (docs || []).length,
      quizzesTaken: totalQuizzes,
      studyScore: score,
      correctAnswers: correctAnswers
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET SUBSCRIPTION STATUS
app.get('/api/subscription/:studentId', async (req, res) => {
  try {
    const subStatus = await checkSubscription(req.params.studentId);
    const { data } = await supabase.from('students').select('trial_end_date, next_renewal_date, mtn_msisdn, study_streak').eq('id', req.params.studentId).single();
    res.json({
      isPremium: subStatus.isPremium,
      daysLeft: subStatus.daysLeft,
      status: subStatus.status,
      trialEnds: data.trial_end_date,
      renewalDate: data.next_renewal_date,
      mtnNumber: data.mtn_msisdn,
      streak: data.study_streak || 0
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PAYMENT INITIATE
app.post('/api/payment/initiate', async (req, res) => {
  try {
    const { studentId, msisdn } = req.body;
    const { error } = await supabase.from('students').update({
      mtn_msisdn: msisdn,
      payment_reference: `AURA-${Date.now()}`
    }).eq('id', studentId);
    if (error) throw error;
    res.json({ success: true, message: 'Payment initiated. Confirm on your MTN phone.', amount: 'K10', period: '1 week' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PAYMENT CONFIRM
app.post('/api/payment/confirm', async (req, res) => {
  try {
    const { studentId } = req.body;
    const nextRenewal = new Date(Date.now() + 7*24*60*60*1000);
    const { error } = await supabase.from('students').update({
      subscription_status: 'active',
      last_payment_date: new Date().toISOString(),
      next_renewal_date: nextRenewal.toISOString()
    }).eq('id', studentId);
    if (error) throw error;
    res.json({ success: true, message: '✅ Premium unlocked for 7 days!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// STATS
app.get('/api/stats/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_stats').select('*').eq('student_id', req.params.studentId).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// LEADERBOARD
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_stats').select('*, students(name)').order('aura_points', { ascending: false }).limit(10);
    if (error) throw error;
    res.json({ leaderboard: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// SERVE APP
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA Dashboard</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a24;color:#f1f5f9;overflow-x:hidden}#starfield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1}#app{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;overflow-y:auto}input,select{width:100%;padding:12px;margin:8px 0;border:1.5px solid rgba(74,242,161,0.3);border-radius:10px;font-size:14px;background:rgba(10,10,36,0.4);color:#f1f5f9;font-family:inherit;backdrop-filter:blur(8px)}input:focus{outline:none;border-color:#4AF2A1;box-shadow:0 0 15px rgba(74,242,161,0.5)}.btn{background:linear-gradient(135deg,#00FFCC,#4AF2A1);color:#0a0a24;padding:12px 24px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;box-shadow:0 0 15px rgba(74,242,161,0.4);transition:all 0.3s}.btn:hover{transform:translateY(-2px);box-shadow:0 0 25px rgba(74,242,161,0.6)}.hidden{display:none!important}.top-nav{background:rgba(10,10,36,0.6);padding:16px 20px;border-bottom:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(10px);position:sticky;top:0;z-index:50}.logo{font-size:22px;font-weight:800;text-shadow:0 0 15px rgba(74,242,161,0.3)}.nav-bar{display:flex;gap:12px;align-items:center}.badge{background:rgba(74,242,161,0.2);border:1px solid rgba(74,242,161,0.3);padding:6px 12px;border-radius:8px;font-size:11px;color:#4AF2A1;font-weight:600}.content{max-width:1200px;margin:0 auto;padding:20px;padding-bottom:120px}.section{display:none}.section.active{display:block}.page-title{font-size:28px;font-weight:800;margin-bottom:8px;text-shadow:0 0 15px rgba(74,242,161,0.3)}.subtitle{color:#cbd5e1;font-size:13px;margin-bottom:20px}.card{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:20px;backdrop-filter:blur(8px);margin-bottom:16px;transition:all 0.3s}.card:hover{border-color:rgba(74,242,161,0.4);box-shadow:0 0 20px rgba(74,242,161,0.15)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.stat-box{background:rgba(74,242,161,0.1);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:20px;text-align:center;backdrop-filter:blur(8px)}.stat-value{font-size:32px;font-weight:800;color:#4AF2A1;margin-bottom:6px}.stat-label{font-size:12px;color:#cbd5e1}.progress-bar{background:rgba(74,242,161,0.1);border-radius:8px;height:8px;margin:8px 0;overflow:hidden}.progress-fill{background:linear-gradient(90deg,#00FFCC,#4AF2A1);height:100%;transition:width 0.3s}.upload-zone{border:3px dashed rgba(74,242,161,0.4);border-radius:12px;padding:30px;text-align:center;cursor:pointer;background:rgba(74,242,161,0.05);margin-bottom:16px;transition:all 0.3s}.upload-zone:hover{border-color:rgba(74,242,161,0.6);background:rgba(74,242,161,0.1)}.upload-icon{font-size:40px;margin-bottom:8px}.upload-text{color:#cbd5e1;font-size:14px}#fileInput{display:none}.btn-group{display:flex;gap:8px;margin-top:12px}.btn-group .btn{flex:1;font-size:13px}.premium-card{background:linear-gradient(135deg,rgba(74,242,161,0.1),rgba(0,255,204,0.1));border:1.5px solid rgba(74,242,161,0.3);border-radius:12px;padding:24px;backdrop-filter:blur(8px);text-align:center}.premium-icon{font-size:36px;margin-bottom:12px}.premium-title{font-size:18px;font-weight:700;color:#4AF2A1;margin-bottom:8px}.premium-text{color:#cbd5e1;font-size:13px;margin-bottom:16px}.premium-price{font-size:24px;font-weight:800;color:#4AF2A1;margin-bottom:8px}.premium-period{color:#cbd5e1;font-size:12px;margin-bottom:16px}.locked-feature{opacity:0.6;pointer-events:none}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(10,10,36,0.7);border-top:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-around;padding:10px 0;backdrop-filter:blur(10px);z-index:100}.nav-btn{background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;transition:all 0.2s}.nav-btn.active{color:#4AF2A1;text-shadow:0 0 8px rgba(74,242,161,0.5)}.feature-list{list-style:none;margin:12px 0}.feature-list li{padding:8px 0;padding-left:24px;position:relative;font-size:13px;color:#cbd5e1}.feature-list li:before{content:"✓";position:absolute;left:0;color:#4AF2A1;font-weight:700}</style></head><body><canvas id="starfield"></canvas><div id="app"><div class="top-nav"><div class="logo">📚 AURA</div><div class="nav-bar"><div class="badge" id="premiumBadge">🔓 Premium Active</div><button class="btn" style="padding:6px 14px;font-size:12px" onclick="app.logout()">Logout</button></div></div><div class="content"><div id="landing" class="section active"><div class="page-title">Welcome to AURA! 🚀</div><p class="subtitle">Premium study platform for Zambian university students</p><div class="grid"><div class="card"><div style="font-size:32px">📚</div><div style="font-weight:700;color:#4AF2A1">Upload & Simplify</div><div style="font-size:13px;color:#cbd5e1;margin-top:8px">Upload PDFs, get AI summaries instantly</div></div><div class="card"><div style="font-size:32px">🎯</div><div style="font-weight:700;color:#4AF2A1">AI Quiz</div><div style="font-size:13px;color:#cbd5e1;margin-top:8px">Generate exam questions from notes</div></div><div class="card"><div style="font-size:32px">📊</div><div style="font-weight:700;color:#4AF2A1">Analytics</div><div style="font-size:13px;color:#cbd5e1;margin-top:8px">Track progress & weak topics</div></div></div><button class="btn" style="width:100%;margin-top:20px" onclick="app.goTo('dashboard')">Enter Dashboard</button></div><div id="dashboard" class="section"><div class="page-title">Dashboard 📊</div><p class="subtitle">Your study stats & quick actions</p><div class="grid" style="grid-template-columns:1fr"><div class="stat-box"><div style="font-size:48px" id="studyScore">--</div><div class="stat-label">Study Score</div><div class="progress-bar" style="margin-top:12px"><div class="progress-fill" id="scoreFill" style="width:50%"></div></div></div></div><div class="grid"><div class="stat-box"><div class="stat-value" id="dLevel">1</div><div class="stat-label">Level</div></div><div class="stat-box"><div class="stat-value" id="dPoints">0</div><div class="stat-label">Points</div></div><div class="stat-box"><div class="stat-value" id="dStreak">0</div><div class="stat-label">Day Streak</div></div></div><div class="card"><div style="margin-bottom:12px"><div style="font-weight:700;color:#4AF2A1;margin-bottom:6px">📄 Upload & Simplify</div><div class="upload-zone" onclick="document.getElementById('fileInput').click()"><div class="upload-icon">📄</div><div class="upload-text">Click to upload PDF</div><input type="file" id="fileInput" accept=".pdf" onchange="app.handleUpload(event)"></div><div id="uploadResult" class="hidden"><div style="background:rgba(74,242,161,0.15);border-radius:8px;padding:12px;margin:12px 0"><div style="color:#4AF2A1;font-weight:700;margin-bottom:8px">✅ Simplified Summary:</div><div id="summaryText" style="font-size:13px;color:#cbd5e1;line-height:1.6"></div></div><button class="btn" style="width:100%;margin-top:8px" onclick="app.generateQuiz()">📝 Generate Quiz from This</button></div></div></div><div class="card"><div style="font-weight:700;color:#4AF2A1;margin-bottom:12px">📚 Recent Uploads</div><div id="recentUploads"><div style="color:#cbd5e1;font-size:13px">No uploads yet. Start by uploading a PDF!</div></div></div><div class="premium-card" id="premiumCard"><div class="premium-icon">💎</div><div class="premium-title">Unlock Premium</div><div class="premium-text">Get unlimited AI, deep analytics, and exam predictions</div><div class="premium-price">K10</div><div class="premium-period">/week (7-day free trial)</div><button class="btn" style="width:100%" onclick="app.goTo('payment')">Upgrade Now</button></div></div><div id="payment" class="section"><div class="page-title">💳 Premium Upgrade</div><p class="subtitle">K10/week gives you:</p><ul class="feature-list"><li>Unlimited PDF uploads & AI simplification</li><li>Unlimited quiz generation (exam-style questions)</li><li>AI explanation for any topic</li><li>Deep progress analytics & weak topic detection</li><li>Study planner & deadline tracking</li><li>Leaderboard & achievement badges</li></ul><div class="card"><div style="margin-bottom:16px"><div style="font-weight:700;color:#4AF2A1;margin-bottom:12px">Enter MTN Number</div><input type="tel" id="mtnNumber" placeholder="0964969767" value="0964969767"><div style="font-size:12px;color:#cbd5e1;margin-top:8px">You will receive a prompt to confirm payment on your phone</div></div><button class="btn" style="width:100%" onclick="app.initiatePayment()">Pay K10 Now</button></div><div style="text-align:center;margin-top:20px;color:#cbd5e1;font-size:12px">Have a 7-day free trial? <a onclick="app.confirmTrial()" style="color:#4AF2A1;cursor:pointer;text-decoration:underline">Start Free Trial</a></div></div><div id="leaderboard" class="section"><div class="page-title">🏆 Top Students</div><p class="subtitle">Compete & climb rankings</p><div id="leaderboardList"></div></div></div><nav class="bottom-nav"><button class="nav-btn active" onclick="app.goTo('dashboard')"><span style="font-size:18px">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('leaderboard')"><span style="font-size:18px">🏆</span>Leaderboard</button><button class="nav-btn" onclick="app.goTo('payment')"><span style="font-size:18px">💎</span>Premium</button></nav></div><script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.143.0/build/three.module.js"}}</script><script type="module">import*as THREE from'three';const canvas=document.getElementById('starfield');const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(window.devicePixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);renderer.setClearColor(0x0a0a24);const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);camera.position.z=5;const geo=new THREE.BufferGeometry();const count=4200;let pos=new Float32Array(count*3);let col=new Float32Array(count*3);const c1=new THREE.Color(0xaef6cf),c2=new THREE.Color(0x5fe6a0),c3=new THREE.Color(0xeafff2);for(let i=0;i<count;i++){pos[i*3]=(Math.random()-0.5)*24;pos[i*3+1]=(Math.random()-0.5)*16;pos[i*3+2]=(Math.random()-0.5)*30;let c=Math.floor(Math.random()*3);let color=c===0?c1:c===1?c2:c3;let b=0.7+Math.random()*0.6;col[i*3]=color.r*b;col[i*3+1]=color.g*b;col[i*3+2]=color.b*b;}geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));const mat=new THREE.PointsMaterial({size:0.15,vertexColors:true,transparent:true});const stars=new THREE.Points(geo,mat);scene.add(stars);function animate(){requestAnimationFrame(animate);stars.rotation.z+=0.00005;renderer.render(scene,camera);}animate();</script><script>class App{constructor(){this.user=null;this.API=window.location.origin}async init(){const saved=localStorage.getItem('aura_user');if(saved){this.user=JSON.parse(saved);await this.loadDashboard()}else this.goTo('landing')}async loadDashboard(){const sub=await fetch(this.API+\`/api/subscription/\${this.user.id}\`).then(r=>r.json());document.getElementById('premiumBadge').textContent=sub.isPremium?'🔓 Premium ('+sub.daysLeft+' days)':'⏳ Trial ('+sub.daysLeft+' days)';const prog=await fetch(this.API+\`/api/progress/\${this.user.id}\`).then(r=>r.json());document.getElementById('studyScore').textContent=prog.studyScore+'%';document.getElementById('scoreFill').style.width=prog.studyScore+'%';document.getElementById('dLevel').textContent=prog.level;document.getElementById('dPoints').textContent=prog.points;document.getElementById('dStreak').textContent=sub.streak;const docs=await fetch(this.API+\`/api/documents/\${this.user.email}\`).then(r=>r.json());const html=docs.documents.map(d=>\`<div class="card" style="margin-bottom:8px"><div style="font-size:13px;color:#cbd5e1"><strong>\${d.file_name}</strong></div></div>\`).join('');document.getElementById('recentUploads').innerHTML=html||'<div style="color:#cbd5e1;font-size:13px">No uploads yet</div>';const lb=await fetch(this.API+'/api/leaderboard').then(r=>r.json());const lbHtml=lb.leaderboard.map((s,i)=>\`<div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between"><div><div style="font-weight:700;color:#4AF2A1">#\${i+1}</div></div><div><div style="color:#cbd5e1">ID: \${s.student_id}</div><div style="color:#4AF2A1;font-weight:700">\${s.aura_points}pts</div></div></div></div>\`).join('');document.getElementById('leaderboardList').innerHTML=lbHtml}async handleUpload(e){const file=e.target.files[0];if(!file)return;const sub=await fetch(this.API+\`/api/subscription/\${this.user.id}\`).then(r=>r.json());if(!sub.isPremium)return alert('⏳ Upgrade to premium to upload PDFs!');const fd=new FormData();fd.append('file',file);fd.append('studentId',this.user.id);fd.append('studentEmail',this.user.email);const res=await fetch(this.API+'/api/upload',{method:'POST',body:fd}).then(r=>r.json());if(res.success){document.getElementById('summaryText').textContent=res.summary;document.getElementById('uploadResult').classList.remove('hidden');this.loadDashboard()}else alert('Error: '+res.error)}async generateQuiz(){alert('✅ Quiz generation coming next phase!')}async initiatePayment(){const mtn=document.getElementById('mtnNumber').value;if(!mtn)return alert('Enter MTN number');const res=await fetch(this.API+'/api/payment/initiate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:this.user.id,msisdn:mtn})}).then(r=>r.json());if(res.success){alert('Check your phone for payment prompt!\n'+res.message);setTimeout(()=>this.confirmPayment(),3000)}}async confirmPayment(){await fetch(this.API+'/api/payment/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:this.user.id})});alert('✅ Premium unlocked!');this.loadDashboard();this.goTo('dashboard')}confirmTrial(){alert('✅ 7-day free trial started!\n\nYou have full premium access for 7 days.');this.loadDashboard();this.goTo('dashboard')}goTo(section){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(section).classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}logout(){localStorage.removeItem('aura_user');window.location.reload()}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA ULTIMATE DASHBOARD on ' + PORT));
