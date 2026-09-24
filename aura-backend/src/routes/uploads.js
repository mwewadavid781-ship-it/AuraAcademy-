const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const multer = require('multer')
const pdfParse = require('pdf-parse')
const Groq = require('groq-sdk')
const officeParser = require('officeparser')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const allowed = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', PPTX]
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, allowed.includes(file.mimetype)) })

function cleanExtractedText(value) {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''
  if (Buffer.isBuffer(value)) return value.toString('utf8').trim()
  if (typeof value === 'object') {
    return Object.values(value).map(cleanExtractedText).filter(Boolean).join('\n').trim()
  }
  return String(value).trim()
}

async function extractText(buffer, mimetype) {
  try {
    if (mimetype === 'application/pdf') return cleanExtractedText((await pdfParse(buffer)).text)
    if (mimetype === 'text/plain') return cleanExtractedText(buffer)
    if (mimetype === PPTX) return cleanExtractedText(await officeParser.parseOfficeAsync(buffer))
  } catch (err) {
    console.error('Text extraction error:', err)
  }
  return ''
}

async function extractImageText(publicUrl) {
  try {
    const response = await groq.chat.completions.create({
      model: 'qwen/qwen3.6-27b',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Transcribe all readable text in this study-note image, including headings, bullets, formulas and labels. Return only the transcription.' },
        { type: 'image_url', image_url: { url: publicUrl } }
      ] }], temperature: 0.2, max_tokens: 2000
    })
    return cleanExtractedText(response.choices[0]?.message?.content)
  } catch (err) {
    console.error('Image vision extraction error:', err)
    return ''
  }
}

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { course_id, topic_id } = req.body
    if (!course_id) return res.status(400).json({ error: 'course_id is required' })
    if (!req.file) return res.status(400).json({ error: 'No file provided' })

    const { data: course } = await supabase.from('courses').select('id').eq('id', course_id).eq('user_id', req.user.id).single()
    if (!course) return res.status(404).json({ error: 'Course not found' })

    let selectedTopic = topic_id || null
    if (selectedTopic) {
      const { data: topic } = await supabase.from('topics').select('id').eq('id', selectedTopic).eq('course_id', course_id).single()
      if (!topic) return res.status(400).json({ error: 'Topic does not belong to this course' })
    }

    const ext = req.file.originalname.split('.').pop()
    const storagePath = `${req.user.id}/${course_id}/${Date.now()}.${ext}`
    const { error: storageError } = await supabase.storage.from('uploads').upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false })
    if (storageError) throw storageError
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(storagePath)

    const typeMap = { 'application/pdf': 'pdf', 'text/plain': 'text', 'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', [PPTX]: 'pptx' }
    const fileType = typeMap[req.file.mimetype] || 'text'
    const extractedText = fileType === 'image' ? await extractImageText(urlData.publicUrl) : await extractText(req.file.buffer, req.file.mimetype)

    const { data: uploadRecord, error: dbError } = await supabase.from('uploads').insert({
      user_id: req.user.id, course_id, topic_id: selectedTopic, file_name: req.file.originalname,
      file_url: urlData.publicUrl, file_type: fileType, file_size_kb: Math.round(req.file.size / 1024),
      extracted_text: extractedText, processing_status: extractedText ? 'done' : 'failed'
    }).select().single()
    if (dbError) throw dbError

    res.status(201).json({ upload: uploadRecord, extracted: Boolean(extractedText), extracted_characters: extractedText.length, extraction_warning: !extractedText ? 'No readable text was found. Try exporting the presentation as PPTX or PDF.' : null, actions: ['simplify', 'explain', 'ask', 'quiz', 'flashcards'] })
  } catch (err) {
    console.error('POST /uploads error:', err)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

router.get('/', async (req, res) => {
  try {
    let query = supabase.from('uploads').select('id, file_name, file_type, file_size_kb, processing_status, topic_id, created_at').eq('user_id', req.user.id).order('created_at', { ascending: false })
    if (req.query.course_id) query = query.eq('course_id', req.query.course_id)
    const { data, error } = await query
    if (error) throw error
    res.json({ uploads: data })
  } catch (err) { console.error('GET /uploads error:', err); res.status(500).json({ error: 'Failed to fetch uploads' }) }
})

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('uploads').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single()
    if (error || !data) return res.status(404).json({ error: 'Upload not found' })
    res.json({ upload: data })
  } catch (err) { console.error('GET /uploads/:id error:', err); res.status(500).json({ error: 'Failed to fetch upload' }) }
})

router.delete('/:id', async (req, res) => {
  try {
    const { data: file } = await supabase.from('uploads').select('file_url').eq('id', req.params.id).eq('user_id', req.user.id).single()
    if (!file) return res.status(404).json({ error: 'Upload not found' })
    const path = file.file_url.split('/uploads/')[1]
    if (path) await supabase.storage.from('uploads').remove([path])
    await supabase.from('uploads').delete().eq('id', req.params.id).eq('user_id', req.user.id)
    res.json({ message: 'Upload deleted' })
  } catch (err) { console.error('DELETE /uploads/:id error:', err); res.status(500).json({ error: 'Failed to delete upload' }) }
})

module.exports = router
