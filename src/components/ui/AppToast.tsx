import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { _registerToast } from '@/lib/toast'

interface Toast {
  id: number
  msg: string
  type: 'success' | 'error'
}

export function AppToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    _registerToast((msg, type = 'success') => {
      const id = Date.now()
      setToasts(p => [...p, { id, msg, type }])
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2200)
    })
  }, [])

  if (toasts.length === 0) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '.5rem',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: t.type === 'success'
              ? 'rgba(74,222,128,.95)'
              : 'rgba(248,113,113,.95)',
            color: t.type === 'success' ? '#052e16' : '#450a0a',
            padding: '.6rem 1.1rem',
            borderRadius: 10,
            fontSize: '.85rem',
            fontWeight: 700,
            fontFamily: 'Raleway, sans-serif',
            boxShadow: '0 4px 24px rgba(0,0,0,.45)',
            animation: 'fadeInUp .18s ease',
            letterSpacing: '.02em',
          }}
        >
          {t.type === 'success' ? '✓ ' : '✕ '}{t.msg}
        </div>
      ))}
    </div>,
    document.body,
  )
}
