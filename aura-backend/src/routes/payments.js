const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const requireAuth = require('../middleware/auth')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const WEEKLY_AMOUNT = 10.00
const MOMO_NUMBER = '0964969767'

// ── GET /api/payments/status — check subscription ──────
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_expiry, trial_start_date')
      .eq('id', req.user.id)
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const now = new Date()
    const trialEnd = new Date(
      new Date(user.trial_start_date).getTime() + 7 * 24 * 60 * 60 * 1000
    )
    const trialDaysLeft = Math.max(
      0,
      Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
    )

    let isLocked = false
    if (user.subscription_status === 'expired') isLocked = true
    if (user.subscription_status === 'trial' && now > trialEnd) isLocked = true
    if (
      user.subscription_status === 'active' &&
      new Date(user.subscription_expiry) < now
    ) isLocked = true

    res.json({
      status: user.subscription_status,
      subscription_expiry: user.subscription_expiry,
      trial_end: trialEnd.toISOString(),
      trial_days_left: trialDaysLeft,
      is_locked: isLocked,
      momo_number: MOMO_NUMBER,
      weekly_amount: WEEKLY_AMOUNT
    })
  } catch (err) {
    console.error('GET /payments/status error:', err)
    res.status(500).json({ error: 'Failed to fetch status' })
  }
})

// ── POST /api/payments/initiate ────────────────────────
router.post('/initiate', requireAuth, async (req, res) => {
  try {
    const { momo_ref, momo_number } = req.body

    if (!momo_ref) {
      return res.status(400).json({
        error: 'momo_ref (your MoMo transaction ID) is required'
      })
    }

    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('momo_ref', momo_ref)
      .single()

    if (existing) {
      if (existing.status === 'success') {
        return res.status(400).json({ error: 'This transaction was already used' })
      }
      return res.status(400).json({ error: 'This reference is already submitted' })
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        user_id: req.user.id,
        amount: WEEKLY_AMOUNT,
        currency: 'ZMW',
        momo_ref,
        momo_number: momo_number || MOMO_NUMBER,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({
      payment,
      message: 'Payment submitted. Your account will be activated within minutes after verification.'
    })
  } catch (err) {
    console.error('POST /payments/initiate error:', err)
    res.status(500).json({ error: 'Failed to submit payment' })
  }
})

// ── POST /api/payments/verify (admin only) ─────────────
router.post('/verify', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key']
    if (adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { payment_id } = req.body
    if (!payment_id) {
      return res.status(400).json({ error: 'payment_id is required' })
    }

    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single()

    if (payErr || !payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (payment.status === 'success') {
      return res.status(400).json({ error: 'Already verified' })
    }

    await supabase
      .from('payments')
      .update({
        status: 'success',
        verified_at: new Date().toISOString()
      })
      .eq('id', payment_id)

    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await supabase
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_expiry: expiry.toISOString()
      })
      .eq('id', payment.user_id)

    res.json({
      message: 'Payment verified. Subscription activated.',
      expiry: expiry.toISOString()
    })
  } catch (err) {
    console.error('POST /payments/verify error:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

// ── GET /api/payments/history ──────────────────────────
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, currency, momo_ref, status, verified_at, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ payments: data })
  } catch (err) {
    console.error('GET /payments/history error:', err)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

// ── GET /api/payments/pending (admin only) ─────────────
router.get('/pending', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key']
    if (adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, amount, momo_ref, momo_number,
        status, created_at,
        users(full_name, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json({ pending: data })
  } catch (err) {
    console.error('GET /payments/pending error:', err)
    res.status(500).json({ error: 'Failed to fetch pending payments' })
  }
})

module.exports = router
