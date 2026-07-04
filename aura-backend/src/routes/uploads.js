const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const multer = require('multer')
const pdfParse = require('pdf-parse')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Multer — store in memory, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('File type not allowed'))
    }
  }
})

// Helper: extract text from buffer
async function extractText(buffer, mimetype) {
  try {
    if (mimetype === 'application/pdf') {
      const parsed = await pdfParse(buffer)
      return parsed.text.trim()
    }
    if (mimetype === 'text/plain') {
      return buffer.toString('utf8').trim()
    }
    // images — return placeholder; AI route handles vision later
    return '[Image uploaded — use AI Explain to analyse this file]'
  } catch (err) {
    console.error('Text extraction error:', err)
    return ''
  }
}

// POST /api/uploads — upload a file, extract text, save to Supabase
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { course_id, topic_id } = req.body

    if (!course_id) {
      return res.status(400).json({ error: 'course_id is required' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // Verify course belongs to user
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', course_id)
      .eq('user_id', req.user.id)
      .single()

    if (!course) {
      return res.status(404).json({ error: 'Course not found' })
    }

    const file = req.file
    const ext = file.originalname.split('.').pop()
    const storagePath = `${req.user.id}/${course_id}/${Date.now()}.${ext}`

    // Upload to Supabase Storage bucket "uploads"
    const { error: storageError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      })

    if (storageError) throw storageError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath)

    // Extract text
    const extractedText = await extractText(file.buffer, file.mimetype)

    // Determine file type label
    const typeMap = {
      'application/pdf': 'pdf',
      'text/plain': 'text',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/webp': 'image'
    }

    // Save record to DB
    const { data: uploadRecord, error: dbError } = await supabase
      .from('uploads')
      .insert({
        user_id: req.user.id,
        course_id,
        topic_id: topic_id || null,
        file_name: file.originalname,
        file_url: urlData.publicUrl,
        file_type: typeMap[file.mimetype] || 'text',
        file_size_kb: Math.round(file.size / 1024),
        extracted_text: extractedText,
        processing_status: extractedText ? 'done' : 'pending'
      })
      .select()
      .single()

    if (dbError) throw dbError

    res.status(201).json({
      upload: uploadRecord,
      extracted: !!extractedText,
      actions: [
        'simplify',
        'explain',
        'ask',
        'quiz',
        'flashcards'
      ]
    })
  } catch (err) {
    console.error('POST /uploads error:', err)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

// GET /api/uploads?course_id=xxx — list uploads for a course
router.get('/', async (req, res) => {
  try {
    const { course_id } = req.query

    let query = supabase
      .from('uploads')
      .select('id, file_name, file_type, file_size_kb, processing_status, topic_id, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (course_id) {
      query = query.eq('course_id', course_id)
    }

    const { data, error } = await query
    if (error) throw error
    res.json({ uploads: data })
  } catch (err) {
    console.error('GET /uploads error:', err)
    res.status(500).json({ error: 'Failed to fetch uploads' })
  }
})

// GET /api/uploads/:id — get single upload with extracted text
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Upload not found' })
    }
    res.json({ upload: data })
  } catch (err) {
    console.error('GET /uploads/:id error:', err)
    res.status(500).json({ error: 'Failed to fetch upload' })
  }
})

// DELETE /api/uploads/:id
router.delete('/:id', async (req, res) => {
  try {
    const { data: upload } = await supabase
      .from('uploads')
      .select('file_url')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' })
    }

    // Remove from storage
    const path = upload.file_url.split('/uploads/')[1]
    if (path) {
      await supabase.storage.from('uploads').remove([path])
    }

    // Remove DB record
    await supabase
      .from('uploads')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    res.json({ message: 'Upload deleted' })
  } catch (err) {
    console.error('DELETE /uploads/:id error:', err)
    res.status(500).json({ error: 'Failed to delete upload' })
  }
})

module.exports = router
