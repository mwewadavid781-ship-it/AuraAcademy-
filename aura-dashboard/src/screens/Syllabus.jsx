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
  const [form, setForm] = useState({
    course_name: '', course_code: '',
    semester: '', exam_date: '', color: COLORS[0]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function onChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function onSave() {
    if (!form.course_name || !form.course_code || !form.semester) {
      return setError('Course name, code and semester are required')
    }
    setLoading(true)
    try {
      const data = await coursesAPI.create({
        course_name: form.course_name,
        course_code: form.course_code.toUpperCase(),
        semester: form.semester,
        exam_date: form.exam_date || null,
        color: form.color
      })
      onSaved(data.course)
    } catch (err) {
      setError(err.message || 'Failed to create course')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#061a10',
        border: '1px solid var(--green-border)',
        borderRadius: '24px 24px 0 0',
        padding: '1.5rem 1.25rem 2.5rem',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Handle */}
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
          Add New Course
        </h2>

        {error && (
          <div className='error-msg' style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div>
            <label className='label'>Course Name</label>
            <input
              className='input'
              name='course_name'
              placeholder='e.g. Engineering Mathematics'
              value={form.course_name}
              onChange={onChange}
            />
          </div>

          <div>
            <label className='label'>Course Code</label>
            <input
              className='input'
              name='course_code'
              placeholder='e.g. ENG201'
              value={form.course_code}
              onChange={onChange}
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label className='label'>Semester</label>
            <select
              className='input'
              name='semester'
              value={form.semester}
              onChange={onChange}
              style={{ background: 'var(--surface)' }}
            >
              <option value=''>Select semester</option>
              {SEMESTERS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='label'>Exam Date (optional)</label>
            <input
              className='input'
              type='date'
              name='exam_date'
              value={form.exam_date}
              onChange={onChange}
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Color picker */}
          <div>
            <label className='label'>Course Color</label>
            <div style={{
              display: 'flex', gap: '0.5rem', flexWrap: 'wrap'
            }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: c, border: 'none', cursor: 'pointer',
                    outline: form.color === c
                      ? `3px solid white`
                      : '3px solid transparent',
                    outlineOffset: 2
                  }}
                />
              ))}
            </div>
          </div>

          <button
            className='btn btn-primary'
            style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }}
            onClick={onSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Add Course'}
          </button>

        </div>
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

      {/* Progress */}
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

  function onSaved(course) {
    setCourses(prev => [...prev, { ...course, overall_progress: 0 }])
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
            <p>Add your first course to start building your syllabus. Only add courses you actually study.</p>
            <button
              className='btn btn-primary'
              onClick={() => setShowAdd(true)}
            >
              Add First Course
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
