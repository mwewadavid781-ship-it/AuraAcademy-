const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const Groq = require('groq-sdk')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Helper: fetch upload text and verify ownership
async function getUploadText(uploadId, userId) {
  const { data, error } = await supabase
    .from('uploads')
    .select('extracted_text, file_name, course_id')
    .eq('id', uploadId)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data
}

// Helper: call Groq
async function callGroq(systemPrompt, userPrompt) {
  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1500
  })
  return response.choices[0]?.message?.content || ''
}

// ── POST /api/ai/simplify ──────────────────────────────
router.post('/simplify', async (req, res) => {
  try {
    const { upload_id, text } = req.body
    let content = text || ''

    if (upload_id) {
      const upload = await getUploadText(upload_id, req.user.id)
      if (!upload) return res.status(404).json({ error: 'Upload not found' })
      content = upload.extracted_text
    }

    if (!content || content.length < 10) {
      return res.status(400).json({ error: 'No content to simplify' })
    }

    const system = `You are a study assistant for Zambian university students.
Your job is to simplify complex academic content into easy, clear bullet points.
Use simple English. Keep each bullet under 5 sentences.
Format: start each point with •`

    const prompt = `Simplify this content into clear study bullet points:\n\n${content.slice(0, 4000)}`

    const result = await callGroq(system, prompt)
    res.json({ result, type: 'simplify' })
  } catch (err) {
    console.error('POST /ai/simplify error:', err)
    res.status(500).json({ error: 'AI simplify failed' })
  }
})

// ── POST /api/ai/explain ───────────────────────────────
router.post('/explain', async (req, res) => {
  try {
    const { upload_id, topic, text } = req.body
    let content = text || ''

    if (!topic) {
      return res.status(400).json({ error: 'topic is required' })
    }

    if (upload_id) {
      const upload = await getUploadText(upload_id, req.user.id)
      if (!upload) return res.status(404).json({ error: 'Upload not found' })
      content = upload.extracted_text
    }

  const system = `You are a friendly university tutor for Zambian students.
Explain topics clearly using the student's own uploaded notes first.
Then give 1-2 real-world examples relevant to Zambia or Africa where possible.
Keep the tone warm and encouraging.
Do not use Markdown formatting — no #, ##, **, or | table symbols.
Write in plain text with clear paragraph breaks.`

    const prompt = content
      ? `Using these notes:\n\n${content.slice(0, 3000)}\n\nExplain: "${topic}"`
      : `Explain this university topic clearly with examples: "${topic}"`

    const result = await callGroq(system, prompt)
    res.json({ result, type: 'explain' })
  } catch (err) {
    console.error('POST /ai/explain error:', err)
    res.status(500).json({ error: 'AI explain failed' })
  }
})

// ── POST /api/ai/ask ───────────────────────────────────
router.post('/ask', async (req, res) => {
  try {
    const { upload_id, question, history } = req.body

    if (!question) {
      return res.status(400).json({ error: 'question is required' })
    }

    let content = ''
    if (upload_id) {
      const upload = await getUploadText(upload_id, req.user.id)
      if (!upload) return res.status(404).json({ error: 'Upload not found' })
      content = upload.extracted_text
    }

const system = `You are Aura, an AI study tutor for university students in Zambia.
Answer questions based on the student's uploaded notes.
If the answer is not in the notes, say so clearly, then still help from your knowledge.
Be concise, accurate, and encouraging.
Never make up facts.
Do not use Markdown formatting — no #, ##, **, or | table symbols.
Write in plain text. Use simple bullet points starting with • if you need a list.
To emphasize a term, use CAPITALS or simply repeat it clearly in the sentence, never asterisks.`

    const messages = [{ role: 'system', content: system }]

    if (content) {
      messages.push({
        role: 'user',
        content: `My notes for context:\n\n${content.slice(0, 2500)}`
      })
      messages.push({
        role: 'assistant',
        content: 'Got it, I have read your notes. Ask me anything about them.'
      })
    }

    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    messages.push({ role: 'user', content: question })

    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages,
      temperature: 0.6,
      max_tokens: 1000
    })

    const result = response.choices[0]?.message?.content || ''
    res.json({ result, type: 'ask' })
  } catch (err) {
    console.error('POST /ai/ask error:', err)
    res.status(500).json({ error: 'AI ask failed' })
  }
})

// ── POST /api/ai/flashcards ────────────────────────────
router.post('/flashcards', async (req, res) => {
  try {
    const { upload_id, course_id, count } = req.body

    if (!upload_id) {
      return res.status(400).json({ error: 'upload_id is required' })
    }

    const upload = await getUploadText(upload_id, req.user.id)
    if (!upload) return res.status(404).json({ error: 'Upload not found' })

    const numCards = Math.min(parseInt(count) || 10, 20)

    const system = `You are a study assistant. Generate flashcards from academic content.
Return ONLY valid JSON. No explanation, no markdown, no backticks.
Format: [{"question":"...","answer":"..."}]`

    const prompt = `Generate ${numCards} flashcards from this content.
Each answer should be 1-2 sentences max.

Content:
${upload.extracted_text.slice(0, 3500)}`

    const raw = await callGroq(system, prompt)

    let cards = []
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      cards = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'Failed to parse flashcards' })
    }

    const inserts = cards.map(c => ({
      user_id: req.user.id,
      course_id: upload.course_id || course_id,
      question: c.question,
      answer: c.answer
    }))

    const { data, error } = await supabase
      .from('flashcards')
      .insert(inserts)
      .select()

    if (error) throw error
    res.json({ flashcards: data, count: data.length })
  } catch (err) {
    console.error('POST /ai/flashcards error:', err)
    res.status(500).json({ error: 'Flashcard generation failed' })
  }
})

// ── GET /api/ai/flashcards/:course_id ─────────────────
router.get('/flashcards/:course_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('course_id', req.params.course_id)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ flashcards: data })
  } catch (err) {
    console.error('GET /ai/flashcards error:', err)
    res.status(500).json({ error: 'Failed to fetch flashcards' })
  }
})

module.exports = router
