const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TRIAL_DAYS = 7;

async function checkPremium(req, res, next) {
  try {
    const userId = req.user?.id; // assumes auth middleware already set req.user

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, trial_start_date, subscription_status, subscription_expiry')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();

    // Case 1: Active paid subscription
    if (user.subscription_status === 'active' && user.subscription_expiry) {
      const expiry = new Date(user.subscription_expiry);
      if (expiry > now) {
        return next(); // allowed
      } else {
        // Expired — flip status in DB
        await supabase
          .from('users')
          .update({ subscription_status: 'expired' })
          .eq('id', userId);
      }
    }

    // Case 2: Still within 7-day trial
    if (user.trial_start_date) {
      const trialStart = new Date(user.trial_start_date);
      const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      if (now < trialEnd) {
        return next(); // allowed, still trialing
      }
    }

    // Case 3: No active sub, trial expired -> locked
    return res.status(402).json({
      locked: true,
      message: 'Your trial has ended. Subscribe for K10/week to continue.'
    });

  } catch (err) {
    console.error('checkPremium error:', err);
    return res.status(500).json({ error: 'Server error checking subscription' });
  }
}

module.exports = checkPremium;
