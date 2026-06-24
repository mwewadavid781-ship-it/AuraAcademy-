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
    const { name, email, course, year } = req.body;
    const { data, error } = await supabase.from('students').insert([{
      name, email, university: 'Zambia', course_id: null, year,
      trial_end_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      is_locked: false
    }]).select();
    if (error) throw error;
    await supabase.from('student_stats').insert([{ student_id: data[0].id, aura_points: 0, level: 1 }]);
    res.json({ success: true, student: { ...data[0], course } });
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

app.get('/api/groups/:course/:year', async (req, res) => {
  try {
    const { course, year } = req.params;
    const { data, error } = await supabase.from('study_groups').select('*').eq('course_id', course).eq('year', year);
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
      trial_end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString()
    }).eq('id', req.params.studentId).select();
    if (error) throw error;
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA - Premium Study Platform</title><style>*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0e27;color:#f1f5f9;min-height:100vh;overflow-x:hidden}.gradient-bg{background:linear-gradient(135deg,#0a0e27 0%,#1a0a2e 50%,#16213e 100%);position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1}input,select,textarea{width:100%;padding:14px;margin:12px 0;border:1.5px solid rgba(168,85,247,0.3);border-radius:12px;font-size:15px;background:rgba(30,20,60,0.6);color:#f1f5f9;font-family:inherit;backdrop-filter:blur(10px);transition:all 0.3s}input:focus,select:focus,textarea:focus{outline:none;border-color:#a855f7;box-shadow:0 0 20px rgba(168,85,247,0.4);background:rgba(30,20,60,0.9)}.btn-primary{width:100%;background:linear-gradient(135deg,#a855f7,#ec4899);color:white;padding:14px;border:none;border-radius:12px;cursor:pointer;font-weight:700;margin-top:12px;font-size:15px;transition:all 0.3s;box-shadow:0 0 30px rgba(168,85,247,0.3)}. btn-primary:hover{transform:translateY(-2px);box-shadow:0 0 40px rgba(168,85,247,0.6);background:linear-gradient(135deg,#ec4899,#a855f7)}.hidden{display:none!important}#loginScreen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;position:relative}#loginScreen::before{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(168,85,247,0.1) 0%,transparent 70%);animation:float 20s ease-in-out infinite}@keyframes float{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,30px)}}.login-box{background:rgba(30,20,60,0.4);padding:40px;border-radius:20px;border:1px solid rgba(168,85,247,0.3);box-shadow:0 25px 60px rgba(0,0,0,0.5),0 0 60px rgba(168,85,247,0.2);width:100%;max-width:420px;backdrop-filter:blur(10px);position:relative;z-index:1;transform:perspective(1000px) rotateX(0deg);transition:all 0.3s}.logo{font-size:36px;font-weight:800;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px}p{color:#cbd5e1;margin-bottom:20px;font-size:14px}a{color:#a855f7;cursor:pointer;text-decoration:none;font-weight:600;transition:all 0.2s}a:hover{color:#ec4899;text-shadow:0 0 10px rgba(168,85,247,0.5)}.toggle{text-align:center;margin-top:20px;font-size:14px}#appScreen{display:none;flex-direction:column;min-height:100vh;position:relative}#appScreen.active{display:flex}.top-bar{background:linear-gradient(180deg,rgba(30,20,60,0.8) 0%,rgba(30,20,60,0.4) 100%);padding:20px;border-bottom:1px solid rgba(168,85,247,0.3);display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(10px);position:sticky;top:0;z-index:100;box-shadow:0 0 30px rgba(168,85,247,0.2)}.top-bar h1{font-size:24px;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.stats{display:flex;gap:12px;flex-wrap:wrap}.stat-badge{background:linear-gradient(135deg,rgba(168,85,247,0.3),rgba(236,72,153,0.3));border:1px solid rgba(168,85,247,0.5);padding:8px 14px;border-radius:20px;font-size:12px;color:#f1f5f9;font-weight:600;backdrop-filter:blur(10px);transition:all 0.3s;box-shadow:0 0 15px rgba(168,85,247,0.2)}. stat-badge:hover{transform:translateY(-2px);box-shadow:0 0 25px rgba(168,85,247,0.4)}.btn-logout{background:linear-gradient(135deg,#a855f7,#ec4899);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;transition:all 0.3s}.app-content{flex:1;overflow-y:auto;padding:24px;padding-bottom:100px;perspective:1000px}.section{display:none;animation:slideIn 0.5s ease-out}.section.active{display:block}.@keyframes slideIn{from{opacity:0;transform:translateY(20px);filter:blur(5px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}.page-title{font-size:32px;font-weight:800;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px}.page-subtitle{color:#cbd5e1;font-size:13px;margin-bottom:24px}.card{background:linear-gradient(135deg,rgba(168,85,247,0.1),rgba(236,72,153,0.1));padding:20px;border-radius:16px;border:1px solid rgba(168,85,247,0.3);margin-bottom:16px;transition:all 0.3s;backdrop-filter:blur(10px);box-shadow:0 0 20px rgba(168,85,247,0.1);transform:perspective(1000px) rotateY(0deg);cursor:pointer}.card:hover{transform:perspective(1000px) translateZ(20px) rotateY(5deg);border-color:rgba(168,85,247,0.6);box-shadow:0 0 40px rgba(168,85,247,0.3);background:linear-gradient(135deg,rgba(168,85,247,0.2),rgba(236,72,153,0.2))}.card-emoji{font-size:32px;margin-bottom:12px}.card-title{color:#f1f5f9;font-weight:700;font-size:16px;margin-bottom:4px}.card-meta{font-size:12px;color:#94a3b8}.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}.stat-box{background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.15));padding:20px;border-radius:16px;border:1px solid rgba(168,85,247,0.3);text-align:center;backdrop-filter:blur(10px);box-shadow:0 0 20px rgba(168,85,247,0.1);transition:all 0.3s}.stat-box:hover{transform:translateY(-8px);box-shadow:0 0 40px rgba(168,85,247,0.3)}.stat-number{font-size:36px;font-weight:800;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:4px}.stat-label{font-size:12px;color:#cbd5e1}.ceo-card{background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1));padding:16px;border-radius:12px;border-left:4px solid #a855f7;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(10px);transition:all 0.3s}.ceo-card:hover{border-left-color:#ec4899;box-shadow:0 0 30px rgba(168,85,247,0.2)}.student-info{flex:1}.student-name{color:#f1f5f9;font-weight:600;font-size:15px}.student-email{font-size:11px;color:#94a3b8;margin-top:2px}.unlock-btn{background:linear-gradient(135deg,#a855f7,#ec4899);color:white;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:11px;transition:all 0.3s}.unlock-btn:hover{transform:scale(1.05);box-shadow:0 0 20px rgba(168,85,247,0.4)}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:linear-gradient(180deg,rgba(30,20,60,0.6),rgba(30,20,60,0.95));border-top:1px solid rgba(168,85,247,0.3);display:flex;justify-content:space-around;padding:12px 0;backdrop-filter:blur(10px);box-shadow:0 -5px 30px rgba(0,0,0,0.5)}.nav-btn{background:none;border:none;color:#64748b;font-size:10px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;transition:all 0.3s}.nav-btn.active{color:#a855f7;text-shadow:0 0 10px rgba(168,85,247,0.5)}.nav-emoji{font-size:22px;transition:all 0.3s}.nav-btn.active .nav-emoji{filter:drop-shadow(0 0 8px rgba(168,85,247,0.6));transform:scale(1.2)}</style></head><body><div class="gradient-bg"></div><div id="loginScreen"><div class="login-box"><div class="logo">📚 AURA</div><p>Premium Study Platform for Zambian Students</p><div id="signIn"><form onsubmit="app.login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button class="btn-primary">Sign In</button></form><div class="toggle">New here? <a onclick="app.toggleAuth()">Create account</a></div></div><div id="signUp" class="hidden"><form onsubmit="app.register(event)"><input type="text" id="name" placeholder="Full Name" required><input type="email" id="regEmail" placeholder="Email" required><input type="text" id="course" placeholder="Your Course" required><select id="year" required><option value="">Select Year</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select><input type="password" id="regPass" placeholder="Password" required><button class="btn-primary">Create Account</button></form><div class="toggle"><a onclick="app.toggleAuth()">Back to Login</a></div></div></div></div><div id="appScreen"><div class="top-bar"><h1>📚 AURA</h1><div class="stats"><div class="stat-badge">L<span id="lvl">1</span></div><div class="stat-badge"><span id="pts">0pts</span></div><button class="btn-logout" onclick="app.logout()">Logout</button></div></div><div class="app-content"><div id="home" class="section active"><div class="page-title">Welcome to AURA 👋</div><p class="page-subtitle">Your premium study companion</p><div class="stats-grid"><div class="stat-box"><div class="stat-number" id="homeLevel">1</div><div class="stat-label">Level</div></div><div class="stat-box"><div class="stat-number" id="homePoints">0</div><div class="stat-label">Points</div></div></div><div class="card"><div class="card-emoji">🎯</div><div class="card-title">Quick Start</div><div class="card-meta">Upload PDFs, join groups, earn points</div></div></div><div id="groups" class="section"><div class="page-title">Study Groups 👥</div><p class="page-subtitle">Connect with your course mates</p><div id="groupsList"></div></div><div id="ceo" class="section"><div class="page-title">Admin Dashboard 👑</div><p class="page-subtitle">Manage premium access</p><div id="studentsList"></div></div></div><nav class="bottom-nav"><button class="nav-btn active" onclick="app.goTo('home')"><span class="nav-emoji">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('groups')"><span class="nav-emoji">👥</span>Groups</button><button class="nav-btn hidden" id="ceoBtn" onclick="app.goTo('ceo')"><span class="nav-emoji">👑</span>Admin</button></nav></div><script>class App{constructor(){this.user=null;this.course=null;this.API=window.location.origin}async init(){const saved=localStorage.getItem('aura_user');const course=localStorage.getItem('aura_course');if(saved&&course){this.user=JSON.parse(saved);this.course=course;this.showApp()}}async register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regEmail').value;const course=document.getElementById('course').value;const year=parseInt(document.getElementById('year').value);const res=await fetch(this.API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,course,year})});const data=await res.json();if(data.success){this.user={id:data.student.id,email,name,year};this.course=course;localStorage.setItem('aura_user',JSON.stringify(this.user));localStorage.setItem('aura_course',course);this.showApp()}else alert('❌ '+data.error)}async login(e){e.preventDefault();const email=document.getElementById('email').value;const res=await fetch(this.API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await res.json();if(data.success){this.user=data.student;this.course='';localStorage.setItem('aura_user',JSON.stringify(this.user));if(data.isCEO){document.getElementById('ceoBtn').classList.remove('hidden');this.showCEO()}else this.showApp()}else alert('❌ Login failed')}toggleAuth(){document.getElementById('signIn').classList.toggle('hidden');document.getElementById('signUp').classList.toggle('hidden')}showApp(){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('appScreen').classList.add('active');this.loadStats();this.loadGroups()}showCEO(){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('appScreen').classList.add('active');this.loadStats();this.loadStudents()}async loadGroups(){const res=await fetch(this.API+\`/api/groups/\${this.course}/\${this.user.year}\`);const data=await res.json();const groups=data.groups||[];const html=groups.length>0?groups.map(g=>\`<div class="card"><div class="card-emoji">👥</div><div class="card-title">\${g.group_name}</div><div class="card-meta">\${g.member_count||0} members</div></div>\`).join(''):'<div class="card"><p style="color:#94a3b8">Join your course group to get started</p></div>';document.getElementById('groupsList').innerHTML=html}async loadStudents(){const res=await fetch(this.API+'/ceo/students');const data=await res.json();const html=(data.students||[]).map(s=>\`<div class="ceo-card"><div class="student-info"><div class="student-name">\${s.name}</div><div class="student-email">\${s.email}</div></div><button class="unlock-btn" onclick="app.unlockStudent(\${s.id})">Unlock</button></div>\`).join('');document.getElementById('studentsList').innerHTML=html}async unlockStudent(id){const res=await fetch(this.API+\`/ceo/unlock/\${id}\`,{method:'POST'});if((await res.json()).success){alert('✅ Unlocked!');this.loadStudents()}}async loadStats(){const res=await fetch(this.API+\`/api/stats/\${this.user.id}\`);const data=await res.json();document.getElementById('lvl').textContent=data.level;document.getElementById('pts').textContent=data.aura_points+'pts';document.getElementById('homeLevel').textContent=data.level;document.getElementById('homePoints').textContent=data.aura_points}goTo(section){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(section)?.classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}logout(){localStorage.removeItem('aura_user');localStorage.removeItem('aura_course');location.reload()}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA PREMIUM 3D on ' + PORT));
