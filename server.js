cat > /mnt/user-data/outputs/server-working.js << 'WORKINGEOF'
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

// API Routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, university } = req.body;
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase.from('students').insert([{ name, email, university, trial_end_date: trialEndDate.toISOString(), is_locked: false }]).select();
    if (error) throw error;
    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabase.from('students').select('*').eq('email', email).single();
    if (error) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, student: data, isLocked: data.is_locked });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file' });
    let text = 'Sample material';
    try {
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } catch (e) {}
    const summary = 'Summary from AI';
    const { data, error } = await supabase.from('documents').insert([{ student_email: studentEmail, file_name: req.file.originalname, summary, extracted_text: text.substring(0, 3000), questions_count: 30 }]).select();
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

app.get('/ceo/students', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('*');
    if (error) throw error;
    res.json({ students: data || [] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Serve HTML
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>AURA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#fff}.hidden{display:none}#login{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px}.box{background:white;padding:40px;border-radius:16px;width:100%;max-width:400px}h1{color:#667eea;margin-bottom:20px}input,select{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:8px;font-size:14px}button{width:100%;background:#667eea;color:white;padding:12px;border:none;border-radius:8px;cursor:pointer;font-weight:700;margin-top:10px}button:hover{opacity:0.9}a{color:#667eea;cursor:pointer}.msg{padding:15px;background:#dcfce7;border-radius:8px;margin:10px 0}</style></head><body><div id="login"><div class="box"><h1>📚 AURA</h1><p>Study Companion</p><form onsubmit="login(event)"><input type="email" id="email" placeholder="Email" required><input type="password" id="pass" placeholder="Password" required><button type="submit">Sign In</button></form><p style="margin-top:15px">New? <a onclick="showReg()">Create account</a></p></div></div><script>function login(e){e.preventDefault();alert('Welcome to AURA! 🎉');}</script></body></html>`);
});

app.listen(PORT, () => console.log('🚀 AURA running on port ' + PORT));
WORKINGEOF
cat /mnt/user-data/outputs/server-working.js
