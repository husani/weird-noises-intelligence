/**
 * Producer detail — OrganizationDetail pattern with anchor nav.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import EntityNav from '@shared/components/EntityNav'
import {
  ActionMenu, Alert, DataTable, Drawer, EmptyState, Modal, StatusIndicator, PlatformIcon,
} from '@shared/components'
import {
  getProducer, deleteProducer as apiDeleteProducer,
  getInteractions, getProductions, getOrganizations, getRelationship,
  getHistory, refreshProducer, addTag, removeTag,
  getProducerTraits, getProducerIntel,
  addInteraction, editInteraction, deleteInteraction, transcribeAudio,
  addAffiliation, updateAffiliation, removeAffiliation,
  listOrganizations, gatherIntel,
  getProducerShows, listShows, addProducerToShow, removeProducerFromShow,
  listAllProductions, addProducerToProduction, removeProducerFromProduction,
} from '@producers/api'
import { useLookupValues } from '@shared/hooks/useLookupValues'
import ProductionDrawer from '@producers/components/ProductionDrawer'
import OrganizationDrawer from '@producers/components/OrganizationDrawer'

const NAV_LINKS = [
  { label: 'Overview', anchor: 'overview' },
  { label: 'Intel', anchor: 'intel' },
  { label: 'Shows & Productions', anchor: 'productions' },
  { label: 'Organizations', anchor: 'organizations' },
  { label: 'Interactions', anchor: 'interactions' },
]

const STATE_CONFIG = {
  no_contact: { label: 'No contact', variant: 'neutral' },
  new: { label: 'New', variant: 'blue' },
  active: { label: 'Active', variant: 'sage' },
  gone_cold: { label: 'Gone cold', variant: 'neutral' },
}

function relativeTime(dateStr) {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function Field({ label, children }) {
  return (
    <div className="sidebar-field">
      <div className="type-label">{label}</div>
      <div>{children || <span className="cell-muted">&mdash;</span>}</div>
    </div>
  )
}

function ChipInput({ tags = [], onAdd, onRemove }) {
  const [val, setVal] = useState('')
  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const t = val.trim().replace(/,$/, '')
      if (t) { onAdd(t); setVal('') }
    } else if (e.key === 'Backspace' && !val && tags.length) {
      onRemove(tags[tags.length - 1])
    }
  }
  return (
    <div className="chip-input-wrapper" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
      {tags.map(t => (
        <span key={t} className="chip">{t}
          <button type="button" className="chip-remove" onClick={() => onRemove(t)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l6 6M8 2l-6 6" /></svg>
          </button>
        </span>
      ))}
      <input type="text" className="chip-input" placeholder={tags.length === 0 ? 'Add tag…' : ''}
        value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleKey} />
    </div>
  )
}

function TagAdder({ onAdd }) {
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(''); setAdding(false) } }
    if (e.key === 'Escape') { setAdding(false); setVal('') }
  }
  if (!adding) return (
    <button className="pd-add-tag-btn" onClick={() => setAdding(true)} title="Add tag">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 1v8M1 5h8" /></svg>
    </button>
  )
  return <input className="input pd-tag-input" value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleKey} onBlur={() => { setAdding(false); setVal('') }} autoFocus placeholder="Tag…" />
}

export default function ProducerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [producer, setProducer] = useState(null)
  const [interactions, setInteractions] = useState([])
  const [productions, setProductions] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [relationship, setRelationship] = useState(null)
  const [history, setHistory] = useState([])
  const [traits, setTraits] = useState([])
  const [intel, setIntel] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editIntId, setEditIntId] = useState(null)
  const [editIntText, setEditIntText] = useState('')
  const pollRef = useRef(null)
  const [intVisible, setIntVisible] = useState(15)
  // Interaction modal
  const [intModal, setIntModal] = useState(false)
  const [newInt, setNewInt] = useState('')
  const [intProcessing, setIntProcessing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  const [orgModal, setOrgModal] = useState(null)
  const [orgQuery, setOrgQuery] = useState('')
  const [orgSugs, setOrgSugs] = useState([])
  const [orgForm, setOrgForm] = useState({ organization_name: '', role_title: '', start_date: '', end_date: '' })
  const orgDbRef = useRef(null)

  // Show/Production add modals
  const [shows, setShows] = useState([])
  const [addShowModal, setAddShowModal] = useState(false)
  const [addShowQuery, setAddShowQuery] = useState('')
  const [addShowResults, setAddShowResults] = useState([])
  const [addShowSelected, setAddShowSelected] = useState(null)
  const [addShowRoleId, setAddShowRoleId] = useState('')
  const [addShowSaving, setAddShowSaving] = useState(false)
  const [addProdModal, setAddProdModal] = useState(false)
  const [addProdQuery, setAddProdQuery] = useState('')
  const [addProdResults, setAddProdResults] = useState([])
  const [addProdSelected, setAddProdSelected] = useState(null)
  const [addProdRoleId, setAddProdRoleId] = useState('')
  const [addProdSaving, setAddProdSaving] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const addShowDbRef = useRef(null)
  const addProdDbRef = useRef(null)
  const [modalError, setModalError] = useState(null)
  const [productionDrawerId, setProductionDrawerId] = useState(null)
  const [orgDrawerId, setOrgDrawerId] = useState(null)
  const [researchDrawer, setResearchDrawer] = useState(false)
  const [historyModal, setHistoryModal] = useState(false)

  const { values: showRoleValues } = useLookupValues('role', 'producer_show')
  const { values: prodRoleValues } = useLookupValues('role', 'producer_production')

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.allSettled([
      getProducer(id), getInteractions(id), getProductions(id),
      getOrganizations(id), getRelationship(id), getHistory(id),
      getProducerTraits(id), getProducerIntel(id), getProducerShows(id),
    ]).then(r => {
      const v = (i, fb) => r[i].status === 'fulfilled' ? r[i].value : fb
      setProducer(v(0, null)); setInteractions(v(1, [])); setProductions(v(2, []))
      setOrganizations(v(3, [])); setRelationship(v(4, null)); setHistory(v(5, []))
      setTraits(v(6, [])); setIntel(v(7, [])); setShows(v(8, []))
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // Research polling
  function startPoll() {
    setRefreshing(true)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const p = await getProducer(id)
        if (p.research_status !== 'in_progress') {
          clearInterval(pollRef.current); pollRef.current = null; setRefreshing(false); loadAll()
        }
      } catch {}
    }, 4000)
  }
  useEffect(() => {
    if (producer?.research_status === 'in_progress' && !pollRef.current) startPoll()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [producer?.research_status])

  async function handleRefresh() { try { await refreshProducer(id); startPoll() } catch {} }
  const [gatheringIntel, setGatheringIntel] = useState(false)
  async function handleGatherIntel() {
    setGatheringIntel(true)
    try {
      await gatherIntel(id)
      // When the real pipeline is ready, this will poll for completion
      // instead of immediately reloading
      const newIntel = await getProducerIntel(id)
      setIntel(newIntel)
    } catch {}
    finally { setGatheringIntel(false) }
  }
  async function handleDelete() { await apiDeleteProducer(id); navigate('/producers/list') }

  // Interactions
  async function handleAddInt(e) {
    e.preventDefault(); if (!newInt.trim()) return
    setIntProcessing(true)
    await addInteraction(id, newInt)
    setNewInt(''); setIntModal(false)
    // Refresh just interactions, not the whole page
    const newInteractions = await getInteractions(id)
    setInteractions(newInteractions)
    // Delayed second fetch picks up AI-processed follow-ups and relationship updates
    setTimeout(async () => {
      const [ints, rel] = await Promise.all([getInteractions(id), getRelationship(id)])
      setInteractions(ints); setRelationship(rel)
      setIntProcessing(false)
    }, 5000)
  }
  async function handleEditInt(iid) {
    if (!editIntText.trim()) return
    try {
      await editInteraction(id, iid, editIntText); setEditIntId(null)
      const ints = await getInteractions(id); setInteractions(ints)
    } catch (err) { console.error('Edit failed:', err) }
  }
  async function handleDeleteInt(iid) {
    try {
      await deleteInteraction(id, iid)
      const [ints, rel] = await Promise.all([getInteractions(id), getRelationship(id)])
      setInteractions(ints); setRelationship(rel)
    } catch (err) { console.error('Delete failed:', err) }
  }

  // Recording
  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); setTranscribing(true)
        try { const r = await transcribeAudio(id, new Blob(chunksRef.current, { type: 'audio/webm' })); if (r.text) setNewInt(p => p ? `${p}\n\n${r.text}` : r.text) } catch {}
        setTranscribing(false)
      }
      mediaRef.current = rec; rec.start(); setRecording(true)
    } catch {}
  }
  function stopRec() { if (mediaRef.current && recording) { mediaRef.current.stop(); setRecording(false) } }

  // Org search
  useEffect(() => {
    if (orgDbRef.current) clearTimeout(orgDbRef.current)
    if (orgQuery.length < 2) { setOrgSugs([]); return }
    orgDbRef.current = setTimeout(() => {
      listOrganizations({ search: orgQuery, limit: 8 }).then(d => setOrgSugs(d.organizations || [])).catch(() => {})
    }, 250)
    return () => { if (orgDbRef.current) clearTimeout(orgDbRef.current) }
  }, [orgQuery])

  async function refreshOrgs() {
    const orgs = await getOrganizations(id); setOrganizations(orgs)
  }
  async function handleAddOrg(e) {
    e.preventDefault(); if (!orgForm.organization_name.trim()) return
    setModalError(null)
    try {
      const result = await addAffiliation(id, orgForm)
      if (result.error) { setModalError(result.error); return }
      setOrgModal(null); setOrgQuery(''); setModalError(null); refreshOrgs()
    } catch (err) { setModalError(err.message) }
  }
  async function handleEditOrg(e) {
    e.preventDefault(); if (!orgModal?.id) return
    setModalError(null)
    try {
      const result = await updateAffiliation(id, orgModal.id, { role_title: orgForm.role_title, start_date: orgForm.start_date || null, end_date: orgForm.end_date || null })
      if (result.error) { setModalError(result.error); return }
      setOrgModal(null); setModalError(null); refreshOrgs()
    } catch (err) { setModalError(err.message) }
  }
  async function handleRemoveOrg(affId) {
    try { await removeAffiliation(id, affId); refreshOrgs() }
    catch (err) { console.error('Remove failed:', err) }
  }

  // Show search for add modal
  useEffect(() => {
    if (addShowDbRef.current) clearTimeout(addShowDbRef.current)
    if (addShowQuery.length < 2) { setAddShowResults([]); return }
    addShowDbRef.current = setTimeout(() => {
      listShows({ search: addShowQuery, limit: 8 }).then(d => setAddShowResults(d.shows || [])).catch(() => {})
    }, 250)
    return () => { if (addShowDbRef.current) clearTimeout(addShowDbRef.current) }
  }, [addShowQuery])

  // Production search for add modal
  useEffect(() => {
    if (addProdDbRef.current) clearTimeout(addProdDbRef.current)
    if (addProdQuery.length < 2) { setAddProdResults([]); return }
    addProdDbRef.current = setTimeout(() => {
      listAllProductions({ search: addProdQuery, limit: 8 }).then(d => setAddProdResults(d.productions || [])).catch(() => {})
    }, 250)
    return () => { if (addProdDbRef.current) clearTimeout(addProdDbRef.current) }
  }, [addProdQuery])

  async function refreshCredits() {
    const [prods, shs] = await Promise.all([getProductions(id), getProducerShows(id)])
    setProductions(prods); setShows(shs)
  }
  async function handleAddToShow(e) {
    e.preventDefault()
    if (!addShowSelected) return
    setAddShowSaving(true); setModalError(null)
    try {
      const result = await addProducerToShow(addShowSelected.id, { producer_id: parseInt(id), role_id: addShowRoleId ? parseInt(addShowRoleId) : null })
      if (result.error) { setModalError(result.error); setAddShowSaving(false); return }
      setAddShowModal(false); setAddShowSelected(null); setAddShowRoleId(''); setAddShowQuery(''); setModalError(null); refreshCredits()
    } catch (err) { setModalError(err.message) }
    finally { setAddShowSaving(false) }
  }

  async function handleAddToProduction(e) {
    e.preventDefault()
    if (!addProdSelected) return
    setAddProdSaving(true); setModalError(null)
    try {
      const result = await addProducerToProduction(addProdSelected.id, { producer_id: parseInt(id), role_id: addProdRoleId ? parseInt(addProdRoleId) : null })
      if (result.error) { setModalError(result.error); setAddProdSaving(false); return }
      setAddProdModal(false); setAddProdSelected(null); setAddProdRoleId(''); setAddProdQuery(''); setModalError(null); refreshCredits()
    } catch (err) { setModalError(err.message) }
    finally { setAddProdSaving(false) }
  }

  async function handleRemoveShowLink(linkId) {
    await removeProducerFromShow(shows.find(s => s.id === linkId)?.show_id, linkId)
    refreshCredits()
  }

  async function handleRemoveProdLink(prodId, linkId) {
    await removeProducerFromProduction(prodId, linkId)
    refreshCredits()
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>
  if (!producer || producer.error) return <EmptyState title="Producer not found" />

  const state = STATE_CONFIG[producer.relationship_state] || STATE_CONFIG.no_contact
  const currentOrg = organizations.find(o => !o.end_date)
  const location = [producer.city, producer.state_region, producer.country].filter(Boolean).join(', ')
  const hometown = [producer.hometown, producer.hometown_state, producer.hometown_country].filter(Boolean).join(', ')
  const INTEL_COLS = [
    { key: 'observation', label: 'Observation', render: v => <span className="prose">{v}</span> },
    { key: 'confidence', label: 'Confidence', render: v => v != null ? `${v}%` : null, className: 'cell-number' },
    { key: 'discovered_at', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : null, className: 'cell-muted' },
    { key: 'source_url', label: 'Source', sortable: false, render: v => v
      ? <a href={v} target="_blank" rel="noopener noreferrer" className="link link-external">{new URL(v).hostname.replace('www.', '')}</a>
      : <span className="cell-muted">&mdash;</span>
    },
  ]

  // Unified shows + productions list
  const allCredits = (() => {
    const rows = []
    for (const s of (shows || [])) {
      rows.push({
        _key: `show-${s.id}`,
        _type: 'show',
        link_id: s.id,
        show_id: s.show_id,
        title: s.show_title || s.title,
        venue: null,
        year: null,
        role: s.role,
        scale: null,
        source: 'show',
        source_label: 'Show',
      })
    }
    for (const p of (productions || [])) {
      const detail = [p.year, p.scale?.display_label, p.venue?.name].filter(Boolean).join(' · ')
      rows.push({
        _key: `prod-${p.production_id}`,
        _type: 'production',
        link_id: p.link_id,
        production_id: p.production_id,
        title: p.title,
        venue: p.venue?.name,
        year: p.year,
        role: p.role,
        scale: p.scale,
        source: 'production',
        source_label: detail || 'Production',
      })
    }
    return rows
  })()

  const ORG_COLS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => {
            setOrgForm({ organization_name: row.name, role_title: row.role_title || '', start_date: row.start_date || '', end_date: row.end_date || '' })
            setOrgModal(row)
          }},
          { divider: true },
          { label: 'Remove', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => handleRemoveOrg(row.id || row.organization_id) },
        ]} />
      ),
    },
    { key: 'name', label: 'Name', strong: true },
    { key: 'role_title', label: 'Role' },
    {
      key: 'start_date', label: 'Tenure',
      render: (_, row) => {
        const start = row.start_date
        const end = row.end_date
        if (!start && !end) return <span className="cell-muted">&mdash;</span>
        const s = start ? new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
        const e = end ? new Date(end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'present'
        return `${s} — ${e}`
      },
      className: 'cell-muted',
    },
  ]

  const CREDIT_COLS = [
    {
      key: '_actions', label: '', sortable: false, className: 'th-actions',
      render: (_, row) => (
        <ActionMenu items={[
          { label: 'Remove', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4',
            destructive: true,
            onClick: () => row.source === 'show'
              ? handleRemoveShowLink(row.link_id)
              : handleRemoveProdLink(row.production_id, row.link_id) },
        ]} />
      ),
    },
    { key: 'title', label: 'Title', strong: true },
    { key: 'venue', label: 'Venue' },
    { key: 'year', label: 'Year' },
    { key: 'role', label: 'Role', render: v => v?.display_label || <span className="cell-muted">&mdash;</span> },
    {
      key: 'source_label', label: 'Relationship',
      render: (v, row) => row.source === 'show'
        ? <span className="badge badge-warm">Show</span>
        : <span className="badge badge-blue">{v}</span>,
    },
  ]

  return (
    <>
      <EntityNav title={`${producer.first_name} ${producer.last_name}`} backText="Producers" backPath="/producers/list" links={NAV_LINKS} anchor />

      {/* Alerts */}
      {(producer.research_status === 'in_progress' || refreshing) && <Alert variant="info" title="Research in progress">{producer.research_status_detail || 'Page updates automatically.'}</Alert>}
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{producer.first_name} {producer.last_name}</h1>
          <ActionMenu items={[
            { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/detail/${id}/edit`) },
            { label: 'Research Details', icon: 'M7.5 2a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.5 5v3M7.5 10v.5', onClick: () => setResearchDrawer(true) },
            { label: 'Change History', icon: 'M1.5 2.5h12M1.5 7.5h12M1.5 12.5h8', onClick: () => setHistoryModal(true) },
            { divider: true },
            { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => setDeleteConfirm(true) },
          ]} />
          <div className="pd-header-right">
            <button className="btn btn-primary" onClick={() => { setNewInt(''); setIntModal(true) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Log Interaction
            </button>
            <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing || producer.research_status === 'in_progress'}>
              {refreshing ? 'Researching…' : 'Re-research'}
            </button>
          </div>
        </div>
        {currentOrg && <div className="pd-org-line">{currentOrg.role_title && `${currentOrg.role_title}, `}{currentOrg.name}</div>}
        <div className="pd-contact-row">
          {producer.email && <a href={`mailto:${producer.email}`} className="link">{producer.email}</a>}
          {producer.email && producer.phone && <span className="cell-muted">·</span>}
          {producer.phone && <a href={`tel:${producer.phone}`} className="link">{producer.phone}</a>}
          {(producer.email || producer.phone) && location && <span className="cell-muted">·</span>}
          {location && <span>{location}</span>}
          {producer.website && <><span className="cell-muted">·</span><a href={producer.website} target="_blank" rel="noopener noreferrer" className="link link-external">{producer.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></>}
          {(producer.social_links || []).map((link, i) => (
            <a key={i} href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
              target="_blank" rel="noopener noreferrer" className="pd-social-link" title={link.platform_name}>
              <PlatformIcon svg={link.icon_svg} />
            </a>
          ))}
          {!producer.email && !producer.phone && !location && !producer.website && (producer.social_links || []).length === 0 && (
            <span className="cell-muted">No contact information</span>
          )}
        </div>
      </div>

      {/* ===== OVERVIEW — 2:5 grid ===== */}
      <div id="overview" className="pd-overview-grid">
        <div>
          <div className="section-card">
            <div className="section-card-header">
              <h3 className="section-card-title">Details</h3>
            </div>
            <div className="pd-details-grid">
              <Field label="Pronouns">{producer.pronouns}</Field>
              <Field label="Nickname">{producer.nickname}</Field>
              <Field label="Birthdate">{producer.birthdate}</Field>
              <Field label="College">{producer.college}</Field>
              <Field label="Hometown">{hometown}</Field>
              <Field label="Partner">{producer.spouse_partner}</Field>
              <Field label="Languages">{producer.languages}</Field>
              <Field label="Seasonal">{producer.seasonal_location}</Field>
            </div>
            <div className="pd-sidebar-divider" />
            <div className="pd-tags-row">
              {(producer.tags || []).map(t => (
                <span key={t} className="tag">
                  {t}
                  <button type="button" className="chip-remove" onClick={async () => { await removeTag(id, t); const p = await getProducer(id); setProducer(p) }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l6 6M8 2l-6 6" /></svg>
                  </button>
                </span>
              ))}
              <TagAdder onAdd={async t => { await addTag(id, t); const p = await getProducer(id); setProducer(p) }} />
            </div>
            <div className="pd-sidebar-divider" />
            <Field label="Last Contact">{relativeTime(relationship?.last_contact_date)}</Field>
          </div>
        </div>

        <div>
          <div className="pd-dossier-block">
            <div className="type-meta">Description</div>
            <p className="prose">{producer.description || <span className="cell-muted">&mdash;</span>}</p>
          </div>

          <div className="pd-dossier-block">
            <div className="type-meta">Traits</div>
            <p className="prose">{traits?.length > 0 ? traits.map(t => t.value).join(' ') : <span className="cell-muted">&mdash;</span>}</p>
          </div>
        </div>
      </div>

      {/* ===== PRODUCTIONS ===== */}
      <div id="intel" className="section-card pd-section">
        <div className="section-card-header">
          <h3 className="section-card-title">
            Intel on {producer.first_name} {producer.last_name}
            {gatheringIntel && <span className="status status-warm" style={{ marginLeft: 12, fontSize: '0.8125rem' }}><span className="status-dot pulse" />Gathering</span>}
          </h3>
          <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8125rem' }} onClick={handleGatherIntel} disabled={gatheringIntel}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            {gatheringIntel ? 'Gathering…' : 'Gather Intel'}
          </button>
        </div>
        <DataTable
          data={intel || []}
          columns={INTEL_COLS}
          rowKey="id"
          emptyState={<EmptyState title="No intel yet" description="Click Gather Intel to find information about this producer." />}
        />
      </div>

      <div id="productions" className="section-card pd-section">
        <div className="section-card-header">
          <h3 className="section-card-title">Shows & Productions for {producer.first_name} {producer.last_name}</h3>
          <span className="section-card-meta">
            {allCredits.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => { setAddShowSelected(null); setAddShowRoleId(''); setAddShowQuery(''); setModalError(null); setAddShowModal(true) }}>+ Add to show</span>
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => { setAddProdSelected(null); setAddProdRoleId(''); setAddProdQuery(''); setModalError(null); setAddProdModal(true) }}>+ Add to production</span>
          </span>
        </div>
        <DataTable data={allCredits} columns={CREDIT_COLS} rowKey="_key"
          onRowClick={row => row._type === 'production' ? setProductionDrawerId(row.production_id) : navigate(`/producers/shows/${row.show_id}`)}
          emptyState={<EmptyState title="No shows or productions" description="Link this producer to shows and productions." />} />
      </div>

      {/* ===== ORGANIZATIONS ===== */}
      <div id="organizations" className="section-card pd-section">
        <div className="section-card-header">
          <h3 className="section-card-title">Organizations for {producer.first_name} {producer.last_name}</h3>
          <span className="section-card-meta">
            {organizations.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => {
              setOrgForm({ organization_name: '', role_title: '', start_date: '', end_date: '' })
              setOrgQuery(''); setOrgSugs([]); setModalError(null); setOrgModal('add')
            }}>+ Add</span>
          </span>
        </div>
        <DataTable
          data={organizations}
          columns={ORG_COLS}
          rowKey={row => row.id || row.organization_id}
          onRowClick={row => setOrgDrawerId(row.organization_id || row.id)}
          emptyState={<EmptyState title="No organizations" description="Affiliations populate from research or add manually." />}
        />
      </div>

      {/* ===== INTERACTIONS ===== */}
      <div id="interactions" className="section-card pd-section">
        <div className="section-card-header">
          <h3 className="section-card-title">Interaction history with {producer.first_name} {producer.last_name}</h3>
          <span className="section-card-meta">
            {interactions.length} total
            <span className="link" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={() => { setNewInt(''); setIntModal(true) }}>+ Add</span>
          </span>
        </div>
        {interactions.length > 0 ? (
          <>
            <ul className="item-list">
              {interactions.slice(0, intVisible).map(int => (
                <li key={int.id} className="pd-interaction-row">
                  <div className="pd-interaction-header">
                    <span className="pd-interaction-date">
                      {int.date ? new Date(int.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      {int.author && ` — ${int.author}`}
                    </span>
                    <ActionMenu items={[
                      { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => { setEditIntId(int.id); setEditIntText(int.content) } },
                      { divider: true },
                      { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: () => handleDeleteInt(int.id) },
                    ]} />
                  </div>
                  {editIntId === int.id ? (
                    <div className="field-stack">
                      <textarea className="textarea textarea-full" value={editIntText} onChange={e => setEditIntText(e.target.value)} autoFocus rows={4} />
                      <div className="form-actions">
                        <button className="btn btn-ghost" onClick={() => setEditIntId(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={() => handleEditInt(int.id)}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="pd-interaction-content">{int.content}</div>
                  )}
                </li>
              ))}
            </ul>
            {interactions.length > intVisible && (
              <div className="pd-show-older">
                <button className="link" onClick={() => setIntVisible(v => v + 15)}>
                  Show older ({interactions.length - intVisible} more)
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="No interactions" description="Log your first interaction using the button above." />
        )}
      </div>


      {/* Modals */}
      {deleteConfirm && (
        <Modal title="Delete Producer" onClose={() => setDeleteConfirm(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button><button className="btn btn-destructive" onClick={handleDelete}>Delete</button></>}>
          <p className="confirm-body">Permanently delete <strong>{producer.first_name} {producer.last_name}</strong>? This cannot be undone.</p>
        </Modal>
      )}
      {orgModal && (
        <Modal title={orgModal === 'add' ? 'Add Organization' : `Edit — ${orgModal.name}`} onClose={() => setOrgModal(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setOrgModal(null)}>Cancel</button><button className="btn btn-primary" onClick={orgModal === 'add' ? handleAddOrg : handleEditOrg} disabled={orgModal === 'add' && !orgForm.organization_name.trim()}>{orgModal === 'add' ? 'Add' : 'Save'}</button></>}>
          {modalError && <Alert variant="error" title={modalError} />}
          <form onSubmit={orgModal === 'add' ? handleAddOrg : handleEditOrg}>
            <div className="field-stack">
              {orgModal === 'add' && (
                <div style={{ position: 'relative' }}>
                  <label className="input-label">Organization *</label>
                  <input className="input" placeholder="Type to search…" value={orgQuery} autoFocus
                    onChange={e => { setOrgQuery(e.target.value); setOrgForm(p => ({ ...p, organization_name: e.target.value })) }} />
                  {orgSugs.length > 0 && (
                    <div className="dropdown-select-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4 }}>
                      {orgSugs.map(org => (
                        <div key={org.id} className="dropdown-select-option" onMouseDown={() => { setOrgQuery(org.name); setOrgForm(p => ({ ...p, organization_name: org.name })); setOrgSugs([]) }}>
                          <div className="dropdown-select-check-empty" />{org.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div><label className="input-label">Role / Title</label><input className="input" placeholder="e.g. Executive Producer" value={orgForm.role_title} onChange={e => setOrgForm(p => ({ ...p, role_title: e.target.value }))} /></div>
              <div className="form-grid-2col">
                <div><label className="input-label">Start Date</label><input className="input" type="date" value={orgForm.start_date} onChange={e => setOrgForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div><label className="input-label">End Date</label><input className="input" type="date" value={orgForm.end_date} onChange={e => setOrgForm(p => ({ ...p, end_date: e.target.value }))} /></div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Change history modal */}
      {historyModal && (
        <Modal title={`Change history — ${producer.first_name} ${producer.last_name}`} wide onClose={() => setHistoryModal(false)}
          footer={<button className="btn btn-ghost" onClick={() => setHistoryModal(false)}>Close</button>}>
          <DataTable
            data={history}
            columns={[
              { key: 'changed_at', label: 'Date', render: v => new Date(v).toLocaleDateString(), className: 'cell-muted' },
              { key: 'changed_by', label: 'By', render: v => v?.includes('@') ? v.split('@')[0] : v },
              { key: 'field_name', label: 'Field', strong: true, render: v => v.replace(/_/g, ' ') },
              { key: 'new_value', label: 'Value', render: v => v ? <span className="line-clamp-2">{v}</span> : <span className="cell-muted">&mdash;</span> },
            ]}
            rowKey="id"
            emptyState={<EmptyState title="No changes" description="Changes will appear as the producer's data is updated." />}
          />
        </Modal>
      )}

      {/* Interaction modal */}
      {intModal && (
        <Modal title="Log Interaction" onClose={() => { if (!intProcessing) { setIntModal(false); setNewInt('') } }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setIntModal(false); setNewInt('') }} disabled={intProcessing}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddInt} disabled={!newInt.trim() || intProcessing}>
              {intProcessing ? 'Processing…' : 'Log'}
            </button>
          </>}>
          <form onSubmit={handleAddInt}>
            <div className="field-stack">
              <div>
                <label className="input-label">Notes</label>
                <textarea className="textarea textarea-full" placeholder="What happened?"
                  value={newInt} onChange={e => setNewInt(e.target.value)} rows={5} autoFocus />
              </div>
              <div>
                <label className="input-label">Voice Memo</label>
                {recording ? (
                  <div className="voice-recording-state">
                    <button type="button" className="voice-record-btn recording" onClick={stopRec}>
                      <div className="record-dot" />
                    </button>
                    <div className="voice-waveform">
                      {[0, 0.1, 0.2, 0.3, 0.15, 0.25, 0.05, 0.35].map((delay, i) => (
                        <div key={i} className="voice-waveform-bar" style={{ animationDelay: `${delay}s` }} />
                      ))}
                    </div>
                    <span className="voice-timer">Recording…</span>
                  </div>
                ) : transcribing ? (
                  <div className="voice-recording-state">
                    <div className="loading-spinner" />
                    <span className="cell-muted">Transcribing…</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button type="button" className="voice-record-btn" onClick={startRec}>
                      <div className="record-dot" />
                    </button>
                    <span className="cell-muted" style={{ fontSize: '0.9375rem', fontWeight: 300 }}>Tap to record</span>
                  </div>
                )}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Drawers */}
      {productionDrawerId && <ProductionDrawer productionId={productionDrawerId} onClose={() => setProductionDrawerId(null)} />}
      {orgDrawerId && <OrganizationDrawer organizationId={orgDrawerId} onClose={() => setOrgDrawerId(null)} />}
      {researchDrawer && (
        <Drawer open onClose={() => setResearchDrawer(false)} title="Research Details" subtitle={`${producer.first_name} ${producer.last_name}`}>
          <div className="drawer-section">
            <Field label="Status">{producer.research_status || <span className="cell-muted">&mdash;</span>}</Field>
            {producer.research_status_detail && <Field label="Detail">{producer.research_status_detail}</Field>}
            <Field label="Last Researched">{producer.last_research_date ? new Date(producer.last_research_date).toLocaleDateString() : null}</Field>
            <Field label="Intake Source">{producer.intake_source}</Field>
            {producer.intake_source_url && <Field label="Intake URL"><a href={producer.intake_source_url} target="_blank" rel="noopener noreferrer" className="link link-external">{new URL(producer.intake_source_url).hostname.replace('www.', '')}</a></Field>}
            {producer.intake_ai_reasoning && <Field label="AI Reasoning">{producer.intake_ai_reasoning}</Field>}
            <Field label="Sources Consulted">{producer.research_sources_consulted?.length > 0 ? producer.research_sources_consulted.join(', ') : null}</Field>
            <Field label="Research Gaps">{producer.research_gaps?.length > 0 ? producer.research_gaps.join(', ') : null}</Field>
          </div>
        </Drawer>
      )}

      {/* Add to show modal */}
      {addShowModal && (
        <Modal title="Add to Show" onClose={() => setAddShowModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setAddShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={addShowSaving || !addShowSelected} onClick={handleAddToShow}>
              {addShowSaving ? 'Adding…' : 'Add'}
            </button>
          </>}>
          {modalError && <Alert variant="error" title={modalError} />}
          <form onSubmit={handleAddToShow}>
            <div className="field-stack">
              <div style={{ position: 'relative' }}>
                <label className="input-label">Show *</label>
                {addShowSelected ? (
                  <div className="producer-search-selected">
                    <span className="cell-strong">{addShowSelected.title}</span>
                    <button type="button" className="producer-search-clear" onClick={() => { setAddShowSelected(null); setAddShowQuery('') }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <input className="input" placeholder="Search shows…" value={addShowQuery} autoFocus
                      onChange={e => setAddShowQuery(e.target.value)} />
                    {addShowResults.length > 0 && (
                      <div className="dropdown-select-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4 }}>
                        {addShowResults.map(s => (
                          <div key={s.id} className="dropdown-select-option"
                            onMouseDown={() => { setAddShowSelected(s); setAddShowResults([]) }}>
                            <div className="dropdown-select-check-empty" />
                            {s.title}
                            {s.medium && <span className="cell-muted"> · {s.medium.display_label}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="input-label">Role</label>
                <div className="select-wrapper">
                  <select className="select" value={addShowRoleId} onChange={e => setAddShowRoleId(e.target.value)}>
                    <option value="">Select role…</option>
                    {showRoleValues.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
                  </select>
                  <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Add to production modal */}
      {addProdModal && (
        <Modal title="Add to Production" onClose={() => setAddProdModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setAddProdModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={addProdSaving || !addProdSelected} onClick={handleAddToProduction}>
              {addProdSaving ? 'Adding…' : 'Add'}
            </button>
          </>}>
          {modalError && <Alert variant="error" title={modalError} />}
          <form onSubmit={handleAddToProduction}>
            <div className="field-stack">
              <div style={{ position: 'relative' }}>
                <label className="input-label">Production *</label>
                {addProdSelected ? (
                  <div className="producer-search-selected">
                    <span className="cell-strong">{addProdSelected.show_title || addProdSelected.title}</span>
                    <span className="cell-muted"> · {[addProdSelected.year, addProdSelected.venue_name].filter(Boolean).join(' · ')}</span>
                    <button type="button" className="producer-search-clear" onClick={() => { setAddProdSelected(null); setAddProdQuery('') }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <input className="input" placeholder="Search productions…" value={addProdQuery} autoFocus
                      onChange={e => setAddProdQuery(e.target.value)} />
                    {addProdResults.length > 0 && (
                      <div className="dropdown-select-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4 }}>
                        {addProdResults.map(p => (
                          <div key={p.id} className="dropdown-select-option"
                            onMouseDown={() => { setAddProdSelected(p); setAddProdResults([]) }}>
                            <div className="dropdown-select-check-empty" />
                            {p.show_title || p.title}
                            <span className="cell-muted"> · {[p.year, p.venue_name, p.scale?.display_label].filter(Boolean).join(' · ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="input-label">Role</label>
                <div className="select-wrapper">
                  <select className="select" value={addProdRoleId} onChange={e => setAddProdRoleId(e.target.value)}>
                    <option value="">Select role…</option>
                    {prodRoleValues.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
                  </select>
                  <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
