const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// PATCH /api/topics/:id — update topic progress
router.patch('/:id', async (req, res) => {
  try {
    const { progress_percent, title, description } = req.body

    const updates = {}
    if (progress_percent !== undefined) updates.progress_percent = progress_percent
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    // Verify the topic belongs to a course owned by this user
    const { data: topic } = await supabase
      .from('topics')
      .select('id, course_id, courses(user_id)')
      .eq('id', req.params.id)
      .single()

    if (!topic || topic.courses.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Topic not found' })
    }

    const { data, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json({ topic: data })
  } catch (err) {
    console.error('PATCH /topics/:id error:', err)
    res.status(500).json({ error: 'Failed to update topic' })
  }
})

// DELETE /api/topics/:id
router.delete('/:id', async (req, res) => {
  try {
    const { data: topic } = await supabase
      .from('topics')
      .select('id, courses(user_id)')
      .eq('id', req.params.id)
      .single()

    if (!topic || topic.courses.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Topic not found' })
    }

    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ message: 'Topic deleted' })
  } catch (err) {
    console.error('DELETE /topics/:id error:', err)
    res.status(500).json({ error: 'Failed to delete topic' })
  }
})

module.exports = router
