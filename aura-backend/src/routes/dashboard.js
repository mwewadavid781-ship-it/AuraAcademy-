const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ── GET /api/dashboard ─────────────────────────────────
// Returns everything the dashboard needs in one call
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const now = new Date()

    // 1. User + subscription status
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('full_name, avatar_url, streak_count, trial_start_date, subscription_status, subscription_expiry, last_active_date')
      .eq('id', userId)
      .single()

    if (userErr || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 2. Update streak
    const today = now.toISOString().split('T')[0]
    const lastActive = user.last_active_date
    let streak = user.streak_count || 0

    if (lastActive !== today) {
      const yesterday = new Date(now - 86400000).toISOString().split('T')[0]
      if (lastActive === yesterday) {
        streak += 1
      } else if (lastActive && lastActive < yesterday) {
        streak = 1 // reset streak
      } else if (!lastActive) {
        streak = 1 // first time
      }
      await supabase
        .from('users')
        .update({ streak_count: streak, last_active_date: today })
        .eq('id', userId)
    }

    // 3. Subscription info
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

    // 4. All courses with progress
    const { data: courses } = await supabase
      .from('courses')
      .select(`
        id, course_name, course_code, semester, exam_date, color,
        topics(id, title, progress_percent),
        assignments(id, title, due_date, status),
        test_dates(id, title, test_date)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    // Calculate overall progress per course
    const coursesWithProgress = (courses || []).map(c => {
      const topics = c.topics || []
      const avgProgress = topics.length
        ? Math.round(topics.reduce((s, t) => s + t.progress_percent, 0) / topics.length)
        : 0
      return { ...c, overall_progress: avgProgress }
    })

    // 5. Next upcoming assignment (closest due date)
    const allAssignments = (courses || []).flatMap(c =>
      (c.assignments || [])
        .filter(a => a.due_date && new Date(a.due_date) >= now && a.status === 'pending')
        .map(a => ({ ...a, course_name: c.course_name, course_code: c.course_code }))
    )
    allAssignments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    const nextAssignment = allAssignments[0] || null

    // 6. Next upcoming test
    const allTests = (courses || []).flatMap(c =>
      (c.test_dates || [])
        .filter(t => new Date(t.test_date) >= now)
        .map(t => ({ ...t, course_name: c.course_name, course_code: c.course_code }))
    )
    allTests.sort((a, b) => new Date(a.test_date) - new Date(b.test_date))
    const nextTest = allTests[0] || null

    // 7. Recent uploads (last 5)
    const { data: recentUploads } = await supabase
      .from('uploads')
      .select('id, file_name, file_type, processing_status, created_at, courses(course_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    // 8. Active study groups
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, last_read_at')
      .eq('user_id', userId)

    let activeGroups = []
    if (memberships && memberships.length > 0) {
      const groupIds = memberships.map(m => m.group_id)

      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, invite_code, courses(course_name), group_members(count)')
        .in('id', groupIds)
        .eq('is_active', true)
        .limit(4)

      // Attach unread counts
      activeGroups = await Promise.all((groups || []).map(async g => {
        const membership = memberships.find(m => m.group_id === g.id)
        const { count } = await supabase
          .from('group_messages')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', g.id)
          .gt('created_at', membership?.last_read_at || '1970-01-01')
        return { ...g, unread_count: count || 0 }
      }))
    }

    // 9. Quiz performance summary
    const { data: quizStats } = await supabase
      .from('quizzes')
      .select('score, course_id')
      .eq('user_id', userId)
      .not('score', 'is', null)
      .order('attempted_at', { ascending: false })
      .limit(20)

    const avgQuizScore = quizStats && quizStats.length
      ? Math.round(quizStats.reduce((s, q) => s + q.score, 0) / quizStats.length)
      : null

    // 10. Locked premium features list
    const premiumFeatures = [
      { key: 'ai_simplify', label: 'AI Simplify', icon: '✨' },
      { key: 'ai_explain', label: 'AI Explain', icon: '🧠' },
      { key: 'ai_ask', label: 'Ask AI Tutor', icon: '💬' },
      { key: 'quiz_gen', label: 'Quiz Generation', icon: '📝' },
      { key: 'flashcards', label: 'Flashcards', icon: '🃏' },
      { key: 'study_groups', label: 'Study Groups', icon: '👥' },
      { key: 'progress', label: 'Progress Tracking', icon: '📈' }
    ]

    // ── Assemble final response ────────────────────────
    res.json({
      user: {
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        streak: streak
      },
      subscription: {
        status: user.subscription_status,
        is_locked: isLocked,
        trial_days_left: trialDaysLeft,
        trial_end: trialEnd.toISOString(),
        expiry: user.subscription_expiry,
        premium_features: premiumFeatures
      },
      courses: coursesWithProgress,
      next_assignment: nextAssignment,
      next_test: nextTest,
      recent_uploads: recentUploads || [],
      active_groups: activeGroups,
      quiz_summary: {
        total_attempted: quizStats?.length || 0,
        average_score: avgQuizScore
      },
      quick_actions: [
        { key: 'add_course', label: 'Add Course', icon: '📚' },
        { key: 'upload', label: 'Upload Notes', icon: '📄' },
        { key: 'new_quiz', label: 'Generate Quiz', icon: '🧠', premium: true },
        { key: 'new_group', label: 'Create Group', icon: '👥', premium: true }
      ]
    })
  } catch (err) {
    console.error('GET /dashboard error:', err)
    res.status(500).json({ error: 'Failed to load dashboard' })
  }
})

module.exports = router
