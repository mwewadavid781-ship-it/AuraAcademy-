const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' })
    }

    const token = authHeader.split(' ')[1]

    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Attach user to request for downstream middleware
    req.user = { id: user.id, email: user.email }

    // Ensure a users row exists (first login auto-creates it)
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || '',
        trial_start_date: new Date().toISOString(),
        subscription_status: 'trial'
      })
    }

    next()
  } catch (err) {
    console.error('requireAuth error:', err)
    return res.status(500).json({ error: 'Auth server error' })
  }
}

module.exports = requireAuth
