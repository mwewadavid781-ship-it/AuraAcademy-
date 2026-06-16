const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk').default;
const pdfParse = require('pdf-parse');
const multer = require('multer');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ===== API ROUTES FIRST =====

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

// ===== SERVE HTML INLINE =====
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AURA Study Companion</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .login-box { background: white; padding: 40px; border-radius: 16px; width: 100%; max-width: 400px; text-align: center; }
        h1 { color: #667eea; margin-bottom: 20px; }
        p { color: #6b7280; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>📚 AURA</h1>
        <p>Loading... Please wait</p>
        <p id="message">Initializing student app...</p>
    </div>
    <script>
        document.getElementById('message').innerText = 'App is loading. Refresh page if it takes too long.';
    </script>
</body>
</html>`;

app.get('*', (req, res) => {
  res.send(htmlContent);
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 AURA running on port ${PORT}`);
});
