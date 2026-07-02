import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { uploadsAPI, coursesAPI } from '../lib/api'

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

function FileIcon({ type }) {
  if (type?.includes('pdf')) return <span style={{ fontSize: '2rem' }}>📄</span>
  if (type?.includes('image')) return <span style={{ fontSize: '2rem' }}>🖼️</span>
  return <span style={{ fontSize: '2rem' }}>📝</span>
}

const ALLOWED = [
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp'
]

const MAX_MB = 10

export default function Upload() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preselectedCourse = params.get('course_id')

  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState(preselectedCourse || '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const [uploads, setUploads] = useState([])
  const [loadingUploads, setLoadingUploads] = useState(true)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    async function load() {
      try {
        const [cData, uData] = await Promise.all([
          coursesAPI.list(),
          uploadsAPI.list()
        ])
        setCourses(cData.courses || [])
        setUploads(uData.uploads || [])
      } catch {} finally {
        setLoadingUploads(false)
      }
    }
    load()
  }, [])

  function onFileChange(e) {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
  }

  function pickFile(f) {
    setError('')
    setDone(null)

    if (!ALLOWED.includes(f.type)) {
      return setError('Only PDF, TXT, JPG, PNG or WEBP files allowed')
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return setError(`File must be under ${MAX_MB}MB`)
    }

    setFile(f)

    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  async function onUpload() {
    if (!file) return setError('Please select a file')
    if (!courseId) return setError('Please select a course')

    setUploading(true)
    setProgress(0)
    setError('')

    // Fake progress animation
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 85) { clearInterval(interval); return p }
        return p + 8
      })
    }, 200)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('course_id', courseId)

      const data = await uploadsAPI.upload(fd)
      clearInterval(interval)
      setProgress(100)
      setDone(data.upload)
      setUploads(prev => [data.upload, ...prev])
      setFile(null)
      setPreview(null)
    } catch (err) {
      clearInterval(interval)
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setDone(null)
    setProgress(0)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className='screen'>

      <div className='screen-header'>
        <h1 className='screen-title'>Upload Notes</h1>
      </div>

      <div style={{ padding: '1.25rem' }}>

        {/* SUCCESS STATE */}
        {done && (
          <div style={{
            background: 'rgba(52,232,154,0.06)',
            border: '1px solid var(--green-border)',
            borderRadius: 16, padding: '1.5rem',
            textAlign: 'center', marginBottom: '1.5rem'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <h3 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem'
            }}>
              Upload complete!
            </h3>
            <p style={{
              fontSize: '0.825rem', color: 'var(--text-dim)',
              marginBottom: '1.25rem', lineHeight: 1.5
            }}>
              {done.file_name} is ready.
              {done.processing_status === 'done'
                ? ' Text extracted — AI tools are available.'
                : ' Processing...'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className='btn btn-primary'
                style={{ flex: 1, fontSize: '0.85rem' }}
                onClick={() => navigate(`/ai/${done.id}`)}
              >
                Open AI Tools →
              </button>
              <button
                className='btn btn-ghost'
                style={{ flex: 1, fontSize: '0.85rem' }}
                onClick={reset}
              >
                Upload Another
              </button>
            </div>
          </div>
        )}

        {/* UPLOAD FORM */}
        {!done && (
          <>
            {/* Course selector */}
            <div style={{ marginBottom: '1rem' }}>
              <label className='label'>Select Course</label>
              <select
                className='input'
                value={courseId}
                onChange={e => { setCourseId(e.target.value); setError('') }}
                style={{ background: 'var(--surface)' }}
              >
                <option value=''>Choose a course...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} — {c.course_name}
                  </option>
                ))}
              </select>
              {courses.length === 0 && (
                <p style={{
                  fontSize: '0.75rem', color: 'var(--text-faint)',
                  marginTop: '0.4rem'
                }}>
                  No courses yet.{' '}
                  <span
                    style={{ color: 'var(--green)', cursor: 'pointer' }}
                    onClick={() => navigate('/syllabus')}
                  >
                    Add one first →
                  </span>
                </p>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging
                  ? 'var(--green)'
                  : file ? 'var(--green-border)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 16,
                padding: '2rem 1rem',
                textAlign: 'center',
                cursor: file ? 'default' : 'pointer',
                background: dragging
                  ? 'var(--green-dim)'
                  : 'var(--surface)',
                transition: 'all 0.2s',
                marginBottom: '1rem'
              }}
            >
              <input
                ref={fileRef}
                type='file'
                accept='.pdf,.txt,.jpg,.jpeg,.png,.webp'
                onChange={onFileChange}
                style={{ display: 'none' }}
              />

              {!file ? (
                <>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                    📁
                  </div>
                  <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                    Tap to select file
                  </p>
                  <p style={{
                    fontSize: '0.78rem', color: 'var(--text-faint)',
                    lineHeight: 1.5
                  }}>
                    PDF, TXT, JPG, PNG or WEBP · Max 10MB
                  </p>
                </>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  gap: '0.75rem', textAlign: 'left'
                }}>
                  {preview
                    ? <img
                        src={preview}
                        alt='preview'
                        style={{
                          width: 56, height: 56,
                          borderRadius: 8, objectFit: 'cover'
                        }}
                      />
                    : <FileIcon type={file.type} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.875rem', fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.name}
                    </p>
                    <p style={{
                      fontSize: '0.72rem', color: 'var(--text-faint)',
                      marginTop: '0.2rem'
                    }}>
                      {(file.size / 1024).toFixed(0)}KB
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); reset() }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-faint)', cursor: 'pointer',
                      fontSize: '1rem', flexShrink: 0
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {uploading && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{
                  height: 4, background: 'var(--surface2)',
                  borderRadius: 4, overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%', background: 'var(--green)',
                    borderRadius: 4, width: `${progress}%`,
                    transition: 'width 0.2s ease'
                  }} />
                </div>
                <p style={{
                  fontSize: '0.75rem', color: 'var(--text-dim)',
                  marginTop: '0.4rem', textAlign: 'center'
                }}>
                  {progress < 90
                    ? 'Uploading...'
                    : 'Extracting text...'}
                </p>
              </div>
            )}

            {error && (
              <div className='error-msg' style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <button
              className='btn btn-primary'
              style={{ width: '100%', padding: '0.85rem' }}
              onClick={onUpload}
              disabled={uploading || !file || !courseId}
            >
              {uploading ? 'Uploading...' : 'Upload & Extract Text'}
            </button>

            {/* What happens next */}
            <div style={{
              marginTop: '1.25rem',
              background: 'var(--green-dim)',
              border: '1px solid var(--green-border)',
              borderRadius: 12, padding: '1rem'
            }}>
              <p style={{
                fontSize: '0.75rem', fontWeight: 700,
                color: 'var(--green)', marginBottom: '0.6rem'
              }}>
                After upload you can:
              </p>
              {[
                { icon: '✨', text: 'Simplify into bullet points' },
                { icon: '🧠', text: 'Explain any topic' },
                { icon: '💬', text: 'Ask your AI tutor' },
                { icon: '📝', text: 'Generate a quiz' },
                { icon: '🃏', text: 'Create flashcards' }
              ].map(a => (
                <div key={a.text} style={{
                  display: 'flex', gap: '0.6rem',
                  fontSize: '0.8rem', color: 'var(--text-dim)',
                  marginBottom: '0.35rem'
                }}>
                  <span>{a.icon}</span><span>{a.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* RECENT UPLOADS */}
        {!loadingUploads && uploads.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <p style={{
              fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--text-faint)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: '0.75rem'
            }}>
              Recent Uploads
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {uploads.slice(0, 8).map(u => (
                <div
                  key={u.id}
                  className='card'
                  onClick={() => navigate(`/ai/${u.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: '0.75rem', cursor: 'pointer',
                    padding: '0.75rem 1rem'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>
                    {u.file_type === 'pdf' ? '📄'
                      : u.file_type === 'image' ? '🖼️' : '📝'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.825rem', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {u.file_name}
                    </p>
                    <p style={{
                      fontSize: '0.7rem', color: 'var(--text-faint)',
                      marginTop: '0.1rem'
                    }}>
                      {new Date(u.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.75rem', color: 'var(--green)',
                    fontWeight: 600, flexShrink: 0
                  }}>
                    AI →
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <BottomNav active='/upload' />
    </div>
  )
}
