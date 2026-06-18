const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// API Routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, university } = req.body;
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase.from('students').insert([{ 
      name, email, university, trial_end_date: trialEndDate.toISOString(), is_locked: false 
    }]).select();
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
    const { data, error } = await supabase.from('documents').insert([{ 
      student_email: studentEmail, 
      file_name: req.file.originalname, 
      summary: 'Summary', 
      extracted_text: 'Text', 
      questions_count: 30 
    }]).select();
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

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('🚀 AURA running on port ' + PORT));
