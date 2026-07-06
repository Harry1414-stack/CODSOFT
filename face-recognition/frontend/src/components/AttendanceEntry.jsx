import { useState, useEffect, useRef } from 'react'

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast-wrap">
      <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
    </div>
  )
}

export default function AttendanceEntry() {
  const [cameraOn, setCameraOn] = useState(false)
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(false)
  const [markedToday, setMarkedToday] = useState(new Map()) // name -> {time, timestamp}
  const [imgError, setImgError] = useState(false)
  const [toast, setToast] = useState(null)
  const [lastMarked, setLastMarked] = useState(null) // {name, timestamp}
  const wsRef = useRef(null)
  const isMarkingRef = useRef(false)
  const markedTodayRef = useRef(markedToday)
  const [countdown, setCountdown] = useState(null) // countdown timer in seconds
  const warmupRef = useRef(false)                  // warm-up guard right after camera start

  useEffect(() => {
    markedTodayRef.current = markedToday
  }, [markedToday])

  // Load today's logged attendance on component mount
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      try {
        const r = await fetch('/api/attendance-today')
        if (r.ok) {
          const data = await r.json()
          const records = data.records || []
          const initialMap = new Map()
          records.forEach(rec => {
            let timeStr = ''
            if (rec.date && rec.day && rec.month && rec.year && rec.time) {
              timeStr = `${rec.day}, ${rec.month} ${parseInt(rec.date.split('-')[0])}, ${rec.year} at ${rec.time}`
            } else {
              const timeObj = new Date(rec.timestamp || rec.marked_at)
              const dayName = timeObj.toLocaleDateString('en-US', { weekday: 'long' })
              const monthName = timeObj.toLocaleDateString('en-US', { month: 'long' })
              const dateNum = timeObj.getDate()
              const yearNum = timeObj.getFullYear()
              const tStr = timeObj.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })
              timeStr = `${dayName}, ${monthName} ${dateNum}, ${yearNum} at ${tStr}`
            }
            initialMap.set(rec.name, { time: timeStr, timestamp: rec.timestamp || rec.marked_at })
          })
          setMarkedToday(initialMap)
        }
      } catch (err) {
        console.error('Failed to load today\'s attendance:', err)
      }
    }
    fetchTodayAttendance()
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const clearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all attendance logs? This cannot be undone.")) return
    try {
      const r = await fetch('/api/attendance/clear', { method: 'DELETE' })
      if (r.ok) {
        setMarkedToday(new Map())
        setLastMarked(null)
        showToast("Attendance history cleared successfully", "success")
      } else {
        showToast("Failed to clear attendance history", "error")
      }
    } catch (err) {
      console.error(err)
      showToast("Error connecting to server", "error")
    }
  }

  /* ── WebSocket for detection metadata ── */
  useEffect(() => {
    let ws
    let retryTimer

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}/ws/detections`)

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          const newDetections = data.detections || []
          setDetections(newDetections)
          
          // Auto-mark attendance for new faces
          // Skip if in warm-up period
          if (!warmupRef.current) {
            newDetections.forEach(det => {
              if (det.name && det.name !== 'Unknown' && !markedTodayRef.current.has(det.name) && !isMarkingRef.current) {
                markAttendance(det.name, det.employee_id)
              }
            })
          }
          
          if (data.camera_on !== undefined) setCameraOn(data.camera_on)
        } catch { /* ignore malformed */ }
      }

      ws.onclose = () => {
        retryTimer = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()
    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (ws) ws.close()
    }
  }, [])

  const markAttendance = async (name, employeeId) => {
    if (isMarkingRef.current) return
    isMarkingRef.current = true
    try {
      const now = new Date()
      const timestamp = now.toISOString()
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
      const monthName = now.toLocaleDateString('en-US', { month: 'long' })
      const dateNum = now.getDate()
      const yearNum = now.getFullYear()
      const tStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      })
      const timeStr = `${dayName}, ${monthName} ${dateNum}, ${yearNum} at ${tStr}`

      const r = await fetch('/api/mark-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name,
          employee_id: employeeId || '',
          timestamp
        })
      })
      
      if (r.ok) {
        setMarkedToday(prev => new Map(prev).set(name, { time: timeStr, timestamp }))
        setLastMarked({ name, time: timeStr })

        // Stop camera and clear detections immediately
        await fetch('/api/camera/stop', { method: 'POST' }).catch(() => {})
        setCameraOn(false)
        setDetections([])   // clear stale face list from UI

        showToast(`✅ ${name} marked PRESENT at ${timeStr}`, 'success')
        
        // Start the 5-second off-and-wait period before restarting
        setCountdown(5)
      } else {
        isMarkingRef.current = false
      }
    } catch (err) {
      console.error('Error marking attendance:', err)
      isMarkingRef.current = false
    }
  }

  const startCamera = async () => {
    setLastMarked(null)   // clear success card when user starts a new session
    setDetections([])     // clear previous detections from UI
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const r = await fetch('/api/camera/start', { method: 'POST', signal: controller.signal })
      clearTimeout(timeout)
      if (!r.ok) throw new Error('Failed to start camera')
      setCameraOn(true)
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'Camera timed out — check if it is connected' : (err.message || 'Failed to start camera')
      showToast(msg, 'error')
      setCameraOn(false)
    } finally {
      setLoading(false)
    }
  }

  const stopCamera = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/camera/stop', { method: 'POST' })
      setCameraOn(false)
      setDetections([])   // clear previous detections from UI
      showToast('Camera stopped', 'success')
    } catch (err) {
      showToast('Failed to stop camera', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Countdown timer handler for auto-restarting the camera
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      setCountdown(null)
      setLastMarked(null)
      warmupRef.current = true
      startCamera()
      // Turn off warm-up guard after 3 seconds of new feed
      setTimeout(() => {
        warmupRef.current = false
        isMarkingRef.current = false
      }, 3000)
      return
    }
    const timer = setTimeout(() => {
      setCountdown(c => c - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  return (
    <div className="attendance-entry">
      <Toast toast={toast} />
      
      <div className="attendance-header">
        <h2>📋 Attendance Entry</h2>
        <p>Face detection will automatically mark employees present</p>
      </div>

      {/* ── Camera Controls ── */}
      <div className="camera-controls">
        {!cameraOn ? (
          <button className="btn btn-primary" onClick={startCamera} disabled={loading}>
            {loading ? 'Starting...' : '🎥 Start Camera'}
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopCamera} disabled={loading}>
            {loading ? 'Stopping...' : '⏹️ Stop Camera'}
          </button>
        )}
      </div>

      {/* Video Feed */}
      {cameraOn && (
        <div className="video-container">
          <img
            src="/api/video-feed"
            alt="Live Camera Feed"
            onError={() => setImgError(true)}
            onLoad={() => setImgError(false)}
            className="video-feed"
          />
          {imgError && <div className="error-overlay">Camera feed error</div>}
        </div>
      )}

      {/* Last Marked - Show prominently when someone is marked */}
      {lastMarked && (
        <div className="last-marked-card">
          <div className="checkmark-icon">✅</div>
          <div className="marked-name">{lastMarked.name}</div>
          <div className="marked-time">PRESENT at {lastMarked.time}</div>
          {countdown !== null ? (
            <div className="marked-subtitle">Camera stopped • Restarting automatically in {countdown}s for next person…</div>
          ) : (
            <div className="marked-subtitle">Camera stopped • Click <strong>Start Camera</strong> to resume manually</div>
          )}
        </div>
      )}

      {/* ── Detected Faces ── */}
      {detections.length > 0 && (
        <div className="detections-panel">
          <h3>🎯 Detected Faces</h3>
          <div className="detections-list">
            {detections.map((det, i) => {
              const isMarked = markedToday.has(det.name)
              return (
                <div key={i} className={`detection-item ${isMarked ? 'marked' : ''}`}>
                  <div className="detection-name">{det.name}</div>
                  <div className="detection-info">
                    {det.employee_id && <span>ID: {det.employee_id}</span>}
                    {det.confidence && <span>Conf: {(det.confidence * 100).toFixed(1)}%</span>}
                  </div>
                  {isMarked && <div className="status-badge status-present">✓ PRESENT</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Marked Today ── */}
      {markedToday.size > 0 && (
        <div className="marked-today">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>📊 Marked Present Today</h3>
            <button className="btn btn-danger" onClick={clearHistory} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              🗑️ Clear History
            </button>
          </div>
          <div className="count-badge">{markedToday.size} employee(s)</div>
          <div className="marked-list">
            {Array.from(markedToday.entries()).map(([name, data]) => (
              <div key={name} className="marked-item">
                <div className="mark-name">✓ {name}</div>
                <div className="mark-time">{data.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .attendance-entry {
          padding: 2rem;
          max-width: 900px;
          margin: 0 auto;
        }

        .attendance-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .attendance-header h2 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
          color: #1e40af;
        }

        .camera-controls {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          justify-content: center;
        }

        .video-container {
          position: relative;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 2rem;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .video-feed {
          width: 100%;
          display: block;
        }

        .error-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #ef4444;
          font-size: 1.1rem;
        }

        .last-marked-card {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          border: 3px solid #10b981;
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          margin-bottom: 2rem;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.2);
          animation: slideIn 0.5s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .checkmark-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          animation: bounce 0.6s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        .marked-name {
          font-size: 1.8rem;
          font-weight: 700;
          color: #047857;
          margin-bottom: 0.5rem;
        }

        .marked-time {
          font-size: 1.3rem;
          font-weight: 600;
          color: #059669;
          margin-bottom: 0.5rem;
          font-family: 'Courier New', monospace;
        }

        .marked-subtitle {
          font-size: 0.9rem;
          color: #10b981;
        }

        .detections-panel {
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border: 2px solid #0ea5e9;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .detections-panel h3 {
          margin-bottom: 1rem;
          color: #0c4a6e;
        }

        .detections-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1rem;
        }

        .detection-item {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #0ea5e9;
          transition: all 0.3s;
        }

        .detection-item.marked {
          border-left-color: #10b981;
          background: #f0fdf4;
        }

        .detection-name {
          font-weight: 600;
          color: #1e40af;
          margin-bottom: 0.5rem;
          font-size: 1.05rem;
        }

        .detection-info {
          font-size: 0.9rem;
          color: #666;
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .status-badge {
          display: inline-block;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .status-present {
          background: #d1fae5;
          color: #065f46;
        }

        .marked-today {
          background: linear-gradient(135deg, #fef3c7, #fef08a);
          border: 2px solid #fcd34d;
          border-radius: 12px;
          padding: 1.5rem;
        }

        .marked-today h3 {
          margin-bottom: 1rem;
          color: #92400e;
        }

        .count-badge {
          background: #fbbf24;
          color: #78350f;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 600;
          display: inline-block;
          margin-bottom: 1rem;
        }

        .marked-list {
          display: grid;
          gap: 0.5rem;
        }

        .marked-item {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #10b981;
          transition: all 0.3s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .marked-item:hover {
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
          transform: translateX(4px);
        }

        .mark-name {
          font-weight: 600;
          color: #065f46;
          flex: 1;
        }

        .mark-time {
          font-size: 0.9rem;
          color: #10b981;
          font-family: 'Courier New', monospace;
          font-weight: 600;
          background: #d1fae5;
          padding: 0.4rem 0.8rem;
          border-radius: 4px;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          gap: 0.5rem;
          align-items: center;
          justify-content: center;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #1e40af;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover {
          background: #dc2626;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
