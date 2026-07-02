import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentsAPI } from '../lib/api'

const FEATURES = [
  { icon: '✨', label: 'AI Simplify', desc: 'Turn notes into bullet points' },
  { icon: '🧠', label: 'AI Explain', desc: 'Tutor-style breakdowns' },
  { icon: '💬', label: 'Ask AI Tutor', desc: 'Chat grounded in your notes' },
  { icon: '📝', label: 'Quiz Generation', desc: 'MCQ, T/F and short answer' },
  { icon: '🃏', label: 'Flashcards', desc: 'Tap-to-flip revision cards' },
  { icon: '👥', label: 'Study Groups', desc: 'Create and join group chats' },
  { icon: '📈', label: 'Progress Tracking', desc: 'Scores, streaks and readiness' }
]

function StatusBadge({ status, daysLeft, isLocked }) {
  if (status === 'active') return (
    <div style={{
      background: 'rgba(52,232,154,0.1)',
      border: '1px solid var(--green)',
      borderRadius: 12, padding: '1rem',
      textAlign: 'center', marginBottom: '1.5rem'
    }}>
      <p style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>✅</p>
      <p style={{
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '1rem', fontWeight: 700,
        color: 'var(--green)', marginBottom: '0.25rem'
      }}>
        Premium Active
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
        All features unlocked
      </p>
    </div>
  )

  if (status === 'trial' && !isLocked) return (
    <div style={{
      background: 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: 12, padding: '1rem',
      textAlign: 'center', marginBottom: '1.5rem'
    }}>
      <p style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>⏳</p>
      <p style={{
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '1rem', fontWeight: 700,
        color: '#f59e0b', marginBottom: '0.25rem'
      }}>
        Free Trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
        Subscribe before your trial ends to keep access
      </p>
    </div>
  )

  return (
    <div style={{
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 12, padding: '1rem',
      textAlign: 'center', marginBottom: '1.5rem'
    }}>
      <p style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🔒</p>
      <p style={{
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '1rem', fontWeight: 700,
        color: '#ef4444', marginBottom: '0.25rem'
      }}>
        Trial Ended
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
        Subscribe below to unlock all premium features
      </p>
    </div>
  )
}

