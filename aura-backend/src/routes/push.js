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

module.exports = router
