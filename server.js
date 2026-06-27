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

// AUTH - REGISTER
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, course, year } = req.body;
    const trialEnd = new Date(Date.now() + 7*24*60*60*1000);
    const { data, error } = await supabase.from('students').insert([{
      name, email, university: 'Zambia', year,
      trial_start_date: new Date().toISOString(),
      trial_end_date: trialEnd.toISOString(),
      is_paid: false,
      syllabus_created: false
    }]).select();
    if (error) throw error;
    await supabase.from('student_stats').insert([{ student_id: data[0].id, aura_points: 0, level: 1 }]);
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// AUTH - LOGIN
app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    if (error) throw error;
    
    const now = new Date();
    const trialEnd = new Date(data.trial_end_date);
    const daysLeft = Math.ceil((trialEnd - now) / (1000*60*60*24));
    const isTrialActive = daysLeft > 0 && !data.is_paid;
    
    res.json({ 
      success: true, 
      student: data, 
      daysLeft, 
      isTrialActive,
      syllabusCreated: data.syllabus_created 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// CREATE SYLLABUS (Student enters their courses)
app.post('/api/syllabus/create', async (req, res) => {
  try {
    const { studentId, courseName, courseCode, semester, topics, examDate, assignmentDates } = req.body;
    
    const { data, error } = await supabase.from('syllabuses').insert([{
      student_id: studentId,
      course_name: courseName,
      course_code: courseCode,
      semester: semester,
      topics: topics, // Array of topic names
      exam_date: examDate,
      assignment_dates: assignmentDates,
      progress_percentage: 0,
      created_at: new Date().toISOString()
    }]).select();
    
    if (error) throw error;
    
    // Mark syllabus as created
    await supabase.from('students').update({ syllabus_created: true }).eq('id', studentId);
    
    res.json({ success: true, syllabus: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET STUDENT'S SYLLABUSES
app.get('/api/syllabuses/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('syllabuses').select('*').eq('student_id', req.params.studentId);
    if (error) throw error;
    res.json({ syllabuses: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// UPDATE SYLLABUS PROGRESS
app.post('/api/syllabus/update-progress', async (req, res) => {
  try {
    const { syllabusId, progressPercentage } = req.body;
    const { data, error } = await supabase.from('syllabuses').update({ progress_percentage: progressPercentage }).eq('id', syllabusId).select();
    if (error) throw error;
    res.json({ success: true, syllabus: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PDF UPLOAD & SIMPLIFY
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentId, studentEmail } = req.body;
    const { data: student } = await supabase.from('students').select('trial_end_date, is_paid').eq('id', studentId).single();
    
    const now = new Date();
    const trialEnd = new Date(student.trial_end_date);
    const isTrialActive = trialEnd > now && !student.is_paid;
    if (!isTrialActive) return res.status(403).json({ error: 'Trial expired. Please pay K10/week.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    let text = 'Study material';
    try {
      const pdfParse = require('pdf-parse');
      const pdf = await pdfParse(req.file.buffer);
      text = pdf.text.replace(/\n\n+/g, '\n').substring(0, 5000);
    } catch (e) {
      console.log('PDF parse error');
    }

    const simplified = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `Simplify into 5 KEY POINTS:\n${text}\n\nUse bullets, simple language.` }],
      max_tokens: 600
    }).then(r => r.choices[0]?.message?.content || 'Summary generated');

    const { data, error } = await supabase.from('documents').insert([{
      student_email: studentEmail,
      file_name: req.file.originalname,
      summary: simplified,
      extracted_text: text,
      created_at: new Date().toISOString()
    }]).select();
    
    if (error) throw error;
    res.json({ success: true, summary: simplified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET SUBSCRIPTION
app.get('/api/subscription/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('trial_end_date, is_paid').eq('id', req.params.studentId).single();
    if (error) throw error;
    const now = new Date();
    const trialEnd = new Date(data.trial_end_date);
    const daysLeft = Math.ceil((trialEnd - now) / (1000*60*60*24));
    const isTrialActive = daysLeft > 0 && !data.is_paid;
    res.json({ daysLeft: Math.max(0, daysLeft), isTrialActive, isPaid: data.is_paid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PAYMENT
app.post('/api/payment/initiate', async (req, res) => {
  try {
    const { studentId, msisdn } = req.body;
    await supabase.from('students').update({ mtn_msisdn: msisdn, payment_reference: `AURA-${Date.now()}` }).eq('id', studentId);
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

// SERVE APP
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:system-ui,sans-serif; background:#0a0a24; color:#f1f5f9; }
#starfield { position:fixed; top:0; left:0; width:100%; height:100%; z-index:1; }
#app { position:fixed; top:0; left:0; width:100%; height:100%; z-index:10; overflow-y:auto; }
input,select,textarea { width:100%; padding:12px; margin:8px 0; border:1.5px solid rgba(74,242,161,0.3); border-radius:10px; font-size:14px; background:rgba(10,10,36,0.4); color:#f1f5f9; font-family:inherit; }
input:focus { outline:none; border-color:#4AF2A1; box-shadow:0 0 15px rgba(74,242,161,0.5); }
.btn { background:linear-gradient(135deg,#00FFCC,#4AF2A1); color:#0a0a24; padding:12px 24px; border:none; border-radius:10px; cursor:pointer; font-weight:700; font-size:14px; box-shadow:0 0 15px rgba(74,242,161,0.4); transition:all 0.3s; }
.btn:hover { transform:translateY(-2px); box-shadow:0 0 25px rgba(74,242,161,0.6); }
.hidden { display:none!important; }
.top-nav { background:rgba(10,10,36,0.6); padding:16px 20px; border-bottom:1.5px solid rgba(74,242,161,0.2); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:50; }
.logo { font-size:22px; font-weight:800; text-shadow:0 0 15px rgba(74,242,161,0.3); }
.countdown { background:rgba(74,242,161,0.2); border:1.5px solid rgba(74,242,161,0.4); padding:10px 16px; border-radius:8px; font-size:12px; font-weight:700; color:#4AF2A1; }
.content { max-width:1200px; margin:0 auto; padding:20px; padding-bottom:120px; }
.section { display:none; }
.section.active { display:block; }
.page-title { font-size:28px; font-weight:800; margin-bottom:8px; text-shadow:0 0 15px rgba(74,242,161,0.3); }
.card { background:rgba(74,242,161,0.08); border:1.5px solid rgba(74,242,161,0.2); border-radius:12px; padding:20px; margin-bottom:16px; }
.stat-box { background:rgba(74,242,161,0.1); border:1.5px solid rgba(74,242,161,0.2); border-radius:12px; padding:20px; text-align:center; }
.stat-value { font-size:32px; font-weight:800; color:#4AF2A1; margin-bottom:6px; }
.stat-label { font-size:12px; color:#cbd5e1; }
.course-box { background:rgba(74,242,161,0.08); border:1.5px solid rgba(74,242,161,0.2); border-radius:12px; padding:16px; margin-bottom:12px; }
.course-title { font-weight:700; color:#4AF2A1; margin-bottom:4px; }
.progress-bar { background:rgba(74,242,161,0.1); border-radius:8px; height:10px; margin:8px 0; overflow:hidden; }
.progress-fill { background:linear-gradient(90deg,#00FFCC,#4AF2A1); height:100%; }
.bottom-nav { position:fixed; bottom:0; left:0; right:0; background:rgba(10,10,36,0.7); border-top:1.5px solid rgba(74,242,161,0.2); display:flex; justify-content:space-around; padding:10px 0; z-index:100; }
.nav-btn { background:none; border:none; color:#64748b; font-size:11px; cursor:pointer; font-weight:600; display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px; }
.nav-btn.active { color:#4AF2A1; }
</style>
</head>
<body>
<canvas id="starfield"></canvas>
<div id="app">
<div class="top-nav">
<div class="logo">📚 AURA</div>
<div class="countdown" id="countdownBadge">⏳ 7 days</div>
<button class="btn" style="padding:6px 14px;font-size:12px" onclick="app.logout()">Logout</button>
</div>
<div class="content">
<div id="createSyllabus" class="section">
<div class="page-title">📚 Create Your Syllabus</div>
<p style="color:#cbd5e1;margin-bottom:20px">Tell AURA about your courses so we can track your progress</p>
<div class="card">
<div style="font-weight:700;color:#4AF2A1;margin-bottom:16px">Add Your First Course</div>
<input type="text" id="courseName" placeholder="Course Name (e.g. Programming 101)">
<input type="text" id="courseCode" placeholder="Course Code (e.g. CS101)">
<select id="semester"><option value="">Select Semester</option><option value="Semester 1">Semester 1</option><option value="Semester 2">Semester 2</option></select>
<textarea id="topics" placeholder="Topics (comma-separated, e.g. Loops, Functions, Arrays)" style="height:80px"></textarea>
<input type="date" id="examDate" placeholder="Exam Date">
<button class="btn" style="width:100%;margin-top:12px" onclick="app.addCourse()">Add Course →</button>
</div>
</div>
<div id="dashboard" class="section active">
<div class="page-title">Dashboard 📊</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
<div class="stat-box"><div class="stat-value" id="dLevel">1</div><div class="stat-label">Level</div></div>
<div class="stat-box"><div class="stat-value" id="dPoints">0</div><div class="stat-label">Points</div></div>
</div>
<div class="card">
<div style="font-weight:700;color:#4AF2A1;margin-bottom:12px">📖 Your Syllabus</div>
<div id="syllabusDisplay"></div>
<button class="btn" style="width:100%;margin-top:12px" onclick="app.goTo('createSyllabus')">+ Add Course</button>
</div>
<div class="card">
<div style="font-weight:700;color:#4AF2A1;margin-bottom:12px">📄 Upload & Simplify</div>
<div style="border:3px dashed rgba(74,242,161,0.4);border-radius:12px;padding:30px;text-align:center;cursor:pointer;background:rgba(74,242,161,0.05)" onclick="document.getElementById('fileInput').click()">
<div style="font-size:40px;margin-bottom:8px">📄</div>
<div style="color:#cbd5e1">Click to upload PDF</div>
<input type="file" id="fileInput" accept=".pdf" onchange="app.handleUpload(event)" style="display:none">
</div>
<div id="uploadResult" class="hidden" style="background:rgba(74,242,161,0.15);border-radius:8px;padding:12px;margin-top:12px">
<div style="color:#4AF2A1;font-weight:700;margin-bottom:8px">✅ Simplified:</div>
<div id="summaryText" style="font-size:13px;color:#cbd5e1"></div>
</div>
</div>
<div class="card">
<div style="font-size:36px;margin-bottom:12px">💎</div>
<div style="font-size:18px;font-weight:700;color:#4AF2A1;margin-bottom:8px">Premium (K10/week)</div>
<div style="color:#cbd5e1;font-size:13px;margin-bottom:16px">After 7 days, pay to keep uploading & tracking progress</div>
<button class="btn" style="width:100%" onclick="app.goTo('payment')">Learn More</button>
</div>
</div>
<div id="payment" class="section">
<div class="page-title">💳 Premium (K10/week)</div>
<div class="card">
<div style="font-weight:700;color:#4AF2A1;margin-bottom:12px">Enter MTN Number</div>
<input type="tel" id="mtnNumber" placeholder="0964969767">
<button class="btn" style="width:100%;margin-top:12px" onclick="app.initiatePayment()">Pay K10 Now →</button>
</div>
</div>
</div>
<nav class="bottom-nav">
<button class="nav-btn active" onclick="app.goTo('dashboard')"><span style="font-size:18px">🏠</span>Home</button>
<button class="nav-btn" onclick="app.goTo('payment')"><span style="font-size:18px">💎</span>Premium</button>
</nav>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
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
</script>
<script>
class App {
  constructor() {
    this.user = null;
    this.API = window.location.origin;
  }

  async init() {
    const saved = localStorage.getItem('aura_user');
    if (!saved) {
      window.location.href = '/';
      return;
    }
    this.user = JSON.parse(saved);
    await this.updateCountdown();
    await this.loadStats();
    await this.loadSyllabus();
    
    if (!this.user.syllabusCreated) {
      this.goTo('createSyllabus');
    }
  }

  async updateCountdown() {
    try {
      const sub = await fetch(this.API + \`/api/subscription/\${this.user.id}\`).then(r => r.json());
      document.getElementById('countdownBadge').textContent = sub.daysLeft <= 0 ? '❌ Expired' : \`⏳ \${sub.daysLeft} days\`;
    } catch (e) {
      console.log('Countdown error');
    }
  }

  async loadStats() {
    try {
      const stats = await fetch(this.API + \`/api/stats/\${this.user.id}\`).then(r => r.json());
      document.getElementById('dLevel').textContent = stats.level || 1;
      document.getElementById('dPoints').textContent = stats.aura_points || 0;
    } catch (e) {
      console.log('Stats error');
    }
  }

  async loadSyllabus() {
    try {
      const res = await fetch(this.API + \`/api/syllabuses/\${this.user.id}\`).then(r => r.json());
      const syllabuses = res.syllabuses || [];
      const html = syllabuses.map(s => \`
        <div class="course-box">
          <div class="course-title">\${s.course_name} (\${s.course_code})</div>
          <div style="font-size:12px;color:#cbd5e1;margin-bottom:8px">\${s.semester} • \${(s.topics || []).length} topics</div>
          <div class="progress-bar"><div class="progress-fill" style="width:\${s.progress_percentage}%"></div></div>
          <div style="font-size:11px;color:#cbd5e1;margin-top:4px">\${s.progress_percentage}% Complete</div>
        </div>
      \`).join('');
      document.getElementById('syllabusDisplay').innerHTML = html || '<div style="color:#cbd5e1;font-size:13px">No courses yet. Add one to get started!</div>';
    } catch (e) {
      console.log('Syllabus error');
    }
  }

  async addCourse() {
    const courseName = document.getElementById('courseName').value;
    const courseCode = document.getElementById('courseCode').value;
    const semester = document.getElementById('semester').value;
    const topicsText = document.getElementById('topics').value;
    const examDate = document.getElementById('examDate').value;
    
    if (!courseName || !courseCode || !semester || !topicsText) {
      alert('Fill all fields');
      return;
    }
    
    const topics = topicsText.split(',').map(t => t.trim());
    
    const res = await fetch(this.API + '/api/syllabus/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: this.user.id, courseName, courseCode, semester, topics, examDate })
    }).then(r => r.json());
    
    if (res.success) {
      alert('✅ Course added!');
      this.user.syllabusCreated = true;
      localStorage.setItem('aura_user', JSON.stringify(this.user));
      document.getElementById('courseName').value = '';
      document.getElementById('courseCode').value = '';
      document.getElementById('semester').value = '';
      document.getElementById('topics').value = '';
      document.getElementById('examDate').value = '';
      await this.loadSyllabus();
      this.goTo('dashboard');
    }
  }

  async handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const sub = await fetch(this.API + \`/api/subscription/\${this.user.id}\`).then(r => r.json());
    if (!sub.isTrialActive) return alert('⏰ Trial expired! Pay K10/week to continue.');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('studentId', this.user.id);
    fd.append('studentEmail', this.user.email);
    const res = await fetch(this.API + '/api/upload', { method: 'POST', body: fd }).then(r => r.json());
    if (res.success) {
      document.getElementById('summaryText').textContent = res.summary;
      document.getElementById('uploadResult').classList.remove('hidden');
    }
  }

  async initiatePayment() {
    const mtn = document.getElementById('mtnNumber').value;
    if (!mtn) return alert('Enter MTN number');
    const res = await fetch(this.API + '/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: this.user.id, msisdn: mtn })
    }).then(r => r.json());
    if (res.success) {
      alert('✅ Check your phone!' + res.message);
      setTimeout(() => this.confirmPayment(), 3000);
    }
  }

  async confirmPayment() {
    await fetch(this.API + '/api/payment/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: this.user.id }) });
    alert('✅ Premium unlocked!');
    await this.updateCountdown();
  }

  goTo(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(section).classList.add('active');
    event.target.closest('.nav-btn')?.classList.add('active');
  }

  logout() {
    localStorage.removeItem('aura_user');
    window.location.href = '/';
  }
}

const app = new App();
app.init();
</script>
</body>
</html>`);
});

app.listen(PORT, () => console.log('🚀 AURA WITH STUDENT SYLLABUS on ' + PORT));
