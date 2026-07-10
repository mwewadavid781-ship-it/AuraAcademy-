const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const checkPremium = require('../middleware/checkPremium')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ── POST /api/groups — create a group (premium) ────────
router.post('/', checkPremium, async (req, res) => {
  try {
    const { name, description, course_id } = req.body

    if (!name || !course_id) {
      return res.status(400).json({ error: 'name and course_id are required' })
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

    // Create the group
    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .insert({
        name,
        description: description || null,
        course_id,
        owner_id: req.user.id
      })
      .select()
      .single()

    if (groupErr) throw groupErr

    // Auto-add creator as first member
    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: req.user.id
    })

    res.status(201).json({ group })
  } catch (err) {
    console.error('POST /groups error:', err)
    res.status(500).json({ error: 'Failed to create group' })
  }
})

// ── GET /api/groups — all groups user belongs to ───────
router.get('/', async (req, res) => {
  try {
    // Get group IDs the user is a member of
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, last_read_at')
      .eq('user_id', req.user.id)

    if (!memberships || memberships.length === 0) {
      return res.json({ groups: [] })
    }

    const groupIds = memberships.map(m => m.group_id)

    const { data: groups, error } = await supabase
      .from('groups')
      .select(`
        id, name, description, invite_code, is_active, created_at,
        courses(course_name, course_code),
        group_members(count)
      `)
      .in('id', groupIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Attach unread count per group
    const enriched = await Promise.all(groups.map(async (g) => {
      const membership = memberships.find(m => m.group_id === g.id)
      const { count } = await supabase
        .from('group_messages')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', g.id)
        .gt('created_at', membership?.last_read_at || '1970-01-01')

      return { ...g, unread_count: count || 0 }
    }))

    res.json({ groups: enriched })
  } catch (err) {
    console.error('GET /groups error:', err)
    res.status(500).json({ error: 'Failed to fetch groups' })
  }
})

// ── GET /api/groups/:id — single group detail ──────────
router.get('/:id', async (req, res) => {
  try {
    // Check membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group' })
    }

    const { data: group, error } = await supabase
      .from('groups')
      .select(`
        *,
        courses(course_name, course_code),
        group_members(
          user_id, joined_at,
          users(full_name, avatar_url)
        )
      `)
      .eq('id', req.params.id)
      .single()

    if (error || !group) {
      return res.status(404).json({ error: 'Group not found' })
    }

    res.json({ group })
  } catch (err) {
    console.error('GET /groups/:id error:', err)
    res.status(500).json({ error: 'Failed to fetch group' })
  }
})

// ── POST /api/groups/join — join by invite code ────────
router.post('/join', checkPremium, async (req, res) => {
  try {
    const { invite_code } = req.body

    if (!invite_code) {
      return res.status(400).json({ error: 'invite_code is required' })
    }

    const { data: group, error } = await supabase
      .from('groups')
      .select('id, name, is_active')
      .eq('invite_code', invite_code.toUpperCase())
      .single()

    if (error || !group) {
      return res.status(404).json({ error: 'Invalid invite code' })
    }

    if (!group.is_active) {
      return res.status(400).json({ error: 'This group is no longer active' })
    }

    // Check already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', req.user.id)
      .single()

    if (existing) {
      return res.status(200).json({ message: 'Already a member', group })
    }

    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: req.user.id
    })

    res.status(201).json({ message: `Joined ${group.name}`, group })
  } catch (err) {
    console.error('POST /groups/join error:', err)
    res.status(500).json({ error: 'Failed to join group' })
  }
})

// ── GET /api/groups/:id/messages — fetch chat history ──
router.get('/:id/messages', async (req, res) => {
  try {
    // Verify membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group' })
    }

    const limit = parseInt(req.query.limit) || 50
    const before = req.query.before // ISO timestamp for pagination

    let query = supabase
      .from('group_messages')
      .select(`
        id, content, message_type, file_url,
        file_name, metadata, created_at,
        users(full_name, avatar_url)
      `)
      .eq('group_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query
    if (error) throw error

    // Mark as read — update last_read_at
    await supabase
      .from('group_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('group_id', req.params.id)
      .eq('user_id', req.user.id)

    res.json({ messages: messages.reverse() })
  } catch (err) {
    console.error('GET /groups/:id/messages error:', err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// ── POST /api/groups/:id/messages — send a message ─────
router.post('/:id/messages', async (req, res) => {
  try {
    const { content, message_type, file_url, file_name, metadata } = req.body

    // Verify membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group' })
    }

    if (!content && !file_url) {
      return res.status(400).json({ error: 'content or file_url is required' })
    }

    const { data: message, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: req.params.id,
        user_id: req.user.id,
        content: content || null,
        message_type: message_type || 'text',
        file_url: file_url || null,
        file_name: file_name || null,
        metadata: metadata || null
      })
      .select(`
        id, content, message_type, file_url,
        file_name, metadata, created_at,
        users(full_name, avatar_url)
      `)
      .single()

    if (error) throw error

    // Supabase Realtime broadcasts this insert automatically
    // to all subscribers on the group_messages table
    res.status(201).json({ message })
  } catch (err) {
    console.error('POST /groups/:id/messages error:', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// ── DELETE /api/groups/:id — owner can delete group ────
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)

    if (error) throw error
    res.json({ message: 'Group deleted' })
  } catch (err) {
    console.error('DELETE /groups/:id error:', err)
    res.status(500).json({ error: 'Failed to delete group' })
  }
})

// ── DELETE /api/groups/:id/leave — leave a group ───────
router.delete('/:id/leave', async (req, res) => {
  try {
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', req.params.id)
      .eq('user_id', req.user.id)

    res.json({ message: 'Left group' })
  } catch (err) {
    console.error('DELETE /groups/:id/leave error:', err)
    res.status(500).json({ error: 'Failed to leave group' })
  }
})

module.exports = router
