const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function getToken() {
  return localStorage.getItem('aura_token') || ''
}

async function request(method, path, body = null, isForm = false) {
  const headers = { Authorization: `Bearer ${getToken()}` }
  if (!isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : null
  })

  const data = await res.json()

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.status = res.status
    err.locked = data.locked || false
    throw err
  }

  return data
}

// ── Auth ───────────────────────────────────────────────
export const authAPI = {
  signup: (body) => request('POST', '/api/auth/signup', body),
  login: (body) => request('POST', '/api/auth/login', body),
  logout: () => request('POST', '/api/auth/logout'),
  resetPassword: (email) => request('POST', '/api/auth/reset-password', { email })
}

// ── Dashboard ──────────────────────────────────────────
export const dashAPI = {
  get: () => request('GET', '/api/dashboard')
}

// ── Courses ────────────────────────────────────────────
export const coursesAPI = {
  list: () => request('GET', '/api/courses'),
  get: (id) => request('GET', `/api/courses/${id}`),
  create: (body) => request('POST', '/api/courses', body),
  update: (id, body) => request('PATCH', `/api/courses/${id}`, body),
  delete: (id) => request('DELETE', `/api/courses/${id}`),
  addTopic: (id, body) => request('POST', `/api/courses/${id}/topics`, body),
  addAssignment: (id, body) => request('POST', `/api/courses/${id}/assignments`, body),
  addTestDate: (id, body) => request('POST', `/api/courses/${id}/testdates`, body)
}

// ── Uploads ────────────────────────────────────────────
export const uploadsAPI = {
  list: (course_id) => request('GET', `/api/uploads${course_id ? `?course_id=${course_id}` : ''}`),
  get: (id) => request('GET', `/api/uploads/${id}`),
  upload: (formData) => request('POST', '/api/uploads', formData, true),
  delete: (id) => request('DELETE', `/api/uploads/${id}`)
}

// ── AI ─────────────────────────────────────────────────
export const aiAPI = {
  simplify: (body) => request('POST', '/api/ai/simplify', body),
  explain: (body) => request('POST', '/api/ai/explain', body),
  ask: (body) => request('POST', '/api/ai/ask', body),
  generateFlashcards: (body) => request('POST', '/api/ai/flashcards', body),
  getFlashcards: (course_id) => request('GET', `/api/ai/flashcards/${course_id}`)
}

// ── Quiz ───────────────────────────────────────────────
export const quizAPI = {
  generate: (body) => request('POST', '/api/quiz/generate', body),
  list: (course_id) => request('GET', `/api/quiz${course_id ? `?course_id=${course_id}` : ''}`),
  get: (id) => request('GET', `/api/quiz/${id}`),
  submit: (id, answers) => request('POST', `/api/quiz/${id}/submit`, { answers }),
  progress: (course_id) => request('GET', `/api/quiz/progress/${course_id}`)
}

// ── Groups ─────────────────────────────────────────────
export const groupsAPI = {
  list: () => request('GET', '/api/groups'),
  get: (id) => request('GET', `/api/groups/${id}`),
  create: (body) => request('POST', '/api/groups', body),
  join: (invite_code) => request('POST', '/api/groups/join', { invite_code }),
  leave: (id) => request('DELETE', `/api/groups/${id}/leave`),
  delete: (id) => request('DELETE', `/api/groups/${id}`),
  getMessages: (id, params) => {
    const q = params?.before ? `?before=${params.before}` : ''
    return request('GET', `/api/groups/${id}/messages${q}`)
  },
  sendMessage: (id, body) => request('POST', `/api/groups/${id}/messages`, body)
}

// ── Payments ───────────────────────────────────────────
export const paymentsAPI = {
  status: () => request('GET', '/api/payments/status'),
  initiate: (body) => request('POST', '/api/payments/initiate', body),
  history: () => request('GET', '/api/payments/history')
}
