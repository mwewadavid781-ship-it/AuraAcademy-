import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const MAX_MB = 10

export default function Upload() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected && selected.size > MAX_MB * 1024 * 1024) {
      alert('File size exceeds 10MB limit.')
      return
    }
    setFile(selected)
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('course_id', params.get('course_id') || '')

    try {
      // Points to your Express API route
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (response.ok) {
        alert('File uploaded successfully!')
        navigate('/dashboard')
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (err) {
      console.error(err)
      alert('Error uploading file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Upload Study Materials</h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <input
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.txt,.jpg,.png,.webp,.pptx"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Uploading...' : 'Upload File'}
        </button>
      </form>
    </div>
  )
}