export default function Subscription() {
  const navigate = useNavigate()
  const [subStatus, setSubStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('info') // info | pay | confirm | done
  const [momoRef, setMomoRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const [sData, hData] = await Promise.all([
          paymentsAPI.status(),
          paymentsAPI.history()
        ])
        setSubStatus(sData)
        setHistory(hData.payments || [])
      } catch {} finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function onSubmitRef() {
    if (!momoRef.trim()) return setError('Enter your MoMo transaction ID')
    if (momoRef.trim().length < 4) return setError('Transaction ID too short')
    setSubmitting(true)
    setError('')
    try {
      await paymentsAPI.initiate({ momo_ref: momoRef.trim() })
      setStep('done')
    } catch (err) {
      setError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className='spinner' />
    </div>
  )

  return (
    <div className='screen'>

      {/* Header */}
      <div className='screen-header'>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-dim)', cursor: 'pointer',
              fontSize: '1.1rem', padding: 0
            }}
          >
            ←
          </button>
          <h1 className='screen-title'>Premium</h1>
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>

        {/* Subscription status */}
        {subStatus && (
          <StatusBadge
            status={subStatus.status}
            daysLeft={subStatus.trial_days_left}
            isLocked={subStatus.is_locked}
          />
        )}

        {/* STEP: INFO */}
        {step === 'info' && (
          <>
            {/* Price card */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--green-border)',
              borderRadius: 20, padding: '1.5rem',
              textAlign: 'center', marginBottom: '1.5rem',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute', top: -40, left: '50%',
                transform: 'translateX(-50%)',
                width: 160, height: 160,
                background: 'radial-gradient(circle, rgba(52,232,154,0.08), transparent 70%)',
                pointerEvents: 'none'
              }} />

              <div style={{
                display: 'inline-block',
                background: 'var(--green-dim)',
                border: '1px solid var(--green-border)',
                borderRadius: 100, padding: '0.3rem 1rem',
                fontSize: '0.72rem', fontWeight: 700,
                color: 'var(--green)', letterSpacing: '0.06em',
                textTransform: 'uppercase', marginBottom: '1rem'
              }}>
                Weekly Plan
              </div>

              <div style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '3rem', fontWeight: 700,
                letterSpacing: '-0.04em', lineHeight: 1,
                marginBottom: '0.4rem'
              }}>
                <span style={{ fontSize: '1.2rem', color: 'var(--green)', verticalAlign: 'super' }}>K</span>
                10
                <span style={{
                  fontSize: '1rem', color: 'var(--text-dim)',
                  fontWeight: 400, letterSpacing: 0
                }}>
                  /week
                </span>
              </div>

              <p style={{
                fontSize: '0.8rem', color: 'var(--text-dim)',
                marginBottom: '1.25rem', lineHeight: 1.5
              }}>
                Cancel any week · No long-term commitment
              </p>

              {subStatus?.status !== 'active' && (
                <button
                  className='btn btn-primary'
                  style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
                  onClick={() => setStep('pay')}
                >
                  Subscribe Now — K10/week
                </button>
              )}
            </div>

            {/* Features list */}
            <p style={{
              fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--text-faint)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: '0.75rem'
            }}>
              What's included
            </p>

            <div style={{
              display: 'flex', flexDirection: 'column',
              gap: '0.6rem', marginBottom: '1.5rem'
            }}>
              {FEATURES.map(f => (
                <div
                  key={f.label}
                  className='card'
                  style={{
                    display: 'flex', gap: '0.75rem',
                    alignItems: 'center', padding: '0.85rem 1rem'
                  }}
                >
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{f.label}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{f.desc}</p>
                  </div>
                  <span style={{
                    marginLeft: 'auto', color: 'var(--green)',
                    fontSize: '0.8rem', flexShrink: 0
                  }}>✓</span>
                </div>
              ))}
            </div>

            {/* Payment history */}
            {history.length > 0 && (
              <>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  color: 'var(--text-faint)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: '0.75rem'
                }}>
                  Payment History
                </p>
                <div className='card' style={{ padding: '0 1rem' }}>
                  {history.map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '0.75rem 0',
                        borderBottom: i < history.length - 1
                          ? '1px solid rgba(255,255,255,0.04)' : 'none'
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '0.825rem', fontWeight: 500 }}>
                          K{p.amount} · {p.momo_ref}
                        </p>
                        <p style={{
                          fontSize: '0.7rem', color: 'var(--text-faint)',
                          marginTop: '0.1rem'
                        }}>
                          {new Date(p.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700,
                        color: p.status === 'success'
                          ? 'var(--green)'
                          : p.status === 'pending'
                            ? '#f59e0b' : '#ef4444',
                        textTransform: 'uppercase'
                      }}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* STEP: PAY */}
        {step === 'pay' && (
          <div>
            <h2 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1.1rem', fontWeight: 700,
              marginBottom: '0.5rem'
            }}>
              How to pay
            </h2>
            <p style={{
              fontSize: '0.875rem', color: 'var(--text-dim)',
              marginBottom: '1.5rem', lineHeight: 1.6
            }}>
              Send K10 via MTN Mobile Money then come back
              and enter your transaction ID below.
            </p>

            {/* Steps */}
            {[
              {
                num: '1',
                title: 'Open MTN MoMo on your phone',
                desc: 'Go to Send Money or Pay'
              },
              {
                num: '2',
                title: 'Send K10 to 0964969767',
                desc: 'Reference: Aura Academy'
              },
              {
                num: '3',
                title: 'Copy your transaction ID',
                desc: 'It looks like MP241234567 or similar'
              },
              {
                num: '4',
                title: 'Paste it below and submit',
                desc: 'Your account activates within minutes'
              }
            ].map(s => (
              <div
                key={s.num}
                style={{
                  display: 'flex', gap: '0.85rem',
                  marginBottom: '1rem', alignItems: 'flex-start'
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'var(--green)',
                  color: '#02160c',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '0.875rem', fontWeight: 700,
                  flexShrink: 0
                }}>
                  {s.num}
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {s.title}
                  </p>
                  <p style={{
                    fontSize: '0.78rem', color: 'var(--text-dim)',
                    marginTop: '0.15rem'
                  }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}

            {/* MoMo number highlight */}
            <div style={{
              background: 'var(--green-dim)',
              border: '1px solid var(--green)',
              borderRadius: 12, padding: '1rem',
              textAlign: 'center', marginBottom: '1.5rem'
            }}>
              <p style={{
                fontSize: '0.72rem', color: 'var(--text-dim)',
                marginBottom: '0.25rem'
              }}>
                Send K10 to MTN MoMo number
              </p>
              <p style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '1.6rem', fontWeight: 700,
                color: 'var(--green)', letterSpacing: '0.05em'
              }}>
                0964969767
              </p>
            </div>

            <button
              className='btn btn-primary'
              style={{ width: '100%', padding: '0.85rem', marginBottom: '0.75rem' }}
              onClick={() => setStep('confirm')}
            >
              I've Sent the Money →
            </button>

            <button
              className='btn btn-ghost'
              style={{ width: '100%' }}
              onClick={() => setStep('info')}
            >
              ← Back
            </button>
          </div>
        )}

        {/* STEP: CONFIRM */}
        {step === 'confirm' && (
          <div>
            <h2 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1.1rem', fontWeight: 700,
              marginBottom: '0.5rem'
            }}>
              Enter transaction ID
            </h2>
            <p style={{
              fontSize: '0.875rem', color: 'var(--text-dim)',
              marginBottom: '1.5rem', lineHeight: 1.6
            }}>
              After sending K10 to <strong style={{ color: 'var(--green)' }}>0964969767</strong>,
              paste your MoMo transaction ID below.
            </p>

            {error && (
              <div className='error-msg' style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <label className='label'>MoMo Transaction ID</label>
            <input
              className='input'
              placeholder='e.g. MP241234567'
              value={momoRef}
              onChange={e => { setMomoRef(e.target.value); setError('') }}
              style={{
                marginBottom: '0.75rem',
                letterSpacing: '0.04em',
                fontSize: '1rem'
              }}
              autoFocus
            />

            <p style={{
              fontSize: '0.75rem', color: 'var(--text-faint)',
              marginBottom: '1.25rem', lineHeight: 1.5
            }}>
              You'll find the transaction ID in your MTN MoMo
              SMS confirmation or app history.
            </p>

            <button
              className='btn btn-primary'
              style={{ width: '100%', padding: '0.85rem', marginBottom: '0.75rem' }}
              onClick={onSubmitRef}
              disabled={submitting || !momoRef.trim()}
            >
              {submitting ? 'Submitting...' : 'Submit Payment Reference'}
            </button>

            <button
              className='btn btn-ghost'
              style={{ width: '100%' }}
              onClick={() => setStep('pay')}
            >
              ← Back
            </button>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1.3rem', fontWeight: 700,
              marginBottom: '0.5rem'
            }}>
              Payment submitted!
            </h2>
            <p style={{
              fontSize: '0.875rem', color: 'var(--text-dim)',
              lineHeight: 1.65, marginBottom: '2rem', maxWidth: 320, margin: '0 auto 2rem'
            }}>
              Your transaction reference has been received.
              Your account will be activated within a few minutes
              once the payment is verified.
            </p>

            <div style={{
              background: 'var(--green-dim)',
              border: '1px solid var(--green-border)',
              borderRadius: 12, padding: '1rem',
              marginBottom: '1.5rem', textAlign: 'left'
            }}>
              <p style={{
                fontSize: '0.78rem', color: 'var(--green)',
                fontWeight: 600, marginBottom: '0.4rem'
              }}>
                What happens next:
              </p>
              {[
                'We verify your MoMo payment',
                'Your subscription activates automatically',
                'All premium features unlock instantly',
                'You get 7 days of full access'
              ].map(t => (
                <p key={t} style={{
                  fontSize: '0.78rem', color: 'var(--text-dim)',
                  marginBottom: '0.3rem'
                }}>
                  ✓ {t}
                </p>
              ))}
            </div>

            <button
              className='btn btn-primary'
              style={{ width: '100%', padding: '0.85rem' }}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
