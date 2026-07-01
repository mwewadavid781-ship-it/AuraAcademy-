import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function onChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function onSubmit() {
    if (!form.email || !form.password) {
      return setError('Please fill in all fields')
    }
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
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
          Welcome back
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          Sign in to your Aura account
        </p>
      </div>

      {/* Card */}
      <div className='card' style={{ width: '100%', maxWidth: 400 }}>

        {error && (
          <div className='error-msg' style={{ marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

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
              placeholder='Your password'
              value={form.password}
              onChange={onChange}
              autoComplete='current-password'
              onKeyDown={e => e.key === 'Enter' && onSubmit()}
            />
          </div>

          <button
            className='btn btn-primary'
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.85rem' }}
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </div>

        {/* Forgot password */}
        <p style={{
          textAlign: 'center', marginTop: '1rem',
          fontSize: '0.8rem', color: 'var(--text-dim)'
        }}>
          <Link
            to='/reset'
            style={{ color: 'var(--green)', textDecoration: 'none' }}
          >
            Forgot password?
          </Link>
        </p>

      </div>

      {/* Sign up link */}
      <p style={{
        marginTop: '1.5rem', fontSize: '0.875rem',
        color: 'var(--text-dim)', textAlign: 'center'
      }}>
        Don't have an account?{' '}
        <Link
          to='/signup'
          style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}
        >
          Sign up free
        </Link>
      </p>

      {/* Back to landing */}
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
