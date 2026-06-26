const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA - Premium Study Platform</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;scroll-behavior:smooth}#starfield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1}#content{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;overflow-y:auto;overflow-x:hidden}input,select,textarea{width:100%;padding:14px;margin:12px 0;border:1.5px solid rgba(74,242,161,0.3);border-radius:12px;font-size:15px;background:rgba(10,10,36,0.4);color:#f1f5f9;font-family:inherit;backdrop-filter:blur(8px);transition:all 0.3s}input::placeholder{color:rgba(74,242,161,0.4)}input:focus,select:focus{outline:none;border-color:#4AF2A1;box-shadow:0 0 15px rgba(74,242,161,0.5);background:rgba(10,10,36,0.6)}.btn-primary{background:linear-gradient(135deg,#00FFCC,#4AF2A1);color:#0a0a24;padding:14px;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:15px;box-shadow:0 0 20px rgba(74,242,161,0.5),0 0 40px rgba(0,255,204,0.2);transition:all 0.3s}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 0 30px rgba(74,242,161,0.8),0 0 60px rgba(0,255,204,0.4)}.hidden{display:none!important}.landing-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;color:#f1f5f9}.hero{margin-bottom:60px;max-width:800px}.hero-logo{font-size:64px;margin-bottom:20px}.hero-title{font-size:48px;font-weight:800;color:#f1f5f9;margin-bottom:12px;text-shadow:0 0 30px rgba(74,242,161,0.4)}.hero-subtitle{font-size:18px;color:#cbd5e1;margin-bottom:32px}.cta-buttons{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:80px}.btn-large{padding:16px 40px;font-size:16px;width:auto;min-width:180px}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:1000px;margin-bottom:80px}.feature-card{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:16px;padding:28px;backdrop-filter:blur(8px);transition:all 0.3s}.feature-card:hover{border-color:rgba(74,242,161,0.4);box-shadow:0 0 30px rgba(74,242,161,0.2)}.feature-icon{font-size:40px;margin-bottom:16px}.feature-title{font-size:18px;font-weight:700;color:#4AF2A1;margin-bottom:8px}.feature-text{font-size:14px;color:#cbd5e1}.pricing{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:16px;padding:40px;max-width:600px;backdrop-filter:blur(8px)}.pricing-title{font-size:28px;font-weight:800;margin-bottom:24px;color:#4AF2A1}.pricing-item{text-align:left;margin:16px 0;padding:12px 0;border-bottom:1px solid rgba(74,242,161,0.1)}.pricing-item:last-child{border-bottom:none}.price-label{color:#cbd5e1;font-size:14px}.price-value{font-size:24px;font-weight:700;color:#4AF2A1}.login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.login-box{background:rgba(10,10,36,0.25);padding:40px;border-radius:20px;border:1.5px solid rgba(74,242,161,0.25);box-shadow:0 0 50px rgba(74,242,161,0.1);width:100%;max-width:420px;backdrop-filter:blur(12px)}.logo{font-size:36px;font-weight:800;color:#f1f5f9;margin-bottom:4px;text-shadow:0 0 20px rgba(74,242,161,0.4)}.logo-sub{font-size:12px;color:rgba(74,242,161,0.8);margin-bottom:24px;font-weight:600;letter-spacing:1px}p{color:#cbd5e1;margin-bottom:20px;font-size:14px}a{color:#4AF2A1;cursor:pointer;text-decoration:none;font-weight:600;transition:all 0.2s}a:hover{color:#00FFCC;text-shadow:0 0 10px rgba(74,242,161,0.6)}.toggle{text-align:center;margin-top:20px;font-size:14px}.login-input{width:100%}.btn-login{width:100%}.auth-form{display:none}.auth-form.active{display:block}.top-bar{background:rgba(10,10,36,0.4);padding:20px;border-bottom:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(10px);box-shadow:0 0 20px rgba(74,242,161,0.1)}.top-bar h1{font-size:24px;color:#f1f5f9;text-shadow:0 0 15px rgba(74,242,161,0.3)}.app-content{padding:24px;padding-bottom:100px;color:#f1f5f9;max-width:1200px;margin:0 auto}.section{display:none}.section.active{display:block}.page-title{font-size:32px;font-weight:800;color:#f1f5f9;margin-bottom:8px;text-shadow:0 0 20px rgba(74,242,161,0.3)}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(10,10,36,0.5);border-top:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-around;padding:12px 0;backdrop-filter:blur(10px);z-index:11;box-shadow:0 -5px 20px rgba(74,242,161,0.1)}.nav-btn{background:none;border:none;color:#64748b;font-size:10px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;transition:all 0.3s}.nav-btn.active{color:#4AF2A1;text-shadow:0 0 10px rgba(74,242,161,0.5)}</style></head><body><canvas id="starfield"></canvas><div id="content"><div id="landingPage" class="landing-page"><div class="hero"><div class="hero-logo">📚</div><div class="hero-title">AURA</div><div class="hero-subtitle">Experience the future of learning</div><p style="font-size:16px;color:#cbd5e1;margin-bottom:40px">Premium Study Platform for Zambian University Students</p></div><div class="features"><div class="feature-card"><div class="feature-icon">👥</div><div class="feature-title">Study Groups</div><div class="feature-text">Connect with students in your course and year. Join study groups, chat, share notes, and learn together.</div></div><div class="feature-card"><div class="feature-icon">🎯</div><div class="feature-title">AI-Powered Questions</div><div class="feature-text">Upload PDFs and get instant AI-generated study questions. Learn smarter with personalized practice.</div></div><div class="feature-card"><div class="feature-icon">🏆</div><div class="feature-title">Gamification</div><div class="feature-text">Earn AURA points, unlock badges, and climb the leaderboard. Study becomes an adventure.</div></div><div class="feature-card"><div class="feature-icon">💬</div><div class="feature-title">Group Chat</div><div class="feature-text">Real-time messaging, voice notes, and PDF sharing. Collaborate seamlessly with classmates.</div></div><div class="feature-card"><div class="feature-icon">💰</div><div class="feature-title">Earn Money</div><div class="feature-text">Tutor classmates, complete micro-tasks, and sell notes. Study AND earn simultaneously.</div></div><div class="feature-card"><div class="feature-icon">📊</div><div class="feature-title">Progress Tracking</div><div class="feature-text">See detailed analytics of your learning. Track speed, accuracy, and mastery by concept.</div></div></div><div class="pricing"><div class="pricing-title">💎 Simple Pricing</div><div class="pricing-item"><div class="price-label">First 7 Days</div><div class="price-value">FREE</div></div><div class="pricing-item"><div class="price-label">After Trial</div><div class="price-value">K10/week</div></div><div class="pricing-item"><div class="price-label">Payment Method</div><div class="price-value">MTN Mobile Money</div></div></div><div class="cta-buttons" style="margin-top:60px"><button class="btn-primary btn-large" onclick="app.goToAuth('signin')">SIGN IN</button><button class="btn-primary btn-large" onclick="app.goToAuth('signup')">START FREE TRIAL</button></div></div><div id="authPage" class="login-screen hidden"><div class="login-box"><a style="position:absolute;top:20px;left:20px;font-size:24px;cursor:pointer" onclick="app.goToLanding()">←</a><div class="logo">📚 AURA</div><div class="logo-sub">CYBERPUNK STUDY PLATFORM</div><div id="signInForm" class="auth-form active"><p>Welcome back</p><form onsubmit="app.login(event)"><input class="login-input" type="email" id="email" placeholder="Email" required><input class="login-input" type="password" id="pass" placeholder="Password" required><button class="btn-primary btn-login">SIGN IN</button></form><div class="toggle">No account? <a onclick="app.toggleAuthForm()">Create one</a></div></div><div id="signUpForm" class="auth-form"><p>Join AURA today</p><form onsubmit="app.register(event)"><input class="login-input" type="text" id="name" placeholder="Full Name" required><input class="login-input" type="email" id="regEmail" placeholder="Email" required><input class="login-input" type="text" id="course" placeholder="Your Course" required><select class="login-input" id="year" required><option value="">Select Year</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select><input class="login-input" type="password" id="regPass" placeholder="Password" required><button class="btn-primary btn-login">CREATE ACCOUNT</button></form><div class="toggle">Have account? <a onclick="app.toggleAuthForm()">Sign in</a></div></div></div></div><div id="dashboardPage" class="hidden" style="min-height:100vh"><div class="top-bar"><h1>📚 AURA</h1><button class="btn-primary" style="padding:8px 16px;font-size:12px;width:auto" onclick="app.logout()">Logout</button></div><div class="app-content"><div id="dashboard" class="section active"><div class="page-title">Welcome to AURA! 🎮</div><p style="color:#cbd5e1;margin-bottom:40px">Your cyberpunk study companion is ready</p><div style="background:rgba(74,242,161,0.1);border:1.5px solid rgba(74,242,161,0.2);border-radius:16px;padding:30px;text-align:center"><div style="font-size:48px;font-weight:800;color:#4AF2A1;margin-bottom:8px" id="dLevel">1</div><div style="color:#cbd5e1;margin-bottom:30px">Level</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:rgba(74,242,161,0.15);padding:16px;border-radius:12px;border:1px solid rgba(74,242,161,0.2)"><div id="dPoints" style="font-size:28px;font-weight:700;color:#4AF2A1">0</div><div style="color:#cbd5e1;font-size:12px;margin-top:8px">AURA Points</div></div><div style="background:rgba(74,242,161,0.15);padding:16px;border-radius:12px;border:1px solid rgba(74,242,161,0.2)"><div id="dBadges" style="font-size:28px;font-weight:700;color:#4AF2A1">0</div><div style="color:#cbd5e1;font-size:12px;margin-top:8px">Badges Earned</div></div></div></div></div></div></div></div><script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.143.0/build/three.module.js"}}</script><script type="module">import*as THREE from'three';const canvas=document.getElementById('starfield');const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(window.devicePixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);renderer.setClearColor(0x0a0a24);const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);camera.position.z=5;const starsGeometry=new THREE.BufferGeometry();const count=4200;const depth=30;let positions=new Float32Array(count*3);let colors=new Float32Array(count*3);let sizes=new Float32Array(count);const colorA=new THREE.Color(0xaef6cf);const colorB=new THREE.Color(0x5fe6a0);const colorC=new THREE.Color(0xeafff2);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-0.5)*24;positions[i*3+1]=(Math.random()-0.5)*16;positions[i*3+2]=(Math.random()-0.5)*30;let palette=Math.floor(Math.random()*3);let color=palette===0?colorA:palette===1?colorB:colorC;let bright=0.7+Math.random()*0.6;colors[i*3]=color.r*bright;colors[i*3+1]=color.g*bright;colors[i*3+2]=color.b*bright;sizes[i]=0.5+Math.pow(Math.random(),1.4)*2.5;}starsGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));starsGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));starsGeometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));const starsMaterial=new THREE.PointsMaterial({size:0.15,vertexColors:true,transparent:true,sizeAttenuation:true});const stars=new THREE.Points(starsGeometry,starsMaterial);scene.add(stars);let drift=0;let mouseX=0;let mouseY=0;document.addEventListener('mousemove',(e)=>{mouseX=(e.clientX/window.innerWidth)*2-1;mouseY=-(e.clientY/window.innerHeight)*2-1;});window.addEventListener('scroll',()=>{let scroll=window.scrollY/(document.documentElement.scrollHeight-window.innerHeight);drift+=scroll*0.1;});function animate(){requestAnimationFrame(animate);drift+=0.01;stars.position.z=drift%depth-depth/2;stars.rotation.z+=0.0001;camera.position.x=mouseX*2;camera.position.y=mouseY*2;camera.lookAt(0,0,0);renderer.render(scene,camera);}window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});animate();</script><script>class App{constructor(){this.user=null;this.course=null;this.API=window.location.origin}async init(){const saved=localStorage.getItem('aura_user');if(saved){this.user=JSON.parse(saved);this.loadStats();this.showDashboard()}else{this.showLanding()}}goToLanding(){document.getElementById('landingPage').classList.remove('hidden');document.getElementById('authPage').classList.add('hidden');document.getElementById('dashboardPage').classList.add('hidden')}goToAuth(form){document.getElementById('landingPage').classList.add('hidden');document.getElementById('authPage').classList.remove('hidden');document.getElementById('dashboardPage').classList.add('hidden');if(form==='signin'){document.getElementById('signInForm').classList.add('active');document.getElementById('signUpForm').classList.remove('active')}else{document.getElementById('signInForm').classList.remove('active');document.getElementById('signUpForm').classList.add('active')}}toggleAuthForm(){document.getElementById('signInForm').classList.toggle('active');document.getElementById('signUpForm').classList.toggle('active')}async register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regEmail').value;const course=document.getElementById('course').value;const year=parseInt(document.getElementById('year').value);const res=await fetch(this.API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,course,year})});const data=await res.json();if(data.success){this.user={id:data.student.id,email,name,year};this.course=course;localStorage.setItem('aura_user',JSON.stringify(this.user));this.loadStats();this.showDashboard()}else alert('❌ '+data.error)}async login(e){e.preventDefault();const email=document.getElementById('email').value;const res=await fetch(this.API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await res.json();if(data.success){this.user=data.student;localStorage.setItem('aura_user',JSON.stringify(this.user));this.loadStats();this.showDashboard()}else alert('❌ Login failed')}async loadStats(){const res=await fetch(this.API+\`/api/stats/\${this.user.id}\`);const data=await res.json();document.getElementById('dLevel').textContent=data.level;document.getElementById('dPoints').textContent=data.aura_points;document.getElementById('dBadges').textContent='0'}showLanding(){document.getElementById('landingPage').classList.remove('hidden');document.getElementById('authPage').classList.add('hidden');document.getElementById('dashboardPage').classList.add('hidden')}showDashboard(){document.getElementById('landingPage').classList.add('hidden');document.getElementById('authPage').classList.add('hidden');document.getElementById('dashboardPage').classList.remove('hidden')}logout(){localStorage.removeItem('aura_user');this.showLanding()}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA LANDING PAGE COMPLETE on ' + PORT));
