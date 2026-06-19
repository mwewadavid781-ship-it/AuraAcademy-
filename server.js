const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk').default;
const pdfParse = require('pdf-parse');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// AUTH
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, university, courseId, year } = req.body;
    const { data, error } = await supabase.from('students').insert([{
      name, email, university, course_id: courseId, year,
      trial_end_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      is_locked: false
    }]).select();
    if (error) throw error;
    await supabase.from('student_stats').insert([{ student_id: data[0].id }]);
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
    res.json({ success: true, student: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// COURSES
app.get('/api/courses', async (req, res) => {
  try {
    const { data, error } = await supabase.from('courses').select('*');
    if (error) throw error;
    res.json({ courses: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GROUPS
app.get('/api/groups/:courseId/:year', async (req, res) => {
  try {
    const { courseId, year } = req.params;
    const { data, error } = await supabase
      .from('study_groups')
      .select('*')
      .eq('course_id', courseId)
      .eq('year', year);
    if (error) throw error;
    res.json({ groups: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { courseId, year, groupName } = req.body;
    const { data, error } = await supabase.from('study_groups').insert([{
      course_id: courseId,
      year,
      group_name: groupName,
      description: `${groupName} - Year ${year}`
    }]).select();
    if (error) throw error;
    res.json({ success: true, group: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/groups/:groupId/join', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { studentId } = req.body;
    const { data, error } = await supabase.from('group_members').insert([{
      group_id: groupId,
      student_id: studentId
    }]).select();
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// MESSAGING
app.post('/api/messages', async (req, res) => {
  try {
    const { groupId, studentId, messageText, messageType, mediaUrl, voiceUrl, pdfUrl } = req.body;
    const { data, error } = await supabase.from('messages').insert([{
      group_id: groupId,
      student_id: studentId,
      message_text: messageText,
      message_type: messageType || 'text',
      media_url: mediaUrl,
      voice_note_url: voiceUrl,
      pdf_url: pdfUrl
    }]).select();
    if (error) throw error;
    res.json({ success: true, message: data[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/messages/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ messages: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// UPLOAD & AI
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file' });
    
    let text = '';
    try {
      const pdf = await pdfParse(req.file.buffer);
      text = pdf.text.substring(0, 3000);
    } catch (e) {
      text = 'Study material';
    }

    const summary = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `Summarize: ${text}` }],
      max_tokens: 150
    }).then(r => r.choices[0]?.message?.content || 'Summary');

    const qRes = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: `30 questions from: ${text}. JSON: [{q:"", opts:["A","B","C","D"], correct:0}]` }],
      max_tokens: 2000
    }).then(r => r.choices[0]?.message?.content || '[]');

    let questions = [];
    try {
      questions = JSON.parse(qRes);
    } catch {
      questions = Array(30).fill(0).map((_, i) => ({
        q: `Q${i+1}`,
        opts: ['A', 'B', 'C', 'D'],
        correct: 0
      }));
    }

    const { data, error } = await supabase.from('documents').insert([{
      student_email: studentEmail,
      file_name: req.file.originalname,
      summary,
      extracted_text: text,
      questions_count: questions.length
    }]).select();
    
    if (error) throw error;

    if (data?.[0]) {
      await supabase.from('questions').insert(
        questions.map(q => ({
          document_id: data[0].id,
          question: q.q,
          options: q.opts,
          correct_answer: q.correct || 0,
          explanation: 'Review course material'
        }))
      );
    }

    res.json({ success: true, document: data[0], questions: questions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GAMIFICATION
app.post('/api/answer', async (req, res) => {
  try {
    const { studentId, questionId, answerGiven, timeTaken } = req.body;
    
    const { data: qData } = await supabase
      .from('questions')
      .select('correct_answer')
      .eq('id', questionId)
      .single();
    
    const isCorrect = qData.correct_answer === answerGiven;
    
    await supabase.from('answer_history').insert([{
      student_id: studentId,
      question_id: questionId,
      answer_given: answerGiven,
      is_correct: isCorrect,
      time_taken_seconds: timeTaken
    }]);
    
    if (isCorrect) {
      const points = timeTaken < 30 ? 50 : timeTaken < 60 ? 35 : 20;
      
      const { data: stats } = await supabase
        .from('student_stats')
        .select('aura_points, correct_answers, total_questions_answered')
        .eq('student_id', studentId)
        .single();
      
      const newPoints = (stats?.aura_points || 0) + points;
      const newCorrect = (stats?.correct_answers || 0) + 1;
      const newLevel = Math.floor(newPoints / 500) + 1;
      
      await supabase.from('student_stats').update({
        aura_points: newPoints,
        correct_answers: newCorrect,
        total_questions_answered: (stats?.total_questions_answered || 0) + 1,
        level: newLevel
      }).eq('student_id', studentId);
      
      res.json({ success: true, correct: true, points, newLevel });
    } else {
      res.json({ success: true, correct: false, points: 0 });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// STATS
app.get('/api/stats/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('student_stats')
      .select('*')
      .eq('student_id', req.params.studentId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// SERVE APP
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('🚀 AURA on ' + PORT));
