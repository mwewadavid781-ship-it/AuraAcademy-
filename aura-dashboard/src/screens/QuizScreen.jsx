import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizAPI } from '../lib/api'

function ProgressBar({ current, total, color }) {
  return (
    <div style={{
      height: 4, background: 'var(--surface2)',
      borderRadius: 4, overflow: 'hidden'
    }}>
      <div style={{
        height: '100%', borderRadius: 4,
        background: color || 'var(--green)',
        width: `${(current / total) * 100}%`,
        transition: 'width 0.4s ease'
      }} />
    </div>
  )
}

function MCQQuestion({ q, index, answer, onAnswer }) {
  return (
    <div>
      <p style={{
        fontSize: '1rem', fontWeight: 600,
        lineHeight: 1.55, marginBottom: '1.25rem'
      }}>
        {q.question}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {q.options.map((opt, i) => {
          const selected = answer === opt
          const letter = ['A','B','C','D'][i]
          return (
            <button
              key={i}
              onClick={() => !answer && onAnswer(opt)}
              style={{
                display: 'flex', alignItems: 'center',
                gap: '0.75rem', padding: '0.85rem 1rem',
                background: selected
                  ? 'rgba(52,232,154,0.1)'
                  : 'var(--surface)',
                border: `1px solid ${selected
                  ? 'var(--green)'
                  : 'var(--green-border)'}`,
                borderRadius: 12, cursor: answer ? 'default' : 'pointer',
                textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: selected ? 'var(--green)' : 'var(--surface2)',
                color: selected ? '#02160c' : 'var(--text-dim)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
              }}>
                {letter}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TrueFalseQuestion({ q, answer, onAnswer }) {
  return (
    <div>
      <p style={{
        fontSize: '1rem', fontWeight: 600,
        lineHeight: 1.55, marginBottom: '1.25rem'
      }}>
        {q.question}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {['True', 'False'].map(opt => {
          const selected = answer === opt
          return (
            <button
              key={opt}
              onClick={() => !answer && onAnswer(opt)}
              style={{
                flex: 1, padding: '1rem',
                background: selected
                  ? opt === 'True'
                    ? 'rgba(52,232,154,0.12)'
                    : 'rgba(239,68,68,0.1)'
                  : 'var(--surface)',
                border: `1px solid ${selected
                  ? opt === 'True' ? 'var(--green)' : '#ef4444'
                  : 'var(--green-border)'}`,
                borderRadius: 12,
                cursor: answer ? 'default' : 'pointer',
                fontSize: '0.95rem', fontWeight: 700,
                color: selected
                  ? opt === 'True' ? 'var(--green)' : '#ef4444'
                  : 'var(--text-dim)',
                transition: 'all 0.15s'
              }}
            >
              {opt === 'True' ? '✓ True' : '✗ False'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ShortAnswerQuestion({ q, answer, onAnswer }) {
  const [val, setVal] = useState('')

  return (
    <div>
      <p style={{
        fontSize: '1rem', fontWeight: 600,
        lineHeight: 1.55, marginBottom: '1.25rem'
      }}>
        {q.question}
      </p>
      {!answer ? (
        <>
          <textarea
            className='input'
            placeholder='Type your answer here...'
            value={val}
            onChange={e => setVal(e.target.value)}
            rows={4}
            style={{ resize: 'none', marginBottom: '0.75rem' }}
          />
          <button
            className='btn btn-primary'
            style={{ width: '100%' }}
            onClick={() => val.trim() && onAnswer(val.trim())}
            disabled={!val.trim()}
          >
            Submit Answer
          </button>
        </>
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--green-border)',
          borderRadius: 12, padding: '1rem',
          fontSize: '0.875rem', color: 'var(--text)',
          lineHeight: 1.6
        }}>
          {answer}
        </div>
      )}
    </div>
  )
}

function ResultScreen({ results, score, total, readiness, onRetry, navigate, onFocusWeak, focusLoading }) {
  const scoreColor = score >= 70
    ? 'var(--green)'
    : score >= 50 ? '#f59e0b' : '#ef4444'

  const readinessEmoji = {
    'Exam Ready': '🎓',
    'Almost There': '💪',
    'Keep Studying': '📚',
    'Needs Work': '⚠️'
  }

  const hasWrongAnswers = results.some(r => !r.is_correct)

  // Wrong answers first — that's what the student actually needs to review
  const sortedResults = results
    .slice()
    .sort((a, b) => (a.is_correct === b.is_correct ? 0 : a.is_correct ? 1 : -1))

  return (
    <div style={{ padding: '1.25rem' }}>

      {/* Score card */}
      <div style={{
        background: 'var(--surface)',
        border: `1px solid ${scoreColor}`,
        borderRadius: 20, padding: '2rem',
        textAlign: 'center', marginBottom: '1.5rem'
      }}>
        <div style={{
          width: 90, height: 90,
          borderRadius: '50%',
          border: `4px solid ${scoreColor}`,
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          background: `${scoreColor}15`
        }}>
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '1.6rem', fontWeight: 700,
            color: scoreColor
          }}>
            {score}%
          </span>
        </div>

        <h2 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1.2rem', fontWeight: 700,
          marginBottom: '0.35rem'
        }}>
          {readinessEmoji[readiness]} {readiness}
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
          {results.filter(r => r.is_correct).length} correct out of {total} questions
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: hasWrongAnswers ? '0.75rem' : '1.5rem' }}>
        <button
          className='btn btn-ghost'
          style={{ flex: 1 }}
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <button
          className='btn btn-primary'
          style={{ flex: 1 }}
          onClick={onRetry}
        >
          Try Again
        </button>
      </div>

      {/* Focus on weak areas */}
      {hasWrongAnswers && onFocusWeak && (
        <button
          className='btn btn-primary'
          style={{
            width: '100%', padding: '0.85rem', marginBottom: '1.5rem',
            background: '#f59e0b', color: '#02160c'
          }}
          onClick={onFocusWeak}
          disabled={focusLoading}
        >
          {focusLoading ? 'Building your focus quiz...' : '🎯 Practice My Weak Areas'}
        </button>
      )}

      {/* Question review — wrong answers shown first */}
      <p style={{
        fontSize: '0.7rem', fontWeight: 700,
        color: 'var(--text-faint)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: '0.75rem'
      }}>
        Review Answers
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sortedResults.map((r, i) => (
          <div
            key={i}
            className='card'
            style={{
              borderLeft: `3px solid ${r.is_correct ? 'var(--green)' : '#ef4444'}`,
              background: r.is_correct ? 'var(--surface)' : 'rgba(239,68,68,0.04)'
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: '0.75rem',
              marginBottom: '0.5rem'
            }}>
              <p style={{ fontSize: '0.825rem', fontWeight: 600, flex: 1 }}>
                {r.question}
              </p>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700,
                padding: '0.2rem 0.5rem', borderRadius: 6,
                background: r.is_correct ? 'var(--green-dim)' : 'rgba(239,68,68,0.15)',
                color: r.is_correct ? 'var(--green)' : '#ef4444',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                flexShrink: 0
              }}>
                {r.is_correct ? 'Correct' : 'Review'}
              </span>
            </div>

            {!r.is_correct && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '0.35rem',
                marginBottom: '0.5rem'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>You said:</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{r.your_answer}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>Correct:</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{r.correct_answer}</span>
                </div>
              </div>
            )}

            {r.explanation && (
              <p style={{
                fontSize: '0.78rem', color: 'var(--text-dim)',
                lineHeight: 1.55,
                background: 'var(--surface2)',
                borderRadius: 8, padding: '0.5rem 0.75rem',
                marginTop: '0.35rem'
              }}>
                💡 {r.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function QuizScreen() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)
  const [score, setScore] = useState(null)
  const [readiness, setReadiness] = useState('')
  const [error, setError] = useState('')
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [focusLoading, setFocusLoading] = useState(false)
  const timerRef = useRef()

  useEffect(() => {
    async function load() {
      try {
        const data = await quizAPI.get(id)
        setQuiz(data.quiz)

        if (data.quiz.score != null) {
          setScore(data.quiz.score)
        }
      } catch {
        setError('Quiz not found')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (!quiz || results) return
    timerRef.current = setInterval(() => {
      setTimeElapsed(t => t + 1)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [quiz, results])

  function onAnswer(questionIndex, answer) {
    setAnswers(prev => ({ ...prev, [questionIndex]: answer }))
  }

  async function onSubmit() {
    clearInterval(timerRef.current)
    setSubmitting(true)
    try {
      const answersArr = Object.entries(answers).map(([qi, answer]) => ({
        question_index: parseInt(qi),
        answer
      }))

      const data = await quizAPI.submit(id, answersArr)
      setResults(data.results)
      setScore(data.score)
      setReadiness(data.readiness)
    } catch (err) {
      setError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onFocusWeak() {
    const wrongQs = results.filter(r => !r.is_correct).map(r => r.question)
    setFocusLoading(true)
    setError('')
    try {
      const data = await quizAPI.retestWeak(id, wrongQs)
      navigate(`/quiz/${data.quiz.id}`)
    } catch (err) {
      setError(err.message || 'Failed to build focus quiz')
    } finally {
      setFocusLoading(false)
    }
  }

  function onRetry() {
    setAnswers({})
    setCurrent(0)
    setResults(null)
    setScore(null)
    setReadiness('')
    setTimeElapsed(0)
  }

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className='spinner' />
    </div>
  )

  if (error && !quiz) return (
    <div className='screen' style={{ padding: '2rem 1.25rem' }}>
      <div className='error-msg'>{error}</div>
      <button
        className='btn btn-ghost'
        style={{ marginTop: '1rem', width: '100%' }}
        onClick={() => navigate(-1)}
      >
        ← Go Back
      </button>
    </div>
  )

  const questions = quiz?.questions || []
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === questions.length
  const q = questions[current]

  if (results) {
    return (
      <div className='screen'>
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
            <h1 className='screen-title'>Quiz Results</h1>
          </div>
          <span style={{
            fontSize: '0.78rem', color: 'var(--text-faint)'
          }}>
            ⏱ {formatTime(timeElapsed)}
          </span>
        </div>
        {error && (
          <div style={{ padding: '0.75rem 1.25rem 0' }}>
            <div className='error-msg'>{error}</div>
          </div>
        )}
        <ResultScreen
          results={results}
          score={score}
          total={questions.length}
          readiness={readiness}
          onRetry={onRetry}
          navigate={navigate}
          onFocusWeak={onFocusWeak}
          focusLoading={focusLoading}
        />
      </div>
    )
  }

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
          <div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
              Question {current + 1} of {questions.length}
            </p>
            <h1 className='screen-title' style={{ fontSize: '0.95rem' }}>
              {quiz.title}
            </h1>
          </div>
        </div>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)', fontWeight: 600 }}>
          ⏱ {formatTime(timeElapsed)}
        </span>
      </div>

      {/* Progress */}
      <div style={{ padding: '0.75rem 1.25rem 0' }}>
        <ProgressBar current={answeredCount} total={questions.length} />
        <p style={{
          fontSize: '0.68rem', color: 'var(--text-faint)',
          marginTop: '0.35rem', textAlign: 'right'
        }}>
          {answeredCount}/{questions.length} answered
        </p>
      </div>

      {/* Question type badge */}
      <div style={{ padding: '0.75rem 1.25rem 0' }}>
        <span className={`tag ${
          q?.type === 'mcq' ? 'tag-green'
          : q?.type === 'truefalse' ? 'tag-dim'
          : 'tag-dim'
        }`}>
          {q?.type === 'mcq' ? 'Multiple Choice'
            : q?.type === 'truefalse' ? 'True / False'
            : 'Short Answer'}
        </span>
      </div>

      {/* Question */}
      <div style={{ padding: '1rem 1.25rem' }}>
        {q?.type === 'mcq' && (
          <MCQQuestion
            q={q} index={current}
            answer={answers[current]}
            onAnswer={a => onAnswer(current, a)}
          />
        )}
        {q?.type === 'truefalse' && (
          <TrueFalseQuestion
            q={q}
            answer={answers[current]}
            onAnswer={a => onAnswer(current, a)}
          />
        )}
        {q?.type === 'shortanswer' && (
          <ShortAnswerQuestion
            q={q}
            answer={answers[current]}
            onAnswer={a => onAnswer(current, a)}
          />
        )}
      </div>

      {/* Navigation */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(2,22,12,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--green-border)',
        padding: '1rem 1.25rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem'
      }}>

        {/* Question dots */}
        <div style={{
          display: 'flex', gap: '0.35rem',
          flexWrap: 'wrap', justifyContent: 'center'
        }}>
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: 28, height: 28, borderRadius: 8,
                border: 'none', cursor: 'pointer',
                fontSize: '0.68rem', fontWeight: 700,
                background: i === current
                  ? 'var(--green)'
                  : answers[i] !== undefined
                    ? 'rgba(52,232,154,0.2)'
                    : 'var(--surface2)',
                color: i === current
                  ? '#02160c'
                  : answers[i] !== undefined
                    ? 'var(--green)'
                    : 'var(--text-faint)'
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className='btn btn-ghost'
            style={{ flex: 1 }}
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            ← Prev
          </button>

          {current < questions.length - 1 ? (
            <button
              className='btn btn-primary'
              style={{ flex: 1 }}
              onClick={() => setCurrent(c => c + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              className='btn btn-primary'
              style={{
                flex: 1,
                opacity: !allAnswered ? 0.6 : 1
              }}
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting
                ? 'Submitting...'
                : allAnswered
                  ? 'Submit Quiz ✓'
                  : `Submit (${answeredCount}/${questions.length})`}
            </button>
          )}
        </div>

        {error && !results && (
          <div className='error-msg' style={{ margin: 0 }}>{error}</div>
        )}
      </div>

    </div>
  )
}
