import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashAPI } from '../lib/api'

function BottomNav({ active }) {
  const links = [
    { to: '/dashboard', icon: '⊞', label: 'Home' },
    { to: '/syllabus', icon: '📚', label: 'Courses' },
    { to: '/upload', icon: '📄', label: 'Upload' },
    { to: '/groups', icon: '👥', label: 'Groups' },
    { to: '/subscription', icon: '✦', label: 'Premium' }
  ]
  return (
    <nav className='bottom-nav'>
      {links.map(l => (
        <Link
          key={l.to}
          to={l.to}
          className={active === l.to ? 'active' : ''}
        >
          <span className='nav-icon'>{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}

function StreakBadge({ count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem',
      background: 'rgba(255,160,0,0.1)',
      border: '1px solid rgba(255,160,0,0.2)',
      borderRadius: 100, padding: '0.3rem 0.75rem',
      fontSize: '0.78rem', fontWeight: 700,
      color: '#ffb347'
    }}>
      🔥 {count} day{count !== 1 ? 's' : ''}
    </div>
  )
}

function SubBanner({ subscription, navigate }) {
  if (!subscription?.is_locked && subscription?.status === 'trial') {
    const days = subscription.trial_days_left
    if (days > 3) return null
    return (
      <div className='paywall-banner'>
        <p>⏳ <strong>{days} day{days !== 1 ? 's' : ''}</strong> left on your free trial</p>
        <button
          className='btn btn-primary'
          style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem', whiteSpace: 'nowrap' }}
          onClick={() => navigate('/subscription')}
        >
          Upgrade
        </button>
      </div>
    )
  }
  if (subscription?.is_locked) {
    return (
      <div className='paywall-banner'>
        <p>🔒 Your trial has ended. Unlock premium for <strong>K10/week</strong></p>
        <button
          className='btn btn-primary'
          style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem', whiteSpace: 'nowrap' }}
          onClick={() => navigate('/subscription')}
        >
          Subscribe
        </button>
      </div>
    )
  }
  return null
}

function QuickActions({ actions, isLocked, navigate }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0.75rem',
      padding: '0 1.25rem',
      marginBottom: '1.5rem'
    }}>
      {actions.map(a => (
        <button
          key={a.key}
          className='card'
          style={{
            display: 'flex', alignItems: 'center',
            gap: '0.65rem', cursor: 'pointer',
            border: 'none', textAlign: 'left',
            opacity: a.premium && isLocked ? 0.45 : 1,
            padding: '0.9rem 1rem'
          }}
          onClick={() => {
            if (a.premium && isLocked) {
              navigate('/subscription')
              return
            }
            const routes = {
              add_course: '/syllabus',
              upload: '/upload',
              new_quiz: '/upload',
              new_group: '/groups'
            }
            navigate(routes[a.key] || '/dashboard')
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>{a.icon}</span>
          <div>
            <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>{a.label}</p>
            {a.premium && isLocked && (
              <p style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>
                Premium
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

function CourseCard({ course }) {
  return (
    <Link
      to={`/courses/${course.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div className='card' style={{
        minWidth: 200, maxWidth: 220,
        borderLeft: `3px solid ${course.color || 'var(--green)'}`,
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: '0.6rem'
        }}>
          <span className='tag tag-dim'>{course.course_code}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            {course.semester}
          </span>
        </div>
        <p style={{
          fontSize: '0.875rem', fontWeight: 600,
          color: 'var(--text)', marginBottom: '0.75rem',
          lineHeight: 1.3
        }}>
          {course.course_name}
        </p>

        {/* Progress bar */}
        <div style={{
          height: 4, background: 'var(--surface2)',
          borderRadius: 4, overflow: 'hidden', marginBottom: '0.4rem'
        }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: course.color || 'var(--green)',
            width: `${course.overall_progress || 0}%`,
            transition: 'width 0.6s ease'
          }} />
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
          {course.overall_progress || 0}% complete
        </p>

        {/* Exam date */}
        {course.exam_date && (
          <p style={{
            fontSize: '0.7rem', color: 'var(--text-dim)',
            marginTop: '0.5rem'
          }}>
            📅 Exam {new Date(course.exam_date).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short'
            })}
          </p>
        )}
      </div>
    </Link>
  )
}

function UpcomingCard({ label, icon, title, subtitle, color }) {
  return (
    <div className='card' style={{
      borderLeft: `3px solid ${color}`,
      display: 'flex', gap: '0.75rem',
      alignItems: 'center'
    }}>
      <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '0.68rem', color: 'var(--text-faint)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          marginBottom: '0.2rem'
        }}>
          {label}
        </p>
        <p style={{
          fontSize: '0.875rem', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {title}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {subtitle}
        </p>
      </div>
    </div>
  )
}

function GroupRow({ group, navigate }) {
  return (
    <button
      onClick={() => navigate(`/groups/${group.id}`)}
      style={{
        width: '100%', background: 'none',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        padding: '0.75rem 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '0.75rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1rem',
          flexShrink: 0
        }}>👥</div>
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            {group.name}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {group.courses?.course_name || 'Study Group'}
          </p>
        </div>
      </div>
      {group.unread_count > 0 && (
        <span style={{
          background: 'var(--green)', color: '#02160c',
          borderRadius: 100, fontSize: '0.65rem',
          fontWeight: 700, padding: '0.2rem 0.5rem',
          minWidth: 20, textAlign: 'center'
        }}>
          {group.unread_count}
        </span>
      )}
    </button>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await dashAPI.get()
        setData(res)
      } catch (err) {
        if (err.status === 401) {
          logout()
          navigate('/login')
        } else {
          setError('Failed to load dashboard')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '1rem'
      }}>
        <div className='spinner' />
        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
          Loading your dashboard...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className='screen' style={{ padding: '2rem 1.25rem' }}>
        <div className='error-msg'>{error}</div>
        <button
          className='btn btn-ghost'
          style={{ marginTop: '1rem', width: '100%' }}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  const {
    user: profile,
    subscription,
    courses,
    next_assignment,
    next_test,
    recent_uploads,
    active_groups,
    quiz_summary,
    quick_actions
  } = data

  const isLocked = subscription?.is_locked

  function fmtDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short'
    })
  }

  return (
    <div className='screen'>

      {/* Header */}
      <div className='screen-header'>
        <div>
          <p style={{
            fontSize: '0.75rem', color: 'var(--text-dim)',
            marginBottom: '0.1rem'
          }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋
          </p>
          <h1 className='screen-title'>
            {profile?.full_name?.split(' ')[0] || 'Student'}
          </h1>
        </div>
        <StreakBadge count={profile?.streak || 0} />
      </div>

      {/* Subscription banner */}
      <SubBanner subscription={subscription} navigate={navigate} />

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: '0.75rem', padding: '1rem 1.25rem 0'
      }}>
        {[
          {
            label: 'Courses',
            value: courses?.length || 0,
            icon: '📚'
          },
          {
            label: 'Avg Score',
            value: quiz_summary?.average_score != null
              ? `${quiz_summary.average_score}%`
              : '—',
            icon: '🎯'
          },
          {
            label: 'Streak',
            value: `${profile?.streak || 0}d`,
            icon: '🔥'
          }
        ].map(s => (
          <div key={s.label} className='card' style={{
            textAlign: 'center', padding: '0.85rem 0.5rem'
          }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{s.icon}</p>
            <p style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1.3rem', fontWeight: 700,
              color: 'var(--green)', lineHeight: 1
            }}>
              {s.value}
            </p>
            <p style={{
              fontSize: '0.65rem', color: 'var(--text-faint)',
              marginTop: '0.2rem', textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ padding: '1.25rem 1.25rem 0.5rem' }}>
        <p style={{
          fontSize: '0.7rem', fontWeight: 700,
          color: 'var(--text-faint)', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: '0.75rem'
        }}>
          Quick Actions
        </p>
      </div>
      <QuickActions
        actions={quick_actions || []}
        isLocked={isLocked}
        navigate={navigate}
      />

      {/* Upcoming */}
      {(next_assignment || next_test) && (
        <div style={{ padding: '0 1.25rem 1.5rem' }}>
          <p style={{
            fontSize: '0.7rem', fontWeight: 700,
            color: 'var(--text-faint)', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: '0.75rem'
          }}>
            Coming Up
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {next_assignment && (
              <UpcomingCard
                label='Next Assignment'
                icon='📝'
                title={next_assignment.title}
                subtitle={`${next_assignment.course_code} · Due ${fmtDate(next_assignment.due_date)}`}
                color='#f59e0b'
              />
            )}
            {next_test && (
              <UpcomingCard
                label='Next Test'
                icon='📋'
                title={next_test.title}
                subtitle={`${next_test.course_code} · ${fmtDate(next_test.test_date)}`}
                color='#ef4444'
              />
            )}
          </div>
        </div>
      )}

      {/* My Courses horizontal scroll */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem', marginBottom: '0.75rem'
        }}>
          <p style={{
            fontSize: '0.7rem', fontWeight: 700,
            color: 'var(--text-faint)', textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>
            My Courses
          </p>
          <Link to='/syllabus' style={{
            fontSize: '0.78rem', color: 'var(--green)',
            textDecoration: 'none', fontWeight: 600
          }}>
            See all
          </Link>
        </div>

        {courses?.length > 0 ? (
          <div style={{
            display: 'flex', gap: '0.75rem',
            overflowX: 'auto', padding: '0 1.25rem',
            scrollbarWidth: 'none'
          }}>
            {courses.map(c => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '0 1.25rem' }}>
            <div className='card' style={{ textAlign: 'center', padding: '1.5rem' }}>
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📚</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                No courses yet
              </p>
              <button
                className='btn btn-primary'
                style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}
                onClick={() => navigate('/syllabus')}
              >
                Add your first course
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Uploads */}
      {recent_uploads?.length > 0 && (
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: '0.75rem'
          }}>
            <p style={{
              fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--text-faint)', textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              Recent Uploads
            </p>
            <Link to='/upload' style={{
              fontSize: '0.78rem', color: 'var(--green)',
              textDecoration: 'none', fontWeight: 600
            }}>
              Upload
            </Link>
          </div>
          <div className='card' style={{ padding: '0.25rem 0' }}>
            {recent_uploads.map((u, i) => (
              <div
                key={u.id}
                onClick={() => !isLocked && navigate(`/ai/${u.id}`)}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: '0.75rem', padding: '0.75rem 1rem',
                  borderBottom: i < recent_uploads.length - 1
                    ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: isLocked ? 'default' : 'pointer'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>
                  {u.file_type === 'pdf' ? '📄'
                    : u.file_type === 'image' ? '🖼️' : '📝'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.825rem', fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {u.file_name}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                    {u.courses?.course_name || 'No course'}
                  </p>
                </div>
                {isLocked
                  ? <span style={{ fontSize: '0.8rem' }}>🔒</span>
                  : <span style={{
                      fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600
                    }}>AI →</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Groups */}
      {active_groups?.length > 0 && (
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: '0.75rem'
          }}>
            <p style={{
              fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--text-faint)', textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              Study Groups
            </p>
            <Link to='/groups' style={{
              fontSize: '0.78rem', color: 'var(--green)',
              textDecoration: 'none', fontWeight: 600
            }}>
              See all
            </Link>
          </div>
          <div className='card' style={{ padding: '0 1rem' }}>
            {active_groups.map(g => (
              <GroupRow key={g.id} group={g} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* Premium locked features */}
      {isLocked && (
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
          <p style={{
            fontSize: '0.7rem', fontWeight: 700,
            color: 'var(--text-faint)', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: '0.75rem'
          }}>
            Locked Premium Features
          </p>
          <div className='card' style={{
            background: 'rgba(255,160,0,0.03)',
            border: '1px solid rgba(255,160,0,0.12)'
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem', marginBottom: '1rem'
            }}>
              {subscription?.premium_features?.map(f => (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center',
                  gap: '0.5rem', fontSize: '0.8rem',
                  color: 'var(--text-dim)'
                }}>
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
            <button
              className='btn btn-primary'
              style={{ width: '100%' }}
              onClick={() => navigate('/subscription')}
            >
              Unlock for K10/week
            </button>
          </div>
        </div>
      )}

      <BottomNav active='/dashboard' />
    </div>
  )
}
