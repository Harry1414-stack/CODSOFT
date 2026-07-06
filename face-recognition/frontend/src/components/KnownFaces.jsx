import { useState, useEffect } from 'react'

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast-wrap">
      <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
    </div>
  )
}

export default function KnownFaces() {
  const [people, setPeople]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast]     = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loadError, setLoadError] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const r = await fetch('/api/known-faces')
      if (r.ok) {
        setPeople(await r.json())
      } else {
        setLoadError(true)
        showToast('Failed to load registered faces', 'error')
      }
    } catch {
      setLoadError(true)
      showToast('Cannot connect to backend', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const deletePerson = async (name) => {
    setDeleting(name)
    try {
      const r = await fetch(`/api/known-faces/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      showToast(`🗑 Deleted "${name}"`)
      setPeople(prev => prev.filter(p => p.name !== name))
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  const filtered = people.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
        <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <div className="empty-title">Failed to load registered faces</div>
        <div className="empty-sub" style={{ marginBottom: '1.5rem' }}>Check that the backend is running</div>
        <button className="btn btn-primary" onClick={load}>🔄 Retry</button>
        <Toast toast={toast} />
      </div>
    )
  }

  return (
    <div>
      {/* Top bar */}
      <div className="faces-topbar">
        <div>
          <h2 className="section-title">Registered Faces</h2>
          <p className="section-sub" style={{ margin: 0 }}>
            {people.length} registered {people.length === 1 ? 'person' : 'people'}
            {search && ` · ${filtered.length} shown`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="face-search"
            className="input"
            placeholder="🔍 Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <button
            className="btn btn-ghost"
            onClick={load}
            title="Refresh list"
            style={{ padding: '10px 14px', flexShrink: 0 }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{search ? '🔍' : '👥'}</div>
          <div className="empty-title">
            {search ? `No results for "${search}"` : 'No people registered yet'}
          </div>
          <div className="empty-sub">
            {search
              ? 'Try a different search term'
              : 'Head to the Register tab to add someone'}
          </div>
        </div>
      ) : (
        <div className="faces-grid">
          {filtered.map(person => (
            <PersonCard
              key={person.name}
              person={person}
              onDelete={setConfirmDelete}
              deleting={deleting === person.name}
            />
          ))}
        </div>
      )}

      {/* Custom confirm modal overlay */}
      {confirmDelete && (
        <div className="confirm-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(3,3,8,0.75)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', padding: 24, textAlign: 'center', border: '1px solid var(--border)', background: 'var(--bg-2)', boxShadow: 'var(--shadow)' }}>
            <span style={{ fontSize: 44, display: 'block', marginBottom: 12 }}>🗑️</span>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#fff' }}>Delete Registration?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: '1.5' }}>
              Are you sure you want to delete <strong>{confirmDelete}</strong>? This will permanently delete their metadata and all photo descriptors.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: 10, cursor: 'pointer' }}
                onClick={() => setConfirmDelete(null)}
                disabled={deleting !== null}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, padding: 10, cursor: 'pointer' }}
                onClick={() => deletePerson(confirmDelete)}
                disabled={deleting !== null}
              >
                {deleting ? <span className="spinner" /> : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}

function PersonCard({ person, onDelete, deleting }) {
  const [photoError, setPhotoError] = useState(false)

  return (
    <div className="face-card">
      {/* Photo */}
      <div className="face-card-photo">
        {!photoError ? (
          <img
            src={`/api/known-faces/${encodeURIComponent(person.name)}/photo`}
            alt={person.name}
            onError={() => setPhotoError(true)}
          />
        ) : (
          <span className="ph-icon">👤</span>
        )}
      </div>

      {/* Info */}
      <div className="face-card-body">
        <div className="face-card-name" title={person.name}>{person.name}</div>

        {/* Professional Details */}
        {(person.role || person.department || person.employee_id) && (
          <div className="face-card-details" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            {person.role && (
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}>
                <span>💼</span>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={person.role}>{person.role}</span>
              </div>
            )}
            {person.department && (
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}>
                <span>🏢</span>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={person.department}>{person.department}</span>
              </div>
            )}
            {person.employee_id && (
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}>
                <span>🆔</span>
                <span style={{ fontFamily: 'monospace' }}>{person.employee_id}</span>
              </div>
            )}
          </div>
        )}

        <div className="face-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>📸 {person.photo_count} photo{person.photo_count !== 1 ? 's' : ''}</span>
          {person.company && (person.company === 'Geniovate' || person.company === 'Nexoan AI' || person.company === 'NEXOAN AI') && (
            <span style={{ fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>NEXOAN AI</span>
          )}
          {person.company && person.company !== 'Geniovate' && person.company !== 'Nexoan AI' && person.company !== 'NEXOAN AI' && (
            <span style={{ fontSize: 10, background: 'var(--glass)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4, fontWeight: 500, maxWidth: 80, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={person.company}>{person.company.toUpperCase()}</span>
          )}
        </div>

        <button
          id={`btn-delete-${person.name.replace(/\s+/g, '-')}`}
          className="btn btn-danger"
          style={{ width: '100%', fontSize: 13, padding: '8px' }}
          onClick={() => onDelete(person.name)}
          disabled={deleting}
        >
          {deleting ? <span className="spinner" /> : '🗑 Delete'}
        </button>
      </div>
    </div>
  )
}
