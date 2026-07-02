import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { groupsAPI } from '../lib/api'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '../context/AuthContext'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const QUICK_REPLIES = [
  '👍 Got it!',
  '❓ Can you explain?',
  '📝 Noted',
  '✅ Done',
  '🔥 Let\'s go!',
  '⏰ When are we meeting?'
]

function Avatar({ name, size = 32 }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  const colors = ['#34e89a','#60a5fa','#f59e0b','#a78bfa','#f472b6']
  const color = colors[initials.charCodeAt(0) % colors.length]

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}22`,
      border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
      color, flexShrink: 0
    }}>
      {initials}
    </div>
  )
}

function MessageBubble({ msg, isMe }) {
  const name = msg.users?.full_name || 'Member'
  const time = new Date(msg.created_at).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  })

  if (msg.message_type === 'file') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        gap: '0.5rem', alignItems: 'flex-end',
        marginBottom: '0.75rem'
      }}>
        {!isMe && <Avatar name={name} size={28} />}
        <div style={{ maxWidth: '75%' }}>
          {!isMe && (
            <p style={{
              fontSize: '0.68rem', color: 'var(--text-faint)',
              marginBottom: '0.25rem', paddingLeft: '0.25rem'
            }}>
              {name}
            </p>
          )}
          <div style={{
            background: isMe ? 'var(--green-dim)' : 'var(--surface)',
            border: `1px solid ${isMe ? 'var(--green)' : 'var(--green-border)'}`,
            borderRadius: isMe
              ? '16px 16px 4px 16px'
              : '16px 16px 16px 4px',
            padding: '0.75rem 1rem',
            display: 'flex', gap: '0.6rem', alignItems: 'center'
          }}>
            <span style={{ fontSize: '1.3rem' }}>📄</span>
            <div>
              <p style={{
                fontSize: '0.8rem', fontWeight: 600,
                color: 'var(--text)'
              }}>
                {msg.file_name || 'File'}
              </p>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                Shared file
              </p>
            </div>
          </div>
          <p style={{
            fontSize: '0.62rem', color: 'var(--text-faint)',
            marginTop: '0.25rem',
            textAlign: isMe ? 'right' : 'left',
            paddingLeft: '0.25rem'
          }}>
            {time}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMe ? 'row-reverse' : 'row',
      gap: '0.5rem', alignItems: 'flex-end',
      marginBottom: '0.75rem'
    }}>
      {!isMe && <Avatar name={name} size={28} />}
      <div style={{ maxWidth: '78%' }}>
        {!isMe && (
          <p style={{
            fontSize: '0.68rem', color: 'var(--text-faint)',
            marginBottom: '0.25rem', paddingLeft: '0.25rem'
          }}>
            {name}
          </p>
        )}
        <div style={{
          background: isMe ? 'var(--green)' : 'var(--surface)',
          color: isMe ? '#02160c' : 'var(--text)',
          border: isMe ? 'none' : '1px solid var(--green-border)',
          borderRadius: isMe
            ? '16px 16px 4px 16px'
            : '16px 16px 16px 4px',
          padding: '0.65rem 0.9rem',
          fontSize: '0.875rem',
          lineHeight: 1.55,
          wordBreak: 'break-word'
        }}>
          {msg.content}
        </div>
        <p style={{
          fontSize: '0.62rem', color: 'var(--text-faint)',
          marginTop: '0.25rem',
          textAlign: isMe ? 'right' : 'left',
          paddingLeft: '0.25rem'
        }}>
          {time}
        </p>
      </div>
    </div>
  )
}

function DateDivider({ date }) {
  const label = (() => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today - 86400000)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short'
    })
  })()

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: '0.75rem', margin: '1rem 0'
    }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span style={{
        fontSize: '0.65rem', color: 'var(--text-faint)',
        fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', whiteSpace: 'nowrap'
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function MembersSheet({ members, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end'
    }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)'
        }}
      />
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#061a10',
        border: '1px solid var(--green-border)',
        borderRadius: '24px 24px 0 0',
        padding: '1.5rem 1.25rem 2.5rem',
        maxHeight: '60vh', overflowY: 'auto'
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 4,
          background: 'var(--green-border)',
          margin: '0 auto 1.25rem'
        }} />
        <h3 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1rem', fontWeight: 700,
          marginBottom: '1rem'
        }}>
          Members ({members.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {members.map(m => (
            <div key={m.user_id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem'
            }}>
              <Avatar name={m.users?.full_name} size={36} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {m.users?.full_name || 'Member'}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                  Joined {new Date(m.joined_at).toLocaleDateString('en-GB')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GroupChat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const bottomRef = useRef()
  const inputRef = useRef()

  useEffect(() => {
    async function load() {
      try {
        const [gData, mData] = await Promise.all([
          groupsAPI.get(id),
          groupsAPI.getMessages(id)
        ])
        setGroup(gData.group)
        setMessages(mData.messages || [])
      } catch {
        setError('Could not load chat')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`group_messages:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${id}`
        },
        payload => {
          const newMsg = payload.new
          // Avoid duplicates from our own sends
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id])

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content, type = 'text') {
    if (!content.trim() || sending) return
    setSending(true)
    const optimistic = {
      id: `temp-${Date.now()}`,
      content, message_type: type,
      user_id: user.id,
      created_at: new Date().toISOString(),
      users: { full_name: user.full_name }
    }
    setMessages(prev => [...prev, optimistic])
    setText('')
    setShowQuickReplies(false)
    try {
      const data = await groupsAPI.sendMessage(id, {
        content, message_type: type
      })
      // Replace optimistic with real message
      setMessages(prev =>
        prev.map(m => m.id === optimistic.id ? data.message : m)
      )
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setError(err.locked
        ? 'Subscribe to use group chat.'
        : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(text)
    }
  }

  // Group messages by date
  function groupByDate(msgs) {
    const groups = []
    let lastDate = null
    for (const msg of msgs) {
      const d = new Date(msg.created_at).toDateString()
      if (d !== lastDate) {
        groups.push({ type: 'date', date: msg.created_at })
        lastDate = d
      }
      groups.push({ type: 'message', msg })
    }
    return groups
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className='spinner' />
    </div>
  )

  if (error && !group) return (
    <div className='screen' style={{ padding: '2rem 1.25rem' }}>
      <div className='error-msg'>{error}</div>
      <button
        className='btn btn-ghost'
        style={{ marginTop: '1rem', width: '100%' }}
        onClick={() => navigate('/groups')}
      >
        ← Back to Groups
      </button>
    </div>
  )

  const members = group?.group_members || []
  const items = groupByDate(messages)

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column'
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: '0.75rem', padding: '0.9rem 1.25rem',
        background: 'rgba(2,22,12,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(52,232,154,0.08)',
        position: 'sticky', top: 0, zIndex: 40
      }}>
        <button
          onClick={() => navigate('/groups')}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontSize: '1.1rem', padding: 0, flexShrink: 0
          }}
        >
          ←
        </button>

        <div
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'var(--green-dim)',
            border: '1px solid var(--green-border)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.1rem',
            flexShrink: 0, cursor: 'pointer'
          }}
          onClick={() => setShowMembers(true)}
        >
          👥
        </div>

        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => setShowMembers(true)}
        >
          <p style={{
            fontSize: '0.95rem', fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {group?.name}
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
            {' · '}{group?.courses?.course_name}
          </p>
        </div>

        {/* Invite code pill */}
        <div style={{
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
          borderRadius: 8, padding: '0.3rem 0.65rem',
          flexShrink: 0
        }}>
          <p style={{
            fontSize: '0.62rem', color: 'var(--text-faint)',
            lineHeight: 1
          }}>
            Code
          </p>
          <p style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: 'var(--green)', letterSpacing: '0.06em'
          }}>
            {group?.invite_code}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '1rem 1.25rem',
        paddingBottom: showQuickReplies ? '14rem' : '8rem'
      }}>

        {messages.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '3rem 1rem'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
            <p style={{
              fontSize: '0.875rem', fontWeight: 600,
              marginBottom: '0.35rem'
            }}>
              No messages yet
            </p>
            <p style={{
              fontSize: '0.78rem', color: 'var(--text-faint)',
              lineHeight: 1.5
            }}>
              Be the first to say something!
              Share the code <strong style={{ color: 'var(--green)' }}>
                {group?.invite_code}
              </strong> to invite classmates.
            </p>
          </div>
        )}

        {items.map((item, i) => {
          if (item.type === 'date') {
            return <DateDivider key={`date-${i}`} date={item.date} />
          }
          const msg = item.msg
          const isMe = msg.user_id === user?.id
          return (
            <MessageBubble key={msg.id} msg={msg} isMe={isMe} />
          )
        })}

        {error && (
          <div className='error-msg' style={{ marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQuickReplies && (
        <div style={{
          position: 'fixed',
          bottom: '4.5rem', left: 0, right: 0,
          background: 'rgba(6,26,16,0.98)',
          borderTop: '1px solid var(--green-border)',
          padding: '0.75rem 1.25rem',
          display: 'flex', gap: '0.5rem',
          flexWrap: 'wrap', zIndex: 30
        }}>
          {QUICK_REPLIES.map(qr => (
            <button
              key={qr}
              onClick={() => sendMessage(qr, 'quick_reply')}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--green-border)',
                borderRadius: 100,
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem', color: 'var(--text)',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(2,22,12,0.98)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--green-border)',
        padding: '0.75rem 1.25rem',
        display: 'flex', gap: '0.5rem',
        alignItems: 'flex-end', zIndex: 40
      }}>

        {/* Quick reply toggle */}
        <button
          onClick={() => setShowQuickReplies(s => !s)}
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: showQuickReplies
              ? 'var(--green)' : 'var(--surface)',
            border: '1px solid var(--green-border)',
            color: showQuickReplies ? '#02160c' : 'var(--text-dim)',
            fontSize: '1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0
          }}
        >
          ⚡
        </button>

        <textarea
          ref={inputRef}
          className='input'
          placeholder='Message...'
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          style={{
            flex: 1, resize: 'none',
            maxHeight: 100, lineHeight: 1.5,
            padding: '0.6rem 0.85rem'
          }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
          }}
        />

        <button
          onClick={() => sendMessage(text)}
          disabled={!text.trim() || sending}
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: text.trim() ? 'var(--green)' : 'var(--surface)',
            border: '1px solid var(--green-border)',
            color: text.trim() ? '#02160c' : 'var(--text-faint)',
            fontSize: '1rem', cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            transition: 'all 0.15s'
          }}
        >
          {sending ? '...' : '→'}
        </button>
      </div>

      {showMembers && (
        <MembersSheet
          members={members}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  )
}
