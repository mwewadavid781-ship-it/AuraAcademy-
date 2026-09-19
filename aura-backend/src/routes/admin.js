const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ── GET /api/admin/live-users (admin only) ──────────────
router.get('/live-users', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key']
    if (adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data, error } = await supabase
      .from('users')
      .select('full_name, email, last_seen_at, session_started_at, subscription_status')
      .not('last_seen_at', 'is', null)
      .order('last_seen_at', { ascending: false })

    if (error) throw error

    const now = new Date()
    const users = data.map(u => {
      const lastSeenMinutesAgo = (now - new Date(u.last_seen_at)) / 60000
      return {
        ...u,
        is_live: lastSeenMinutesAgo <= 5
      }
    })

    res.json({ users })
  } catch (err) {
    console.error('GET /admin/live-users error:', err)
    res.status(500).json({ error: 'Failed to fetch live users' })
  }
})

module.exports = router
