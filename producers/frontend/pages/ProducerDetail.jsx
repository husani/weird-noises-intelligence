import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@shared/auth/AuthGuard'
import Modal from '@shared/components/Modal'
import LocationAutocomplete from '@shared/components/LocationAutocomplete'
import PlatformIcon from '@shared/components/PlatformIcon'
import {
  getProducer, updateProducer, deleteProducer as apiDeleteProducer,
  getInteractions, addInteraction, editInteraction, deleteInteraction, transcribeAudio,
  getProductions, getOrganizations, getRelationship,
  getHistory, refreshProducer, addTag, removeTag,
  addAffiliation, updateAffiliation, removeAffiliation,
  resolveFollowUp, updateFollowUp, deleteFollowUp,
  listOrganizations,
} from '@producers/api'

const STATE_CONFIG = {
  no_contact: { label: 'No contact', variant: 'neutral' },
  new: { label: 'New', variant: 'blue' },
  active: { label: 'Active', variant: 'sage' },
  waiting: { label: 'Waiting', variant: 'warm' },
  overdue: { label: 'Overdue', variant: 'rose' },
  gone_cold: { label: 'Gone cold', variant: 'neutral' },
}

const FIELD_LABELS = {
  production_added: 'Production Added', organization_added: 'Organization Added',
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

function EditableField({ label, value, field, onSave, multiline = false }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')

  function handleSave() {
    onSave(field, editValue)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="editable-field-wrap">
        {label && <div className="type-meta">{label}</div>}
        <div
          className="editable-field"
          onClick={() => { setEditValue(value || ''); setEditing(true) }}
        >
          <span className="value-light">{value || <span className="cell-muted">&mdash;</span>}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="editable-field-wrap">
      {label && <div className="type-meta">{label}</div>}
      <div className="editable-field editing">
        {multiline ? (
          <textarea
            className="textarea textarea-inline"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            autoFocus
          />
        ) : (
          <input
            className="input input-inline"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus
          />
        )}
        <div className="edit-actions">
          <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

function ChipInput({ tags = [], onAdd, onRemove }) {
  const [inputVal, setInputVal] = useState('')

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = inputVal.trim().replace(/,$/, '')
      if (tag) { onAdd(tag); setInputVal('') }
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    }
  }

  return (
    <div className="chip-input-wrapper input-full" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
      {tags.map(t => (
        <span key={t} className="chip">
          {t}
          <button type="button" className="chip-remove" onClick={() => onRemove(t)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        className="chip-input"
        placeholder={tags.length === 0 ? 'Add tag...' : ''}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function FreshnessIndicator({ history, fields }) {
  const change = history.find(h => fields.some(f =>
    h.field_name === f || h.field_name.startsWith(f)
  ))
  if (!change) return null

  const daysAgo = Math.floor((Date.now() - new Date(change.changed_at).getTime()) / (1000 * 60 * 60 * 24))
  const label = change.changed_by.startsWith('AI') ? change.changed_by : change.changed_by.split('@')[0]
  const freshness = daysAgo <= 7 ? 'fresh' : daysAgo <= 30 ? 'recent' : 'stale'

  return (
    <span className={`freshness freshness--${freshness}`}>
      {daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`} by {label}
    </span>
  )
}

function SectionHeader({ title, collapsed, onToggle, children }) {
  return (
    <div className="section-card-header section-card-header--clickable" onClick={onToggle}>
      <div className="section-header-toggle">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={`section-chevron${collapsed ? ' section-chevron--collapsed' : ''}`}>
          <path d="M3 4.5l3 3 3-3" />
        </svg>
        <div className="section-card-title">{title}</div>
      </div>
      <div>
        {children}
      </div>
    </div>
  )
}

export default function ProducerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuth()
  const [producer, setProducer] = useState(null)
  const [interactions, setInteractions] = useState([])
  const [productions, setProductions] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [relationship, setRelationship] = useState(null)
  const [history, setHistory] = useState([])
  const [newInteraction, setNewInteraction] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Organization affiliation state
  const [addOrgModal, setAddOrgModal] = useState(false)
  const [editOrgModal, setEditOrgModal] = useState(null)
  const [orgQuery, setOrgQuery] = useState('')
  const [orgSuggestions, setOrgSuggestions] = useState([])
  const [orgForm, setOrgForm] = useState({ organization_name: '', role_title: '', start_date: '', end_date: '' })
  const orgDebounceRef = React.useRef(null)

  // Interaction edit state
  const [editingInteraction, setEditingInteraction] = useState(null)
  const [editInteractionContent, setEditInteractionContent] = useState('')

  // Follow-up edit state
  const [editingFollowUp, setEditingFollowUp] = useState(null)
  const [followUpForm, setFollowUpForm] = useState({ implied_action: '', timeframe: '' })

  // AI processing feedback
  const [interactionProcessing, setInteractionProcessing] = useState(false)
  const [researchPolling, setResearchPolling] = useState(false)
  const researchPollRef = useRef(null)

  // Audio recording state
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = React.useRef(null)
  const audioChunksRef = React.useRef([])

  // Contact edit state
  const [editingContact, setEditingContact] = useState(false)

  // Sections — most admin sections collapsed by default
  const [collapsed, setCollapsed] = useState({
    productions: true,
    metadata: true, history: true,
  })
  function toggle(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.allSettled([
      getProducer(id), getInteractions(id), getProductions(id),
      getOrganizations(id), getRelationship(id), getHistory(id),
    ]).then(results => {
      const val = (i, fallback) => results[i].status === 'fulfilled' ? results[i].value : fallback
      setProducer(val(0, null))
      setInteractions(val(1, []))
      setProductions(val(2, []))
      setOrganizations(val(3, []))
      setRelationship(val(4, null))
      setHistory(val(5, []))
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // Poll for research completion when status is in_progress
  function startResearchPolling() {
    setResearchPolling(true)
    if (researchPollRef.current) clearInterval(researchPollRef.current)
    researchPollRef.current = setInterval(async () => {
      try {
        const p = await getProducer(id)
        if (p.research_status !== 'in_progress') {
          clearInterval(researchPollRef.current)
          researchPollRef.current = null
          setResearchPolling(false)
          setRefreshing(false)
          loadAll()
        }
      } catch { /* ignore polling errors */ }
    }, 4000)
  }

  // Auto-start polling if we land on a producer mid-research
  useEffect(() => {
    if (producer?.research_status === 'in_progress' && !researchPollRef.current) {
      startResearchPolling()
    }
    return () => { if (researchPollRef.current) clearInterval(researchPollRef.current) }
  }, [producer?.research_status])

  async function handleAddInteraction(e) {
    e.preventDefault()
    if (!newInteraction.trim()) return
    setInteractionProcessing(true)
    await addInteraction(id, newInteraction)
    setNewInteraction('')
    loadAll()
    // Poll briefly for AI processing (follow-ups, summary)
    setTimeout(async () => {
      await loadAll()
      setInteractionProcessing(false)
    }, 5000)
  }

  async function handleAddTag(tagName) { await addTag(id, tagName); loadAll() }
  async function handleRemoveTag(tagName) { await removeTag(id, tagName); loadAll() }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshProducer(id)
      startResearchPolling()
    } catch {
      setRefreshing(false)
    }
  }

  async function handleFieldSave(field, value) {
    await updateProducer(id, { [field]: value })
    loadAll()
  }

  // Audio recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const result = await transcribeAudio(id, blob)
          if (result.text) {
            setNewInteraction(prev => prev ? `${prev}\n\n${result.text}` : result.text)
          } else if (result.error) {
            console.error('Transcription error:', result.error)
          }
        } catch (err) {
          console.error('Transcription failed:', err)
        }
        setTranscribing(false)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      console.error('Microphone access denied:', err)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  // Delete producer
  async function handleDeleteProducer() {
    await apiDeleteProducer(id)
    navigate('/producers/list')
  }

  // Org affiliation handlers
  React.useEffect(() => {
    if (orgDebounceRef.current) clearTimeout(orgDebounceRef.current)
    if (orgQuery.length < 2) { setOrgSuggestions([]); return }
    orgDebounceRef.current = setTimeout(() => {
      listOrganizations({ search: orgQuery, limit: 8 })
        .then(data => setOrgSuggestions(data.organizations || []))
        .catch(() => {})
    }, 250)
    return () => { if (orgDebounceRef.current) clearTimeout(orgDebounceRef.current) }
  }, [orgQuery])

  async function handleAddAffiliation(e) {
    e.preventDefault()
    if (!orgForm.organization_name.trim()) return
    await addAffiliation(id, orgForm)
    setAddOrgModal(false)
    setOrgForm({ organization_name: '', role_title: '', start_date: '', end_date: '' })
    setOrgQuery('')
    loadAll()
  }

  async function handleUpdateAffiliation(e) {
    e.preventDefault()
    if (!editOrgModal) return
    await updateAffiliation(id, editOrgModal.id, {
      role_title: orgForm.role_title,
      start_date: orgForm.start_date || null,
      end_date: orgForm.end_date || null,
    })
    setEditOrgModal(null)
    loadAll()
  }

  async function handleRemoveAffiliation(affId) {
    await removeAffiliation(id, affId)
    loadAll()
  }

  // Interaction edit/delete handlers
  async function handleEditInteraction(intId) {
    if (!editInteractionContent.trim()) return
    await editInteraction(id, intId, editInteractionContent)
    setEditingInteraction(null)
    setEditInteractionContent('')
    loadAll()
  }

  async function handleDeleteInteraction(intId) {
    await deleteInteraction(id, intId)
    loadAll()
  }

  // Follow-up handlers
  async function handleResolveFollowUp(signalId) {
    await resolveFollowUp(id, signalId)
    loadAll()
  }

  async function handleUpdateFollowUp(e) {
    e.preventDefault()
    if (!editingFollowUp) return
    await updateFollowUp(id, editingFollowUp.id, followUpForm)
    setEditingFollowUp(null)
    loadAll()
  }

  async function handleDeleteFollowUp(signalId) {
    await deleteFollowUp(id, signalId)
    loadAll()
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  if (!producer || producer.error) {
    return <div className="empty-state"><div className="empty-state-title">Producer not found</div></div>
  }

  const state = STATE_CONFIG[producer.relationship_state] || STATE_CONFIG.no_contact
  const currentOrg = organizations.find(o => !o.end_date)
  const pendingFollowUps = relationship?.pending_follow_ups?.filter(f => !f.resolved) || []
  const locationStr = [producer.city, producer.state_region, producer.country].filter(Boolean).join(', ')

  // SVG icon helpers (inline, small)
  const IconMail = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
  const IconPhone = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
  const IconGlobe = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
  const IconPin = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
  const IconLinkedIn = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z"/></svg>
  const IconInstagram = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>
  const IconX = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-6.8-8.5L20 4h-2l-5.2 6.3L8 4H4z"/></svg>
  const IconEdit = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  const IconTrash = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
  const IconCheck = <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>

  return (
    <>
      {/* ===== BREADCRUMBS ===== */}
      <div className="breadcrumbs">
        <span className="breadcrumb" onClick={() => navigate('/producers/list')}>Producers</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{producer.first_name} {producer.last_name}</span>
      </div>

      {/* ===== RESEARCH STATUS BANNER ===== */}
      {(producer.research_status === 'in_progress' || researchPolling || refreshing) && (
        <div className="alert alert-info alert-compact">
          <div className="loading-spinner alert-spinner" />
          <div className="alert-content">
            <div className="alert-title">
              {producer.research_status_detail || (refreshing ? 'Dossier refresh in progress' : 'AI research in progress')}
            </div>
            <div className="alert-subtitle">
              This page will update automatically when complete.
            </div>
          </div>
        </div>
      )}

      {producer.research_status === 'failed' && !researchPolling && !refreshing && (
        <div className="alert alert-error alert-compact">
          <div className="alert-content">
            <div className="alert-title">Research failed</div>
            <div className="alert-subtitle--detail">
              {producer.research_status_detail || 'AI research could not complete. Try refreshing the dossier again.'}
            </div>
          </div>
        </div>
      )}

      {interactionProcessing && (
        <div className="alert alert-info alert-compact">
          <div className="loading-spinner alert-spinner" />
          <div className="alert-content">
            <div className="alert-title">Processing interaction</div>
            <div className="alert-subtitle">
              Extracting follow-ups and updating relationship summary.
            </div>
          </div>
        </div>
      )}

      {/* ===== HERO HEADER — borderless, dominant ===== */}
      <div className="detail-hero">
        <div className="hero-identity">
          <div className="person-avatar person-avatar-lg">
            {producer.photo_url
              ? <img className="person-avatar-photo person-avatar-lg" src={producer.photo_url} alt="" />
              : `${(producer.first_name || '')[0] || ''}${(producer.last_name || '')[0] || ''}`.toUpperCase()
            }
          </div>
          <div>
            <h1 className="type-display-1 mb-4">{producer.first_name} {producer.last_name}</h1>
            {currentOrg && (
              <div className="hero-subtitle">
                {currentOrg.role_title && `${currentOrg.role_title}, `}{currentOrg.name}
              </div>
            )}
            <div className="hero-meta-row">
              <span className={`status status-${state.variant}`}>
                <span className="status-dot" />
                {state.label}
              </span>
              {pendingFollowUps.length > 0 && (
                <span className="hero-followup-count">
                  {pendingFollowUps.length} follow-up{pendingFollowUps.length > 1 ? 's' : ''}
                </span>
              )}
              {producer.research_status === 'pending' && (
                <span className="status status-blue"><span className="status-dot pulse" />researching</span>
              )}
              {locationStr && (
                <span className="hero-location">
                  {IconPin} {locationStr}
                </span>
              )}
            </div>
            {/* Contact icon buttons — scannable at a glance */}
            <div className="hero-contact-icons">
              {producer.email && <a className="contact-icon-btn" href={`mailto:${producer.email}`} title={producer.email}>{IconMail}</a>}
              {producer.phone && <a className="contact-icon-btn" href={`tel:${producer.phone}`} title={producer.phone}>{IconPhone}</a>}
              {producer.website && <a className="contact-icon-btn" href={producer.website} target="_blank" rel="noopener noreferrer" title={producer.website}>{IconGlobe}</a>}
              {(producer.social_links || []).map((link, i) => (
                <a key={i} className="contact-icon-btn" href={link.url.startsWith('http') ? link.url : `https://${link.url}`} target="_blank" rel="noopener noreferrer" title={`${link.platform_name}: ${link.url}`}><PlatformIcon svg={link.icon_svg} /></a>
              ))}
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn btn-secondary btn-refresh"
            onClick={handleRefresh} disabled={refreshing || researchPolling || producer.research_status === 'in_progress'}>
            {(refreshing || researchPolling || producer.research_status === 'in_progress') ? 'Researching...' : 'Refresh Dossier'}
          </button>
          <button className="btn-icon btn-icon--rose"
            onClick={() => setDeleteConfirm(true)} title="Delete Producer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== TWO-COLUMN LAYOUT ===== */}
      <div className="detail-layout">

        {/* ========== MAIN COLUMN ========== */}
        <div className="detail-main">

          {/* --- Pending Follow-ups — alert-styled action items --- */}
          {pendingFollowUps.length > 0 && (
            <div>
              <div className="sidebar-label">Action Items</div>
              {pendingFollowUps.map(f => (
                <div key={f.id} className={`followup-item ${f.overdue ? 'followup-item--overdue' : 'followup-item--pending'}`}>
                  {f.overdue
                    ? <span className="badge badge-rose">Overdue</span>
                    : <span className="followup-pending-label">Pending</span>
                  }
                  {editingFollowUp?.id === f.id ? (
                    <form onSubmit={handleUpdateFollowUp} className="followup-edit-form">
                      <input className="input input-compact flex-1"
                        value={followUpForm.implied_action} onChange={e => setFollowUpForm(prev => ({ ...prev, implied_action: e.target.value }))} autoFocus />
                      <input className="input input-compact-sm"
                        value={followUpForm.timeframe} onChange={e => setFollowUpForm(prev => ({ ...prev, timeframe: e.target.value }))} placeholder="Timeframe" />
                      <button type="submit" className="btn btn-primary">Save</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditingFollowUp(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="followup-text value-light">{f.implied_action}</span>
                      {f.timeframe && <span className="type-meta">{f.timeframe}</span>}
                      <div className="followup-actions">
                        <button className="btn-icon" onClick={() => handleResolveFollowUp(f.id)} title="Resolve">{IconCheck}</button>
                        <button className="btn-icon" onClick={() => { setEditingFollowUp(f); setFollowUpForm({ implied_action: f.implied_action, timeframe: f.timeframe || '' }) }} title="Edit">{IconEdit}</button>
                        <button className="btn-icon" onClick={() => handleDeleteFollowUp(f.id)} title="Delete">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* --- Interaction Compose --- */}
          <form onSubmit={handleAddInteraction} className="compose-area">
            <textarea
              className="textarea compose-textarea"
              placeholder="Log an interaction..."
              value={newInteraction}
              onChange={e => setNewInteraction(e.target.value)}
            />
            <div className="compose-actions">
              <button type="submit" className="btn btn-primary" disabled={!newInteraction.trim()}>Log Interaction</button>
              {recording ? (
                <button type="button" className="btn btn-secondary btn-secondary--rose" onClick={stopRecording}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-rose)" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  Stop Recording
                </button>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={startRecording} disabled={transcribing} title="Voice memo">
                  {transcribing ? 'Transcribing...' : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                      Voice Memo
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* --- Interaction History — timeline --- */}
          <div className="section-card">
            <SectionHeader title="Interaction History" collapsed={collapsed.interactions} onToggle={() => toggle('interactions')}>
              <div className="section-card-meta">{interactions.length}</div>
            </SectionHeader>
            {!collapsed.interactions && (
              interactions.length > 0 ? (
                <div className="timeline">
                  {interactions.map(i => (
                    <div key={i.id} className="timeline-item">
                      <div className={`timeline-dot ${i === interactions[0] ? 'timeline-dot-active' : ''}`} />
                      <div className="interaction-header">
                        <div className="timeline-date">{i.date ? new Date(i.date).toLocaleDateString() : ''} &mdash; {i.author}</div>
                        <div className="interaction-actions">
                          <button className="btn-icon" onClick={() => { setEditingInteraction(i.id); setEditInteractionContent(i.content) }} title="Edit">{IconEdit}</button>
                          <button className="btn-icon" onClick={() => handleDeleteInteraction(i.id)} title="Delete">{IconTrash}</button>
                        </div>
                      </div>
                      {editingInteraction === i.id ? (
                        <div className="interaction-edit-area">
                          <textarea className="textarea textarea-edit-full"
                            value={editInteractionContent} onChange={e => setEditInteractionContent(e.target.value)} autoFocus />
                          <div className="interaction-edit-actions">
                            <button className="btn btn-primary" onClick={() => handleEditInteraction(i.id)}>Save</button>
                            <button className="btn btn-ghost" onClick={() => setEditingInteraction(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="timeline-content">{i.content}</div>
                      )}
                      {i.follow_up_signals && i.follow_up_signals.length > 0 && (
                        <div className="followup-signals">
                          {i.follow_up_signals.map(f => (
                            <div key={f.id} className="followup-signal">
                              <span className={`followup-signal-label ${f.resolved ? 'followup-signal-label--resolved' : 'followup-signal-label--pending'}`}>
                                {f.resolved ? 'Resolved' : 'Follow-up'}
                              </span>
                              <span className="followup-signal-text">{f.implied_action}</span>
                              {f.timeframe && <span className="type-meta">{f.timeframe}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cell-muted p-16">No interactions yet.</div>
              )
            )}
          </div>

          {/* --- Production History — collapsed by default --- */}
          <div className="section-card">
            <SectionHeader title="Production History" collapsed={collapsed.productions} onToggle={() => toggle('productions')}>
              <div className="section-card-meta">{productions.length}</div>
            </SectionHeader>
            {!collapsed.productions && (
              productions.length > 0 ? (
                <table className="data-table">
                  <thead><tr><th>Title</th><th>Venue</th><th>Year</th><th>Role</th></tr></thead>
                  <tbody>
                    {productions.map(p => (
                      <tr key={p.production_id}>
                        <td className="cell-strong">{p.title}</td>
                        <td>{p.venue ? p.venue.name : '\u2014'}</td>
                        <td>{p.year || '\u2014'}</td>
                        <td>{p.role?.display_label || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="cell-muted p-16">No productions yet.</div>
              )
            )}
          </div>

        </div>

        {/* ========== SIDEBAR ========== */}
        <div className="detail-sidebar">

          {/* --- Contact Card --- */}
          <div className="contact-card">
            <div className="contact-card-header">
              <div className="sidebar-label">Contact</div>
              <button className="btn btn-ghost"
                onClick={() => setEditingContact(!editingContact)}>
                {editingContact ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingContact ? (
              <div className="contact-edit-grid">
                <div className="contact-edit-name-grid">
                  <EditableField label="First Name" value={producer.first_name} field="first_name" onSave={handleFieldSave} />
                  <EditableField label="Last Name" value={producer.last_name} field="last_name" onSave={handleFieldSave} />
                </div>
                <EditableField label="Email" value={producer.email} field="email" onSave={handleFieldSave} />
                <EditableField label="Phone" value={producer.phone} field="phone" onSave={handleFieldSave} />
                <div>
                  <div className="type-meta">Location</div>
                  <LocationAutocomplete
                    city={producer.city} stateRegion={producer.state_region} country={producer.country}
                    onChange={loc => { handleFieldSave('city', loc.city); handleFieldSave('state_region', loc.state_region); handleFieldSave('country', loc.country) }}
                  />
                </div>
                <EditableField label="Website" value={producer.website} field="website" onSave={handleFieldSave} />
                <div>
                  <div className="type-meta">Profiles</div>
                  <div className="social-links-list">
                    {(producer.social_links || []).map((link, i) => (
                      <a key={i} href={link.url.startsWith('http') ? link.url : `https://${link.url}`} target="_blank" rel="noopener noreferrer" className="link link-external">{link.platform_name}</a>
                    ))}
                    {(!producer.social_links || producer.social_links.length === 0) && <span className="cell-muted">&mdash;</span>}
                  </div>
                </div>
                <EditableField label="Nickname" value={producer.nickname} field="nickname" onSave={handleFieldSave} />
                <EditableField label="Pronouns" value={producer.pronouns} field="pronouns" onSave={handleFieldSave} />
                <EditableField label="Birthdate" value={producer.birthdate} field="birthdate" onSave={handleFieldSave} />
                <EditableField label="College" value={producer.college} field="college" onSave={handleFieldSave} />
                <EditableField label="Hometown" value={producer.hometown} field="hometown" onSave={handleFieldSave} />
                <EditableField label="Spouse/Partner" value={producer.spouse_partner} field="spouse_partner" onSave={handleFieldSave} />
                <EditableField label="Languages" value={producer.languages} field="languages" onSave={handleFieldSave} />
                <EditableField label="Seasonal Location" value={producer.seasonal_location} field="seasonal_location" onSave={handleFieldSave} />
                <EditableField label="Photo URL" value={producer.photo_url} field="photo_url" onSave={handleFieldSave} />
              </div>
            ) : (
              <>
                <div className="contact-row">
                  <span className="contact-icon">{IconMail}</span>
                  <span className={`contact-value ${!producer.email ? 'contact-value--empty' : ''}`}>
                    {producer.email ? <a href={`mailto:${producer.email}`}>{producer.email}</a> : 'No email'}
                  </span>
                </div>
                <div className="contact-row">
                  <span className="contact-icon">{IconPhone}</span>
                  <span className={`contact-value ${!producer.phone ? 'contact-value--empty' : ''}`}>
                    {producer.phone ? <a href={`tel:${producer.phone}`}>{producer.phone}</a> : 'No phone'}
                  </span>
                </div>
                <div className="contact-row">
                  <span className="contact-icon">{IconPin}</span>
                  <span className={`contact-value ${!locationStr ? 'contact-value--empty' : ''}`}>
                    {locationStr || 'No location'}
                  </span>
                </div>
                {producer.website && (
                  <div className="contact-row">
                    <span className="contact-icon">{IconGlobe}</span>
                    <span className="contact-value"><a href={producer.website} target="_blank" rel="noopener noreferrer">{producer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></span>
                  </div>
                )}
                {(producer.social_links || []).length > 0
                  ? (producer.social_links || []).map((link, i) => (
                      <div className="contact-row" key={i}>
                        <span className="contact-icon"><PlatformIcon svg={link.icon_svg} /></span>
                        <span className="contact-value"><a href={link.url.startsWith('http') ? link.url : `https://${link.url}`} target="_blank" rel="noopener noreferrer">{link.platform_name}</a></span>
                      </div>
                    ))
                  : (
                    <div className="contact-row">
                      <span className="contact-icon">{IconGlobe}</span>
                      <span className="contact-value contact-value--empty">No profiles</span>
                    </div>
                  )}
                {producer.nickname && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">Nickname</span> {producer.nickname}</span>
                  </div>
                )}
                {producer.pronouns && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">Pronouns</span> {producer.pronouns}</span>
                  </div>
                )}
                {producer.birthdate && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">Birthdate</span> {producer.birthdate}</span>
                  </div>
                )}
                {producer.college && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">College</span> {producer.college}</span>
                  </div>
                )}
                {producer.hometown && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">Hometown</span> {producer.hometown}</span>
                  </div>
                )}
                {producer.spouse_partner && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">Spouse/Partner</span> {producer.spouse_partner}</span>
                  </div>
                )}
                {producer.languages && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">Languages</span> {producer.languages}</span>
                  </div>
                )}
                {producer.seasonal_location && (
                  <div className="contact-row">
                    <span className="contact-icon">&nbsp;</span>
                    <span className="contact-value"><span className="type-meta">Seasonal Location</span> {producer.seasonal_location}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* --- Relationship Stats --- */}
          {relationship && (
            <div>
              <div className="sidebar-label">Relationship</div>
              <div className="stat-grid relationship-stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Interactions</div>
                  <div className="stat-value">{relationship.interaction_count || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Frequency</div>
                  <div className="stat-value stat-value--sm">{relationship.interaction_frequency ? `${Math.round(relationship.interaction_frequency)}d` : '\u2014'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Last</div>
                  <div className="stat-value stat-value--sm">{relationship.last_contact_date ? relativeTime(relationship.last_contact_date) : 'Never'}</div>
                </div>
              </div>
            </div>
          )}

          {/* --- Organizations --- */}
          <div>
            <div className="sidebar-section-header">
              <div className="sidebar-label">Organizations</div>
              <button className="btn btn-ghost"
                onClick={() => setAddOrgModal(true)}>Add</button>
            </div>
            {organizations.length > 0 ? (
              <ul className="item-list">
                {organizations.map(o => (
                  <li key={o.id || o.organization_id} className="item-row org-row-detail">
                    <div>
                      <div className="item-primary org-name">{o.name}</div>
                      <div className="item-secondary org-role">
                        {o.role_title || ''}
                        {o.start_date && ` \u2014 since ${o.start_date}`}
                      </div>
                    </div>
                    <div className="org-row-actions">
                      {!o.end_date && <span className="org-current-badge">Current</span>}
                      <button className="btn-icon"
                        onClick={() => { setEditOrgModal(o); setOrgForm({ organization_name: o.name, role_title: o.role_title || '', start_date: o.start_date || '', end_date: o.end_date || '' }) }} title="Edit">{IconEdit}</button>
                      <button className="btn-icon"
                        onClick={() => handleRemoveAffiliation(o.id || o.organization_id)} title="Remove">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="cell-muted">No organizations yet.</div>
            )}
          </div>

          {/* --- Tags --- */}
          <div>
            <div className="sidebar-label">Tags</div>
            <ChipInput tags={producer.tags || []} onAdd={handleAddTag} onRemove={handleRemoveTag} />
          </div>

          {/* --- Dossier Metadata — collapsed --- */}
          <div className="section-card section-card--compact">
            <SectionHeader title="Metadata" collapsed={collapsed.metadata} onToggle={() => toggle('metadata')} />
            {!collapsed.metadata && (
              <>
                <div className="metadata-list">
                  <div>
                    <div className="type-meta">Last researched</div>
                    <div className="metadata-value">{producer.last_research_date ? new Date(producer.last_research_date).toLocaleDateString() : 'Never'}</div>
                  </div>
                  <div>
                    <div className="type-meta">Intake source</div>
                    <div className="metadata-value">{producer.intake_source || '\u2014'}</div>
                  </div>
                </div>
                {producer.research_status_detail && (
                  <div className="mt-8">
                    <div className="type-meta">Last research result</div>
                    <div className="metadata-value">{producer.research_status_detail}</div>
                  </div>
                )}
                {producer.research_sources_consulted && producer.research_sources_consulted.length > 0 && (
                  <div className="mt-8">
                    <div className="type-meta">Sources consulted</div>
                    <div className="metadata-value">{producer.research_sources_consulted.join(', ')}</div>
                  </div>
                )}
                {producer.research_gaps && producer.research_gaps.length > 0 && (
                  <div className="mt-8">
                    <div className="type-meta">Research gaps</div>
                    <div className="metadata-value--warn">{producer.research_gaps.join(', ')}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* --- Change History — collapsed --- */}
          <div className="section-card section-card--compact">
            <SectionHeader title="Change History" collapsed={collapsed.history} onToggle={() => toggle('history')}>
              <div className="section-card-meta">{history.length}</div>
            </SectionHeader>
            {!collapsed.history && (
              history.length > 0 ? (
                <div className="history-scroll">
                  {history.slice(0, 20).map(h => (
                    <div key={h.id} className="history-entry">
                      <div className="history-entry-header">
                        <span className="value-bold">{FIELD_LABELS[h.field_name] || h.field_name.replace(/_/g, ' ')}</span>
                        <span className="cell-muted">{new Date(h.changed_at).toLocaleDateString()}</span>
                      </div>
                      <div className="history-entry-value line-clamp-2">{h.new_value || '\u2014'}</div>
                      <div className="cell-muted history-entry-author">by {h.changed_by}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cell-muted">No changes recorded.</div>
              )
            )}
          </div>

        </div>
      </div>

      {/* ===== MODALS ===== */}

      {addOrgModal && (
        <Modal title="Add Organization"
          onClose={() => { setAddOrgModal(false); setOrgQuery(''); setOrgSuggestions([]) }}
          footer={<><button className="btn btn-ghost" onClick={() => setAddOrgModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAddAffiliation} disabled={!orgForm.organization_name.trim()}>Add</button></>}>
          <form onSubmit={handleAddAffiliation}>
            <div className="modal-field-relative">
              <div className="input-label">Organization</div>
              <input className="input input-full" placeholder="Type to search..."
                value={orgQuery}
                onChange={e => { setOrgQuery(e.target.value); setOrgForm(prev => ({ ...prev, organization_name: e.target.value })) }}
                autoFocus />
              {orgSuggestions.length > 0 && (
                <div className="autocomplete-dropdown">
                  {orgSuggestions.map(org => (
                    <div key={org.id} className="autocomplete-option"
                      onMouseDown={() => { setOrgQuery(org.name); setOrgForm(prev => ({ ...prev, organization_name: org.name })); setOrgSuggestions([]) }}>
                      {org.name}
                      {org.org_type && <span className="cell-muted ml-8 fs-meta">{org.org_type}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-field">
              <div className="input-label">Role / Title</div>
              <input className="input input-full" placeholder="e.g. Executive Producer"
                value={orgForm.role_title} onChange={e => setOrgForm(prev => ({ ...prev, role_title: e.target.value }))} />
            </div>
            <div className="org-date-grid">
              <div><div className="input-label">Start Date</div><input className="input input-full" type="date" value={orgForm.start_date} onChange={e => setOrgForm(prev => ({ ...prev, start_date: e.target.value }))} /></div>
              <div><div className="input-label">End Date</div><input className="input input-full" type="date" value={orgForm.end_date} onChange={e => setOrgForm(prev => ({ ...prev, end_date: e.target.value }))} /></div>
            </div>
          </form>
        </Modal>
      )}

      {editOrgModal && (
        <Modal title={`Edit \u2014 ${editOrgModal.name}`} onClose={() => setEditOrgModal(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditOrgModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleUpdateAffiliation}>Save</button></>}>
          <form onSubmit={handleUpdateAffiliation}>
            <div className="modal-field">
              <div className="input-label">Role / Title</div>
              <input className="input input-full" value={orgForm.role_title} onChange={e => setOrgForm(prev => ({ ...prev, role_title: e.target.value }))} autoFocus />
            </div>
            <div className="org-date-grid">
              <div><div className="input-label">Start Date</div><input className="input input-full" type="date" value={orgForm.start_date} onChange={e => setOrgForm(prev => ({ ...prev, start_date: e.target.value }))} /></div>
              <div><div className="input-label">End Date</div><input className="input input-full" type="date" value={orgForm.end_date} onChange={e => setOrgForm(prev => ({ ...prev, end_date: e.target.value }))} /></div>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Delete Producer" onClose={() => setDeleteConfirm(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button><button className="btn btn-primary btn-danger" onClick={handleDeleteProducer}>Delete</button></>}>
          <div className="prose">Permanently delete <strong>{producer.first_name} {producer.last_name}</strong> and all their data? This cannot be undone.</div>
        </Modal>
      )}
    </>
  )
}
