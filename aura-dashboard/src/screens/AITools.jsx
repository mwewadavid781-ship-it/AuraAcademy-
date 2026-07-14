import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { uploadsAPI, aiAPI, quizAPI } from '../lib/api'

const TOOLS = [
  { key: 'simplify',   label: 'Simplify',   icon: '✨', desc: 'Turn content into easy bullet points' },
  { key: 'explain',    label: 'Explain',     icon: '🧠', desc: 'Tutor-style explanation with examples' },
  { key: 'ask',        label: 'Ask',         icon: '💬', desc: 'Chat with your AI study tutor' },
  { key: 'quiz',       label: 'Quiz',        icon: '📝', desc: 'Generate MCQ, T/F and short answer' },
  { key: 'flashcards', label: 'Flashcards',  icon: '🃏', desc: 'Auto-generate revision flashcards' }
]

function ToolBar({ active, setActive }) {
  return (
    <div style={{
      display: 'flex', gap: '0.4rem',
      overflowX: 'auto', scrollbarWidth: 'none',
      padding: '0.75rem 1.25rem 0'
    }}>
      {TOOLS.map(t => (
        <button
          key={t.key}
          onClick={() => setActive(t.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            background: active === t.key ? 'var(--green)' : 'var(--surface)',
            color: active === t.key ? '#02160c' : 'var(--text-dim)',
            border: `1px solid ${active === t.key ? 'var(--green)' : 'var(--green-border)'}`,
            borderRadius: 100, padding: '0.35rem 0.85rem',
            fontSize: '0.78rem', fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}

function ResultBox({ content, loading }) {
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: '0.75rem', padding: '1.25rem',
      background: 'var(--surface)',
      border: '1px solid var(--green-border)',
      borderRadius: 12
    }}>
      <div className='spinner' style={{ width: 20, height: 20, borderWidth: 2 }} />
      <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
        AI is thinking...
      </p>
    </div>
  )

  if (!content) return null

  return (
    <div style={{
      background: 'rgba(52,232,154,0.04)',
      border: '1px solid var(--green-border)',
      borderRadius: 12, padding: '1.25rem'
    }}>
      <p style={{
        fontSize: '0.875rem', color: 'var(--text)',
        lineHeight: 1.75, whiteSpace: 'pre-wrap'
      }}>
        {content}
      </p>
    </div>
  )
}

// ── SIMPLIFY ──────────────────────────────────────────
function SimplifyTool({ upload }) {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    setResult('')
    try {
      const data = await aiAPI.simplify({ upload_id: upload.id })
      setResult(data.result)
    } catch (err) {
      setError(err.locked
        ? 'This is a premium feature. Subscribe to use AI tools.'
        : err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{
        background: 'var(--green-dim)',
        border: '1px solid var(--green-border)',
        borderRadius: 12, padding: '1rem', marginBottom: '1rem'
      }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          ✨ Turns your uploaded content into clean, easy bullet points in simple English.
        </p>
      </div>
      <button
        className='btn btn-primary'
        style={{ width: '100%', marginBottom: '1rem' }}
        onClick={run} disabled={loading}
      >
        {loading ? 'Simplifying...' : 'Simplify This File'}
      </button>
      {error && <div className='error-msg' style={{ marginBottom: '1rem' }}>{error}</div>}
      <ResultBox content={result} loading={loading} />
    </div>
  )
}

// ── EXPLAIN ───────────────────────────────────────────
function ExplainTool({ upload }) {
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!topic.trim()) return setError('Enter a topic to explain')
    setLoading(true)
    setError('')
    setResult('')
    try {
      const data = await aiAPI.explain({ upload_id: upload.id, topic })
      setResult(data.result)
    } catch (err) {
      setError(err.locked
        ? 'Subscribe to use AI Explain.'
        : err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <label className='label'>What do you want explained?</label>
        <input
          className='input'
          placeholder="e.g. Newton\'s second law, integration by parts..."
          value={topic}
          onChange={e => { setTopic(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && run()}
          style={{ marginBottom: '0.75rem' }}
        />
        <button
          className='btn btn-primary'
          style={{ width: '100%' }}
          onClick={run} disabled={loading || !topic.trim()}
        >
          {loading ? 'Explaining...' : 'Explain Using My Notes'}
        </button>
      </div>
      {error && <div className='error-msg' style={{ marginBottom: '1rem' }}>{error}</div>}
      <ResultBox content={result} loading={loading} />
    </div>
  )
}

// ── ASK (chat) ────────────────────────────────────────
function AskTool({ upload }) {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef()

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await aiAPI.getChatHistory(upload.id)
        setHistory(data.history || [])
      } catch {} finally {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [upload.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  async function send() {
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion('')
    setError('')
    setHistory(h => [...h, { role: 'user', content: q }])
    setLoading(true)
    try {
      const data = await aiAPI.ask({
        upload_id: upload.id,
        question: q,
        history: history.slice(-6)
      })
      setHistory(h => [...h, { role: 'assistant', content: data.result }])
    } catch (err) {
      setError(err.locked
        ? 'Subscribe to use AI Ask.'
        : err.message || 'Failed')
      setHistory(h => h.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

     {!loadingHistory && history.length === 0 && (
        <div style={{
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
          borderRadius: 12, padding: '1rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            💬 Ask anything about your uploaded file. Aura answers using your notes first.
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              'Summarise the key points',
              'What are the main formulas?',
              'Explain this in simpler terms'
            ].map(s => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--green-border)',
                  borderRadius: 8, padding: '0.5rem 0.75rem',
                  fontSize: '0.78rem', color: 'var(--text-dim)',
                  cursor: 'pointer', textAlign: 'left'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      {history.map((m, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
          }}
        >
          <div style={{
            maxWidth: '85%',
            background: m.role === 'user'
              ? 'var(--green)'
              : 'var(--surface)',
            color: m.role === 'user' ? '#02160c' : 'var(--text)',
            border: m.role === 'assistant'
              ? '1px solid var(--green-border)' : 'none',
            borderRadius: m.role === 'user'
              ? '16px 16px 4px 16px'
              : '16px 16px 16px 4px',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap'
          }}>
            {m.content}
          </div>
        </div>
      ))}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className='spinner' style={{ width: 16, height: 16, borderWidth: 2 }} />
          <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Aura is thinking...</p>
        </div>
      )}

      {error && <div className='error-msg'>{error}</div>}

      <div ref={bottomRef} />

      {/* Input */}
      <div style={{
        display: 'flex', gap: '0.5rem',
        position: 'sticky', bottom: '5rem',
        background: 'var(--bg)', paddingTop: '0.5rem'
      }}>
        <input
          className='input'
          placeholder='Ask about your notes...'
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1 }}
        />
        <button
          className='btn btn-primary'
          style={{ padding: '0.7rem 1rem', flexShrink: 0 }}
          onClick={send}
          disabled={loading || !question.trim()}
        >
          →
        </button>
      </div>
    </div>
  )
}

// ── QUIZ ──────────────────────────────────────────────
function QuizTool({ upload, navigate }) {
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const data = await quizAPI.generate({
        upload_id: upload.id,
        course_id: upload.course_id,
        count
      })
      navigate(`/quiz/${data.quiz.id}`)
    } catch (err) {
      setError(err.locked
        ? 'Subscribe to generate quizzes.'
        : err.message || 'Quiz generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{
        background: 'var(--green-dim)',
        border: '1px solid var(--green-border)',
        borderRadius: 12, padding: '1rem', marginBottom: '1.25rem'
      }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          📝 Generates MCQ, True/False and Short Answer questions from your uploaded file.
          After the quiz you get a readiness score.
        </p>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label className='label'>Number of Questions</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[5, 10, 15, 20].map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              style={{
                background: count === n ? 'var(--green)' : 'var(--surface)',
                color: count === n ? '#02160c' : 'var(--text-dim)',
                border: `1px solid ${count === n ? 'var(--green)' : 'var(--green-border)'}`,
                borderRadius: 8, padding: '0.5rem 1rem',
                fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && <div className='error-msg' style={{ marginBottom: '1rem' }}>{error}</div>}

      <button
        className='btn btn-primary'
        style={{ width: '100%', padding: '0.85rem' }}
        onClick={generate}
        disabled={loading}
      >
        {loading ? 'Generating Quiz...' : `Generate ${count}-Question Quiz`}
      </button>
    </div>
  )
}

// ── FLASHCARDS ────────────────────────────────────────
function FlashcardsTool({ upload }) {
  const [cards, setCards] = useState([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(10)

  async function generate() {
    setLoading(true)
    setError('')
    setCards([])
    setCurrent(0)
    setFlipped(false)
    try {
      const data = await aiAPI.generateFlashcards({
        upload_id: upload.id,
        course_id: upload.course_id,
        count
      })
      setCards(data.flashcards || [])
    } catch (err) {
      setError(err.locked
        ? 'Subscribe to create flashcards.'
        : err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (cards.length > 0) {
    const card = cards[current]
    return (
      <div>
        {/* Progress */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.78rem', color: 'var(--text-faint)',
          marginBottom: '1rem'
        }}>
          <span>Card {current + 1} of {cards.length}</span>
          <button
            onClick={() => setCards([])}
            style={{
              background: 'none', border: 'none',
              color: 'var(--green)', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 600
            }}
          >
            Regenerate
          </button>
        </div>

        {/* Card */}
        <div
          onClick={() => setFlipped(f => !f)}
          style={{
            background: flipped ? 'rgba(52,232,154,0.08)' : 'var(--surface)',
            border: `1px solid ${flipped ? 'var(--green)' : 'var(--green-border)'}`,
            borderRadius: 20,
            padding: '2rem 1.5rem',
            textAlign: 'center',
            minHeight: 200,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.3s',
            marginBottom: '1rem'
          }}
        >
          <p style={{
            fontSize: '0.68rem', fontWeight: 700,
            color: flipped ? 'var(--green)' : 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: '0.75rem'
          }}>
            {flipped ? 'Answer' : 'Question — tap to flip'}
          </p>
          <p style={{
            fontSize: '1rem', lineHeight: 1.65,
            color: 'var(--text)', fontWeight: flipped ? 500 : 600
          }}>
            {flipped ? card.answer : card.question}
          </p>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className='btn btn-ghost'
            style={{ flex: 1 }}
            onClick={() => {
              setCurrent(c => Math.max(0, c - 1))
              setFlipped(false)
            }}
            disabled={current === 0}
          >
            ← Prev
          </button>
          <button
            className='btn btn-primary'
            style={{ flex: 1 }}
            onClick={() => {
              if (current < cards.length - 1) {
                setCurrent(c => c + 1)
                setFlipped(false)
              }
            }}
            disabled={current === cards.length - 1}
          >
            Next →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        background: 'var(--green-dim)',
        border: '1px solid var(--green-border)',
        borderRadius: 12, padding: '1rem', marginBottom: '1.25rem'
      }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          🃏 Creates tap-to-flip flashcards from your notes. Great for quick revision before a test.
        </p>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label className='label'>How many cards?</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[5, 10, 15, 20].map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              style={{
                background: count === n ? 'var(--green)' : 'var(--surface)',
                color: count === n ? '#02160c' : 'var(--text-dim)',
                border: `1px solid ${count === n ? 'var(--green)' : 'var(--green-border)'}`,
                borderRadius: 8, padding: '0.5rem 1rem',
                fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && <div className='error-msg' style={{ marginBottom: '1rem' }}>{error}</div>}

      <button
        className='btn btn-primary'
        style={{ width: '100%', padding: '0.85rem' }}
        onClick={generate}
        disabled={loading}
      >
        {loading ? 'Generating...' : `Create ${count} Flashcards`}
      </button>
    </div>
  )
}

// ── MAIN SCREEN ───────────────────────────────────────
export default function AITools() {
  const { upload_id } = useParams()
  const navigate = useNavigate()
  const [upload, setUpload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTool, setActiveTool] = useState('simplify')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await uploadsAPI.get(upload_id)
        setUpload(data.upload)
      } catch {
        setError('Upload not found')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [upload_id])

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className='spinner' />
    </div>
  )

  if (error || !upload) return (
    <div className='screen' style={{ padding: '2rem 1.25rem' }}>
      <div className='error-msg'>{error || 'Upload not found'}</div>
      <button
        className='btn btn-ghost'
        style={{ marginTop: '1rem', width: '100%' }}
        onClick={() => navigate('/upload')}
      >
        ← Back to Uploads
      </button>
    </div>
  )

  const tool = TOOLS.find(t => t.key === activeTool)

  return (
    <div className='screen'>

      {/* Header */}
      <div className='screen-header'>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-dim)', cursor: 'pointer',
              fontSize: '1.1rem', padding: 0
            }}
          >
            ←
          </button>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: '0.68rem', color: 'var(--text-faint)',
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {upload.file_name}
            </p>
            <h1 className='screen-title' style={{ fontSize: '0.95rem' }}>
              {tool?.icon} {tool?.label}
            </h1>
          </div>
        </div>
      </div>

      {/* Tool selector */}
      <ToolBar active={activeTool} setActive={setActiveTool} />

      {/* Tool description */}
      <div style={{ padding: '0.75rem 1.25rem 0' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>
          {tool?.desc}
        </p>
      </div>

      {/* Active tool */}
      <div style={{ padding: '1rem 1.25rem' }}>
        {activeTool === 'simplify' && <SimplifyTool upload={upload} />}
        {activeTool === 'explain' && <ExplainTool upload={upload} />}
        {activeTool === 'ask' && <AskTool upload={upload} />}
        {activeTool === 'quiz' && <QuizTool upload={upload} navigate={navigate} />}
        {activeTool === 'flashcards' && <FlashcardsTool upload={upload} />}
      </div>

    </div>
  )
}
