const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk').default;
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ===== AUTH =====
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, year } = req.body;
    const trialEnd = new Date(Date.now() + 7*24*60*60*1000);
    
    const { data, error } = await supabase.from('students').insert([{
      name, email, year,
      trial_start_date: new Date().toISOString(),
      trial_end_date: trialEnd.toISOString(),
      is_paid: false,
      last_login: new Date().toISOString(),
      study_streak: 1
    }]).select();
    
    if (error) throw error;
    
    await supabase.from('student_stats').insert([{ 
      student_id: data[0].id, 
      aura_points: 0, 
      level: 1,
      total_topics_completed: 0
    }]);
    
    res.json({ success: true, student: data[0], token: data[0].id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    
    if (error) throw error;
    
    const now = new Date();
    const trialEnd = new Date(data.trial_end_date);
    const daysLeft = Math.ceil((trialEnd - now) / (1000*60*60*24));
    const isTrialActive = daysLeft > 0 && !data.is_paid;
    
    const lastLogin = new Date(data.last_login);
    const daysDiff = Math.floor((now - lastLogin) / (1000*60*60*24));
    const newStreak = daysDiff === 1 ? (data.study_streak || 0) + 1 : (daysDiff === 0 ? data.study_streak : 1);
    
    await supabase.from('students').update({ 
      last_login: now.toISOString(),
      study_streak: newStreak
    }).eq('id', data.id);
    
    res.json({ 
      success: true, 
      student: { ...data, study_streak: newStreak },
      daysLeft: Math.max(0, daysLeft), 
      isTrialActive,
      token: data.id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== SYLLABUS =====
app.post('/api/syllabus/create', async (req, res) => {
  try {
    const { studentId, courseName, courseCode, semester, topics, examDate } = req.body;
    
    const topicsArray = Array.isArray(topics) ? topics : (typeof topics === 'string' ? topics.split(',').map(t => t.trim()) : []);
    
    const { data, error } = await supabase.from('syllabuses').insert([{
      student_id: studentId,
      course_name: courseName,
      course_code: courseCode,
      semester: semester,
      topics: topicsArray,
      exam_date: examDate,
      completed_topics: [],
      progress_percentage: 0,
      created_at: new Date().toISOString()
    }]).select();
    
    if (error) throw error;
    res.json({ success: true, syllabus: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/syllabuses/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('syllabuses').select('*').eq('student_id', req.params.studentId);
    if (error) throw error;
    res.json({ syllabuses: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/syllabus/mark-topic', async (req, res) => {
  try {
    const { syllabusId, topicName } = req.body;
    
    const { data: syllabus, error: fetchError } = await supabase.from('syllabuses').select('*').eq('id', syllabusId).single();
    if (fetchError) throw fetchError;
    
    const completed = syllabus.completed_topics || [];
    if (!completed.includes(topicName)) {
      completed.push(topicName);
    }
    
    const totalTopics = syllabus.topics.length || 1;
    const progressPercentage = Math.round((completed.length / totalTopics) * 100);
    
    const { data, error } = await supabase.from('syllabuses').update({
      completed_topics: completed,
      progress_percentage: progressPercentage
    }).eq('id', syllabusId).select();
    
    if (error) throw error;
    
    const statsRes = await supabase.from('student_stats').select('aura_points, total_topics_completed').eq('student_id', syllabus.student_id).single();
    const newPoints = (statsRes.data?.aura_points || 0) + 10;
    const newTopics = (statsRes.data?.total_topics_completed || 0) + 1;
    
    await supabase.from('student_stats').update({
      aura_points: newPoints,
      total_topics_completed: newTopics
    }).eq('student_id', syllabus.student_id);
    
    res.json({ success: true, progress: progressPercentage });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== PDF UPLOAD =====
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentId, syllabusId } = req.body;
    
    const { data: student } = await supabase.from('students').select('trial_end_date, is_paid').eq('id', studentId).single();
    const now = new Date();
    const trialEnd = new Date(student.trial_end_date);
    const isTrialActive = trialEnd > now && !student.is_paid;
    
    if (!isTrialActive) {
      return res.status(403).json({ error: 'Trial expired. Please pay K10/week to upload.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    let text = 'Study material';
    try {
      const pdfParse = require('pdf-parse');
      const pdf = await pdfParse(req.file.buffer);
      text = pdf.text.replace(/\n\n+/g, '\n').substring(0, 5000);
    } catch (e) {
      console.log('PDF parse fallback');
    }

    const simplified = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ 
        role: 'user', 
        content: `Simplify this study material into 5 KEY POINTS:\n${text}\n\nUse bullet points, simple language.` 
      }],
      max_tokens: 500
    }).then(r => r.choices[0]?.message?.content || 'Summary generated');

    const { data, error } = await supabase.from('documents').insert([{
      student_id: studentId,
      syllabus_id: syllabusId,
      file_name: req.file.originalname,
      summary: simplified,
      extracted_text: text,
      created_at: new Date().toISOString()
    }]).select();
    
    if (error) throw error;
    res.json({ success: true, summary: simplified, document: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('documents').select('*').eq('student_id', req.params.studentId).order('created_at', { ascending: false }).limit(5);
    if (error) throw error;
    res.json({ documents: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== SUBSCRIPTION =====
app.get('/api/subscription/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('trial_end_date, is_paid').eq('id', req.params.studentId).single();
    if (error) throw error;
    
    const now = new Date();
    const trialEnd = new Date(data.trial_end_date);
    const daysLeft = Math.ceil((trialEnd - now) / (1000*60*60*24));
    const isTrialActive = daysLeft > 0 && !data.is_paid;
    
    res.json({ 
      daysLeft: Math.max(0, daysLeft), 
      isTrialActive, 
      isPaid: data.is_paid 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== PAYMENT =====
app.post('/api/payment/initiate', async (req, res) => {
  try {
    const { studentId, msisdn } = req.body;
    await supabase.from('students').update({
      mtn_msisdn: msisdn,
      payment_reference: `AURA-${Date.now()}`
    }).eq('id', studentId);
    
    res.json({ success: true, message: 'Check your phone for payment prompt!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/payment/confirm', async (req, res) => {
  try {
    const { studentId } = req.body;
    const nextRenewal = new Date(Date.now() + 7*24*60*60*1000);
    
    await supabase.from('students').update({
      is_paid: true,
      last_payment_date: new Date().toISOString(),
      next_renewal_date: nextRenewal.toISOString()
    }).eq('id', studentId);
    
    res.json({ success: true, message: 'Premium unlocked!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== STATS =====
app.get('/api/stats/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('student_stats').select('*').eq('student_id', req.params.studentId).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== SERVE APP =====
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a24;color:#f1f5f9;overflow-x:hidden}
#starfield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1}
#app{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;overflow-y:auto}
input,select,textarea{width:100%;padding:12px;margin:8px 0;border:1.5px solid rgba(74,242,161,0.3);border-radius:10px;font-size:14px;background:rgba(10,10,36,0.4);color:#f1f5f9;font-family:inherit}
input:focus{outline:none;border-color:#4AF2A1;box-shadow:0 0 15px rgba(74,242,161,0.5)}
.btn{background:linear-gradient(135deg,#00FFCC,#4AF2A1);color:#0a0a24;padding:12px 24px;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;box-shadow:0 0 15px rgba(74,242,161,0.4);transition:all 0.3s}
.btn:hover{transform:translateY(-2px);box-shadow:0 0 25px rgba(74,242,161,0.6)}
.hidden{display:none!important}
.top-nav{background:rgba(10,10,36,0.6);padding:16px 20px;border-bottom:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:50}
.logo{font-size:22px;font-weight:800;text-shadow:0 0 15px rgba(74,242,161,0.3)}
.countdown{background:rgba(74,242,161,0.2);border:1.5px solid rgba(74,242,161,0.4);padding:10px 16px;border-radius:8px;font-size:12px;font-weight:700;color:#4AF2A1}
.content{max-width:1200px;margin:0 auto;padding:20px;padding-bottom:120px}
.section{display:none}
.section.active{display:block}
.page-title{font-size:28px;font-weight:800;margin-bottom:8px;text-shadow:0 0 15px rgba(74,242,161,0.3)}
.subtitle{color:#cbd5e1;font-size:13px;margin-bottom:20px}
.card{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:20px;margin-bottom:16px}
.stat-box{background:rgba(74,242,161,0.1);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:20px;text-align:center}
.stat-value{font-size:32px;font-weight:800;color:#4AF2A1;margin-bottom:6px}
.stat-label{font-size:12px;color:#cbd5e1}
.course-box{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:16px;margin-bottom:12px}
.course-title{font-weight:700;color:#4AF2A1;margin-bottom:4px}
.course-code{font-size:12px;color:#cbd5e1}
.progress-bar{background:rgba(74,242,161,0.1);border-radius:8px;height:10px;margin:8px 0;overflow:hidden}
.progress-fill{background:linear-gradient(90deg,#00FFCC,#4AF2A1);height:100%;transition:width 0.3s}
.topics-list{font-size:12px;color:#cbd5e1;margin-top:12px}
.topic-item{background:rgba(74,242,161,0.05);padding:8px 12px;margin:4px 0;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
.topic-item.done{background:rgba(74,242,161,0.15);color:#4AF2A1}
.topic-btn{background:rgba(74,242,161,0.3);border:none;color:#4AF2A1;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600}
.topic-btn:hover{background:rgba(74,242,161,0.5)}
.upload-zone{border:3px dashed rgba(74,242,161,0.4);border-radius:12px;padding:30px;text-align:center;cursor:pointer;background:rgba(74,242,161,0.05);margin-bottom:16px}
.upload-zone:hover{border-color:rgba(74,242,161,0.6);background:rgba(74,242,161,0.1)}
#fileInput{display:none}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(10,10,36,0.7);border-top:1.5px solid rgba(74,242,161,0.2);display:flex;justify-content:space-around;padding:10px 0;z-index:100}
.nav-btn{background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px}
.nav-btn.active{color:#4AF2A1}
.login-section{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.login-box{background:rgba(74,242,161,0.08);border:1.5px solid rgba(74,242,161,0.2);border-radius:12px;padding:40px;max-width:420px;width:100%}
</style></head><body>
<canvas id="starfield"></canvas>
<div id="app">
<div class="login-section hidden" id="loginSection">
<div class="login-box">
<div style="font-size:40px;margin-bottom:12px">📚</div>
<div style="font-size:24px;font-weight:800;color:#f1f5f9;margin-bottom:8px;text-shadow:0 0 15px rgba(74,242,161,0.3)">AURA</div>
<p style="color:#cbd5e1;margin-bottom:20px">Premium Study Platform</p>
<form onsubmit="return app.handleLogin(event)">
<input type="email" id="loginEmail" placeholder="Email" required>
<input type="password" id="loginPass" placeholder="Password" required>
<button class="btn" style="width:100%;margin-top:12px">Sign In</button>
</form>
<div style="text-align:center;margin-top:12px;font-size:13px">
<a style="color:#4AF2A1;cursor:pointer" onclick="app.showSignup()">Create Account</a>
</div>
</div>
</div>
<div id="mainApp" style="display:none">
<div class="top-nav">
<div class="logo">📚 AURA</div>
<div class="countdown" id="countdownBadge">⏳ 7 days</div>
<button class="btn" style="padding:6px 14px;font-size:12px" onclick="app.logout()">Logout</button>
</div>
<div class="content">

<div id="syllabus" class="section active">
<div class="page-title">📚 Syllabus Setup</div>
<p class="subtitle">Create your first course</p>
<div class="card">
<input type="text" id="courseName" placeholder="Course Name">
<input type="text" id="courseCode" placeholder="Course Code">
<select id="semester"><option value="">Select Semester</option><option value="Semester 1">Semester 1</option><option value="Semester 2">Semester 2</option></select>
<textarea id="topics" placeholder="Topics (comma-separated)" style="height:100px"></textarea>
<input type="date" id="examDate">
<button class="btn" style="width:100%;margin-top:12px" onclick="app.createCourse()">Create Course →</button>
</div>
</div>

<div id="dashboard" class="section">
<div class="page-title">Dashboard 📊</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
<div class="stat-box"><div class="stat-value" id="dLevel">1</div><div class="stat-label">Level</div></div>
<div class="stat-box"><div class="stat-value" id="dPoints">0</div><div class="stat-label">Points</div></div>
<div class="stat-box"><div class="stat-value" id="dStreak">0</div><div class="stat-label">🔥 Streak</div></div>
<div class="stat-box"><div class="stat-value" id="dTopics">0</div><div class="stat-label">Topics Done</div></div>
</div>

<div class="card">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
<div style="font-weight:700;color:#4AF2A1">📖 Your Courses</div>
<button class="btn" style="padding:6px 14px;font-size:12px;width:auto" onclick="app.goTo('syllabus')">+ Add</button>
</div>
<div id="coursesList"></div>
</div>

<div class="card">
<div style="font-weight:700;color:#4AF2A1;margin-bottom:12px">📄 Upload & Simplify</div>
<div class="upload-zone" onclick="document.getElementById('fileInput').click()">
<div style="font-size:40px;margin-bottom:8px">📄</div>
<div style="color:#cbd5e1">Click to upload PDF</div>
<input type="file" id="fileInput" accept=".pdf" onchange="app.handleUpload(event)" style="display:none">
</div>
<div id="uploadResult" class="hidden">
<div style="background:rgba(74,242,161,0.15);border-radius:8px;padding:12px;margin-top:12px">
<div style="color:#4AF2A1;font-weight:700;margin-bottom:8px">✅ Simplified:</div>
<div id="summaryText" style="font-size:13px;color:#cbd5e1;line-height:1.6"></div>
</div>
</div>
</div>

<div class="card">
<div style="font-size:36px;margin-bottom:12px">💎</div>
<div style="font-size:16px;font-weight:700;color:#4AF2A1;margin-bottom:8px">Premium (K10/week)</div>
<div style="color:#cbd5e1;font-size:13px;margin-bottom:12px">After 7 days, pay to keep uploading</div>
<button class="btn" style="width:100%" onclick="app.goTo('payment')">Upgrade →</button>
</div>
</div>

<div id="payment" class="section">
<div class="page-title">💳 Premium</div>
<div class="card">
<div style="font-weight:700;color:#4AF2A1;margin-bottom:12px">MTN Mobile Money Number</div>
<input type="tel" id="mtnNumber" placeholder="0964969767">
<button class="btn" style="width:100%;margin-top:12px" onclick="app.initiatePayment()">Pay K10 →</button>
</div>
</div>
</div>
</div>
</div>

<nav class="bottom-nav" id="bottomNav" style="display:none">
<button class="nav-btn active" onclick="app.goTo('dashboard')"><span style="font-size:18px">🏠</span>Home</button>
<button class="nav-btn" onclick="app.goTo('payment')"><span style="font-size:18px">💎</span>Premium</button>
</nav>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
const canvas = document.getElementById('starfield');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0a0a24);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 5;
const geometry = new THREE.BufferGeometry();
const count = 4200;
let positions = new Float32Array(count * 3);
let colors = new Float32Array(count * 3);
const colorA = new THREE.Color(0xaef6cf);
const colorB = new THREE.Color(0x5fe6a0);
const colorC = new THREE.Color(0xeafff2);
for (let i = 0; i < count; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 24;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  let palette = Math.floor(Math.random() * 3);
  let color = palette === 0 ? colorA : palette === 1 ? colorB : colorC;
  let bright = 0.7 + Math.random() * 0.6;
  colors[i * 3] = color.r * bright;
  colors[i * 3 + 1] = color.g * bright;
  colors[i * 3 + 2] = color.b * bright;
}
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const material = new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, sizeAttenuation: true });
const stars = new THREE.Points(geometry, material);
scene.add(stars);
function animate() {
  requestAnimationFrame(animate);
  stars.rotation.z += 0.00005;
  renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
<\/script>

<script>
class App {
  constructor() {
    this.user = null;
    this.API = window.location.origin;
    this.courses = [];
    this.initialized = false;
  }

  init() {
    // Only init once!
    if (this.initialized) return;
    this.initialized = true;

    const saved = localStorage.getItem('aura_user');
    if (!saved) {
      document.getElementById('loginSection').classList.remove('hidden');
      return;
    }

    this.user = JSON.parse(saved);
    this.showApp();
  }

  showApp() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('bottomNav').style.display = 'flex';
    this.loadApp();
  }

  async loadApp() {
    try {
      await this.updateCountdown();
      await this.loadStats();
      await this.loadCourses();
      
      if (this.courses.length === 0) {
        this.goTo('syllabus');
      } else {
        this.goTo('dashboard');
      }
    } catch (e) {
      console.error('Error loading app:', e);
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPass').value;
    
    try {
      const res = await fetch(this.API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).then(r => r.json());

      if (res.success) {
        this.user = res.student;
        localStorage.setItem('aura_user', JSON.stringify(this.user));
        this.showApp();
      } else {
        alert('Login failed');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    return false;
  }

  async updateCountdown() {
    const sub = await fetch(this.API + \`/api/subscription/\${this.user.id}\`).then(r => r.json());
    const badge = document.getElementById('countdownBadge');
    if (sub.daysLeft <= 0) {
      badge.textContent = '❌ Trial Expired';
      badge.style.background = 'rgba(255,107,107,0.2)';
      badge.style.color = '#ff6b6b';
    } else {
      badge.textContent = \`⏳ \${sub.daysLeft} days free\`;
    }
  }

  async loadStats() {
    const stats = await fetch(this.API + \`/api/stats/\${this.user.id}\`).then(r => r.json());
    document.getElementById('dLevel').textContent = stats.level || 1;
    document.getElementById('dPoints').textContent = stats.aura_points || 0;
    document.getElementById('dTopics').textContent = stats.total_topics_completed || 0;
    document.getElementById('dStreak').textContent = this.user.study_streak || 0;
  }

  async loadCourses() {
    const res = await fetch(this.API + \`/api/syllabuses/\${this.user.id}\`).then(r => r.json());
    this.courses = res.syllabuses || [];
    
    const html = this.courses.map(c => \`
      <div class="course-box">
        <div class="course-title">\${c.course_name} (\${c.course_code})</div>
        <div class="course-code">\${c.semester} • \${c.topics.length} topics</div>
        <div class="progress-bar"><div class="progress-fill" style="width:\${c.progress_percentage}%"><\/div><\/div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:4px">\${c.progress_percentage}% Complete (\${(c.completed_topics || []).length}/\${c.topics.length} topics)</div>
        <div class="topics-list">
          \${c.topics.map(t => \`<div class="topic-item \${(c.completed_topics || []).includes(t) ? 'done' : ''}">
            <span>\${t}<\/span>
            \${!(c.completed_topics || []).includes(t) ? \`<button class="topic-btn" onclick="app.markTopic(\${c.id}, '\${t}')">Mark Done<\/button>\` : '<span style="color:#4AF2A1">✓ Done<\/span>'}
          <\/div>\`).join('')}
        <\/div>
      <\/div>
    \`).join('');
    
    document.getElementById('coursesList').innerHTML = html || '<div style="color:#cbd5e1">No courses yet</div>';
  }

  async createCourse() {
    const courseName = document.getElementById('courseName').value;
    const courseCode = document.getElementById('courseCode').value;
    const semester = document.getElementById('semester').value;
    const topicsText = document.getElementById('topics').value;
    const examDate = document.getElementById('examDate').value;
    
    if (!courseName || !courseCode || !semester || !topicsText) {
      alert('Fill all fields');
      return;
    }
    
    const topics = topicsText.split(',').map(t => t.trim()).filter(t => t);
    
    const res = await fetch(this.API + '/api/syllabus/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: this.user.id, courseName, courseCode, semester, topics, examDate })
    }).then(r => r.json());
    
    if (res.success) {
      alert('✅ Course created!');
      document.getElementById('courseName').value = '';
      document.getElementById('courseCode').value = '';
      document.getElementById('semester').value = '';
      document.getElementById('topics').value = '';
      document.getElementById('examDate').value = '';
      await this.loadCourses();
      this.goTo('dashboard');
    }
  }

  async markTopic(syllabusId, topicName) {
    await fetch(this.API + '/api/syllabus/mark-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syllabusId, topicName })
    });
    await this.loadCourses();
    await this.loadStats();
  }

  async handleUpload(e) {
    const file = e.target.files[0];
    if (!file || this.courses.length === 0) {
      alert('Create a course first!');
      return;
    }

    const sub = await fetch(this.API + \`/api/subscription/\${this.user.id}\`).then(r => r.json());
    if (!sub.isTrialActive) {
      alert('Trial expired! Pay K10/week');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('studentId', this.user.id);
    fd.append('syllabusId', this.courses[0].id);

    const res = await fetch(this.API + '/api/upload', { method: 'POST', body: fd }).then(r => r.json());
    if (res.success) {
      document.getElementById('summaryText').textContent = res.summary;
      document.getElementById('uploadResult').classList.remove('hidden');
    }
  }

  async initiatePayment() {
    const mtn = document.getElementById('mtnNumber').value;
    if (!mtn) {
      alert('Enter MTN number');
      return;
    }

    const res = await fetch(this.API + '/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: this.user.id, msisdn: mtn })
    }).then(r => r.json());

    if (res.success) {
      alert('Check your phone!');
      setTimeout(() => this.confirmPayment(), 3000);
    }
  }

  async confirmPayment() {
    await fetch(this.API + '/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: this.user.id })
    });
    alert('✅ Premium unlocked!');
    await this.updateCountdown();
  }

  goTo(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(section).classList.add('active');
    if (event?.target?.closest('.nav-btn')) {
      event.target.closest('.nav-btn').classList.add('active');
    }
  }

  logout() {
    localStorage.removeItem('aura_user');
    this.user = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPass').value = '';
  }

  showSignup() {
    alert('Sign up coming next');
  }
}

const app = new App();
app.init();
<\/script>
</body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA (NO RELOAD LOOP) on ' + PORT));
