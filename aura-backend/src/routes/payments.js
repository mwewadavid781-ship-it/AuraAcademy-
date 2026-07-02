const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const { v4: uuidv4 } = require('uuid')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ── POST /api/payments/initiate ────────────────────────
// Frontend calls this to start a payment
router.post('/initiate', async (req, res) => {
  try {
    const { phone_number, amount, plan_type } = req.body
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!phone_number || !amount || !plan_type) {
      return res.status(400).json({
        error: 'phone_number, amount, and plan_type are required'
      })
    }

    // Verify user from token
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Validate plan
    const validPlans = {
      monthly: 50,      // ZMW
      quarterly: 120,   // ZMW
      annual: 400       // ZMW
    }

    if (!validPlans[plan_type] || validPlans[plan_type] !== amount) {
      return res.status(400).json({ error: 'Invalid amount for plan' })
    }

    // Create payment record in DB (pending)
    const paymentId = uuidv4()
    const { error: payErr } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        user_id: user.id,
        phone_number,
        amount,
        plan_type,
        status: 'pending',
        mtn_reference: null
      })

    if (payErr) throw payErr

    // TODO: Call MTN MoMo API to initiate payment
    // This is a placeholder — integrate actual MTN MoMo SDK/API
    const mtnReference = `MTN-${Date.now()}-${paymentId.slice(0, 8)}`

    res.status(201).json({
      payment_id: paymentId,
      mtn_reference: mtnReference,
      message: 'Payment initiated. Please confirm on your phone.'
    })
  } catch (err) {
    console.error('POST /payments/initiate error:', err)
    res.status(500).json({ error: 'Payment initiation failed' })
  }
})

// ── POST /api/payments/webhook ─────────────────────────
// MTN MoMo calls this to confirm payment (webhook)
router.post('/webhook', async (req, res) => {
  try {
    const { reference, status, user_id, amount, plan_type } = req.body

    if (!reference || !status) {
      return res.status(400).json({ error: 'reference and status required' })
    }

    // Verify webhook came from MTN (in production, check signature)
    // For now, just process it

    if (status === 'success') {
      // Find payment by reference
      const { data: payment, error: payErr } = await supabase
        .from('payments')
        .select('id, user_id')
        .eq('mtn_reference', reference)
        .single()

      if (payErr || !payment) {
        return res.status(404).json({ error: 'Payment not found' })
      }

      // Update payment status
      await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('id', payment.id)

      // Calculate subscription expiry based on plan
      const now = new Date()
      let expiryDate = new Date(now)

      const planDuration = {
        monthly: 30,
        quarterly: 90,
        annual: 365
      }

      if (planDuration[plan_type]) {
        expiryDate.setDate(expiryDate.getDate() + planDuration[plan_type])
      }

      // Update user subscription
      const { error: subErr } = await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_expiry: expiryDate.toISOString(),
          subscription_plan: plan_type
        })
        .eq('id', payment.user_id)

      if (subErr) throw subErr

      res.json({ success: true, message: 'Payment confirmed and subscription activated' })
    } else if (status === 'failed') {
      // Update payment to failed
      const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('mtn_reference', reference)
        .single()

      if (payment) {
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id)
      }

      res.json({ success: false, message: 'Payment failed' })
    } else {
      res.json({ success: false, message: 'Unknown status' })
    }
  } catch (err) {
    console.error('POST /payments/webhook error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// ── GET /api/payments/status/:payment_id ───────────────
// Check payment status
router.get('/status/:payment_id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', req.params.payment_id)
      .eq('user_id', user.id)
      .single()

    if (error || !payment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    res.json({ payment })
  } catch (err) {
    console.error('GET /payments/status error:', err)
    res.status(500).json({ error: 'Failed to fetch payment status' })
  }
})

// ── GET /api/payments/history ──────────────────────────
// Get user's payment history
router.get('/history', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({ payments })
  } catch (err) {
    console.error('GET /payments/history error:', err)
    res.status(500).json({ error: 'Failed to fetch payment history' })
  }
})

module.exports = router
