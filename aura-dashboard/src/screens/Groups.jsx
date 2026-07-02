import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { groupsAPI, coursesAPI } from '../lib/api'

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
        <Link key={l.to} to={l.to} className={active === l.to ? 'active' : ''}>
          <span className='nav-icon'>{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}

function CreateGroupSheet({ courses, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', course_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSave() {
    if (!form.name || !form.course_id) {
      return setError('Group name and course are required')
    }
    setLoading(true)
    try {
      const data = await groupsAPI.create(form)
      onCreated(data.group)
    } catch (err) {
      setError(
        err.locked
          ? 'Study groups are a premium feature. Subscribe to create one.'
          : err.message || 'Failed to create group'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end'
    }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)'
        }}
      />
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#061a10',
        border: '1px solid var(--green-border)',
        borderRadius: '24px 24px 0 0',
        padding: '1.5rem 1.25rem 2.5rem',
        maxHeight: '85vh', overflowY: 'auto'
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 4,
          background: 'var(--green-border)',
          margin: '0 auto 1.25rem'
        }} />
        <h2 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1.1rem', fontWeight: 700,
          marginBottom: '1.25rem'
        }}>
          Create Study Group
        </h2>

        {error && (
          <div className='error-msg' style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div>
            <label className='label'>Group Name</label>
            <input
              className='input'
              placeholder='e.g. ENG201 Study Squad'
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className='label'>Linked Course</label>
            <select
              className='input'
              value={form.course_id}
              onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
              style={{ background: 'var(--surface)' }}
            >
              <option value=''>Select a course</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.course_code} — {c.course_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='label'>Description (optional)</label>
            <textarea
              className='input'
              placeholder='What is this group for?'
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>

          <button
            className='btn btn-primary'
            style={{ width: '100%', padding: '0.85rem', marginTop: '0.25rem' }}
            onClick={onSave}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

function JoinSheet({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onJoin() {
    if (!code.trim()) return setError('Enter an invite code')
    setLoading(true)
    try {
      const data = await groupsAPI.join(code.trim())
      onJoined(data.group)
    } catch (err) {
      setError(
        err.locked
          ? 'Study groups are a premium feature.'
          : err.message || 'Invalid invite code'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end'
    }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)'
        }}
      />
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#061a10',
        border: '1px solid var(--green-border)',
        borderRadius: '24px 24px 0 0',
        padding: '1.5rem 1.25rem 2.5rem'
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 4,
          background: 'var(--green-border)',
          margin: '0 auto 1.25rem'
        }} />
        <h2 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1.1rem', fontWeight: 700,
          marginBottom: '0.5rem'
        }}>
          Join a Group
        </h2>
        <p style={{
          fontSize: '0.8rem', color: 'var(--text-dim)',
          marginBottom: '1.25rem', lineHeight: 1.5
        }}>
          Enter the 8-character invite code from your classmate
        </p>

        {error && (
          <div className='error-msg' style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <input
          className='input'
          placeholder='e.g. AB12CD34'
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          style={{
            textTransform: 'uppercase', letterSpacing: '0.1em',
            fontSize: '1.1rem', textAlign: 'center',
            marginBottom: '1rem'
          }}
          maxLength={8}
          onKeyDown={e => e.key === 'Enter' && onJoin()}
          autoFocus
        />

        <button
          className='btn btn-primary'
          style={{ width: '100%', padding: '0.85rem' }}
          onClick={onJoin}
          disabled={loading || code.length < 6}
        >
          {loading ? 'Joining...' : 'Join Group'}
        </button>
      </div>
    </div>
  )
}

