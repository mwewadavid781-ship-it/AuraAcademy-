import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { coursesAPI } from '../lib/api'

const COLORS = [
  '#34e89a','#60a5fa','#f59e0b','#ef4444',
  '#a78bfa','#f472b6','#34d399','#fb923c'
]

const SEMESTERS = ['Semester 1','Semester 2','Year 1','Year 2','Year 3','Year 4']

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

function AddCourseSheet({ onClose, onSaved }) {
  // Shared across the whole batch
  const [semester, setSemester] = useState('')
  const [examDate, setExamDate] = useState('')

  // The row currently being typed
  const [draftName, setDraftName] = useState('')
  const [draftCode, setDraftCode] = useState('')
  const [draftColor, setDraftColor] = useState(COLORS[0])

  // Queue of courses ready to save
  const [queue, setQueue] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addToQueue() {
    if (!draftName.trim() || !draftCode.trim()) {
      return setError('Enter both a course name and code')
    }
    if (!semester) {
      return setError('Pick a semester first — it applies to all courses below')
    }
    setQueue(q => [...q, {
      tempId: Date.now(),
      course_name: draftName.trim(),
      course_code: draftCode.trim().toUpperCase(),
      color: draftColor
    }])
    setDraftName('')
    setDraftCode('')
    setDraftColor(COLORS[(queue.length + 1) % COLORS.length])
    setError('')
  }

  function removeFromQueue(tempId) {
    setQueue(q => q.filter(c => c.tempId !== tempId))
  }

  async function saveAll() {
    if (queue.length === 0) {
      return setError('Add at least one course to the list first')
    }
    setSaving(true)
    setError('')
    const saved = []
    try {
      for (const c of queue) {
        const data = await coursesAPI.create({
          course_name: c.course_name,
          course_code: c.course_code,
          semester,
          exam_date: examDate || null,
          color: c.color
        })
        saved.push(data.course)
      }
      onSaved(saved)
    } catch (err) {
      setError(
        `Saved ${saved.length} of ${queue.length} courses before this failed: ${err.message || 'Unknown error'}`
      )
      if (saved.length > 0) onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
    }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
        }}
      />

      <div style={{
        position: 'relative', zIndex: 1,
        background: '#061a10',
        border: '1px solid var(--green-border)',
        borderRadius: '24px 24px 0 0',
        padding: '1.5rem 1.25rem 2.5rem',
        maxHeight: '92vh', overflowY: 'auto'
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 4,
          background: 'var(--green-border)',
          margin: '0 auto 1.25rem'
        }} />

        <h2 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1.1rem', fontWeight: 700,
          marginBottom: '0.3rem'
        }}>
          Add Your Courses
        </h2>
        <p style={{
          fontSize: '0.78rem', color: 'var(--text-dim)',
          marginBottom: '1.25rem', lineHeight: 1.5
        }}>
          Add each course one at a time — build your list below, then save them all together.
        </p>

        {error && (
          <div className='error-msg' style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Shared semester + exam date */}
        <div style={{
          display: 'flex', gap: '0.75rem', marginBottom: '1.25rem'
        }}>
          <div style={{ flex: 1 }}>
            <label className='label'>Semester</label>
            <select
              className='input'
              value={semester}
              onChange={e => { setSemester(e.target.value); setError('') }}
              style={{ background: 'var(--surface)' }}
            >
              <option value=''>Select</option>
              {SEMESTERS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className='label'>Exam Date <span style={{ color: 'var(--text-faint)', textTransform: 'none' }}>(optional)</span></label>
            <input
              className='input'
              type='date'
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Course entry row */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--green-border)',
          borderRadius: 14, padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ flex: 2 }}>
              <label className='label'>Course Name</label>
              <input
                className='input'
                placeholder='e.g. Introductory Mathematics'
                value={draftName}
                onChange={e => { setDraftName(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && addToQueue()}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className='label'>Code</label>
              <input
                className='input'
                placeholder='MAT 110'
                value={draftCode}
                onChange={e => { setDraftCode(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && addToQueue()}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          {/* Color picker for this course */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem' }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setDraftColor(c)}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: c, border: 'none', cursor: 'pointer',
                  outline: draftColor === c ? '2px solid white' : '2px solid transparent',
                  outlineOffset: 2, flexShrink: 0
                }}
              />
            ))}
          </div>

          <button
            className='btn btn-ghost'
            style={{ width: '100%', fontSize: '0.85rem' }}
            onClick={addToQueue}
          >
            + Add to List
          </button>
        </div>

        {/* Queue list */}
        {queue.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{
              fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--text-faint)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: '0.6rem'
            }}>
              Ready to save · {queue.length} course{queue.length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {queue.map(c => (
                <div
                  key={c.tempId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    background: 'var(--surface2)',
                    borderLeft: `3px solid ${c.color}`,
                    borderRadius: 8, padding: '0.6rem 0.85rem'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {c.course_name}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                      {c.course_code}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromQueue(c.tempId)}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-faint)', cursor: 'pointer',
                      fontSize: '0.9rem', padding: '0.25rem'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          className='btn btn-primary'
          style={{ width: '100%', padding: '0.85rem' }}
          onClick={saveAll}
          disabled={saving || queue.length === 0}
        >
          {saving
            ? `Saving ${queue.length} course${queue.length !== 1 ? 's' : ''}...`
            : `Save ${queue.length || ''} Course${queue.length !== 1 ? 's' : ''}`.trim()}
        </button>
      </div>
    </div>
  )
}

function CourseRow({ course, onDelete }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirming) return setConfirming(true)
    try {
      await coursesAPI.delete(course.id)
      onDelete(course.id)
    } catch {}
  }

  const progress = course.overall_progress || 0
  const topicCount = course.topics?.length || 0

  return (
    <div
      className='card'
      style={{
        borderLeft: `3px solid ${course.color || 'var(--green)'}`,
        marginBottom: '0.75rem', cursor: 'pointer'
      }}
      onClick={() => navigate(`/courses/${course.id}`)}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '0.5rem'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: '0.5rem', marginBottom: '0.3rem'
          }}>
            <span className='tag tag-dim'>{course.course_code}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
              {course.semester}
            </span>
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {course.course_name}
          </p>
        </div>

        <button
          onClick={handleDelete}
          style={{
            background: 'none', border: 'none',
            cursor: 'pointer', fontSize: '0.75rem',
            color: confirming ? '#ef4444' : 'var(--text-faint)',
            padding: '0.25rem 0.5rem', flexShrink: 0
          }}
        >
          {confirming ? 'Confirm?' : '✕'}
        </button>
      </div>

      <div style={{
        height: 3, background: 'var(--surface2)',
        borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem'
      }}>
        <div style={{
          height: '100%', borderRadius: 4,
          background: course.color || 'var(--green)',
          width: `${progress}%`, transition: 'width 0.6s ease'
        }} />
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: '0.72rem', color: 'var(--text-faint)'
      }}>
        <span>{topicCount} topic{topicCount !== 1 ? 's' : ''}</span>
        <span>{progress}% complete</span>
        {course.exam_date && (
          <span>📅 {new Date(course.exam_date).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short'
          })}</span>
        )}
      </div>
    </div>
  )
}

