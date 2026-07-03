import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const STEPS = ['account', 'courses']

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState('account')
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState(null)

  function onChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function onCreateAccount() {
    if (!form.full_name || !form.email || !form.password) {
      return setError('All fields are required')
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters')
    }
    if (form.password !== form.confirm) {
      return setError('Passwords do not match')
    }

    setLoading(true)
    try {
      const data = await signup(form.email, form.password, form.full_name)
      setUserId(data.user.id)
      setStep('courses')
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: 56, height: 56,
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
          borderRadius: 16,
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem', margin: '0 auto 1rem'
        }}>✦</div>
        <h1 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1.6rem', fontWeight: 700,
          letterSpacing: '-0.03em'
        }}>
          {step === 'account' ? 'Create your account' : 'You\'re in! 🎉'}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          {step === 'account'
            ? '7-day free trial · No payment needed'
            : 'Head to your dashboard to add your first course'}
        </p>
      </div>

      {/* Step indicator */}
      <div style={{
        display: 'flex', gap: '0.5rem',
        marginBottom: '1.5rem'
      }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            width: 24, height: 4, borderRadius: 4,
            background: i <= STEPS.indexOf(step)
              ? 'var(--green)'
              : 'var(--green-border)'
          }} />
        ))}
      </div>

      {/* STEP 1 — Account details */}
      {step === 'account' && (
        <div className='card' style={{ width: '100%', maxWidth: 400 }}>

          {error && (
            <div className='error-msg' style={{ marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div>
              <label className='label'>Full Name</label>
              <input
                className='input'
                name='full_name'
                placeholder='Your full name'
                value={form.full_name}
                onChange={onChange}
                autoComplete='name'
              />
            </div>

            <div>
              <label className='label'>Email</label>
              <input
                className='input'
                type='email'
                name='email'
                placeholder='you@example.com'
                value={form.email}
                onChange={onChange}
                autoComplete='email'
              />
            </div>

            <div>
              <label className='label'>Password</label>
              <input
                className='input'
                type='password'
                name='password'
                placeholder='Min 6 characters'
                value={form.password}
                onChange={onChange}
                autoComplete='new-password'
              />
            </div>

            <div>
              <label className='label'>Confirm Password</label>
              <input
                className='input'
                type='password'
                name='confirm'
                placeholder='Repeat your password'
                value={form.confirm}
                onChange={onChange}
                autoComplete='new-password'
                onKeyDown={e => e.key === 'Enter' && onCreateAccount()}
              />
            </div>

            <button
              className='btn btn-primary'
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.85rem' }}
              onClick={onCreateAccount}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>

          </div>

          {/* Trial info */}
          <div style={{
            marginTop: '1.25rem',
            background: 'var(--green-dim)',
            border: '1px solid var(--green-border)',
            borderRadius: 10, padding: '0.75rem 1rem'
          }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 600 }}>
              ✦ 7-day free trial included
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              Full access to all features. K10/week after trial ends.
            </p>
          </div>

        </div>
      )}

      {/* STEP 2 — Success, go to dashboard */}
      {step === 'courses' && (
        <div className='card' style={{
          width: '100%', maxWidth: 400, textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎓</div>
          <h2 style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '1.2rem', fontWeight: 700,
            marginBottom: '0.5rem'
          }}>
            Account ready!
          </h2>
          <p style={{
            color: 'var(--text-dim)', fontSize: '0.875rem',
            lineHeight: 1.6, marginBottom: '1.5rem'
          }}>
            Your 7-day free trial has started. Add your first course
            from the dashboard to get started.
          </p>

          {/* What to do next */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.6rem',
            marginBottom: '1.5rem', textAlign: 'left'
          }}>
            {[
              { icon: '📚', text: 'Add your courses and topics' },
              { icon: '📄', text: 'Upload your lecture notes or PDFs' },
              { icon: '🧠', text: 'Generate quizzes and flashcards' },
              { icon: '👥', text: 'Create or join a study group' }
            ].map(item => (
              <div key={item.text} style={{
                display: 'flex', alignItems: 'center',
                gap: '0.75rem', fontSize: '0.875rem',
                color: 'var(--text-dim)'
              }}>
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          <button
            className='btn btn-primary'
            style={{ width: '100%', padding: '0.85rem' }}
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard →
          </button>
        </div>
      )}

      {/* Sign in link */}
      {step === 'account' && (
        <p style={{
          marginTop: '1.5rem', fontSize: '0.875rem',
          color: 'var(--text-dim)', textAlign: 'center'
        }}>
          Already have an account?{' '}
          <Link
            to='/login'
            style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign in
          </Link>
        </p>
      )}

      <a
        href='/landing.html'
        style={{
          marginTop: '1rem', fontSize: '0.78rem',
          color: 'var(--text-faint)', textDecoration: 'none'
        }}
      >
        ← Back to home
      </a>

    </div>
  )
}
