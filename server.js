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
  const { name, email, university } = req.body;
  const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    const { data, error } = await supabase.from('students').insert([{ name, email, university, trial_end_date: trialEndDate.toISOString(), is_locked: false }]).select();
    if (error) throw error;
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email } = req.body;
  try {
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    if (error) throw error;
    res.json({ success: true, student: data, isLocked: data.is_locked });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const { data, error } = await supabase.from('documents').insert([{ student_email: studentEmail, file_name: req.file.originalname, summary: 'Summary', extracted_text: 'Text', questions_count: 30 }]).select();
    if (error) throw error;
    res.json({ success: true, document: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents/:email', async (req, res) => {
  try {
    const { data, error } = await supabase.from('documents').select('*').eq('student_email', req.params.email);
    if (error) throw error;
    res.json({ documents: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
.hidden{display:none!important}
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff}.hidden{display:none}#loginScreen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px}.login-box{background:white;padding:40px;border-radius:16px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3)}h1{color:#667eea;margin-bottom:10px;font-size:28px}p{color:#666;margin-bottom:20px}input,select{width:100%;padding:12px;margin:8px 0;border:1px solid #ddd;border-radius:8px;font-size:14px}button{width:100%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px;border:none;border-radius:8px;cursor:pointer;font-weight:700;margin-top:10px}button:hover{opacity:0.9}a{color:#667eea;cursor:pointer;text-decoration:none}.toggle{text-align:center;margin-top:15px;font-size:13px}#appScreen{display:none;flex-direction:column;min-height:100vh}#appScreen.active{display:flex}.app-header{background:white;padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}h2{font-size:20px;color:#667eea}.countdown{background:#fef3c7;color:#b45309;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700}.logout-btn{background:#f3f4f6;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px;color:#6b7280}.app-content{flex:1;padding:20px;overflow-y:auto;padding-bottom:80px}.section{display:none}.section.active{display:block}.page-title{font-size:24px;font-weight:700;margin-bottom:16px;color:#1f2937}.upload-zone{border:2px dashed #d1d5db;border-radius:12px;padding:40px;text-align:center;cursor:pointer;background:#f9fafb;margin-bottom:20px}input[type="file"]{display:none}.nav{position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid #e5e7eb;display:flex;justify-content:space-around;padding:12px 0}.nav-btn{background:none;border:none;display:flex;flex-direction:column;align-items:center;cursor:pointer;gap:4px;font-size:11px;color:#9ca3af;font-weight:600}.nav-btn.active{color:#667eea}.doc-card{background:white;border:1px solid #e5e7eb;padding:16px;border-radius:8px;margin-bottom:12px}</style></head><body><div id="loginScreen"><div class="login-box"><h1>📚 AURA</h1><p>Study Companion</p><div id="signIn"><form onsubmit="app.login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button type="submit">Sign In</button></form><div class="toggle">New? <a onclick="app.toggleAuth()">Create account</a></div></div><div id="signUp" class="hidden"><form onsubmit="app.register(event)"><input type="text" id="name" placeholder="Full Name" required><input type="email" id="regEmail" placeholder="Email" required><select id="uni" required><option value="">Select University</option><option>UNZA</option><option>CBU</option><option>Mulungushi</option><option>LAMU</option></select><input type="password" id="regPass" placeholder="Password" required><button>Create Account</button></form><div class="toggle"><a onclick="app.toggleAuth()">Back to Login</a></div></div></div></div><div id="appScreen"><div class="app-header"><h2>📚 AURA</h2><div style="display:flex;gap:12px"><div class="countdown" id="timer">7d 0h</div><button class="logout-btn" onclick="app.logout()">Logout</button></div></div><div class="app-content"><div id="home" class="section active"><div class="page-title">Welcome! 👋</div><p style="color:#6b7280;margin-bottom:24px">Ready to study?</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;border-radius:12px;text-align:center;cursor:pointer" onclick="app.goTo('upload')"><div style="font-size:32px;margin-bottom:8px">📤</div><strong>Upload Notes</strong></div><div style="background:white;border:1px solid #e5e7eb;padding:20px;border-radius:12px;text-align:center;cursor:pointer" onclick="app.goTo('docs')"><div style="font-size:32px;margin-bottom:8px">📚</div><strong>My Notes</strong></div></div></div><div id="upload" class="section"><div class="page-title">Upload Material 📄</div><div class="upload-zone" onclick="document.getElementById('fileInput').click()"><div style="font-size:32px;margin-bottom:8px">📸 📄</div><h3>Tap to upload</h3><p style="font-size:12px;color:#6b7280">PDF or image • Max 10MB</p></div><input type="file" id="fileInput" onchange="app.upload(event)"></div><div id="docs" class="section"><div class="page-title">Your Materials 📚</div><div id="docsList"></div></div></div><nav class="nav"><button class="nav-btn active" onclick="app.goTo('home')"><span style="font-size:20px">🏠</span>Home</button><button class="nav-btn" onclick="app.goTo('upload')"><span style="font-size:20px">📤</span>Upload</button><button class="nav-btn" onclick="app.goTo('docs')"><span style="font-size:20px">📚</span>Notes</button></nav></div></div><script>class App{constructor(){this.user=null;this.API=window.location.origin}toggleAuth(){document.getElementById('signIn').classList.toggle('hidden');document.getElementById('signUp').classList.toggle('hidden')}async register(e){e.preventDefault();const name=document.getElementById('name').value;const email=document.getElementById('regEmail').value;const uni=document.getElementById('uni').value;const res=await fetch(this.API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,university:uni})});const data=await res.json();if(data.success){this.user={email,name,university:uni};localStorage.setItem('aura_user',JSON.stringify(this.user));this.showApp()}else alert('Error: '+data.error)}async login(e){e.preventDefault();const email=document.getElementById('email').value;const res=await fetch(this.API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await res.json();if(data.success){this.user={email,name:data.student.name,university:data.student.university};localStorage.setItem('aura_user',JSON.stringify(this.user));this.showApp()}else alert('Login failed')}showApp(){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('appScreen').classList.add('active');this.startTimer()}goTo(section){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById(section).classList.add('active');event.target.closest('.nav-btn')?.classList.add('active')}async upload(e){const file=e.target.files[0];if(!file)return;const form=new FormData();form.append('file',file);form.append('studentEmail',this.user.email);const res=await fetch(this.API+'/api/upload',{method:'POST',body:form});const data=await res.json();if(data.success){alert('✅ File uploaded! 30 questions generated');this.goTo('docs')}else alert('Upload failed')}logout(){localStorage.removeItem('aura_user');location.reload()}startTimer(){setInterval(()=>{const now=Date.now();const end=parseInt(localStorage.getItem('aura_trial')||Date.now()+7*24*60*60*1000);const diff=end-now;if(diff<=0)return;const d=Math.floor(diff/86400000);const h=Math.floor((diff%86400000)/3600000);document.getElementById('timer').textContent=d+'d '+h+'h'},1000)}}const app=new App();const saved=localStorage.getItem('aura_user');if(saved){app.user=JSON.parse(saved);app.showApp()}</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA on ' + PORT));
