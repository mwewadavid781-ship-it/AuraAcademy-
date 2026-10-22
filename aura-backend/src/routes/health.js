const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const Groq = require('groq-sdk')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── GET /api/health/full ───────────────────────────────
router.get('/full', async (req, res) => {
  const adminKey = req.headers['x-admin-key']
  if (adminKey !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const checks = []

  // 1. Backend itself
  checks.push({ name: 'Backend server', status: 'pass', detail: 'Responding' })

  // 2. Supabase database connection
  try {
    const { error } = await supabase.from('users').select('id').limit(1)
    checks.push({
      name: 'Database connection',
      status: error ? 'fail' : 'pass',
      detail: error ? error.message : 'Connected'
    })
  } catch (err) {
    checks.push({ name: 'Database connection', status: 'fail', detail: err.message })
  }

  // 3. Supabase Storage (uploads bucket)
  try {
    const { data, error } = await supabase.storage.from('uploads').list('', { limit: 1 })
    checks.push({
      name: 'File storage (uploads bucket)',
      status: error ? 'fail' : 'pass',
      detail: error ? error.message : 'Accessible'
    })
  } catch (err) {
    checks.push({ name: 'File storage (uploads bucket)', status: 'fail', detail: err.message })
  }

  // 4. Groq API key validity — lightweight check, doesn't burn generation tokens
  try {
    const models = await groq.models.list()
    checks.push({
      name: 'Groq AI connection',
      status: models ? 'pass' : 'fail',
      detail: models ? 'API key valid' : 'No response'
    })
  } catch (err) {
    checks.push({ name: 'Groq AI connection', status: 'fail', detail: err.message })
  }

  // 5. Required environment variables present
  const requiredEnvVars = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_API_KEY',
    'ADMIN_SECRET', 'FRONTEND_URL'
  ]
  const missingVars = requiredEnvVars.filter(v => !process.env[v])
  checks.push({
    name: 'Environment variables',
    status: missingVars.length === 0 ? 'pass' : 'fail',
    detail: missingVars.length === 0 ? 'All present' : `Missing: ${missingVars.join(', ')}`
  })

  // 6. Critical tables exist and are queryable
  const tables = ['courses', 'uploads', 'quizzes', 'groups', 'payments', 'ai_chats']
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1)
      checks.push({
        name: `Table: ${table}`,
        status: error ? 'fail' : 'pass',
        detail: error ? error.message : 'OK'
      })
    } catch (err) {
      checks.push({ name: `Table: ${table}`, status: 'fail', detail: err.message })
    }
  }

  const allPassed = checks.every(c => c.status === 'pass')

  res.json({
    overall: allPassed ? 'healthy' : 'issues_found',
    checked_at: new Date().toISOString(),
    checks
  })
})

module.exports = router