import { useState, useRef } from 'react'

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast-wrap">
      <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
    </div>
  )
}

export default function ImageAnalysis() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [annotatedImg, setAnnotatedImg] = useState(null)
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState(null)
  const fileRef = useRef()

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleFile = (selectedFile) => {
    if (!selectedFile) return
    if (!selectedFile.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error')
      return
    }
    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
    setAnnotatedImg(null)
    setDetections([])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const triggerAnalyze = async (imgFile) => {
    const targetFile = imgFile || file
    if (!targetFile) {
      showToast('Please select an image first', 'error')
      return
    }

    setLoading(true)
    const fd = new FormData()
    fd.append('file', targetFile)

    try {
      const r = await fetch('/api/recognize', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Analysis failed')
      
      setDetections(data.detections || [])
      setAnnotatedImg(data.annotated_image)
      showToast(`Analyzed image. Found ${data.face_count} face(s).`)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetImage = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setAnnotatedImg(null)
    setDetections([])
  }

  const recognized = detections.filter(d => d.name !== 'Unknown')
  const unknown = detections.filter(d => d.name === 'Unknown')

  return (
    <div>
      <h2 className="section-title">Static Image Analysis</h2>
      <p className="section-sub">Upload or drag a photo to run face detection and identification</p>

      <div className="camera-layout">
        {/* ── Left: Image Upload & Preview ── */}
        <div>
          <div className="camera-controls">
            {preview && (
              <button
                className="btn btn-secondary"
                onClick={resetImage}
                disabled={loading}
              >
                🔄 Upload Different Image
              </button>
            )}
            {preview && !annotatedImg && (
              <button
                className="btn btn-primary"
                onClick={() => triggerAnalyze()}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : '🔍 Analyze Photo'}
              </button>
            )}
          </div>

          <div className="camera-feed-wrap" style={{ minHeight: 320, background: 'var(--bg-2)' }}>
            {annotatedImg ? (
              <img
                src={annotatedImg}
                alt="Analyzed face detection result"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : preview ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <img
                  src={preview}
                  alt="Source preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: loading ? 0.5 : 1 }}
                />
                {loading && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', gap: 12 }}>
                    <div className="spinner" style={{ width: 40, height: 40 }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>Analyzing features...</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                style={{ border: 'none', margin: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 0, background: 'transparent' }}
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && fileRef.current.click()}
                aria-label="Upload photo for analysis"
              >
                <span className="dz-icon" style={{ fontSize: 44 }}>🖼️</span>
                <div className="dz-text" style={{ marginTop: 8 }}>Drop photo here or click to browse</div>
                <div className="dz-sub">Supports JPG, PNG, WEBP, BMP</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0])
                      // Auto-analyze on file selection
                      triggerAnalyze(e.target.files[0])
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Detections panel ── */}
        <div className="detections-panel">
          <div className="card">
            <div className="det-panel-header">
              <div className="section-title" style={{ fontSize: 16 }}>Detected Faces</div>
              <div className="det-count"><strong>{detections.length}</strong> in photo</div>
            </div>

            {!preview ? (
              <div className="no-det">
                <div className="no-det-icon">🖼️</div>
                <p>Upload a photo to see analysis results</p>
              </div>
            ) : loading && detections.length === 0 ? (
              <div className="no-det">
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p>Processing image...</p>
              </div>
            ) : detections.length === 0 ? (
              <div className="no-det">
                <div className="no-det-icon">👁️</div>
                <p>{annotatedImg ? 'No faces detected in this image' : 'Click "Analyze Photo" to scan'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detections.map((d, i) => (
                  <div key={i} className="det-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={`det-avatar ${d.name !== 'Unknown' ? 'known' : 'unknown'}`} style={{ width: 28, height: 28, fontSize: 12 }}>
                        {d.name !== 'Unknown' ? '✅' : '❓'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="det-name" style={{ fontSize: 14 }}>{d.name}</div>
                        <div className="det-conf" style={{ fontSize: 11 }}>
                          {d.name !== 'Unknown'
                            ? `${(d.confidence * 100).toFixed(0)}% confidence`
                            : 'Unrecognized face'}
                        </div>
                      </div>
                    </div>

                    {d.name !== 'Unknown' ? (
                      <div className="analysis-meta-details" style={{ fontSize: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        {d.employee_id && <div style={{ marginBottom: 4 }}><strong>Employee ID:</strong> {d.employee_id}</div>}
                        {d.role && <div style={{ marginBottom: 4 }}><strong>Role:</strong> {d.role}</div>}
                        {d.department && <div style={{ marginBottom: 4 }}><strong>Department:</strong> {d.department}</div>}
                        {d.company && <div><strong>Company:</strong> {d.company}</div>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: 36 }}>
                        Add this person via the Register tab to recognize them in the future.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session Stats card */}
          {preview && detections.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Analysis Summary
              </div>
              <div className="stats-row">
                <div className="stat-item">
                  <span className="stat-label">Total Faces</span>
                  <span className="stat-value" style={{ color: 'var(--accent)' }}>{detections.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Recognized</span>
                  <span className="stat-value" style={{ color: 'var(--success)' }}>{recognized.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Unknown</span>
                  <span className="stat-value" style={{ color: 'var(--danger)' }}>{unknown.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
