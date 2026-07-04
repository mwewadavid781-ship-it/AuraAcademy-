import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login from './screens/Login'
import Signup from './screens/Signup'
import Dashboard from './screens/Dashboard'
import Syllabus from './screens/Syllabus'
import CourseDetail from './screens/CourseDetail'
import Uploads from './screens/Uploads'
import AITools from './screens/AITools'
import QuizScreen from './screens/QuizScreen'
import Groups from './screens/Groups'
import GroupChat from './screens/GroupChat'
import Subscription from './screens/Subscription'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to='/login' replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (user) return <Navigate to='/dashboard' replace />
  return children
}

function Loader() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#02160c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className='spinner' />
        <p style={{ color: '#34e89a', marginTop: '1rem', fontSize: '0.875rem' }}>
          Loading Aura...
        </p>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<Navigate to='/dashboard' replace />} />
      <Route path='/login' element={<PublicRoute><Login /></PublicRoute>} />
      <Route path='/signup' element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path='/syllabus' element={<ProtectedRoute><Syllabus /></ProtectedRoute>} />
      <Route path='/courses/:id' element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
      <Route path='/uploads' element={<ProtectedRoute><Upload /></ProtectedRoute>} />
      <Route path='/ai/:uploads_id' element={<ProtectedRoute><AITools /></ProtectedRoute>} />
      <Route path='/quiz/:id' element={<ProtectedRoute><QuizScreen /></ProtectedRoute>} />
      <Route path='/groups' element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path='/groups/:id' element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
      <Route path='/subscription' element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
      <Route path='*' element={<Navigate to='/dashboard' replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
