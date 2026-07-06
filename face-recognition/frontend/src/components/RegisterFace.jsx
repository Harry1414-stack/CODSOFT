import { useState, useRef, useEffect } from 'react'

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast-wrap">
      <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
    </div>
  )
}

export default function RegisterFace({ onSuccess }) {
  const [name, setName]               = useState('')
  const [employeeId, setEmployeeId]   = useState('')
  const [role, setRole]               = useState('')
  const [department, setDepartment]   = useState('')
  const [company, setCompany]         = useState('Nexoan AI')
  const [files, setFiles]             = useState([])
  const [previews, setPreviews]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const [toast, setToast]             = useState(null)
  const [mode, setMode]               = useState('upload') // 'upload' or 'webcam'
  const [cameraOn, setCameraOn]       = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [capturing, setCapturing]     = useState(false)
  
  const fileRef = useRef()

  // Stop camera on unmount so the device isn't left locked
  useEffect(() => {
    return () => {
      fetch('/api/camera/stop', { method: 'POST' }).catch(() => {})
    }
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const startCamera = async () => {
    setCameraLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const r = await fetch('/api/camera/start', { method: 'POST', signal: controller.signal })
      clearTimeout(timeout)
      if (!r.ok) throw new Error('Camera start failed')
      setCameraOn(true)
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'Camera timed out — is it plugged in?' : (e.message || 'Failed to start camera')
      showToast(msg, 'error')
      setCameraOn(false)
    } finally {
      setCameraLoading(false)
    }
  }

  const stopCamera = async () => {
    try {
      await fetch('/api/camera/stop', { method: 'POST' })
      setCameraOn(false)
    } catch {
      setCameraOn(false)
    }
  }

  const captureSnapshot = async () => {
    setCapturing(true)
    try {
      const r = await fetch('/api/camera/capture')
      if (!r.ok) throw new Error('Failed to capture snapshot')
      const blob = await r.blob()
      
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const previewUrl = URL.createObjectURL(file)

      setFiles(prev => [...prev, file])
      setPreviews(prev => [...prev, previewUrl])
      showToast('📸 Snapshot captured!')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setCapturing(false)
    }
  }

  const addFiles = (incoming) => {
    const arr = Array.from(incoming).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    const newPreviews = arr.map(f => URL.createObjectURL(f))
    setFiles(prev => [...prev, ...arr])
    setPreviews(prev => [...prev, ...newPreviews])
  }

  const removeFile = (idx) => {
    URL.revokeObjectURL(previews[idx])
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { showToast('Please enter employee name', 'error'); return }
    if (!files.length) { showToast('Add at least one photo', 'error'); return }

    setLoading(true)
    const fd = new FormData()
    fd.append('name', name.trim())
    fd.append('employee_id', employeeId.trim())
    fd.append('role', role.trim())
    fd.append('department', department.trim())
    fd.append('company', company.trim())
    files.forEach(f => fd.append('files', f))

    try {
      const r = await fetch('/api/register', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Registration failed')

      showToast(`✅ ${data.message}`)
      
      previews.forEach(u => URL.revokeObjectURL(u))
      setName('')
      setEmployeeId('')
      setRole('')
      setDepartment('')
      setCompany('Nexoan AI')
      setFiles([])
      setPreviews([])
      stopCamera()
      onSuccess?.()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-wrap">
      <Toast toast={toast} />
      
      <div className="register-header">
        <h2>👤 Register Employee</h2>
        <p>Add employee photos for face recognition in attendance system</p>
      </div>

      {/* Employee Info */}
      <div className="form-group">
        <label className="label">Employee Name *</label>
        <input
          className="input"
          placeholder="e.g. John Doe"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      {/* Details */}
      <div className="form-grid">
        <div className="form-group">
          <label className="label">Employee ID</label>
          <input
            className="input"
            placeholder="e.g. EMP-001"
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="label">Designation</label>
          <input
            className="input"
            placeholder="e.g. Manager"
            value={role}
            onChange={e => setRole(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="label">Department</label>
          <input
            className="input"
            placeholder="e.g. Sales"
            value={department}
            onChange={e => setDepartment(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="label">Company</label>
          <input
            className="input"
            placeholder="e.g. Nexoan AI"
            value={company}
            onChange={e => setCompany(e.target.value)}
          />
        </div>
      </div>

      {/* Mode Selector */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => { setMode('upload'); stopCamera() }}
        >
          📸 Upload Photos
        </button>
        <button
          className={`mode-btn ${mode === 'webcam' ? 'active' : ''}`}
          onClick={() => { setMode('webcam'); if (!cameraOn) startCamera() }}
        >
          🎥 Live Camera
        </button>
      </div>

      {/* Drop zone - Upload Mode */}
      {mode === 'upload' && (
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
        >
          <span className="dz-icon">📸</span>
          <div className="dz-text">Drop photos here or click to browse</div>
          <div className="dz-sub">JPG, PNG, WebP — Multiple photos recommended</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={e => addFiles(e.target.files)}
          />
        </div>
      )}

      {/* Webcam Interface - Camera Mode */}
      {mode === 'webcam' && (
        <div className="webcam-section">
          <div className="video-container">
            {cameraOn ? (
              <>
                <img
                  src="/api/video-feed"
                  alt="Live camera feed"
                  className="video-feed"
                />
                <div className="live-badge">🔴 LIVE</div>
              </>
            ) : (
              <div className="camera-off">
                {cameraLoading ? (
                  <>
                    <div className="spinner"></div>
                    <p>Starting camera...</p>
                  </>
                ) : (
                  <>
                    <span className="camera-icon">📷</span>
                    <p>Camera is off</p>
                    <button
                      className="btn btn-primary"
                      onClick={startCamera}
                      disabled={cameraLoading}
                    >
                      ▶ Start Camera
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {cameraOn && (
            <div className="camera-controls">
              <button
                className="btn btn-primary"
                onClick={captureSnapshot}
                disabled={capturing}
              >
                {capturing ? '⏳ Capturing...' : '📸 Capture Snapshot'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={stopCamera}
              >
                ⏹ Stop Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* Photo previews */}
      {previews.length > 0 && (
        <div className="preview-section">
          <h4>{previews.length} photo(s) selected</h4>
          <div className="preview-grid">
            {previews.map((src, i) => (
              <div key={i} className="preview-item">
                <img src={src} alt={`Preview ${i + 1}`} />
                <button
                  className="preview-rm"
                  onClick={e => { e.stopPropagation(); removeFile(i) }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div
              className="preview-add"
              onClick={() => fileRef.current.click()}
              title="Add more photos"
            >
              +
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        className="btn btn-primary btn-large"
        onClick={handleSubmit}
        disabled={loading || !name.trim() || !files.length}
      >
        {loading ? '🔄 Registering...' : '✅ Register Employee'}
      </button>

      <style>{`
        .register-wrap {
          max-width: 700px;
          margin: 0 auto;
          padding: 2rem;
        }

        .register-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .register-header h2 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
          color: #1e40af;
        }

        .register-header p {
          color: #666;
          font-size: 0.95rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .mode-selector {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          background: #f0f9ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 0.5rem;
        }

        .mode-btn {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid transparent;
          border-radius: 6px;
          background: white;
          color: #666;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 0.95rem;
        }

        .mode-btn:hover {
          background: #f0f9ff;
        }

        .mode-btn.active {
          background: #3b82f6;
          color: white;
          border-color: #1e40af;
        }

        .label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #333;
          font-size: 0.95rem;
        }

        .input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .drop-zone {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          background: #f8fafc;
          margin-bottom: 1.5rem;
        }

        .drop-zone:hover {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .drop-zone.drag-over {
          border-color: #3b82f6;
          background: #dbeafe;
          transform: scale(1.02);
        }

        .dz-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .dz-text {
          font-size: 1.05rem;
          font-weight: 600;
          color: #1e3a8a;
          margin-bottom: 0.5rem;
        }

        .dz-sub {
          color: #666;
          font-size: 0.9rem;
        }

        .preview-section {
          margin-bottom: 1.5rem;
          padding: 1.5rem;
          background: #f0f9ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
        }

        .preview-section h4 {
          margin-bottom: 1rem;
          color: #1e40af;
          font-size: 0.95rem;
        }

        .preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 1rem;
        }

        .preview-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          background: #e0e7ff;
          border: 2px solid #c7d2fe;
        }

        .preview-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .preview-rm {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 28px;
          height: 28px;
          background: rgba(255, 0, 0, 0.8);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          transition: background 0.2s;
        }

        .preview-rm:hover {
          background: rgba(220, 38, 38, 1);
        }

        .preview-add {
          aspect-ratio: 1;
          border: 2px dashed #c7d2fe;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          cursor: pointer;
          background: white;
          transition: all 0.2s;
          color: #999;
        }

        .preview-add:hover {
          border-color: #3b82f6;
          color: #3b82f6;
          background: #eff6ff;
        }

        .webcam-section {
          margin-bottom: 1.5rem;
        }

        .video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .video-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-off {
          text-align: center;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .camera-icon {
          font-size: 3rem;
        }

        .camera-off p {
          font-size: 1.1rem;
          margin: 0;
        }

        .live-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(239, 68, 68, 0.9);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .camera-controls {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .camera-controls .btn {
          flex: 1;
          min-width: 150px;
        }

        .btn-secondary {
          background: #ef4444;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #dc2626;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
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

        .btn-primary:hover:not(:disabled) {
          background: #1e40af;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-large {
          width: 100%;
          padding: 1rem;
          font-size: 1.05rem;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  )
}
