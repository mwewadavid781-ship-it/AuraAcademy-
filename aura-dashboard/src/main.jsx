import React from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('root')).render(
  <div style={{
    minHeight: '100vh',
    background: '#02160c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '1rem',
    fontFamily: 'sans-serif',
    color: 'white'
  }}>
    <h1 style={{ color: '#34e89a', fontSize: '2rem' }}>✦ Aura Academy</h1>
    <p style={{ color: 'rgba(255,255,255,0.5)' }}>React is working!</p>
  </div>
)
