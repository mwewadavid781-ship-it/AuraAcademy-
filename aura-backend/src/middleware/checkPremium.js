const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkPremium(req, res, next) {
  try {
    const userId = req.user.id
    const now = new Date()

    // Fetch user subscription status
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_expiry, trial_start_date')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return res.status(403).json({ error: 'User not found' })
    }

    let isPremium = false

    // Check if in active trial period
if (user.subscription_status === 'trial') {
        const trialEnd = new Date(
          new Date(user.trial_start_date).getTime() + 7 * 24 * 60 * 60 * 1000
        )
        isPremium = now <= trialEnd
}

    // Check if subscription is active
    if (user.subscription_status === 'active' && user.subscription_expiry) {
      isPremium = new Date(user.subscription_expiry) > now
    }

    if (!isPremium) {
      return res.status(403).json({
        error: 'Premium subscription required. Please upgrade to access this feature.',
        subscription_status: user.subscription_status
      })
    }

    next()
  } catch (err) {
    console.error('checkPremium error:', err)
    res.status(500).json({ error: 'Premium verification failed' })
  }
}

module.exports = checkPremium
