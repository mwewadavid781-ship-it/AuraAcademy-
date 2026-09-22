import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class AppErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', background: '#02160c', color: '#fff', display: 'grid', placeItems: 'center', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ maxWidth: 520 }}>
            <h1 style={{ color: '#34e89a' }}>Aura could not load</h1>
            <p style={{ margin: '1rem 0', lineHeight: 1.6 }}>Please refresh the page. If the problem continues, clear the site data and try again.</p>
            <button onClick={() => window.location.reload()} style={{ padding: '0.7rem 1rem', cursor: 'pointer' }}>Refresh</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </React.StrictMode>
  )
}
