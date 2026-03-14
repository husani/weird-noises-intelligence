import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Modal from '@shared/components/Modal'
import SortHeader from '@shared/components/SortHeader'
import { TableControls } from '@shared/components'
import {
  getDiscoveryCandidates, reviewDiscovery, triggerDiscovery, getDiscoverySchedule,
  getScanHistory, getScanDetail, getFocusAreas,
} from '@producers/api'


/* ─── Inline editable field ─── */
function InlineField({ label, value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { setDraft(value || '') }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  if (editing) {
    return (
      <div className="disc-field disc-field--editing">
        <span className="disc-field-label">{label}</span>
        <div className="disc-field-input-wrap">
          <input
            ref={inputRef}
            className="input disc-field-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { onChange(draft); setEditing(false) }
              if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) }
            }}
            onBlur={() => { onChange(draft); setEditing(false) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="disc-field" onClick={() => setEditing(true)}>
      <span className="disc-field-label">{label}</span>
      <span className={`disc-field-value ${!value ? 'disc-field-value--empty' : ''}`}>
        {value || `—`}
      </span>
    </div>
  )
}


/* ─── Candidate review card ─── */
function CandidateCard({ candidate, onConfirm, onDismiss, reviewing, index }) {
  const [expanded, setExpanded] = useState(false)
  const [edits, setEdits] = useState({})
  const detailRef = useRef(null)

  const raw = candidate.raw_data || {}
  const field = (key, fallback) => edits[key] !== undefined ? edits[key] : (raw[key] ?? fallback)
  const setField = (key, val) => setEdits(prev => ({ ...prev, [key]: val }))

  const allEmails = raw.email_candidates || []
  const [selectedEmails, setSelectedEmails] = useState(() => allEmails.map(() => true))
  const toggleEmail = (i) => setSelectedEmails(prev => prev.map((v, idx) => idx === i ? !v : v))

  const isDuplicate = candidate.dedup_status === 'definite_duplicate'
  const isPotentialDuplicate = candidate.dedup_status === 'potential_duplicate'

  const handleConfirm = () => {
    const editedData = { ...edits }
    editedData.first_name = edits.first_name ?? candidate.first_name
    editedData.last_name = edits.last_name ?? candidate.last_name
    const keptEmails = allEmails.filter((_, i) => selectedEmails[i])
    if (keptEmails.length > 0) editedData.email_candidates = keptEmails
    for (const [k, v] of Object.entries(raw)) {
      if (editedData[k] === undefined && k !== 'email_candidates' && k !== 'recent_productions') {
        editedData[k] = v
      }
    }
    onConfirm(candidate.id, editedData)
  }

  const initials = (candidate.first_name?.[0] || '') + (candidate.last_name?.[0] || '')
  const location = [raw.city, raw.state_region].filter(Boolean).join(', ')

  return (
    <article
      className={`disc-card${expanded ? ' disc-card--open' : ''}${isDuplicate ? ' disc-card--dup' : ''}`}
      style={{ '--anim-delay': `${index * 60}ms` }}
    >
      {/* Collapsed header */}
      <div className="disc-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="disc-card-identity">
          <div className="disc-avatar">{initials}</div>
          <div className="disc-card-meta">
            <div className="disc-card-name-row">
              <span className="disc-card-name">{candidate.first_name} {candidate.last_name}</span>
              {raw.organization && <span className="cell-muted">{raw.organization}</span>}
              {location && <span className="cell-muted">{location}</span>}
              {isPotentialDuplicate && <span className="badge badge-rose">possible duplicate</span>}
              {isDuplicate && <span className="badge badge-rose">duplicate</span>}
            </div>
            {!expanded && candidate.reasoning && (
              <p className="disc-card-preview">{candidate.reasoning}</p>
            )}
          </div>
        </div>
        <span className={`disc-chevron${expanded ? ' disc-chevron--open' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </div>

      {/* Expanded review panel */}
      {expanded && (
        <div className="disc-review" ref={detailRef}>

          {/* Dedup alert */}
          {(isDuplicate || isPotentialDuplicate) && candidate.dedup_matches?.length > 0 && (
            <div className={`alert ${isDuplicate ? 'alert-error' : 'alert-warning'}`}>
              <div className="alert-content">
                <div className="alert-title">{isDuplicate ? 'Hard identifier match' : 'Possible duplicate — review carefully'}</div>
                {candidate.dedup_matches.map((m, i) => (
                  <div key={i} className="disc-dedup-match">
                    {m.producer_id ? (
                      <>Matches <Link to={`/producers/detail/${m.producer_id}`} className="link">{m.first_name} {m.last_name}</Link> — {m.signals.join(', ')}</>
                    ) : (
                      <>Previously dismissed: {m.candidate_name}{m.dismissed_reason && <span className="type-meta"> ({m.dismissed_reason})</span>}</>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div className="disc-reasoning">
            <div className="disc-section-label">Why this producer</div>
            <p className="disc-reasoning-text">{candidate.reasoning}</p>
            {candidate.source && (
              <div className="disc-source">
                Source: {/^https?:\/\//.test(candidate.source) ? (
                  <a href={candidate.source} target="_blank" rel="noopener noreferrer" className="link">
                    {(() => { try { return new URL(candidate.source).hostname } catch { return candidate.source } })()}
                  </a>
                ) : candidate.source}
              </div>
            )}
          </div>

          {/* Two-column detail grid */}
          <div className="disc-grid">
            {/* Left: Identity + Location + Links */}
            <div className="disc-col">
              <section className="disc-section">
                <div className="disc-section-label">Identity</div>
                <InlineField label="First name" value={edits.first_name ?? candidate.first_name} onChange={v => setField('first_name', v)} />
                <InlineField label="Last name" value={edits.last_name ?? candidate.last_name} onChange={v => setField('last_name', v)} />
                <InlineField label="Organization" value={field('organization', '')} onChange={v => setField('organization', v)} />
                <InlineField label="Role" value={field('organization_role', '')} onChange={v => setField('organization_role', v)} />
              </section>

              <section className="disc-section">
                <div className="disc-section-label">Location</div>
                <InlineField label="City" value={field('city', '')} onChange={v => setField('city', v)} />
                <InlineField label="State / Region" value={field('state_region', '')} onChange={v => setField('state_region', v)} />
                <InlineField label="Country" value={field('country', '')} onChange={v => setField('country', v)} />
              </section>

              <section className="disc-section">
                <div className="disc-section-label">Links</div>
                <InlineField label="Website" value={field('website', '')} onChange={v => setField('website', v)} />
                {(field('social_links', []) || []).map((link, i) => (
                  <div key={i} className="disc-inline-field">
                    <span className="disc-inline-label">{link.platform}</span>
                    <span className="disc-inline-value">{link.url}</span>
                  </div>
                ))}
              </section>
            </div>

            {/* Right: Emails + Productions */}
            <div className="disc-col">
              {allEmails.length > 0 && (
                <section className="disc-section">
                  <div className="disc-section-label">
                    Email candidates
                    <span className="disc-section-count">{allEmails.filter((_, i) => selectedEmails[i]).length} of {allEmails.length}</span>
                  </div>
                  <div className="disc-emails">
                    {allEmails.map((email, i) => (
                      <label key={i} className={`disc-email-row${!selectedEmails[i] ? ' disc-email-row--off' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedEmails[i] || false}
                          onChange={() => toggleEmail(i)}
                          className="disc-checkbox"
                        />
                        <span className="disc-email-addr">{email.email}</span>
                        <span className={`email-candidate-confidence confidence-${email.confidence || 'unknown'}`}>
                          {email.confidence || '?'}
                        </span>
                        {email.source && <span className="disc-email-source">{email.source}</span>}
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {raw.recent_productions?.length > 0 && (
                <section className="disc-section">
                  <div className="disc-section-label">
                    Recent productions
                    <span className="disc-section-count">{raw.recent_productions.length}</span>
                  </div>
                  <div className="disc-productions">
                    {raw.recent_productions.map((prod, i) => (
                      <div key={i} className="disc-prod-row">
                        <span className="disc-prod-title">{prod.title}</span>
                        <span className="disc-prod-meta">
                          {[prod.year, prod.venue, prod.role, prod.scale].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="disc-actions">
            <button
              className="btn btn-primary"
              disabled={reviewing === candidate.id}
              onClick={handleConfirm}
            >
              {reviewing === candidate.id ? 'Confirming…' : 'Confirm & Add'}
            </button>
            <button
              className="btn btn-ghost"
              disabled={reviewing === candidate.id}
              onClick={() => onDismiss(candidate)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </article>
  )
}


/* ─── Scan detail modal ─── */
function ScanDetailModal({ scanId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getScanDetail(scanId).then(setDetail).catch(() => {}).finally(() => setLoading(false))
  }, [scanId])

  if (loading) {
    return (
      <Modal title="Scan Detail" onClose={onClose}>
        <div className="disc-center"><div className="loading-spinner" /></div>
      </Modal>
    )
  }

  if (!detail) {
    return (
      <Modal title="Scan Detail" onClose={onClose}>
        <p className="prose cell-muted">Could not load scan details.</p>
      </Modal>
    )
  }

  const date = detail.started_at ? new Date(detail.started_at) : null
  const completedDate = detail.completed_at ? new Date(detail.completed_at) : null
  const durationMs = date && completedDate ? completedDate - date : null
  const durationStr = durationMs != null
    ? durationMs < 60000 ? `${Math.round(durationMs / 1000)}s` : `${Math.round(durationMs / 60000)}m`
    : null

  const STATUS_COLORS = { complete: 'var(--accent-sage)', running: 'var(--accent-warm)', failed: 'var(--accent-rose)' }

  return (
    <Modal title="Scan Detail" onClose={onClose} wide>
      <div className="disc-modal-detail">
        {/* Meta grid */}
        <div className="disc-modal-meta">
          <div className="disc-modal-meta-item">
            <span className="disc-modal-meta-label">Status</span>
            <span className="scan-status-label" style={{ '--status-color': STATUS_COLORS[detail.status] || 'var(--text-secondary)' }}>{detail.status}</span>
          </div>
          <div className="disc-modal-meta-item">
            <span className="disc-modal-meta-label">Date</span>
            <span>{date ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
          </div>
          <div className="disc-modal-meta-item">
            <span className="disc-modal-meta-label">Type</span>
            <span className="capitalize">{detail.focus_type || 'auto'}</span>
          </div>
          {durationStr && (
            <div className="disc-modal-meta-item">
              <span className="disc-modal-meta-label">Duration</span>
              <span>{durationStr}</span>
            </div>
          )}
          <div className="disc-modal-meta-item">
            <span className="disc-modal-meta-label">Found</span>
            <span>{detail.candidates_found || 0}</span>
          </div>
          <div className="disc-modal-meta-item">
            <span className="disc-modal-meta-label">After dedup</span>
            <span>{detail.candidates_after_dedup || 0}</span>
          </div>
        </div>

        {/* Focus area */}
        {detail.focus_area && (
          <div className="disc-modal-block">
            <div className="disc-section-label">Focus area</div>
            <p className="disc-modal-block-text">{detail.focus_area}</p>
          </div>
        )}

        {/* Error */}
        {detail.error_detail && (
          <div className="alert alert-error">
            <div className="alert-content">
              <div className="alert-title">Error</div>
              <div className="disc-modal-error">{detail.error_detail}</div>
            </div>
          </div>
        )}

        {/* Candidates */}
        {detail.candidates && detail.candidates.length > 0 ? (
          <div className="disc-modal-block">
            <div className="disc-section-label">
              Candidates
              <span className="disc-section-count">{detail.candidates.length}</span>
            </div>
            <table className="data-table disc-modal-candidates-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Dedup</th>
                  <th>Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {detail.candidates.map(c => {
                  const statusColor = c.status === 'confirmed' ? 'var(--accent-sage)' : c.status === 'dismissed' ? 'var(--accent-rose)' : 'var(--accent-warm)'
                  return (
                    <tr key={c.id}>
                      <td className="cell-strong">{c.first_name} {c.last_name}</td>
                      <td><span className="scan-status-label" style={{ '--status-color': statusColor }}>{c.status}</span></td>
                      <td>
                        {c.dedup_status && c.dedup_status !== 'clean'
                          ? <span className="scan-dedup-label">{c.dedup_status === 'definite_duplicate' ? 'duplicate' : 'possible'}</span>
                          : <span className="cell-muted">clean</span>}
                      </td>
                      <td className="disc-modal-reason-cell">{c.reasoning}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : !detail.error_detail && (
          <p className="disc-modal-block-text cell-muted">No candidates were returned by this scan.</p>
        )}
      </div>
    </Modal>
  )
}


/* ─── Scan history table (paginated) ─── */
function ScanHistoryTab({ scans, loading, total, page, limit, onPageChange, onLimitChange, onScanClick }) {
  const [sort, setSort] = useState('started_at')
  const [sortDir, setSortDir] = useState('desc')

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  if (scans.length === 0 && page === 1) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No scans recorded</div>
        <div className="empty-state-desc">Discovery scans will appear here after they run.</div>
      </div>
    )
  }

  const STATUS_COLORS = { complete: 'var(--accent-sage)', running: 'var(--accent-warm)', failed: 'var(--accent-rose)' }

  function handleSort(field, dir) { setSort(field); setSortDir(dir) }

  // Client-side sort on current page
  const sorted = [...scans].sort((a, b) => {
    let va, vb
    if (sort === 'started_at') {
      va = a.started_at ? new Date(a.started_at).getTime() : 0
      vb = b.started_at ? new Date(b.started_at).getTime() : 0
    } else if (['candidates_found', 'candidates_after_dedup', 'confirmed', 'dismissed', 'pending'].includes(sort)) {
      va = a[sort] || 0; vb = b[sort] || 0
    } else {
      va = a[sort] ?? ''; vb = b[sort] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            <th className="th-checkbox"></th>
            <SortHeader label="Date" field="started_at" sort={sort} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Focus" field="focus_area" sort={sort} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Status" field="status" sort={sort} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="Found" field="candidates_found" sort={sort} sortDir={sortDir} onSort={handleSort} className="cell-number" />
            <SortHeader label="New" field="candidates_after_dedup" sort={sort} sortDir={sortDir} onSort={handleSort} className="cell-number" />
            <SortHeader label="Confirmed" field="confirmed" sort={sort} sortDir={sortDir} onSort={handleSort} className="cell-number" />
            <SortHeader label="Dismissed" field="dismissed" sort={sort} sortDir={sortDir} onSort={handleSort} className="cell-number" />
            <SortHeader label="Pending" field="pending" sort={sort} sortDir={sortDir} onSort={handleSort} className="cell-number" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((scan, i) => {
            const date = scan.started_at ? new Date(scan.started_at) : null
            return (
              <tr
                key={scan.id}
                className="disc-scan-row-anim disc-scan-clickable"
                style={{ '--anim-delay': `${i * 25}ms` }}
                onClick={() => onScanClick(scan.id)}
              >
                <td>
                  <span className={`disc-status-dot disc-status-dot--${scan.status}`} />
                </td>
                <td className="cell-strong disc-scan-date-cell">
                  {date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  <span className="disc-scan-time">
                    {date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </td>
                <td>
                  <span className="disc-scan-focus">{scan.focus_area || <span className="cell-muted">General scan</span>}</span>
                </td>
                <td>
                  <span className="scan-status-label" style={{ '--status-color': STATUS_COLORS[scan.status] || 'var(--text-secondary)' }}>{scan.status}</span>
                </td>
                <td className="cell-number">{scan.candidates_found || 0}</td>
                <td className="cell-number">{scan.candidates_after_dedup || 0}</td>
                <td className="cell-number">
                  {scan.confirmed > 0 ? <span className="cell-positive">{scan.confirmed}</span> : <span className="cell-muted">0</span>}
                </td>
                <td className="cell-number">
                  {scan.dismissed > 0 ? <span className="cell-negative">{scan.dismissed}</span> : <span className="cell-muted">0</span>}
                </td>
                <td className="cell-number">
                  {scan.pending > 0 ? <span className="disc-scan-pending">{scan.pending}</span> : <span className="cell-muted">0</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <TableControls page={page} onPageChange={onPageChange} limit={limit} onLimitChange={onLimitChange} total={total} />
    </>
  )
}


/* ─── Relative time helper ─── */
function formatRelative(dateStr) {
  if (!dateStr) return null
  const diffMs = new Date(dateStr) - Date.now()
  if (diffMs < 0) return 'any moment'
  const h = Math.floor(diffMs / 3.6e6)
  const d = Math.floor(h / 24)
  if (d > 0) return `in ${d}d`
  if (h > 0) return `in ${h}h`
  const m = Math.floor(diffMs / 6e4)
  return `in ${m}m`
}


/* ─── Main component ─── */
export default function DiscoveryQueue() {
  const [tab, setTab] = useState('queue')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState(null)
  const [triggering, setTriggering] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [nextRun, setNextRun] = useState(null)
  const [dismissModal, setDismissModal] = useState(null)
  const [dismissReason, setDismissReason] = useState('')
  const [confirmedProducer, setConfirmedProducer] = useState(null)
  const [scanHistory, setScanHistory] = useState([])
  const [scanTotal, setScanTotal] = useState(0)
  const [scanPage, setScanPage] = useState(1)
  const [scanLimit, setScanLimit] = useState(25)
  const [scansLoading, setScansLoading] = useState(false)
  const [scanDetailId, setScanDetailId] = useState(null)
  const [focusAreas, setFocusAreas] = useState([])
  const [scanFocus, setScanFocus] = useState('')
  const navigate = useNavigate()
  const scanPollRef = useRef(null)

  // Check if any scan is currently running (from recent scans)
  const checkForRunningScans = useCallback(() => {
    getScanHistory(5, 0).then(data => {
      const scans = data.scans || []
      const running = scans.some(s => s.status === 'running')
      if (running && !scanning) {
        setScanning(true)
        const poll = setInterval(async () => {
          try {
            const fresh = await getScanHistory(5, 0)
            const freshScans = fresh.scans || []
            const stillRunning = freshScans.some(s => s.status === 'running')
            if (!stillRunning) {
              clearInterval(poll)
              setScanning(false)
              getDiscoveryCandidates('pending').then(setCandidates).catch(() => {})
            }
          } catch { /* polling */ }
        }, 4000)
      }
    }).catch(() => {})
  }, [scanning])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getDiscoveryCandidates('pending'),
      getDiscoverySchedule(),
    ]).then(([c, schedule]) => {
      setCandidates(c)
      if (schedule.next_run) setNextRun(schedule.next_run)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    checkForRunningScans()
    getFocusAreas().then(setFocusAreas).catch(() => {})
  }, [load, checkForRunningScans])

  const loadHistory = useCallback(() => {
    setScansLoading(true)
    getScanHistory(scanLimit, (scanPage - 1) * scanLimit)
      .then(data => {
        // Backend returns { scans, total } or plain array
        if (Array.isArray(data)) {
          setScanHistory(data)
          setScanTotal(data.length)
        } else {
          setScanHistory(data.scans || [])
          setScanTotal(data.total || 0)
        }
      })
      .catch(() => {})
      .finally(() => setScansLoading(false))
  }, [scanPage, scanLimit])

  useEffect(() => {
    if (tab === 'scans') loadHistory()
  }, [tab, loadHistory])

  async function handleConfirm(id, editedData) {
    setReviewingId(id)
    try {
      const result = await reviewDiscovery(id, 'confirmed', null, editedData)
      if (result.producer_id) {
        const c = candidates.find(c => c.id === id)
        setConfirmedProducer({
          id: result.producer_id,
          name: c ? `${c.first_name} ${c.last_name}` : 'Producer',
        })
        setTimeout(() => setConfirmedProducer(null), 8000)
      }
      load()
    } catch (err) {
      console.error('Confirm failed:', err)
    } finally {
      setReviewingId(null)
    }
  }

  async function handleDismiss() {
    if (!dismissModal) return
    setReviewingId(dismissModal.id)
    try {
      await reviewDiscovery(dismissModal.id, 'dismissed', dismissReason || null)
      setDismissModal(null)
      setDismissReason('')
      load()
    } catch (err) {
      console.error('Dismiss failed:', err)
    } finally {
      setReviewingId(null)
    }
  }

  async function handleTrigger() {
    setTriggering(true)
    setScanning(true)
    try {
      await triggerDiscovery(scanFocus || null)
      setScanFocus('')
      let attempts = 0
      scanPollRef.current = setInterval(async () => {
        attempts++
        try {
          const data = await getScanHistory(3, 0)
          const scans = data.scans || []
          const stillRunning = scans.some(s => s.status === 'running')
          if (!stillRunning || attempts >= 30) {
            clearInterval(scanPollRef.current)
            scanPollRef.current = null
            setScanning(false)
            // Refresh everything
            const c = await getDiscoveryCandidates('pending')
            setCandidates(c)
            if (tab === 'scans') loadHistory()
          }
        } catch { /* polling */ }
      }, 4000)
    } catch (err) {
      console.error('Trigger failed:', err)
      setScanning(false)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <div className="disc-header-row">
          <div>
            <h1 className="page-title">Discovery</h1>
            <p className="page-subtitle">
              AI-directed scans find producers WN should know about.
              {nextRun && <span className="disc-next-run"> Next scan {formatRelative(nextRun)}.</span>}
            </p>
          </div>
          <div className="disc-header-actions">
            <div className="disc-focus-wrap">
              <input
                className="input disc-focus-input"
                placeholder="Focus area (optional)…"
                value={scanFocus}
                onChange={e => setScanFocus(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTrigger() }}
              />
              {focusAreas.length > 0 && (
                <div className="select-wrapper disc-focus-select">
                  <select
                    className="select"
                    value=""
                    onChange={e => { if (e.target.value) setScanFocus(e.target.value) }}
                  >
                    <option value="">Saved…</option>
                    {focusAreas.filter(a => a.active).map(a => (
                      <option key={a.id} value={`${a.name}: ${a.description || a.name}`}>{a.name}</option>
                    ))}
                  </select>
                  <span className="select-arrow">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5l3 3 3-3" /></svg>
                  </span>
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleTrigger} disabled={triggering || scanning}>
              {triggering ? (
                <span className="disc-btn-inner"><div className="loading-spinner disc-btn-spinner" /> Scanning…</span>
              ) : 'Run Scan'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Confirmed banner ── */}
      {confirmedProducer && (
        <div className="alert alert-info disc-banner">
          <div className="alert-content disc-banner-content">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
            <span><strong>{confirmedProducer.name}</strong> confirmed. Research running in background.</span>
          </div>
          <button className="btn btn-secondary disc-banner-btn" onClick={() => navigate(`/producers/detail/${confirmedProducer.id}`)}>
            View Profile
          </button>
        </div>
      )}

      {/* ── Scanning banner ── */}
      {scanning && !triggering && (
        <div className="alert alert-info disc-banner">
          <div className="alert-content disc-banner-content">
            <div className="loading-spinner disc-banner-spinner" />
            <div>
              <strong>Discovery scan in progress</strong>
              <div className="disc-banner-detail">
                Searching industry sources. This may take up to a minute.
                {scanFocus && <> Focus: <em>{scanFocus}</em></>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tab-bar">
        <button className={`tab${tab === 'queue' ? ' active' : ''}`} onClick={() => setTab('queue')}>
          Review Queue
          {candidates.length > 0 && <span className="tab-count">{candidates.length}</span>}
        </button>
        <button className={`tab${tab === 'scans' ? ' active' : ''}`} onClick={() => setTab('scans')}>
          Scan History
          {scanHistory.length > 0 && tab === 'scans' && <span className="tab-count">{scanHistory.length}</span>}
        </button>
      </div>

      {/* ── Tab content ── */}
      <div className="disc-tab-content">
        {tab === 'queue' && (
          <>
            {loading ? (
              <div className="disc-center"><div className="loading-spinner" /></div>
            ) : candidates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No pending discoveries</div>
                <div className="empty-state-desc">
                  {nextRun
                    ? `Next automatic scan ${formatRelative(nextRun)}, or run one now.`
                    : 'Run a scan to discover new producers.'}
                </div>
              </div>
            ) : (
              <div className="disc-queue">
                {candidates.map((c, i) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    onConfirm={handleConfirm}
                    onDismiss={setDismissModal}
                    reviewing={reviewingId}
                    index={i}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'scans' && (
          <ScanHistoryTab
            scans={scanHistory}
            loading={scansLoading}
            total={scanTotal}
            page={scanPage}
            limit={scanLimit}
            onPageChange={setScanPage}
            onLimitChange={v => { setScanLimit(v); setScanPage(1) }}
            onScanClick={setScanDetailId}
          />
        )}
      </div>

      {/* ── Scan detail modal ── */}
      {scanDetailId && (
        <ScanDetailModal scanId={scanDetailId} onClose={() => setScanDetailId(null)} />
      )}

      {/* ── Dismiss modal ── */}
      {dismissModal && (
        <Modal
          title="Dismiss Discovery"
          onClose={() => setDismissModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDismissModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDismiss}>Dismiss</button>
            </>
          }
        >
          <p className="prose mb-16">
            Dismiss <strong>{dismissModal.first_name} {dismissModal.last_name}</strong>?
            Dismissal patterns calibrate future scans.
          </p>
          <label className="input-label">Reason (optional — helps calibration)</label>
          <textarea
            className="textarea disc-dismiss-textarea"
            placeholder="e.g. Regional only, outside WN's focus"
            value={dismissReason}
            onChange={e => setDismissReason(e.target.value)}
            autoFocus
          />
        </Modal>
      )}
    </>
  )
}
