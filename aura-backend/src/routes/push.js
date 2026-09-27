const express = require('express')
const router = express.Router()
const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// ── POST /api/push/subscribe ────────────────────────────
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body
    await supabase.from('push_subscriptions').insert({
      user_id: req.user.id,
      subscription
    })
    res.status(201).json({ message: 'Subscribed' })
  } catch (err) {
    console.error('POST /push/subscribe error:', err)
    res.status(500).json({ error: 'Failed to subscribe' })
  }
})

// ── GET /api/push/vapid-key ─────────────────────────────
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

// ── POST /api/push/notify-inactive ──────────────────────
// One-off script or scheduled route — sends to anyone who hasn't been seen in 3+ days
router.post('/notify-inactive', async (req, res) => {
  const adminKey = req.headers['x-admin-key']
  if (adminKey !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription, user_id, users!inner(last_seen_at)')
      .lt('users.last_seen_at', threeDaysAgo)

    for (const s of subs || []) {
      webpush.sendNotification(s.subscription, JSON.stringify({
        title: 'Aura misses you! 📚',
        body: "Your notes are waiting — come simplify something!"
      })).catch(() => {})
    }

    res.json({ sent: subs?.length || 0 })
  } catch (err) {
    console.error('POST /push/notify-inactive error:', err)
    res.status(500).json({ error: 'Failed to send notifications' })
  }
})

module.exports = router
