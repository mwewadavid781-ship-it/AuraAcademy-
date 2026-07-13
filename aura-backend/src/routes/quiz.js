const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const Groq = require('groq-sdk')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── POST /api/quiz/generate ────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { upload_id, course_id, topic_id, count } = req.body

    if (!upload_id) {
      return res.status(400).json({ error: 'upload_id is required' })
    }

    // Fetch upload and verify ownership
    const { data: upload, error: upErr } = await supabase
      .from('uploads')
      .select('extracted_text, file_name, course_id')
      .eq('id', upload_id)
      .eq('user_id', req.user.id)
      .single()

    if (upErr || !upload) {
      return res.status(404).json({ error: 'Upload not found' })
    }

    if (!upload.extracted_text || upload.extracted_text.length < 50) {
      return res.status(400).json({ error: 'Upload has no extractable text' })
    }

    const numQ = Math.min(parseInt(count) || 10, 20)

    const system = `You are a university exam question generator.
Generate a mix of MCQ, true/false, and short-answer questions.
Return ONLY valid JSON array. No markdown, no backticks, no explanation.
Format exactly:
[
  {
    "type": "mcq",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A. ...",
    "explanation": "..."
  },
  {
    "type": "truefalse",
    "question": "...",
    "options": ["True", "False"],
    "answer": "True",
    "explanation": "..."
  },
  {
    "type": "shortanswer",
    "question": "...",
    "options": [],
    "answer": "...",
    "explanation": "..."
  }
]`

    const prompt = `Generate ${numQ} quiz questions from this academic content.
Mix the types: roughly 50% MCQ, 25% true/false, 25% short answer.

Content:
${upload.extracted_text.slice(0, 3500)}`

    const response = await groq.chat.completions.create({
  model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 2000
    })

    const raw = response.choices[0]?.message?.content || ''

    let questions = []
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      questions = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'Failed to parse quiz questions' })
    }

    // Save quiz to DB (unattempted)
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .insert({
        user_id: req.user.id,
        course_id: upload.course_id || course_id,
        upload_id,
        topic_id: topic_id || null,
        title: `Quiz — ${upload.file_name}`,
        questions,
        total_questions: questions.length
      })
      .select()
      .single()

    if (quizErr) throw quizErr
    res.status(201).json({ quiz })
  } catch (err) {
    console.error('POST /quiz/generate error:', err)
    res.status(500).json({ error: 'Quiz generation failed' })
  }
})

// ── GET /api/quiz?course_id=xxx ────────────────────────
router.get('/', async (req, res) => {
  try {
    const { course_id } = req.query

    let query = supabase
      .from('quizzes')
      .select('id, title, total_questions, score, attempted_at, created_at, course_id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (course_id) query = query.eq('course_id', course_id)

    const { data, error } = await query
    if (error) throw error
    res.json({ quizzes: data })
  } catch (err) {
    console.error('GET /quiz error:', err)
    res.status(500).json({ error: 'Failed to fetch quizzes' })
  }
})

// ── GET /api/quiz/:id ──────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Quiz not found' })
    }
    res.json({ quiz: data })
  } catch (err) {
    console.error('GET /quiz/:id error:', err)
    res.status(500).json({ error: 'Failed to fetch quiz' })
  }
})

// ── POST /api/quiz/:id/submit ──────────────────────────
// Student submits answers, get score + weak topics back
router.post('/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body
    // answers: [{ question_index: 0, answer: "A. ..." }]

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers array is required' })
    }

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !quiz) {
      return res.status(404).json({ error: 'Quiz not found' })
    }

    const questions = quiz.questions
    let correct = 0
    const results = []

    for (const submission of answers) {
      const q = questions[submission.question_index]
      if (!q) continue
      const isCorrect =
        submission.answer?.trim().toLowerCase() ===
        q.answer?.trim().toLowerCase()
      if (isCorrect) correct++
      results.push({
        question_index: submission.question_index,
        question: q.question,
        your_answer: submission.answer,
        correct_answer: q.answer,
        explanation: q.explanation,
        is_correct: isCorrect
      })
    }

    const score = Math.round((correct / questions.length) * 100)

    // Save score to DB
    await supabase
      .from('quizzes')
      .update({ score, attempted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    // Readiness label
    let readiness = 'Needs Work'
    if (score >= 80) readiness = 'Exam Ready'
    else if (score >= 60) readiness = 'Almost There'
    else if (score >= 40) readiness = 'Keep Studying'

    res.json({
      score,
      correct,
      total: questions.length,
      readiness,
      results
    })
  } catch (err) {
    console.error('POST /quiz/:id/submit error:', err)
    res.status(500).json({ error: 'Failed to submit quiz' })
  }
})

// ── GET /api/quiz/progress/:course_id ─────────────────
// Returns average score and readiness per course
router.get('/progress/:course_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('score, total_questions, attempted_at, title')
      .eq('course_id', req.params.course_id)
      .eq('user_id', req.user.id)
      .not('score', 'is', null)
      .order('attempted_at', { ascending: false })

    if (error) throw error

    const attempted = data.length
    const avg = attempted
      ? Math.round(data.reduce((s, q) => s + q.score, 0) / attempted)
      : 0

    let readiness = 'Not Started'
    if (attempted > 0) {
      if (avg >= 80) readiness = 'Exam Ready'
      else if (avg >= 60) readiness = 'Almost There'
      else if (avg >= 40) readiness = 'Keep Studying'
      else readiness = 'Needs Work'
    }

    res.json({
      attempted,
      average_score: avg,
      readiness,
      history: data
    })
  } catch (err) {
    console.error('GET /quiz/progress error:', err)
    res.status(500).json({ error: 'Failed to fetch progress' })
  }
})

module.exports = router
