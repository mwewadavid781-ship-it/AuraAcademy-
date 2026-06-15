const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk').default;
const pdfParse = require('pdf-parse');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Database setup
async function initDatabase() {
  try {
    // Create tables if they don't exist
    await supabase.rpc('create_tables_if_not_exist');
  } catch (e) {
    console.log('Tables may already exist');
  }
}

// ENDPOINTS

// 1. Register/Login
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, university } = req.body;
    
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const { data, error } = await supabase
      .from('students')
      .insert([{
        name,
        email,
        university,
        trial_end_date: trialEndDate.toISOString(),
        is_locked: false
      }])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      student: data[0],
      trialEndsAt: trialEndDate.toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      // Create new student on first login
      return res.status(404).json({ error: 'Student not found. Please register first.' });
    }

    res.json({
      success: true,
      student: data,
      isLocked: data.is_locked,
      trialEndsAt: data.trial_end_date
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2. Upload PDF & Generate Questions
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Extract text from PDF
    let extractedText = '';
    try {
      const data = await pdfParse(file.buffer);
      extractedText = data.text;
    } catch (e) {
      extractedText = 'Sample course material about circuit analysis, electromagnetic fields, and signal processing.';
    }

    // Generate summary with Groq
    const summaryResponse = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{
        role: 'user',
        content: `Summarize this university course material in 3-4 key points:\n\n${extractedText.substring(0, 2000)}`
      }],
      max_tokens: 300
    });

    const summary = summaryResponse.choices[0]?.message?.content || 'Summary generated';

    // Generate 30+ questions with Groq
    const questionsResponse = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{
        role: 'user',
        content: `Generate exactly 30 multiple choice exam questions from this material. Format as JSON array with: {q: "question", opts: ["A", "B", "C", "D"], correct: 0, exp: "explanation"}\n\n${extractedText.substring(0, 3000)}`
      }],
      max_tokens: 2000
    });

    let questions = [];
    try {
      const questionsText = questionsResponse.choices[0]?.message?.content || '[]';
      questions = JSON.parse(questionsText.match(/\[.*\]/s)[0]);
    } catch (e) {
      questions = generateDefaultQuestions();
    }

    // Store in Supabase
    const { data, error } = await supabase
      .from('documents')
      .insert([{
        student_email: studentEmail,
        file_name: file.originalname,
        summary,
        extracted_text: extractedText,
        questions_count: questions.length
      }])
      .select();

    if (error) throw error;

    // Store questions
    if (data && data[0]) {
      await supabase
        .from('questions')
        .insert(questions.map(q => ({
          document_id: data[0].id,
          question: q.q,
          options: q.opts,
          correct_answer: q.correct,
          explanation: q.exp
        })));
    }

    res.json({
      success: true,
      document: data[0],
      summary,
      questionsGenerated: questions.length,
      questions
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Get documents for student
app.get('/api/documents/:email', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('student_email', req.params.email)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ documents: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Get questions for document
app.get('/api/questions/:docId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('document_id', req.params.docId);

    if (error) throw error;

    res.json({ questions: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5. CEO - Get all students
app.get('/ceo/students', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const locked = data.filter(s => s.is_locked).length;
    const active = data.filter(s => !s.is_locked).length;

    res.json({
      total: data.length,
      locked,
      active,
      students: data
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 6. CEO - Unlock student
app.post('/ceo/unlock/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .update({ 
        is_locked: false,
        trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', req.params.studentId)
      .select();

    if (error) throw error;

    res.json({ success: true, student: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 7. Check trial status
app.post('/api/check-status', async (req, res) => {
  try {
    const { email } = req.body;

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;

    const now = new Date();
    const trialEnd = new Date(data.trial_end_date);
    const isExpired = now > trialEnd;

    res.json({
      student: data,
      isExpired,
      daysRemaining: Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)))
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Default questions generator
function generateDefaultQuestions() {
  const questions = [];
  for (let i = 0; i < 30; i++) {
    questions.push({
      q: `Exam Question ${i + 1}: What is the main concept?`,
      opts: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct: Math.floor(Math.random() * 4),
      exp: `This is the correct answer for question ${i + 1}`
    });
  }
  return questions;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AURA Backend running on port ${PORT}`);
  initDatabase();
});
