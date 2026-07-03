import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path='*' element={
        <div style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          fontFamily: 'sans-serif',
          color: 'white'
        }}>
          <h1 style={{ color: '#34e89a', fontSize: '2rem' }}>✦ Aura Academy</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Router is working!</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            Path: {window.location.pathname}
          </p>
        </div>
      } />
    </Routes>
  </BrowserRouter>
)
