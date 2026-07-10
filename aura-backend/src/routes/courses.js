const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// GET /api/courses — get all courses for logged-in user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        topics(id, title, progress_percent, order_index),
        assignments(id, title, due_date, status),
        test_dates(id, title, test_date)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json({ courses: data })
  } catch (err) {
    console.error('GET /courses error:', err)
    res.status(500).json({ error: 'Failed to fetch courses' })
  }
})

// GET /api/courses/:id — single course with all details
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        topics(*, uploads(id, file_name, file_type, processing_status, created_at)),
        assignments(*),
        test_dates(*)
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Course not found' })
    }
    res.json({ course: data })
  } catch (err) {
    console.error('GET /courses/:id error:', err)
    res.status(500).json({ error: 'Failed to fetch course' })
  }
})

// POST /api/courses — create a new course
router.post('/', async (req, res) => {
  try {
    const {
      course_name,
      course_code,
      semester,
      exam_date,
      color
    } = req.body

    if (!course_name || !course_code || !semester) {
      return res.status(400).json({
        error: 'course_name, course_code and semester are required'
      })
    }

    const { data, error } = await supabase
      .from('courses')
      .insert({
        user_id: req.user.id,
        course_name,
        course_code,
        semester,
        exam_date: exam_date || null,
        color: color || '#34e89a'
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ course: data })
  } catch (err) {
    console.error('POST /courses error:', err)
    res.status(500).json({ error: 'Failed to create course' })
  }
})

// PATCH /api/courses/:id — update a course
router.patch('/:id', async (req, res) => {
  try {
    const allowed = [
      'course_name','course_code','semester','exam_date','color'
    ]
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Course not found' })
    }
    res.json({ course: data })
  } catch (err) {
    console.error('PATCH /courses/:id error:', err)
    res.status(500).json({ error: 'Failed to update course' })
  }
})

// DELETE /api/courses/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ message: 'Course deleted' })
  } catch (err) {
    console.error('DELETE /courses/:id error:', err)
    res.status(500).json({ error: 'Failed to delete course' })
  }
})

// POST /api/courses/:id/topics — add a topic to a course
router.post('/:id/topics', async (req, res) => {
  try {
    const { title, description, order_index } = req.body
    if (!title) {
      return res.status(400).json({ error: 'title is required' })
    }

    // verify course belongs to user
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (!course) {
      return res.status(404).json({ error: 'Course not found' })
    }

    const { data, error } = await supabase
      .from('topics')
      .insert({
        course_id: req.params.id,
        title,
        description: description || null,
        order_index: order_index || 0
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ topic: data })
  } catch (err) {
    console.error('POST /courses/:id/topics error:', err)
    res.status(500).json({ error: 'Failed to add topic' })
  }
})

// POST /api/courses/:id/assignments — add an assignment
router.post('/:id/assignments', async (req, res) => {
  try {
    const { title, description, due_date } = req.body
    if (!title) {
      return res.status(400).json({ error: 'title is required' })
    }

    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (!course) {
      return res.status(404).json({ error: 'Course not found' })
    }

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        course_id: req.params.id,
        title,
        description: description || null,
        due_date: due_date || null
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ assignment: data })
  } catch (err) {
    console.error('POST /courses/:id/assignments error:', err)
    res.status(500).json({ error: 'Failed to add assignment' })
  }
})

// POST /api/courses/:id/testdates — add a test date
router.post('/:id/testdates', async (req, res) => {
  try {
    const { title, test_date, notes } = req.body
    if (!title || !test_date) {
      return res.status(400).json({ error: 'title and test_date are required' })
    }

    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (!course) {
      return res.status(404).json({ error: 'Course not found' })
    }

    const { data, error } = await supabase
      .from('test_dates')
      .insert({
        course_id: req.params.id,
        title,
        test_date,
        notes: notes || null
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ test_date: data })
  } catch (err) {
    console.error('POST /courses/:id/testdates error:', err)
    res.status(500).json({ error: 'Failed to add test date' })
  }
})

module.exports = router
