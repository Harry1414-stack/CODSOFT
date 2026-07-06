import { useState, useEffect } from 'react'
import AttendanceEntry from './components/AttendanceEntry.jsx'
import RegisterFace from './components/RegisterFace.jsx'
import KnownFaces from './components/KnownFaces.jsx'

const TABS = [
  { id: 'entry',    label: 'Mark Attendance', icon: '✅' },
  { id: 'register', label: 'Register Employee', icon: '👤' },
  { id: 'faces',    label: 'Registered Faces', icon: '👥' },
]

export default function App() {
  const [tab, setTab]       = useState('entry')
  const [backendOk, setBackendOk] = useState(null)
  const [refKey, setRefKey]   = useState(0)
  const [theme, setTheme]     = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    let failCount = 0
    let checkCount = 0
    const startTime = Date.now()
    const GRACE_MS  = 35000   // 35s startup grace — stay "Connecting…" during TF load
    const MAX_FAILS = 5       // require 5 consecutive failures before declaring offline

    const check = async () => {
      checkCount++
      try {
        const r = await fetch('/api/health', { signal: AbortSignal.timeout(10000) })
        if (r.ok) {
          failCount = 0
          setBackendOk(true)
          return
        }
      } catch { /* network error */ }

      failCount++
      const elapsed = Date.now() - startTime
      if (elapsed < GRACE_MS) {
        // Still in startup grace period — keep showing "Connecting…"
        setBackendOk(null)
      } else if (failCount >= MAX_FAILS) {
        setBackendOk(false)
      }
      // Between 1–4 failures outside grace: stay at last known state (no flicker)
    }
    check()
    const t = setInterval(check, 4000)
    return () => clearInterval(t)
  }, [])

  const onRegistered = () => { setRefKey(k => k + 1) }

  return (
    <div className="app">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#grad)" />
              <path d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6z"
                stroke="white" strokeWidth="1.5" fill="none" />
              <circle cx="16" cy="13" r="3.5" stroke="white" strokeWidth="1.5" fill="none" />
              <path d="M9 25c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeWidth="1.5"
                strokeLinecap="round" fill="none" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#1e40af" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="brand-name">NEXOAN AI</div>
            <div className="brand-sub">Face Recognition System</div>
          </div>
        </div>

        <div className="header-right">
          <button 
            className="btn-theme-toggle" 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="company-badge">
            <span className="company-badge-dot" />
            AI Powered
          </div>
          <div className={`status-pill ${
            backendOk === null ? 'status-loading' :
            backendOk          ? 'status-ok'      : 'status-error'
          }`}>
            <span className="status-dot" />
            {backendOk === null ? 'Connecting…' : backendOk ? 'System Online' : 'System Offline'}
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="tab-nav" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab-btn ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content" role="tabpanel">
        {tab === 'entry'    && <AttendanceEntry />}
        {tab === 'register' && <RegisterFace key={refKey} onSuccess={onRegistered} />}
        {tab === 'faces'    && <KnownFaces />}
      </main>
    </div>
  )
}
