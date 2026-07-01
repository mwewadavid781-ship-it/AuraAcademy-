const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ── POST /api/auth/signup ──────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body

    if (!email || !password || !full_name) {
      return res.status(400).json({
        error: 'email, password and full_name are required'
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      })
    }

    // Create auth user in Supabase
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authErr) {
      if (authErr.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email already in use' })
      }
      throw authErr
    }

    const userId = authData.user.id

    // Create user profile row with trial start
    const { error: profileErr } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        full_name,
        trial_start_date: new Date().toISOString(),
        subscription_status: 'trial',
        streak_count: 0
      })

    if (profileErr) throw profileErr

    // Sign in immediately to return a session token
    const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (signInErr) throw signInErr

    res.status(201).json({
      message: 'Account created. 7-day free trial started.',
      token: session.session.access_token,
      user: {
        id: userId,
        email,
        full_name,
        subscription_status: 'trial'
      }
    })
  } catch (err) {
    console.error('POST /auth/signup error:', err)
    res.status(500).json({ error: err.message || 'Signup failed' })
  }
})

// ── POST /api/auth/login ───────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('users')
      .select('full_name, subscription_status, subscription_expiry, trial_start_date, streak_count')
      .eq('id', data.user.id)
      .single()

    // Check if still in trial or active
    const now = new Date()
    const trialEnd = new Date(
      new Date(profile.trial_start_date).getTime() + 7 * 24 * 60 * 60 * 1000
    )
    let isLocked = false
    if (profile.subscription_status === 'expired') isLocked = true
    if (profile.subscription_status === 'trial' && now > trialEnd) isLocked = true
    if (
      profile.subscription_status === 'active' &&
      new Date(profile.subscription_expiry) < now
    ) isLocked = true

    res.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile.full_name,
        subscription_status: profile.subscription_status,
        is_locked: isLocked,
        streak: profile.streak_count
      }
    })
  } catch (err) {
    console.error('POST /auth/login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── POST /api/auth/logout ──────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      await supabase.auth.admin.signOut(token)
    }
    res.json({ message: 'Logged out' })
  } catch (err) {
    console.error('POST /auth/logout error:', err)
    res.status(500).json({ error: 'Logout failed' })
  }
})

// ── POST /api/auth/reset-password ─────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'email is required' })
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error

    res.json({ message: 'Password reset email sent' })
  } catch (err) {
    console.error('POST /auth/reset-password error:', err)
    res.status(500).json({ error: 'Reset failed' })
  }
})

module.exports = router
