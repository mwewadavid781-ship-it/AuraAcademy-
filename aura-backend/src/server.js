require('dotenv').config()
require('./keepalive')

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { createClient } = require('@supabase/supabase-js')

const requireAuth = require('./middleware/auth')
const checkPremium = require('./middleware/checkPremium')

// ── Routes ──
const authRoutes = require('./routes/auth')
const courseRoutes = require('./routes/courses')
const topicRoutes = require('./routes/topics')
const uploadRoutes = require('./routes/uploads')
const aiRoutes = require('./routes/ai')
const quizRoutes = require('./routes/quiz')
const groupRoutes = require('./routes/groups')
const paymentRoutes = require('./routes/payments')
const dashboardRoutes = require('./routes/dashboard')

const app = express()
const PORT = process.env.PORT || 4000

// ── Global middleware ──
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check (Render pings this to keep service alive) ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Root info route ──
app.get('/', (req, res) => {
  res.json({
    message: 'AuraAcademy API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      courses: '/api/courses',
      uploads: '/api/uploads',
      dashboard: '/api/dashboard',
      groups: '/api/groups',
      ai: '/api/ai',
      quiz: '/api/quiz',
      payments: '/api/payments'
    }
  })
})

// ── Public routes (no auth needed) ──
app.use('/api/auth', authRoutes)

// MTN MoMo webhook is public — MoMo calls it directly
app.use('/api/payments', paymentRoutes)

// ── Protected routes (auth required for all below) ──
app.use('/api/dashboard', requireAuth, dashboardRoutes)
app.use('/api/courses',   requireAuth, courseRoutes)
app.use('/api/topics',    requireAuth, topicRoutes)
app.use('/api/uploads',   requireAuth, uploadRoutes)
app.use('/api/groups',    requireAuth, groupRoutes)

// ── Premium-only routes (auth + subscription check) ──
app.use('/api/ai',   requireAuth, checkPremium, aiRoutes)
app.use('/api/quiz', requireAuth, checkPremium, quizRoutes)

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Aura backend running on port ${PORT}`)
})

module.exports = app