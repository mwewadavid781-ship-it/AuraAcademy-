const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const Groq = require('groq-sdk')
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── POST /api/quiz/:id/submit ──────────────────────────
router.post('/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body

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
    const results = []

    // Separate short-answer questions — these need AI grading, not exact match
    const shortAnswerItems = []

    for (const submission of answers) {
      const q = questions[submission.question_index]
      if (!q) continue

      if (q.type === 'shortanswer') {
        // Placeholder — will be filled in after AI grading below
        shortAnswerItems.push({
          question_index: submission.question_index,
          question: q.question,
          expected: q.answer,
          student_answer: submission.answer || ''
        })
        results.push({
          question_index: submission.question_index,
          question: q.question,
          your_answer: submission.answer,
          correct_answer: q.answer,
          explanation: q.explanation,
          is_correct: null // filled in below
        })
      } else {
        // MCQ / True-False — exact match works fine, options are constrained
        const isCorrect =
          submission.answer?.trim().toLowerCase() ===
          q.answer?.trim().toLowerCase()
        results.push({
          question_index: submission.question_index,
          question: q.question,
          your_answer: submission.answer,
          correct_answer: q.answer,
          explanation: q.explanation,
          is_correct: isCorrect
        })
      }
    }

    // Batch-grade all short-answer questions in ONE Groq call (keeps token usage low)
    if (shortAnswerItems.length > 0) {
      const gradingList = shortAnswerItems.map((item, i) =>
        `${i + 1}. Question: ${item.question}\nExpected answer: ${item.expected}\nStudent's answer: ${item.student_answer}`
      ).join('\n\n')

      const system = `You are grading short-answer quiz responses for a university student.
For each item, judge if the student's answer captures the correct meaning — even if worded completely differently from the expected answer. Be reasonably generous: minor wording differences, synonyms, or less formal phrasing should still count as correct if the core idea is right. Only mark it wrong if the meaning is genuinely incorrect or missing.
Return ONLY a valid JSON array of true/false values, in the same order as the items given. No explanation, no markdown.
Example output: [true, false, true]`

      try {
        const response = await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: gradingList }
          ],
          temperature: 0.2,
          max_tokens: 300
        })

        const raw = response.choices[0]?.message?.content || '[]'
        const clean = raw.replace(/```json|```/g, '').trim()
        const gradedResults = JSON.parse(clean)

        shortAnswerItems.forEach((item, i) => {
          const resultEntry = results.find(r => r.question_index === item.question_index)
          if (resultEntry) {
            resultEntry.is_correct = gradedResults[i] === true
          }
        })
      } catch (gradeErr) {
        console.error('Short-answer grading failed, falling back to exact match:', gradeErr)
        // Fallback — if AI grading fails for any reason, don't leave it null
        shortAnswerItems.forEach(item => {
          const resultEntry = results.find(r => r.question_index === item.question_index)
          if (resultEntry) {
            resultEntry.is_correct =
              item.student_answer.trim().toLowerCase() === item.expected.trim().toLowerCase()
          }
        })
      }
    }

    const correct = results.filter(r => r.is_correct).length
    const score = Math.round((correct / questions.length) * 100)

    await supabase
      .from('quizzes')
      .update({ score, attempted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    if (quiz.topic_id) {
      const { data: topicRow } = await supabase
        .from('topics')
        .select('progress_percent')
        .eq('id', quiz.topic_id)
        .single()

      if (topicRow) {
        const newProgress = Math.max(topicRow.progress_percent, score)
        await supabase
          .from('topics')
          .update({ progress_percent: newProgress })
          .eq('id', quiz.topic_id)
      }
    }

    let readiness = 'Needs Work'
    if (score >= 80) readiness = 'Exam Ready'
    else if (score >= 60) readiness = 'Almost There'
    else if (score >= 40) readiness = 'Keep Studying'

    res.json({
      score,
      correct,
      total: questions.length,
      readiness,
      results,
      topic_updated: !!quiz.topic_id
    })
  } catch (err) {
    console.error('POST /quiz/:id/submit error:', err)
    res.status(500).json({ error: 'Failed to submit quiz' })
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

    // ── NEW: if this quiz is linked to a topic, update that topic's progress ──
    if (quiz.topic_id) {
      const { data: topicRow } = await supabase
        .from('topics')
        .select('progress_percent')
        .eq('id', quiz.topic_id)
        .single()

      if (topicRow) {
        const newProgress = Math.max(topicRow.progress_percent, score)
        await supabase
          .from('topics')
          .update({ progress_percent: newProgress })
          .eq('id', quiz.topic_id)
      }
    }

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
      results,
      topic_updated: !!quiz.topic_id
    })
  } catch (err) {
    console.error('POST /quiz/:id/submit error:', err)
    res.status(500).json({ error: 'Failed to submit quiz' })
  }
})

// ── POST /api/quiz/:id/retest-weak ─────────────────────
// Generates a focused mini-quiz on topics the student got wrong
router.post('/:id/retest-weak', async (req, res) => {
  try {
    const { wrong_questions } = req.body

    if (!wrong_questions || !Array.isArray(wrong_questions) || wrong_questions.length === 0) {
      return res.status(400).json({ error: 'wrong_questions array is required' })
    }

    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .select('upload_id, course_id, topic_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (quizErr || !quiz) {
      return res.status(404).json({ error: 'Original quiz not found' })
    }

    const { data: upload, error: upErr } = await supabase
      .from('uploads')
      .select('extracted_text, file_name')
      .eq('id', quiz.upload_id)
      .eq('user_id', req.user.id)
      .single()

    if (upErr || !upload) {
      return res.status(404).json({ error: 'Original upload not found' })
    }

    const weakList = wrong_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')

    const system = `You are a university exam question generator specializing in targeted revision.
Return ONLY valid JSON array. No markdown, no backticks, no explanation.
Format exactly:
[
  {
    "type": "mcq",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A. ...",
    "explanation": "..."
  }
]`

    const prompt = `A student got these questions wrong on a previous quiz:
${weakList}

Using the course content below, generate 5 NEW questions that test the same underlying concepts these wrong answers reveal weakness in — different wording, same topics, so the student can practice until it sticks. Mostly MCQ.

Content:
${upload.extracted_text.slice(0, 6000)}`

    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 1500
    })

    const raw = response.choices[0]?.message?.content || ''
    let questions = []
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      questions = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'Failed to generate focused quiz' })
    }

    const { data: newQuiz, error: newQuizErr } = await supabase
      .from('quizzes')
      .insert({
        user_id: req.user.id,
        course_id: quiz.course_id,
        upload_id: quiz.upload_id,
        topic_id: quiz.topic_id,
        title: `Focus Quiz — ${upload.file_name}`,
        questions,
        total_questions: questions.length
      })
      .select()
      .single()

    if (newQuizErr) throw newQuizErr
    res.status(201).json({ quiz: newQuiz })
  } catch (err) {
    console.error('POST /quiz/:id/retest-weak error:', err)
    res.status(500).json({ error: 'Failed to generate weak-area quiz' })
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
