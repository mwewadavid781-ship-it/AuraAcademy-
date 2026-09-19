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
    
    // Track presence for the live-users admin view — fire and forget, don't block the request
const now = new Date()
supabase
  .from('users')
  .select('last_seen_at')
  .eq('id', user.id)
  .single()
  .then(({ data }) => {
    const gapMinutes = data?.last_seen_at
      ? (now - new Date(data.last_seen_at)) / 60000
      : Infinity

    const updates = { last_seen_at: now.toISOString() }
    // Treat a 30+ minute gap since last activity as a new session
    if (gapMinutes > 30) {
      updates.session_started_at = now.toISOString()
    }

    supabase.from('users').update(updates).eq('id', user.id).then(() => {})
  })

    next()
  } catch (err) {
    console.error('requireAuth error:', err)
    return res.status(500).json({ error: 'Auth server error' })
  }
}

module.exports = requireAuth
