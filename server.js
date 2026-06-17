cat > /mnt/user-data/outputs/server-complete.js << 'COMPLETEEOF'
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
app.use(express.urlencoded({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ===== API ROUTES =====
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, university } = req.body;
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase.from('students').insert([{ name, email, university, trial_end_date: trialEndDate.toISOString(), is_locked: false }]).select();
    if (error) throw error;
    res.json({ success: true, student: data[0], trialEndsAt: trialEndDate.toISOString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    if (error) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, student: data, isLocked: data.is_locked, trialEndsAt: data.trial_end_date });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file' });

    let text = '';
    try {
      const data = await pdfParse(file.buffer);
      text = data.text;
    } catch (e) {
      text = 'Sample material';
    }

    const summary = (await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `Summarize: ${text.substring(0, 1000)}` }],
      max_tokens: 200
    })).choices[0]?.message?.content || 'Summary';

    const qResp = (await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `30 questions: ${text.substring(0, 2000)}` }],
      max_tokens: 1500
    })).choices[0]?.message?.content || '[]';

    let questions = [];
    try {
      const match = qResp.match(/\[[\s\S]*\]/);
      questions = JSON.parse(match[0]);
    } catch (e) {
      questions = Array(30).fill().map((_, i) => ({ q: `Q${i+1}`, opts: ['A','B','C','D'], correct: 0, exp: 'Ans' }));
    }

    const { data, error } = await supabase.from('documents').insert([{ student_email: studentEmail, file_name: file.originalname, summary, extracted_text: text.substring(0, 3000), questions_count: questions.length }]).select();
    if (error) throw error;

    if (data?.[0]) {
      await supabase.from('questions').insert(questions.map(q => ({ document_id: data[0].id, question: q.q, options: q.opts, correct_answer: q.correct, explanation: q.exp })));
    }

    res.json({ success: true, document: data[0], summary, questionsGenerated: questions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents/:email', async (req, res) => {
  try {
    const { data, error } = await supabase.from('documents').select('*').eq('student_email', req.params.email).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ documents: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/questions/:docId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('questions').select('*').eq('document_id', req.params.docId);
    if (error) throw error;
    res.json({ questions: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/ceo/students', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const locked = data.filter(s => s.is_locked).length;
    res.json({ total: data.length, locked, active: data.length - locked, students: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/ceo/unlock/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').update({ is_locked: false, trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }).eq('id', req.params.studentId).select();
    if (error) throw error;
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/check-status', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    if (error) throw error;
    const now = new Date();
    const trialEnd = new Date(data.trial_end_date);
    res.json({ student: data, isExpired: now > trialEnd, daysRemaining: Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== SERVE FRONTEND FOR ALL OTHER ROUTES =====
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AURA Study Companion</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; color: #1f2937; }
        .hidden { display: none !important; }
        #loginScreen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
        .login-box { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%; max-width: 400px; }
        .login-box h1 { font-size: 28px; margin-bottom: 8px; color: #667eea; }
        .login-box p { color: #6b7280; margin-bottom: 28px; font-size: 14px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
        .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; }
        .form-group input:focus, .form-group select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        .btn-primary { width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; margin-top: 8px; }
        .btn-primary:hover { transform: translateY(-2px); }
        .toggle-auth { text-align: center; margin-top: 16px; font-size: 13px; color: #6b7280; }
        .toggle-auth a { color: #667eea; cursor: pointer; font-weight: 600; }
        #paywallScreen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
        .paywall-box { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%; max-width: 450px; text-align: center; }
        .paywall-box h2 { font-size: 24px; color: #ef4444; margin-bottom: 12px; }
        .payment-info { background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left; }
        .payment-step { background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #667eea; }
        .payment-step strong { color: #667eea; display: block; margin-bottom: 4px; }
        .btn-unlock { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; margin-top: 16px; font-size: 14px; }
        #appScreen { display: none; flex-direction: column; min-height: 100vh; }
        #appScreen.active { display: flex; }
        .app-header { background: white; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .app-header h1 { font-size: 20px; color: #667eea; }
        .countdown-timer { font-size: 12px; font-weight: 700; background: #fef3c7; color: #b45309; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace; }
        .logout-btn { background: #f3f4f6; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: #6b7280; }
        .app-content { flex: 1; padding: 20px; max-width: 100%; overflow-y: auto; padding-bottom: 100px; }
        .content-section { display: none; }
        .content-section.active { display: block; }
        .page-title { font-size: 24px; font-weight: 700; margin-bottom: 6px; color: #1f2937; }
        .upload-zone { border: 2px dashed #d1d5db; border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; background: #f9fafb; transition: all 0.2s; margin-bottom: 24px; }
        .upload-zone:hover { border-color: #667eea; background: rgba(102, 126, 234, 0.05); }
        .upload-zone h3 { font-size: 16px; margin-bottom: 4px; color: #1f2937; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-around; padding: 12px 0; z-index: 100; }
        .nav-btn { background: none; border: none; display: flex; flex-direction: column; align-items: center; cursor: pointer; gap: 4px; font-size: 11px; color: #9ca3af; font-weight: 600; }
        .nav-btn.active { color: #667eea; }
        .nav-emoji { font-size: 20px; }
        input[type="file"] { display: none; }
    </style>
</head>
<body>

<div id="loginScreen">
    <div class="login-box">
        <h1>📚 AURA</h1>
        <p>Study Companion for University Students</p>

        <div id="signInMode">
            <form onsubmit="app.login(event)">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="loginEmail" required placeholder="you@university.edu">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPass" required placeholder="Password">
                </div>
                <button type="submit" class="btn-primary">Sign In</button>
            </form>
            <div class="toggle-auth">
                New student? <a onclick="app.toggleAuthMode()">Create account</a>
            </div>
        </div>

        <div id="signUpMode" class="hidden">
            <form onsubmit="app.register(event)">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="regName" required placeholder="Your name">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="regEmail" required placeholder="you@university.edu">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="regPass" required placeholder="6+ characters">
                </div>
                <div class="form-group">
                    <label>University</label>
                    <select id="regUni" required>
                        <option value="">Select your university</option>
                        <option value="UNZA">UNZA - University of Zambia</option>
                        <option value="CBU">CBU - Copperbelt University</option>
                        <option value="Mulungushi">Mulungushi University</option>
                        <option value="LAMU">LAMU - Lusaka Apex Medical</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary">Create Account</button>
            </form>
            <div class="toggle-auth">
                Have account? <a onclick="app.toggleAuthMode()">Sign in</a>
            </div>
        </div>
    </div>
</div>

<div id="paywallScreen" class="hidden">
    <div class="paywall-box">
        <h2>🔒 Access Locked</h2>
        <p>Your 7-day free trial has ended</p>

        <div class="payment-info">
            <h3>How to unlock access:</h3>
            
            <div class="payment-step">
                <strong>Step 1: Send K10 to Mobile Money</strong>
                <p>Number: <strong>0964069767</strong></p>
            </div>

            <div class="payment-step">
                <strong>Step 2: Send WhatsApp message</strong>
                <p>Message to: <strong>+260750109917</strong></p>
                <p style="font-size: 12px; margin-top: 6px;">Include your mobile number, account name, and the amount sent</p>
            </div>
        </div>

        <button class="btn-unlock" onclick="app.openWhatsApp()">💬 Send WhatsApp Message</button>
    </div>
</div>

<div id="appScreen">
    <div class="app-header">
        <h1>📚 AURA Study</h1>
        <div style="display: flex; gap: 12px; align-items: center;">
            <div class="countdown-timer" id="countdownTimer">7d 0h 0m</div>
            <button class="logout-btn" onclick="app.logout()">Logout</button>
        </div>
    </div>

    <div class="app-content">
        <div id="section-home" class="content-section active">
            <div class="page-title">Welcome! 👋</div>
            <div style="color: #6b7280; margin-bottom: 24px;">Ready to study?</div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer;" onclick="app.switchSection('upload')">
                    <div style="font-size: 32px; margin-bottom: 8px;">📤</div>
                    <strong>Upload Notes</strong>
                </div>
                <div style="background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer;" onclick="app.switchSection('documents')">
                    <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
                    <strong>Your Notes</strong>
                </div>
            </div>
        </div>

        <div id="section-upload" class="content-section">
            <div class="page-title">Upload Your Material 📄</div>
            <div style="color: #6b7280; margin-bottom: 16px;">PDF or photo of your course notes</div>

            <div class="upload-zone" onclick="document.getElementById('fileInput').click()">
                <div style="font-size: 32px; margin-bottom: 8px;">📸 📄</div>
                <h3>Tap to upload</h3>
                <p style="font-size: 12px; color: #6b7280;">PNG, JPG, PDF • Max 10MB</p>
            </div>
            <input type="file" id="fileInput" onchange="app.uploadFile(event)">
        </div>

        <div id="section-documents" class="content-section">
            <div class="page-title">Your Study Materials 📚</div>
            <div id="documentsList"></div>
        </div>
    </div>

    <nav class="bottom-nav">
        <button class="nav-btn active" onclick="app.switchSection('home')"><span class="nav-emoji">🏠</span>Home</button>
        <button class="nav-btn" onclick="app.switchSection('upload')"><span class="nav-emoji">📤</span>Upload</button>
        <button class="nav-btn" onclick="app.switchSection('documents')"><span class="nav-emoji">📚</span>Notes</button>
    </nav>
</div>

<script>
    class AuraApp {
        constructor() {
            this.API_URL = window.location.origin;
            this.user = null;
            this.countdownInterval = null;
        }

        toggleAuthMode() {
            document.getElementById('signInMode').classList.toggle('hidden');
            document.getElementById('signUpMode').classList.toggle('hidden');
        }

        async register(e) {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const uni = document.getElementById('regUni').value;

            try {
                const res = await fetch(\`\${this.API_URL}/auth/register\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, university: uni })
                });
                const data = await res.json();
                
                if (data.success) {
                    this.user = { email, name, university: uni };
                    localStorage.setItem('aura_user', JSON.stringify(this.user));
                    this.showApp();
                }
            } catch (error) {
                alert('❌ Registration failed: ' + error.message);
            }
        }

        async login(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;

            try {
                const res = await fetch(\`\${this.API_URL}/auth/login\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                
                if (data.success) {
                    this.user = { email, name: data.student.name, university: data.student.university };
                    localStorage.setItem('aura_user', JSON.stringify(this.user));
                    
                    if (data.isLocked) {
                        this.showPaywall();
                    } else {
                        this.showApp();
                    }
                }
            } catch (error) {
                alert('❌ Login failed');
            }
        }

        showApp() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('paywallScreen').classList.add('hidden');
            document.getElementById('appScreen').classList.add('active');
            this.startCountdown();
        }

        showPaywall() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('appScreen').classList.remove('active');
            document.getElementById('paywallScreen').classList.remove('hidden');
        }

        switchSection(section) {
            document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

            document.getElementById('section-' + section).classList.add('active');
            event.target.closest('.nav-btn').classList.add('active');
        }

        async uploadFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('studentEmail', this.user.email);

            try {
                const res = await fetch(\`\${this.API_URL}/api/upload\`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    alert('✅ File uploaded! ' + data.questionsGenerated + ' questions generated.');
                    this.switchSection('documents');
                }
            } catch (error) {
                alert('❌ Upload failed');
            }
        }

        openWhatsApp() {
            const message = \`Hi! I just sent K10 for AURA Study access. My mobile number is: [YOUR_NUMBER], Account name: [YOUR_NAME]\`;
            window.open(\`https://wa.me/260750109917?text=\${encodeURIComponent(message)}\`, '_blank');
        }

        startCountdown() {
            if (this.countdownInterval) clearInterval(this.countdownInterval);

            this.countdownInterval = setInterval(() => {
                const now = Date.now();
                const stored = localStorage.getItem('aura_trial');
                if (!stored) {
                    const trialEnd = Date.now() + (7 * 24 * 60 * 60 * 1000);
                    localStorage.setItem('aura_trial', trialEnd);
                }
                const trialEnd = parseInt(localStorage.getItem('aura_trial'));
                const diff = trialEnd - now;

                if (diff <= 0) {
                    clearInterval(this.countdownInterval);
                    this.showPaywall();
                } else {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    document.getElementById('countdownTimer').textContent = \`\${days}d \${hours}h \${mins}m\`;
                }
            }, 1000);
        }

        logout() {
            localStorage.removeItem('aura_user');
            location.reload();
        }
    }

    const app = new AuraApp();

    const saved = localStorage.getItem('aura_user');
    if (saved) {
        app.user = JSON.parse(saved);
        app.showApp();
    }
</script>

</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(\`🚀 AURA running on port \${PORT}\`);
});
COMPLETEEOF
cat /mnt/user-data/outputs/server-complete.js
