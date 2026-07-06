import { useState, useEffect, useRef } from 'react'

export default function LiveCamera() {
  const [cameraOn, setCameraOn] = useState(false)
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(false)
  const [imgError, setImgError] = useState(false)
  const wsRef = useRef(null)

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
          setDetections(data.detections || [])
          if (data.camera_on !== undefined) setCameraOn(data.camera_on)
        } catch { /* ignore malformed */ }
      }

      ws.onclose = () => {
        retryTimer = setTimeout(connect, 2000)
      }

      wsRef.current = ws
    }

    connect()
    return () => {
      ws?.close()
      clearTimeout(retryTimer)
    }
  }, [])

  /* ── Toggle camera via API ── */
  const toggleCamera = async () => {
    setLoading(true)
    try {
      const action = cameraOn ? 'stop' : 'start'
      const r = await fetch(`/api/camera/${action}`, { method: 'POST' })
      if (!r.ok) throw new Error('Failed')
      setCameraOn(!cameraOn)
      if (!cameraOn) {
        setImgError(false)
        setDetections([])
      }
    } catch {
      // swallow — WS will reflect real state
    } finally {
      setLoading(false)
    }
  }

  const recognized = detections.filter(d => d.name !== 'Unknown')
  const unknown    = detections.filter(d => d.name === 'Unknown')

  return (
    <div>
      <h2 className="section-title">Live Camera Feed</h2>
      <p className="section-sub">Real-time face detection & recognition from your webcam</p>

      <div className="camera-layout">

        {/* ── Left: Video ── */}
        <div>
          <div className="camera-controls">
            <button
              id="btn-toggle-camera"
              className={`btn ${cameraOn ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleCamera}
              disabled={loading}
            >
              {loading && <span className="spinner" />}
              {cameraOn ? '⏹ Stop Camera' : '▶ Start Camera'}
            </button>

            {cameraOn && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Stream is live · annotations rendered by backend
              </span>
            )}
          </div>

          <div className="camera-feed-wrap">
            {cameraOn && !imgError ? (
              <>
                {/* MJPEG stream — browser handles multipart decode natively */}
                <img
                  src="/api/video-feed"
                  alt="Live annotated camera feed"
                  onError={() => setImgError(true)}
                />
                <div className="badge-live">
                  <span className="live-dot" />
                  LIVE
                </div>
              </>
            ) : (
              <div className="camera-placeholder">
                <div className="cam-placeholder-icon">📷</div>
                <p style={{ fontWeight: 500 }}>
                  {imgError ? 'Camera unavailable' : 'Camera is off'}
                </p>
                <p style={{ fontSize: 12 }}>
                  {imgError
                    ? 'Check that a webcam is connected and accessible'
                    : 'Click "Start Camera" to begin'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Detections panel ── */}
        <div className="detections-panel">

          {/* Detection list */}
          <div className="card">
            <div className="det-panel-header">
              <div className="section-title" style={{ fontSize: 16 }}>Detected Faces</div>
              <div className="det-count"><strong>{detections.length}</strong> in frame</div>
            </div>

            {detections.length === 0 ? (
              <div className="no-det">
                <div className="no-det-icon">👁</div>
                <p>{cameraOn ? 'No faces detected in frame' : 'Start camera to begin'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detections.map((d, i) => (
                  <div key={i} className="det-card">
                    <div className={`det-avatar ${d.name !== 'Unknown' ? 'known' : 'unknown'}`}>
                      {d.name !== 'Unknown' ? '✅' : '❓'}
                    </div>
                    <div className="det-info">
                      <div className="det-name">{d.name}</div>
                      <div className="det-conf">
                        {d.name !== 'Unknown'
                          ? `${(d.confidence * 100).toFixed(0)}% confidence`
                          : 'Not recognized — register this person'}
                      </div>
                      {d.name !== 'Unknown' && (
                        <div className="conf-bar">
                          <div className="conf-fill" style={{ width: `${d.confidence * 100}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats card */}
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Session Stats
            </div>
            <div className="stats-row">
              <StatRow label="Total Detected" value={detections.length} color="var(--accent)" />
              <StatRow label="Recognized"     value={recognized.length} color="var(--success)" />
              <StatRow label="Unknown"         value={unknown.length}    color="var(--danger)" />
            </div>
          </div>

          {/* Hint card */}
          {!cameraOn && (
            <div className="card" style={{ background: 'var(--purple-dim)', borderColor: 'rgba(124,58,237,0.25)' }}>
              <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, marginBottom: 6 }}>
                🚀 Getting Started
              </div>
              <ol style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 2 }}>
                <li>Register people in the <strong style={{ color: 'var(--text-dim)' }}>Register</strong> tab</li>
                <li>Come back here and click <strong style={{ color: 'var(--text-dim)' }}>Start Camera</strong></li>
                <li>Face the webcam — names appear instantly!</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div className="stat-item">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color }}>{value}</span>
    </div>
  )
}
