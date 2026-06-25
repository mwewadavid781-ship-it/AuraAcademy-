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
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA - Premium Study Platform</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}#starfield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1}#ui{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;overflow-y:auto;pointer-events:none}#ui>*{pointer-events:auto}.hidden{display:none!important}input,select,textarea{width:100%;padding:14px;margin:12px 0;border:1.5px solid rgba(168,85,247,0.3);border-radius:12px;font-size:15px;background:rgba(30,20,60,0.8);color:#f1f5f9;font-family:inherit;backdrop-filter:blur(10px);transition:all 0.3s}.btn-primary{width:100%;background:linear-gradient(135deg,#a855f7,#ec4899);color:white;padding:14px;border:none;border-radius:12px;cursor:pointer;font-weight:700;margin-top:12px;font-size:15px;box-shadow:0 0 30px rgba(168,85,247,0.3);transition:all 0.3s}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 0 40px rgba(168,85,247,0.6)}.login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.login-box{background:rgba(30,20,60,0.5);padding:40px;border-radius:20px;border:1px solid rgba(168,85,247,0.3);box-shadow:0 25px 60px rgba(0,0,0,0.5);width:100%;max-width:420px;backdrop-filter:blur(15px)}.logo{font-size:36px;font-weight:800;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px}p{color:#cbd5e1;margin-bottom:20px;font-size:14px}a{color:#a855f7;cursor:pointer;text-decoration:none;font-weight:600}.toggle{text-align:center;margin-top:20px;font-size:14px}.top-bar{background:linear-gradient(180deg,rgba(30,20,60,0.7),rgba(30,20,60,0.3));padding:20px;border-bottom:1px solid rgba(168,85,247,0.3);display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(10px)}.top-bar h1{font-size:24px;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.stats{display:flex;gap:12px}.stat-badge{background:linear-gradient(135deg,rgba(168,85,247,0.3),rgba(236,72,153,0.3));border:1px solid rgba(168,85,247,0.5);padding:8px 14px;border-radius:20px;font-size:12px;color:#f1f5f9;font-weight:600;backdrop-filter:blur(10px)}.app-content{padding:24px;padding-bottom:100px;color:#f1f5f9}.section{display:none}.section.active{display:block}.page-title{font-size:32px;font-weight:800;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px}.card{background:linear-gradient(135deg,rgba(168,85,247,0.1),rgba(236,72,153,0.1));padding:20px;border-radius:16px;border:1px solid rgba(168,85,247,0.3);margin-bottom:16px;backdrop-filter:blur(10px);transition:all 0.3s}.card:hover{border-color:rgba(168,85,247,0.6);box-shadow:0 0 40px rgba(168,85,247,0.3)}.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:linear-gradient(180deg,rgba(30,20,60,0.7),rgba(30,20,60,0.95));border-top:1px solid rgba(168,85,247,0.3);display:flex;justify-content:space-around;padding:12px 0;backdrop-filter:blur(10px);z-index:11}.nav-btn{background:none;border:none;color:#64748b;font-size:10px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;transition:all 0.3s}.nav-btn.active{color:#a855f7}.nav-emoji{font-size:22px}</style></head><body><canvas id="starfield"></canvas><div id="ui"><div id="loginScreen" class="login-screen"><div class="login-box"><div class="logo">📚 AURA</div><p>Premium Study Platform</p><div id="signIn"><form onsubmit="app.login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button class="btn-primary">Sign In</button></form><div class="toggle">New here? <a onclick="app.toggleAuth()">Create account</a></div></div><div id="signUp" class="hidden"><form onsubmit="app.register(event)"><input type="text" id="name" placeholder="Full Name" required><input type="email" id="regEmail" placeholder="Email" required><input type="text" id="course" placeholder="Your Course" required><select id="year" required><option value="">Select Year</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select><input type="password" id="regPass" placeholder="Password" required><button class="btn-primary">Create Account</button></form><div class="toggle"><a onclick="app.toggleAuth()">Back</a></div></div></div></div><div id="appScreen" class="hidden"><div class="top-bar"><h1>📚 AURA</h1><div class="stats"><div class="stat-badge">L<span id="lvl">1</span></div><div class="stat-badge"><span id="pts">0pts</span></div><button class="btn-primary" style="padding:8px 16px;font-size:12px;margin:0;width:auto" onclick="app.logout()">Logout</button></div></div><div class="app-content"><div id="home" class="section active"><div class="page-title">Welcome! 👋</div><p style="color:#cbd5e1">Premium study companion</p></div><div id="groups" class="section"><div class="page-title">Study Groups 👥</div><div id="groupsList"></div></div></div><nav class="bottom-nav"><button class="nav-btn active" onclick="app.goTo('home')"><span class="nav-emoji">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('groups')"><span class="nav-emoji">👥</span>Groups</button></nav></div></div><script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.143.0/build/three.module.js"}}</script><script type="module">import*as THREE from'three';const canvas=document.getElementById('starfield');const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(window.devicePixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);renderer.setClearColor(0x0a0a24);const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);camera.position.z=5;const starsGeometry=new THREE.BufferGeometry();const count=4200;const depth=30;let positions=new Float32Array(count*3);let colors=new Float32Array(count*3);let sizes=new Float32Array(count);const colorA=new THREE.Color(0xaef6cf);const colorB=new THREE.Color(0x5fe6a0);const colorC=new THREE.Color(0xeafff2);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-0.5)*24;positions[i*3+1]=(Math.random()-0.5)*16;positions[i*3+2]=(Math.random()-0.5)*30;let palette=Math.floor(Math.random()*3);let color=palette===0?colorA:palette===1?colorB:colorC;let bright=0.7+Math.random()*0.6;colors[i*3]=color.r*bright;colors[i*3+1]=color.g*bright;colors[i*3+2]=color.b*bright;sizes[i]=0.5+Math.pow(Math.random(),1.4)*2.5;}starsGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));starsGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));starsGeometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));const starsMaterial=new THREE.PointsMaterial({size:0.15,vertexColors:true,transparent:true,sizeAttenuation:true});const stars=new THREE.Points(starsGeometry,starsMaterial);scene.add(stars);let drift=0;let mouseX=0;let mouseY=0;document.addEventListener('mousemove',(e)=>{mouseX=(e.clientX/window.innerWidth)*2-1;mouseY=-(e.clientY/window.innerHeight)*2-1;});window.addEventListener('scroll',()=>{let scroll=window.scrollY/(document.documentElement.scrollHeight-window.innerHeight);drift+=scroll*0.1;});function animate(){requestAnimationFrame(animate);drift+=0.01;stars.position.z=drift%depth-depth/2;stars.rotation.z+=0.0001;camera.position.x=mouseX*2;camera.position.y=mouseY*2;camera.lookAt(0,0,0);renderer.render(scene,camera);}window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});animate();</script><script>class App{constructor(){this.user=null;this.course=null;this.API=window.location.origin}async init(){const saved=localStorage.getItem('aura_user');const course=localStorage.getItem('aura_course');if(saved&&course){this.user=JSON.parse(saved);this.course=course;this.showApp()}}async register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regEmail').value;const course=document.getElementById('course').value;const year=parseInt(document.getElementById('year').value);const res=await fetch(this.API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,course,year})});const data=await res.json();if(data.success){this.user={id:data.student.id,email,name,year};this.course=course;localStorage.setItem('aura_user',JSON.stringify(this.user));localStorage.setItem('aura_course',course);this.showApp()}else alert('❌ '+data.error)}async login(e){e.preventDefault();const email=document.getElementById('email').value;const res=await fetch(this.API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await res.json();if(data.success){this.user=data.student;this.course='';localStorage.setItem('aura_user',JSON.stringify(this.user));this.showApp()}else alert('❌ Login failed')}toggleAuth(){document.getElementById('signIn').classList.toggle('hidden');document.getElementById('signUp').classList.toggle('hidden')}showApp(){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('appScreen').classList.remove('hidden');this.loadStats();this.loadGroups()}async loadGroups(){const res=await fetch(this.API+\`/api/groups/\${this.course}/\${this.user.year}\`);const data=await res.json();const groups=data.groups||[];const html=groups.length>0?groups.map(g=>\`<div class="card"><div style="font-size:32px">👥</div><div style="color:#a855f7;font-weight:700">\${g.group_name}</div><div style="font-size:13px;color:#94a3b8">\${g.member_count||0} members</div></div>\`).join(''):'<div class="card"><p style="color:#94a3b8">No groups yet</p></div>';document.getElementById('groupsList').innerHTML=html}async loadStats(){const res=await fetch(this.API+\`/api/stats/\${this.user.id}\`);const data=await res.json();document.getElementById('lvl').textContent=data.level;document.getElementById('pts').textContent=data.aura_points+'pts'}goTo(section){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(section)?.classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}logout(){localStorage.removeItem('aura_user');localStorage.removeItem('aura_course');location.reload()}}const app=new App();app.init()</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA WITH STARFIELD on ' + PORT));