export default function Syllabus() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await coursesAPI.list()
        setCourses(data.courses || [])
      } catch (err) {
        setError('Failed to load courses')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function onSaved(newCourses) {
    setCourses(prev => [
      ...prev,
      ...newCourses.map(c => ({ ...c, overall_progress: 0 }))
    ])
    setShowAdd(false)
  }

  function onDelete(id) {
    setCourses(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className='screen'>
      <div className='screen-header'>
        <h1 className='screen-title'>My Courses</h1>
        <button
          className='btn btn-primary'
          style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          onClick={() => setShowAdd(true)}
        >
          + Add
        </button>
      </div>

      <div style={{ padding: '1.25rem' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className='spinner' />
          </div>
        )}

        {error && <div className='error-msg'>{error}</div>}

        {!loading && courses.length === 0 && (
          <div className='empty'>
            <span className='empty-icon'>📚</span>
            <h3>No courses yet</h3>
            <p>Add your courses one by one to build your syllabus. Only add courses you actually study.</p>
            <button
              className='btn btn-primary'
              onClick={() => setShowAdd(true)}
            >
              Add Your Courses
            </button>
          </div>
        )}

        {courses.map(c => (
          <CourseRow key={c.id} course={c} onDelete={onDelete} />
        ))}

        {courses.length > 0 && (
          <p style={{
            textAlign: 'center', fontSize: '0.75rem',
            color: 'var(--text-faint)', marginTop: '1rem'
          }}>
            {courses.length} course{courses.length !== 1 ? 's' : ''} · Tap to open
          </p>
        )}

      </div>

      {showAdd && (
        <AddCourseSheet
          onClose={() => setShowAdd(false)}
          onSaved={onSaved}
        />
      )}

      <BottomNav active='/syllabus' />
    </div>
  )
      }
