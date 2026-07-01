import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('aura_user')
    const token = localStorage.getItem('aura_token')
    if (stored && token) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.clear()
      }
    }
    setLoading(false)
  }, [])

  async function login(email, password) {
    const data = await authAPI.login({ email, password })
    localStorage.setItem('aura_token', data.token)
    localStorage.setItem('aura_user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  async function signup(email, password, full_name) {
    const data = await authAPI.signup({ email, password, full_name })
    localStorage.setItem('aura_token', data.token)
    localStorage.setItem('aura_user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  async function logout() {
    try { await authAPI.logout() } catch {}
    localStorage.removeItem('aura_token')
    localStorage.removeItem('aura_user')
    setUser(null)
  }

  function updateUser(updates) {
    const updated = { ...user, ...updates }
    localStorage.setItem('aura_user', JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