function GroupCard({ group, navigate }) {
  const memberCount = group.group_members?.[0]?.count || 0

  return (
    <div
      className='card'
      onClick={() => navigate(`/groups/${group.id}`)}
      style={{ cursor: 'pointer', marginBottom: '0.75rem' }}
    >
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--green-dim)',
            border: '1px solid var(--green-border)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.3rem',
            flexShrink: 0
          }}>
            👥
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '0.5rem', marginBottom: '0.2rem'
            }}>
              <p style={{
                fontSize: '0.95rem', fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {group.name}
              </p>
              {group.unread_count > 0 && (
                <span style={{
                  background: 'var(--green)', color: '#02160c',
                  borderRadius: 100, fontSize: '0.62rem',
                  fontWeight: 700, padding: '0.15rem 0.45rem',
                  flexShrink: 0
                }}>
                  {group.unread_count}
                </span>
              )}
            </div>

            <p style={{
              fontSize: '0.75rem', color: 'var(--text-dim)',
              marginBottom: '0.4rem'
            }}>
              {group.courses?.course_name || 'Study Group'}
              {' · '}{memberCount} member{memberCount !== 1 ? 's' : ''}
            </p>

            {group.description && (
              <p style={{
                fontSize: '0.78rem', color: 'var(--text-faint)',
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {group.description}
              </p>
            )}
          </div>
        </div>

        <span style={{
          color: 'var(--text-faint)', fontSize: '0.9rem',
          flexShrink: 0, marginTop: '0.25rem'
        }}>
          →
        </span>
      </div>

      {/* Invite code */}
      <div style={{
        marginTop: '0.85rem', paddingTop: '0.75rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
          Invite code:
        </p>
        <span style={{
          fontSize: '0.75rem', fontWeight: 700,
          color: 'var(--green)', letterSpacing: '0.1em',
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
          borderRadius: 6, padding: '0.2rem 0.6rem'
        }}>
          {group.invite_code}
        </span>
      </div>
    </div>
  )
}

export default function Groups() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null) // 'create' | 'join'
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [gData, cData] = await Promise.all([
          groupsAPI.list(),
          coursesAPI.list()
        ])
        setGroups(gData.groups || [])
        setCourses(cData.courses || [])
      } catch {
        setError('Failed to load groups')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function onCreated(group) {
    setGroups(prev => [{ ...group, unread_count: 0 }, ...prev])
    setSheet(null)
    navigate(`/groups/${group.id}`)
  }

  function onJoined(group) {
    if (!groups.find(g => g.id === group.id)) {
      setGroups(prev => [{ ...group, unread_count: 0 }, ...prev])
    }
    setSheet(null)
    navigate(`/groups/${group.id}`)
  }

  const totalUnread = groups.reduce((s, g) => s + (g.unread_count || 0), 0)

  return (
    <div className='screen'>

      <div className='screen-header'>
        <div>
          <h1 className='screen-title'>
            Study Groups
            {totalUnread > 0 && (
              <span style={{
                marginLeft: '0.5rem',
                background: 'var(--green)', color: '#02160c',
                borderRadius: 100, fontSize: '0.65rem',
                fontWeight: 700, padding: '0.15rem 0.5rem'
              }}>
                {totalUnread}
              </span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className='btn btn-ghost'
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setSheet('join')}
          >
            Join
          </button>
          <button
            className='btn btn-primary'
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setSheet('create')}
          >
            + Create
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className='spinner' />
          </div>
        )}

        {error && <div className='error-msg'>{error}</div>}

        {!loading && groups.length === 0 && (
          <div className='empty'>
            <span className='empty-icon'>👥</span>
            <h3>No study groups yet</h3>
            <p>
              Create a group for your course or join one
              with an invite code from a classmate.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className='btn btn-ghost'
                onClick={() => setSheet('join')}
              >
                Join Group
              </button>
              <button
                className='btn btn-primary'
                onClick={() => setSheet('create')}
              >
                Create Group
              </button>
            </div>
          </div>
        )}

        {groups.map(g => (
          <GroupCard key={g.id} group={g} navigate={navigate} />
        ))}

        {groups.length > 0 && (
          <div style={{
            background: 'var(--green-dim)',
            border: '1px solid var(--green-border)',
            borderRadius: 12, padding: '1rem',
            marginTop: '0.5rem'
          }}>
            <p style={{
              fontSize: '0.78rem', color: 'var(--green)',
              fontWeight: 600, marginBottom: '0.3rem'
            }}>
              💡 Share your invite code
            </p>
            <p style={{
              fontSize: '0.75rem', color: 'var(--text-dim)',
              lineHeight: 1.5
            }}>
              Tap a group card to open it and share the invite code
              with classmates so they can join instantly.
            </p>
          </div>
        )}

      </div>

      {sheet === 'create' && (
        <CreateGroupSheet
          courses={courses}
          onClose={() => setSheet(null)}
          onCreated={onCreated}
        />
      )}

      {sheet === 'join' && (
        <JoinSheet
          onClose={() => setSheet(null)}
          onJoined={onJoined}
        />
      )}

      <BottomNav active='/groups' />
    </div>
  )
}
