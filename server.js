const express = require('express');
const cors = require('cors');
const path = require('path');
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
    res.json({ success: true, student: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PDF UPLOAD & AI SIMPLIFICATION
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file' });
    
    let text = '';
    try {
      const pdf = await pdfParse(req.file.buffer);
      text = pdf.text.substring(0, 4000);
    } catch (e) {
      text = 'Study material';
    }

    const simplified = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `Simplify this into 5 key points:\n${text}` }],
      max_tokens: 500
    }).then(r => r.choices[0]?.message?.content || 'Summary');

    const { data, error } = await supabase.from('documents').insert([{
      student_email: studentEmail,
      file_name: req.file.originalname,
      summary: simplified,
      extracted_text: text,
      questions_count: 0
    }]).select();
    
    if (error) throw error;
    res.json({ success: true, document: data[0], summary: simplified });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

app.post('/api/groups', async (req, res) => {
  try {
    const { course, year, groupName } = req.body;
    const { data, error } = await supabase.from('study_groups').insert([{
      course_id: course, year, group_name: groupName
    }]).select();
    if (error) throw error;
    res.json({ success: true, group: data[0] });
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

app.get('/api/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_stats').select('*').order('aura_points', { ascending: false }).limit(10);
    if (error) throw error;
    res.json({ leaderboard: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// SERVE FRONTEND
app.get('/landing', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;font-family:system-ui,sans-serif}#starfield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1}#ui{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;overflow-y:auto;pointer-events:none}#ui>*{pointer-events:auto}.hidden{display:none!important}input,select,button{font-family:inherit}input,select{width:100%;padding:14px;margin:12px 0;border:1.5px solid rgba(74,242,161,0.3);border-radius:12px;font-size:15px;background:rgba(10,10,36,0.4);color:#f1f5f9;backdrop-filter:blur(8px);transition:all 0.3s}input:focus,select:focus{outline:none;border-color:#4AF2A1;box-shadow:0 0 15px rgba(74,242,161,0.5)}.btn{background:linear-gradient(135deg,#00FFCC,#4AF2A1);color:#0a0a24;padding:14px 24px;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:15px;box-shadow:0 0 20px rgba(74,242,161,0.5);transition:all 0.3s}.btn:hover{transform:translateY(-2px);box-shadow:0 0 30px rgba(74,242,161,0.8)}.landing{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;color:#f1f5f9}.hero{max-width:800px;margin-bottom:60px}.hero-title{font-size:48px;font-weight:800;margin-bottom:20px;text-shadow:0 0 30px rgba(74,242,161,0.4)}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:1000px;margin-bottom:60px}.card{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:14px;padding:28px;backdrop-filter:blur(8px);transition:all 0.3s}.card:hover{border-color:rgba(74,242,161,0.4);box-shadow:0 0 30px rgba(74,242,161,0.2)}.card-icon{font-size:40px;margin-bottom:16px}.card-title{font-size:18px;font-weight:700;color:#4AF2A1;margin-bottom:8px}.card-text{font-size:14px;color:#cbd5e1}.pricing{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:16px;padding:40px;max-width:600px;margin-bottom:60px;backdrop-filter:blur(8px)}.pricing-title{font-size:28px;font-weight:800;margin-bottom:24px;color:#4AF2A1}.pricing-item{text-align:left;margin:16px 0;padding:12px 0;border-bottom:1px solid rgba(74,242,161,0.1)}.pricing-value{font-size:24px;font-weight:700;color:#4AF2A1}.cta-buttons{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}.btn-large{padding:16px 40px;font-size:16px;width:auto;min-width:180px}.auth-box{background:rgba(10,10,36,0.25);padding:40px;border-radius:20px;border:1.5px solid rgba(74,242,161,0.25);box-shadow:0 0 50px rgba(74,242,161,0.1);width:100%;max-width:420px;backdrop-filter:blur(12px);margin:0 auto}.logo{font-size:36px;font-weight:800;color:#f1f5f9;margin-bottom:12px;text-shadow:0 0 20px rgba(74,242,161,0.4)}.toggle{text-align:center;margin-top:20px;font-size:14px}a{color:#4AF2A1;cursor:pointer;text-decoration:none;font-weight:600}.top-nav{background:rgba(10,10,36,0.5);padding:16px 24px;border-bottom:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(10px)}.content{max-width:1200px;margin:0 auto;padding:24px;padding-bottom:120px}.section{display:none}.section.active{display:block}.page-title{font-size:32px;font-weight:800;color:#f1f5f9;margin-bottom:8px;text-shadow:0 0 20px rgba(74,242,161,0.3)}.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-bottom:24px}.stat-card{background:rgba(74,242,161,0.1);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:24px;text-align:center;backdrop-filter:blur(8px)}.stat-value{font-size:32px;font-weight:800;color:#4AF2A1}.stat-label{font-size:13px;color:#cbd5e1;margin-top:8px}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(10,10,36,0.6);border-top:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-around;padding:8px 0;backdrop-filter:blur(10px);z-index:100}.nav-btn{background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;transition:all 0.2s}.nav-btn.active{color:#4AF2A1;text-shadow:0 0 8px rgba(74,242,161,0.5)}.upload-zone{border:3px dashed rgba(74,242,161,0.4);border-radius:14px;padding:40px;text-align:center;cursor:pointer;background:rgba(74,242,161,0.05);margin-bottom:20px;transition:all 0.3s}.upload-zone:hover{border-color:rgba(74,242,161,0.6);background:rgba(74,242,161,0.1)}.upload-icon{font-size:48px;margin-bottom:12px}.upload-text{color:#cbd5e1}#fileInput{display:none}</style></head><body><canvas id="starfield"></canvas><div id="ui"><div id="landingPage"><div class="top-nav"><div style="font-size:24px;font-weight:800;color:#f1f5f9;text-shadow:0 0 15px rgba(74,242,161,0.3)">📚 AURA</div></div><div class="landing"><div class="hero"><div class="hero-title">AURA</div><p style="font-size:16px;color:#cbd5e1;margin-bottom:40px">Premium Study Platform for Zambian University Students</p></div><div class="features"><div class="card"><div class="card-icon">👥</div><div class="card-title">Study Groups</div><div class="card-text">Connect with classmates</div></div><div class="card"><div class="card-icon">📚</div><div class="card-title">Upload & Simplify</div><div class="card-text">AI simplifies your PDFs</div></div><div class="card"><div class="card-icon">🏆</div><div class="card-title">Gamification</div><div class="card-text">Earn points & badges</div></div><div class="card"><div class="card-icon">💬</div><div class="card-title">Real Chat</div><div class="card-text">Message classmates</div></div><div class="card"><div class="card-icon">📊</div><div class="card-title">Analytics</div><div class="card-text">Track your progress</div></div><div class="card"><div class="card-icon">💰</div><div class="card-title">Earn Money</div><div class="card-text">Tutor & sell notes</div></div></div><div class="pricing"><div class="pricing-title">Simple Pricing</div><div class="pricing-item"><div>First 7 Days</div><div class="pricing-value">FREE</div></div><div class="pricing-item"><div>After Trial</div><div class="pricing-value">K10/week</div></div></div><div class="cta-buttons"><button class="btn btn-large" onclick="app.goToAuth('signin')">SIGN IN</button><button class="btn btn-large" onclick="app.goToAuth('signup')">START FREE</button></div></div></div><div id="authPage" class="hidden"><div class="top-nav"><a onclick="app.goToLanding()" style="color:#4AF2A1;cursor:pointer">← Back</a></div><div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px"><div class="auth-box"><div class="logo">📚 AURA</div><div id="signInForm"><p style="color:#cbd5e1;margin-bottom:20px">Welcome back</p><form onsubmit="app.login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button class="btn" style="width:100%">SIGN IN</button></form><div class="toggle">No account? <a onclick="app.toggleAuth()">Create one</a></div></div><div id="signUpForm" class="hidden"><p style="color:#cbd5e1;margin-bottom:20px">Join AURA</p><form onsubmit="app.register(event)"><input type="text" id="name" placeholder="Full Name" required><input type="email" id="regEmail" placeholder="Email" required><input type="text" id="course" placeholder="Your Course" required><select id="year" required><option value="">Select Year</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select><input type="password" id="regPass" placeholder="Password" required><button class="btn" style="width:100%">CREATE</button></form><div class="toggle">Have account? <a onclick="app.toggleAuth()">Sign in</a></div></div></div></div></div><div id="dashboardPage" class="hidden"><div class="top-nav"><div class="logo" style="font-size:20px">📚 AURA</div><button class="btn" style="padding:6px 16px;font-size:12px" onclick="app.logout()">Logout</button></div><div class="content"><div id="home" class="section active"><div class="page-title">Welcome! 👋</div><div class="stats-grid"><div class="stat-card"><div class="stat-value" id="dLevel">1</div><div class="stat-label">Level</div></div><div class="stat-card"><div class="stat-value" id="dPoints">0</div><div class="stat-label">Points</div></div></div><div class="page-title" style="font-size:24px;margin-top:40px">Upload & Simplify 📚</div><div class="upload-zone" onclick="document.getElementById('fileInput').click()"><div class="upload-icon">📄</div><div class="upload-text">Click to upload PDF</div><input type="file" id="fileInput" accept=".pdf" onchange="app.handleFileUpload(event)"></div><div id="uploadResult" class="hidden" style="background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:20px"><div style="color:#4AF2A1;font-weight:700;margin-bottom:12px">Simplified Summary:</div><div id="summaryText" style="color:#cbd5e1;line-height:1.6"></div></div></div><div id="groups" class="section"><div class="page-title">Study Groups 👥</div><div id="groupsList"></div></div></div><nav class="bottom-nav"><button class="nav-btn active" onclick="app.goTo('home')"><span style="font-size:20px">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('groups')"><span style="font-size:20px">👥</span>Groups</button></nav></div></div></div><script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.143.0/build/three.module.js"}}</script><script type="module">import*as THREE from'three';const canvas=document.getElementById('starfield');const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(window.devicePixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);renderer.setClearColor(0x0a0a24);const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);camera.position.z=5;const starsGeometry=new THREE.BufferGeometry();const count=4200;const depth=30;let positions=new Float32Array(count*3);let colors=new Float32Array(count*3);const colorA=new THREE.Color(0xaef6cf);const colorB=new THREE.Color(0x5fe6a0);const colorC=new THREE.Color(0xeafff2);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-0.5)*24;positions[i*3+1]=(Math.random()-0.5)*16;positions[i*3+2]=(Math.random()-0.5)*30;let palette=Math.floor(Math.random()*3);let color=palette===0?colorA:palette===1?colorB:colorC;let bright=0.7+Math.random()*0.6;colors[i*3]=color.r*bright;colors[i*3+1]=color.g*bright;colors[i*3+2]=color.b*bright;}starsGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));starsGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));const starsMaterial=new THREE.PointsMaterial({size:0.15,vertexColors:true,transparent:true,sizeAttenuation:true});const stars=new THREE.Points(starsGeometry,starsMaterial);scene.add(stars);function animate(){requestAnimationFrame(animate);stars.rotation.z+=0.0001;renderer.render(scene,camera);}animate();</script><script>class App{constructor(){this.user=null;this.API=window.location.origin}async init(){const saved=localStorage.getItem('aura_user');if(saved){this.user=JSON.parse(saved);this.loadStats();this.loadGroups();this.showDashboard()}else this.showLanding()}goToLanding(){document.getElementById('landingPage').classList.remove('hidden');document.getElementById('authPage').classList.add('hidden');document.getElementById('dashboardPage').classList.add('hidden')}goToAuth(f){document.getElementById('landingPage').classList.add('hidden');document.getElementById('authPage').classList.remove('hidden');if(f==='signin'){document.getElementById('signInForm').classList.remove('hidden');document.getElementById('signUpForm').classList.add('hidden')}else{document.getElementById('signInForm').classList.add('hidden');document.getElementById('signUpForm').classList.remove('hidden')}}toggleAuth(){document.getElementById('signInForm').classList.toggle('hidden');document.getElementById('signUpForm').classList.toggle('hidden')}async register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regEmail').value;const course=document.getElementById('course').value;const year=parseInt(document.getElementById('year').value);const res=await fetch(this.API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,course,year})});const data=await res.json();if(data.success){this.user={id:data.student.id,email,name,year,course};localStorage.setItem('aura_user',JSON.stringify(this.user));this.loadStats();this.showDashboard()}else alert('Error: '+data.error)}async login(e){e.preventDefault();const email=document.getElementById('email').value;const res=await fetch(this.API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await res.json();if(data.success){this.user=data.student;localStorage.setItem('aura_user',JSON.stringify(this.user));this.loadStats();this.showDashboard()}else alert('Login failed')}async loadStats(){const res=await fetch(this.API+\`/api/stats/\${this.user.id}\`);const data=await res.json();document.getElementById('dLevel').textContent=data.level;document.getElementById('dPoints').textContent=data.aura_points}async loadGroups(){const res=await fetch(this.API+\`/api/groups/\${this.user.course}/\${this.user.year}\`);const data=await res.json();const html=(data.groups||[]).map(g=>\`<div class="card" style="margin-bottom:12px"><div style="font-size:28px">👥</div><div style="color:#4AF2A1;font-weight:700">\${g.group_name}</div><div style="font-size:13px;color:#cbd5e1">\${g.member_count||0} members</div></div>\`).join('');document.getElementById('groupsList').innerHTML=html||'<div class="card">No groups yet</div>'}async handleFileUpload(e){const file=e.target.files[0];if(!file)return;const fd=new FormData();fd.append('file',file);fd.append('studentEmail',this.user.email);const res=await fetch(this.API+'/api/upload',{method:'POST',body:fd});const data=await res.json();if(data.success){document.getElementById('summaryText').textContent=data.summary;document.getElementById('uploadResult').classList.remove('hidden')}else alert('Error: '+data.error)}showDashboard(){document.getElementById('landingPage').classList.add('hidden');document.getElementById('authPage').classList.add('hidden');document.getElementById('dashboardPage').classList.remove('hidden')}showLanding(){document.getElementById('landingPage').classList.remove('hidden');document.getElementById('authPage').classList.add('hidden');document.getElementById('dashboardPage').classList.add('hidden')}goTo(s){document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));document.getElementById(s)?.classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}logout(){localStorage.removeItem('aura_user');this.showLanding()}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA FINAL FIXED on ' + PORT));
