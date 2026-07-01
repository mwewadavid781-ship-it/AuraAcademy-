import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { coursesAPI, uploadsAPI, quizAPI } from '../lib/api'

const TABS = ['Topics','Assignments','Tests','Uploads','Quizzes']

function TopicRow({ topic, courseId, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [progress, setProgress] = useState(topic.progress_percent)

  async function saveProgress(val) {
    setProgress(val)
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/api/topics/${topic.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('aura_token')}`
          },
          body: JSON.stringify({ progress_percent: val })
        }
      )
      onUpdate(topic.id, val)
    } catch {}
    setEditing(false)
  }

  return (
    <div style={{
      padding: '0.85rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '0.5rem'
      }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {topic.title}
        </p>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            background: 'none', border: 'none',
            color: 'var(--green)', fontSize: '0.75rem',
            cursor: 'pointer', fontWeight: 600
          }}
        >
          {progress}%
        </button>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, background: 'var(--surface2)',
        borderRadius: 4, overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', background: 'var(--green)',
          width: `${progress}%`, borderRadius: 4,
          transition: 'width 0.4s ease'
        }} />
      </div>

      {/* Progress slider */}
      {editing && (
        <div style={{ marginTop: '0.75rem' }}>
          <input
            type='range' min={0} max={100} step={10}
            value={progress}
            onChange={e => setProgress(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--green)' }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: '0.5rem', gap: '0.5rem'
          }}>
            <button
              className='btn btn-ghost'
              style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem' }}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              className='btn btn-primary'
              style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem' }}
              onClick={() => saveProgress(progress)}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddTopicForm({ courseId, onAdded, onClose }) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSave() {
    if (!title.trim()) return
    setLoading(true)
    try {
      const data = await coursesAPI.addTopic(courseId, { title })
      onAdded(data.topic)
      onClose()
    } catch {} finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--green-border)',
      borderRadius: 12, padding: '1rem',
      marginTop: '0.75rem'
    }}>
      <input
        className='input'
        placeholder='Topic name e.g. Integration by Parts'
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
        onKeyDown={e => e.key === 'Enter' && onSave()}
        style={{ marginBottom: '0.75rem' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className='btn btn-ghost'
          style={{ flex: 1, fontSize: '0.8rem' }}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className='btn btn-primary'
          style={{ flex: 1, fontSize: '0.8rem' }}
          onClick={onSave}
          disabled={loading}
        >
          {loading ? '...' : 'Add Topic'}
        </button>
      </div>
    </div>
  )
}

function AssignmentRow({ a }) {
  const statusColor = {
    pending: '#f59e0b',
    submitted: '#34e89a',
    graded: '#60a5fa'
  }
  return (
    <div style={{
      padding: '0.85rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{a.title}</p>
        {a.due_date && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
            Due {new Date(a.due_date).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short'
            })}
          </p>
        )}
      </div>
      <span style={{
        fontSize: '0.68rem', fontWeight: 700,
        color: statusColor[a.status] || 'var(--text-dim)',
        textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        {a.status}
      </span>
    </div>
  )
}

function AddAssignmentForm({ courseId, onAdded, onClose }) {
  const [form, setForm] = useState({ title: '', due_date: '' })
  const [loading, setLoading] = useState(false)

  async function onSave() {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const data = await coursesAPI.addAssignment(courseId, form)
      onAdded(data.assignment)
      onClose()
    } catch {} finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--green-border)',
      borderRadius: 12, padding: '1rem',
      marginTop: '0.75rem'
    }}>
      <input
        className='input'
        placeholder='Assignment title'
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        style={{ marginBottom: '0.75rem' }}
        autoFocus
      />
      <input
        className='input'
        type='datetime-local'
        value={form.due_date}
        onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
        style={{ marginBottom: '0.75rem', colorScheme: 'dark' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className='btn btn-ghost' style={{ flex: 1, fontSize: '0.8rem' }} onClick={onClose}>
          Cancel
        </button>
        <button
          className='btn btn-primary'
          style={{ flex: 1, fontSize: '0.8rem' }}
          onClick={onSave} disabled={loading}
        >
          {loading ? '...' : 'Add'}
        </button>
      </div>
    </div>
  )
}

function AddTestForm({ courseId, onAdded, onClose }) {
  const [form, setForm] = useState({ title: '', test_date: '' })
  const [loading, setLoading] = useState(false)

  async function onSave() {
    if (!form.title || !form.test_date) return
    setLoading(true)
    try {
      const data = await coursesAPI.addTestDate(courseId, form)
      onAdded(data.test_date)
      onClose()
    } catch {} finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--green-border)',
      borderRadius: 12, padding: '1rem', marginTop: '0.75rem'
    }}>
      <input
        className='input'
        placeholder='Test title e.g. CAT 1'
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        style={{ marginBottom: '0.75rem' }}
        autoFocus
      />
      <input
        className='input'
        type='datetime-local'
        value={form.test_date}
        onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))}
        style={{ marginBottom: '0.75rem', colorScheme: 'dark' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className='btn btn-ghost' style={{ flex: 1, fontSize: '0.8rem' }} onClick={onClose}>Cancel</button>
        <button className='btn btn-primary' style={{ flex: 1, fontSize: '0.8rem' }} onClick={onSave} disabled={loading}>
          {loading ? '...' : 'Add'}
        </button>
      </div>
    </div>
  )
}

export default function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [uploads, setUploads] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Topics')
  const [showForm, setShowForm] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [cData, uData, qData] = await Promise.all([
          coursesAPI.get(id),
          uploadsAPI.list(id),
          quizAPI.list(id)
        ])
        setCourse(cData.course)
        setUploads(uData.uploads || [])
        setQuizzes(qData.quizzes || [])
      } catch {
        navigate('/syllabus')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  function onTopicUpdate(topicId, val) {
    setCourse(c => ({
      ...c,
      topics: c.topics.map(t =>
        t.id === topicId ? { ...t, progress_percent: val } : t
      )
    }))
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className='spinner' />
    </div>
  )

  if (!course) return null

  const avgProgress = course.topics?.length
    ? Math.round(course.topics.reduce((s, t) => s + t.progress_percent, 0) / course.topics.length)
    : 0

  return (
    <div className='screen'>

      {/* Header */}
      <div className='screen-header'>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/syllabus')}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-dim)', cursor: 'pointer',
              fontSize: '1.1rem', padding: 0
            }}
          >
            ←
          </button>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
              {course.course_code} · {course.semester}
            </p>
            <h1 className='screen-title' style={{ fontSize: '0.95rem' }}>
              {course.course_name}
            </h1>
          </div>
        </div>
        <button
          className='btn btn-primary'
          style={{ fontSize: '0.75rem', padding: '0.45rem 0.9rem' }}
          onClick={() => navigate(`/upload?course_id=${id}`)}
        >
          Upload
        </button>
      </div>

      {/* Course summary */}
      <div style={{
        padding: '1rem 1.25rem',
        borderLeft: `3px solid ${course.color || 'var(--green)'}`,
        margin: '0.75rem 1.25rem 0',
        background: 'var(--surface)',
        borderRadius: '0 12px 12px 0'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '0.5rem'
        }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            Overall Progress
          </p>
          <p style={{
            fontSize: '0.875rem', fontWeight: 700,
            color: course.color || 'var(--green)'
          }}>
            {avgProgress}%
          </p>
        </div>
        <div style={{
          height: 5, background: 'var(--surface2)',
          borderRadius: 4, overflow: 'hidden'
        }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: course.color || 'var(--green)',
            width: `${avgProgress}%`, transition: 'width 0.6s ease'
          }} />
        </div>
        {course.exam_date && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
            📅 Exam: {new Date(course.exam_date).toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem',
        padding: '1rem 1.25rem 0',
        overflowX: 'auto', scrollbarWidth: 'none'
      }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowForm(null) }}
            style={{
              background: tab === t ? 'var(--green)' : 'var(--surface)',
              color: tab === t ? '#02160c' : 'var(--text-dim)',
              border: `1px solid ${tab === t ? 'var(--green)' : 'var(--green-border)'}`,
              borderRadius: 100, padding: '0.35rem 0.85rem',
              fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '1rem 1.25rem' }}>

        {/* TOPICS */}
        {tab === 'Topics' && (
          <div>
            <div className='card' style={{ padding: '0 1rem' }}>
              {course.topics?.length === 0 && (
                <p style={{
                  padding: '1rem 0', textAlign: 'center',
                  color: 'var(--text-faint)', fontSize: '0.875rem'
                }}>
                  No topics yet
                </p>
              )}
              {course.topics?.map(t => (
                <TopicRow
                  key={t.id} topic={t}
                  courseId={id} onUpdate={onTopicUpdate}
                />
              ))}
            </div>
            {showForm === 'topic'
              ? <AddTopicForm
                  courseId={id}
                  onAdded={t => setCourse(c => ({ ...c, topics: [...(c.topics||[]), t] }))}
                  onClose={() => setShowForm(null)}
                />
              : (
                <button
                  className='btn btn-ghost'
                  style={{ width: '100%', marginTop: '0.75rem' }}
                  onClick={() => setShowForm('topic')}
                >
                  + Add Topic
                </button>
              )
            }
          </div>
        )}

        {/* ASSIGNMENTS */}
        {tab === 'Assignments' && (
          <div>
            <div className='card' style={{ padding: '0 1rem' }}>
              {course.assignments?.length === 0 && (
                <p style={{
                  padding: '1rem 0', textAlign: 'center',
                  color: 'var(--text-faint)', fontSize: '0.875rem'
                }}>
                  No assignments yet
                </p>
              )}
              {course.assignments?.map(a => (
                <AssignmentRow key={a.id} a={a} />
              ))}
            </div>
            {showForm === 'assignment'
              ? <AddAssignmentForm
                  courseId={id}
                  onAdded={a => setCourse(c => ({ ...c, assignments: [...(c.assignments||[]), a] }))}
                  onClose={() => setShowForm(null)}
                />
              : (
                <button
                  className='btn btn-ghost'
                  style={{ width: '100%', marginTop: '0.75rem' }}
                  onClick={() => setShowForm('assignment')}
                >
                  + Add Assignment
                </button>
              )
            }
          </div>
        )}

        {/* TESTS */}
        {tab === 'Tests' && (
          <div>
            <div className='card' style={{ padding: '0 1rem' }}>
              {course.test_dates?.length === 0 && (
                <p style={{
                  padding: '1rem 0', textAlign: 'center',
                  color: 'var(--text-faint)', fontSize: '0.875rem'
                }}>
                  No test dates yet
                </p>
              )}
              {course.test_dates?.map(t => (
                <div
                  key={t.id}
                  style={{
                    padding: '0.85rem 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', justifyContent: 'space-between'
                  }}
                >
                  <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t.title}</p>
                  <p style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                    {new Date(t.test_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
              ))}
            </div>
            {showForm === 'test'
              ? <AddTestForm
                  courseId={id}
                  onAdded={t => setCourse(c => ({ ...c, test_dates: [...(c.test_dates||[]), t] }))}
                  onClose={() => setShowForm(null)}
                />
              : (
                <button
                  className='btn btn-ghost'
                  style={{ width: '100%', marginTop: '0.75rem' }}
                  onClick={() => setShowForm('test')}
                >
                  + Add Test Date
                </button>
              )
            }
          </div>
        )}

        {/* UPLOADS */}
        {tab === 'Uploads' && (
          <div>
            {uploads.length === 0 && (
              <div className='empty'>
                <span className='empty-icon'>📄</span>
                <h3>No uploads yet</h3>
                <p>Upload notes or PDFs to use AI tools on this course</p>
                <button
                  className='btn btn-primary'
                  onClick={() => navigate(`/upload?course_id=${id}`)}
                >
                  Upload Now
                </button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {uploads.map(u => (
                <div
                  key={u.id}
                  className='card'
                  onClick={() => navigate(`/ai/${u.id}`)}
                  style={{ cursor: 'pointer', display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                >
                  <span style={{ fontSize: '1.4rem' }}>
                    {u.file_type === 'pdf' ? '📄' : u.file_type === 'image' ? '🖼️' : '📝'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.875rem', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {u.file_name}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-GB')}
                      {' · '}{u.file_size_kb}KB
                    </p>
                  </div>
                  <span style={{ color: 'var(--green)', fontSize: '0.8rem', fontWeight: 600 }}>
                    AI →
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUIZZES */}
        {tab === 'Quizzes' && (
          <div>
            {quizzes.length === 0 && (
              <div className='empty'>
                <span className='empty-icon'>🧠</span>
                <h3>No quizzes yet</h3>
                <p>Upload notes then generate a quiz from the AI tools screen</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {quizzes.map(q => (
                <div
                  key={q.id}
                  className='card'
                  onClick={() => navigate(`/quiz/${q.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{q.title}</p>
                    {q.score != null && (
                      <span style={{
                        fontSize: '0.875rem', fontWeight: 700,
                        color: q.score >= 70 ? 'var(--green)' : q.score >= 50 ? '#f59e0b' : '#ef4444'
                      }}>
                        {q.score}%
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>
                    {q.total_questions} questions
                    {q.attempted_at ? ` · Attempted ${new Date(q.attempted_at).toLocaleDateString('en-GB')}` : ' · Not attempted'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
