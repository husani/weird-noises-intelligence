/**
 * Show Pitches — list view with content cards, workspace view for reading,
 * generate modal with audience type selector, and manual write modal.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  listPitches,
  getPitch,
  createPitch,
  generatePitch,
  updatePitch,
  deletePitch,
  listPitchMaterials,
  uploadPitchMaterial,
  deletePitchMaterial,
  downloadPitchMaterial,
  getLookupValues,
} from '@slate/api'
import ActionMenu from '@shared/components/ActionMenu'
import Modal from '@shared/components/Modal'
import EmptyState from '@shared/components/EmptyState'
import DropdownSelect from '@shared/components/DropdownSelect'

const AUDIENCE_TYPES = [
  { value: 'producer', name: 'Producer', desc: 'Tailored for lead or co-producers evaluating commercial potential and creative fit' },
  { value: 'investor', name: 'Investor', desc: 'Focused on financials, market positioning, and return projections' },
  { value: 'festival', name: 'Festival', desc: 'Emphasizes artistic merit, development stage, and creative team credentials' },
  { value: 'grant_maker', name: 'Grant-maker', desc: 'Highlights mission alignment, community impact, and artistic innovation' },
  { value: 'general', name: 'General', desc: 'A versatile pitch suitable for any audience or context' },
]

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ShowPitches({ show }) {
  const [pitches, setPitches] = useState([])
  const [audienceTypes, setAudienceTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPitch, setSelectedPitch] = useState(null)
  const [materials, setMaterials] = useState([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showWriteModal, setShowWriteModal] = useState(false)
  const [showEditTitleModal, setShowEditTitleModal] = useState(false)
  const [editingPitch, setEditingPitch] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [pitchData, lookupData] = await Promise.all([
        listPitches(show.id),
        getLookupValues({ category: 'audience_type' }),
      ])
      setPitches(pitchData.pitches || [])
      setAudienceTypes(lookupData.values || [])
    } catch (err) {
      console.error('Failed to load pitches:', err)
    } finally {
      setLoading(false)
    }
  }, [show.id])

  useEffect(() => { load() }, [load])

  const loadMaterials = useCallback(async (pitchId) => {
    setMaterialsLoading(true)
    try {
      const data = await listPitchMaterials(show.id, pitchId)
      setMaterials(data.materials || [])
    } catch (err) {
      console.error('Failed to load materials:', err)
      setMaterials([])
    } finally {
      setMaterialsLoading(false)
    }
  }, [show.id])

  async function handleSelectPitch(pitch) {
    setSelectedPitch(pitch)
    await loadMaterials(pitch.id)
  }

  function handleBackToList() {
    setSelectedPitch(null)
    setMaterials([])
  }

  async function handleDeletePitch(pitch) {
    if (!confirm(`Delete "${pitch.title}"?`)) return
    try {
      await deletePitch(show.id, pitch.id)
      if (selectedPitch?.id === pitch.id) {
        setSelectedPitch(null)
        setMaterials([])
      }
      await load()
    } catch (err) {
      console.error('Failed to delete pitch:', err)
    }
  }

  async function handleRegenerate() {
    if (!selectedPitch) return
    setRegenerating(true)
    try {
      const result = await generatePitch(show.id, {
        audience_type: selectedPitch.audience_type?.value || selectedPitch.audience_type,
      })
      await load()
      // Select the newly generated pitch
      const fresh = await getPitch(show.id, result.id || result.pitch?.id)
      setSelectedPitch(fresh.pitch || fresh)
      await loadMaterials((fresh.pitch || fresh).id)
    } catch (err) {
      console.error('Failed to regenerate pitch:', err)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleUploadMaterial(e) {
    const file = e.target.files?.[0]
    if (!file || !selectedPitch) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await uploadPitchMaterial(show.id, selectedPitch.id, formData)
      await loadMaterials(selectedPitch.id)
    } catch (err) {
      console.error('Failed to upload material:', err)
    }
    e.target.value = ''
  }

  async function handleDeleteMaterial(materialId) {
    if (!selectedPitch) return
    try {
      await deletePitchMaterial(show.id, selectedPitch.id, materialId)
      await loadMaterials(selectedPitch.id)
    } catch (err) {
      console.error('Failed to delete material:', err)
    }
  }

  async function handleDownloadMaterial(material) {
    try {
      const data = await downloadPitchMaterial(show.id, selectedPitch.id, material.id)
      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      console.error('Failed to download material:', err)
    }
  }

  function getAudienceLabel(pitch) {
    if (pitch.audience_type?.display_label) return pitch.audience_type.display_label
    const found = AUDIENCE_TYPES.find(t => t.value === pitch.audience_type)
    return found?.name || pitch.audience_type || 'General'
  }

  function getAudienceBadgeClass(pitch) {
    if (pitch.audience_type?.css_class) return pitch.audience_type.css_class
    const val = pitch.audience_type?.value || pitch.audience_type
    const map = { producer: 'badge-warm', investor: 'badge-blue', festival: 'badge-sage', grant_maker: 'badge-lavender', general: 'badge-neutral' }
    return map[val] || 'badge-neutral'
  }

  function getStatusLabel(pitch) {
    if (pitch.status?.display_label) return pitch.status.display_label
    return pitch.status || 'Draft'
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  // Workspace view
  if (selectedPitch) {
    return (
      <div className="slate-pitch-workspace">
        <button className="link slate-pitch-back" onClick={handleBackToList}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2L4 7l5 5" />
          </svg>
          Back to pitches
        </button>

        <div className="content-workspace">
          <div className="content-workspace-header">
            <div className="content-workspace-header-left">
              <div className="content-workspace-header-info">
                <span className="type-meta">{getAudienceLabel(selectedPitch)}</span>
                <span className="content-workspace-title">{selectedPitch.title}</span>
              </div>
            </div>
            <div className="content-workspace-actions">
              <button className="btn btn-ghost" onClick={() => {
                setEditingPitch(selectedPitch)
                setShowEditTitleModal(true)
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 12v2h2l8-8-2-2-8 8zM10 2l2-0 2 2-0 2" />
                </svg>
                Edit
              </button>
              <button className="btn btn-ghost" onClick={handleRegenerate} disabled={regenerating}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1.5 7a5.5 5.5 0 019.35-3.93M12.5 7a5.5 5.5 0 01-9.35 3.93" />
                  <path d="M11 1v3h-3M3 13v-3h3" />
                </svg>
                {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button className="btn btn-ghost btn-destructive" onClick={() => handleDeletePitch(selectedPitch)}>
                Delete
              </button>
            </div>
          </div>
          <div className="content-workspace-body">
            <div className="content-workspace-content">{selectedPitch.content}</div>

            <div className="content-workspace-attribution">
              {selectedPitch.generated_by
                ? `Generated by ${selectedPitch.generated_by}`
                : 'Manually written'}
              {selectedPitch.created_at && ` · ${formatDate(selectedPitch.created_at)}`}
              {selectedPitch.updated_at && selectedPitch.updated_at !== selectedPitch.created_at && ` · Updated ${formatDate(selectedPitch.updated_at)}`}
              {' · '}{getStatusLabel(selectedPitch)}
            </div>

            <div className="content-workspace-attachments-label">Attached Materials</div>
            <div className="content-workspace-attachments">
              {materialsLoading ? (
                <div className="type-meta">Loading materials...</div>
              ) : materials.length === 0 ? (
                <div className="type-meta">No materials attached</div>
              ) : (
                materials.map(mat => (
                  <div key={mat.id} className="file-item">
                    <svg className="file-item-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                      <path d="M12 2v4h4" />
                    </svg>
                    <span className="file-item-name slate-material-clickable" onClick={() => handleDownloadMaterial(mat)}>
                      {mat.filename}
                    </span>
                    <span className="file-item-meta">{formatFileSize(mat.file_size)}</span>
                    <svg className="file-item-remove" width="16" height="16" viewBox="0 0 16 16" fill="none"
                      stroke="currentColor" strokeWidth="1.5" onClick={() => handleDeleteMaterial(mat.id)}>
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </div>
                ))
              )}
              <label className="btn btn-ghost btn-sm slate-upload-btn">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 1v12M1 7h12" />
                </svg>
                Upload Material
                <input type="file" className="sr-only" onChange={handleUploadMaterial} />
              </label>
            </div>
          </div>
        </div>

        {showEditTitleModal && editingPitch && (
          <EditTitleModal
            pitch={editingPitch}
            showId={show.id}
            onClose={() => { setShowEditTitleModal(false); setEditingPitch(null) }}
            onSaved={async (updated) => {
              setShowEditTitleModal(false)
              setEditingPitch(null)
              await load()
              setSelectedPitch(updated.pitch || updated)
            }}
          />
        )}
      </div>
    )
  }

  // List view
  // Group pitches by audience type
  const grouped = {}
  pitches.forEach(p => {
    const key = getAudienceLabel(p)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p)
  })

  return (
    <div className="slate-pitches">
      <div className="page-header">
        <div>
          <h2 className="page-title">Pitches</h2>
        </div>
        <div className="slate-actions">
          <button className="btn btn-ghost" onClick={() => setShowWriteModal(true)}>Write Pitch</button>
          <button className="btn btn-primary" onClick={() => setShowGenerateModal(true)}>Generate Pitch</button>
        </div>
      </div>

      {pitches.length === 0 ? (
        <EmptyState
          icon={
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 6h16l8 8v20a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
              <path d="M24 6v8h8" />
              <path d="M14 22h12M14 28h8" />
            </svg>
          }
          title="No pitches yet"
          description="Generate a pitch tailored to a specific audience — producers, investors, festivals, or grant-makers."
          action={<button className="btn btn-primary" onClick={() => setShowGenerateModal(true)}>Generate Pitch</button>}
        />
      ) : (
        <div className="slate-pitch-list">
          {Object.entries(grouped).map(([groupLabel, groupPitches]) => (
            <div key={groupLabel} className="slate-pitch-group">
              <div className="slate-pitch-group-label">{groupLabel}</div>
              {groupPitches.map(pitch => (
                <div key={pitch.id} className="content-card" onClick={() => handleSelectPitch(pitch)}>
                  <div className="content-card-header">
                    <span className={`badge ${getAudienceBadgeClass(pitch)}`}>{getAudienceLabel(pitch)}</span>
                    <span className="content-card-title">{pitch.title}</span>
                    <ActionMenu items={[
                      { label: 'View', icon: 'M1 8s3-5.5 7-5.5S15 8 15 8s-3 5.5-7 5.5S1 8 1 8zM8 10a2 2 0 100-4 2 2 0 000 4z', onClick: () => handleSelectPitch(pitch) },
                      { label: 'Edit title', icon: 'M1 11.5V14h2.5L11 6.5 8.5 4 1 11.5zM10 2l1-.5 2 2-.5 1', onClick: () => { setEditingPitch(pitch); setShowEditTitleModal(true) } },
                      { divider: true },
                      { label: 'Delete', icon: 'M2 3h11M5.5 3V2a1 1 0 011-1h2a1 1 0 011 1v1M3 5v8a1 1 0 001 1h7a1 1 0 001-1V5', destructive: true, onClick: () => handleDeletePitch(pitch) },
                    ]} />
                  </div>
                  <div className="content-card-preview">{pitch.content}</div>
                  <div className="content-card-meta">
                    {pitch.generated_by ? `Generated by ${pitch.generated_by}` : 'Manually written'}
                    {' · '}{formatDate(pitch.created_at)}
                    {' · '}<span className={`badge badge-sm ${pitch.status?.css_class || 'badge-neutral'}`}>{getStatusLabel(pitch)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showGenerateModal && (
        <GenerateModal
          showId={show.id}
          generating={generating}
          setGenerating={setGenerating}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={async () => {
            setShowGenerateModal(false)
            await load()
          }}
        />
      )}

      {showWriteModal && (
        <WriteModal
          showId={show.id}
          audienceTypes={audienceTypes}
          onClose={() => setShowWriteModal(false)}
          onCreated={async () => {
            setShowWriteModal(false)
            await load()
          }}
        />
      )}

      {showEditTitleModal && editingPitch && (
        <EditTitleModal
          pitch={editingPitch}
          showId={show.id}
          onClose={() => { setShowEditTitleModal(false); setEditingPitch(null) }}
          onSaved={async () => {
            setShowEditTitleModal(false)
            setEditingPitch(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

function GenerateModal({ showId, generating, setGenerating, onClose, onGenerated }) {
  const [selectedType, setSelectedType] = useState('producer')
  const [targetProducerId, setTargetProducerId] = useState('')
  const [error, setError] = useState(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const data = { audience_type: selectedType }
      if (selectedType === 'producer' && targetProducerId.trim()) {
        data.target_producer_id = targetProducerId.trim()
      }
      await generatePitch(showId, data)
      onGenerated()
    } catch (err) {
      setError(err.message)
      setGenerating(false)
    }
  }

  return (
    <Modal
      title="Generate Pitch"
      wide
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </>}
    >
      <div className="type-meta slate-generate-label">Generate pitch for</div>
      <div className="content-type-selector">
        {AUDIENCE_TYPES.map(type => (
          <div
            key={type.value}
            className={`content-type-option${selectedType === type.value ? ' content-type-option-selected' : ''}`}
            onClick={() => setSelectedType(type.value)}
          >
            <div className="content-type-option-name">{type.name}</div>
            <div className="content-type-option-desc">{type.desc}</div>
          </div>
        ))}
      </div>

      {selectedType === 'producer' && (
        <div className="slate-generate-producer-field">
          <label className="input-label">Target Producer ID (optional)</label>
          <input
            className="input"
            value={targetProducerId}
            onChange={e => setTargetProducerId(e.target.value)}
            placeholder="Enter a producer ID to tailor the pitch"
          />
        </div>
      )}

      {error && <div className="field-error">{error}</div>}
    </Modal>
  )
}

function WriteModal({ showId, audienceTypes, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [audienceType, setAudienceType] = useState(null)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const typeOptions = audienceTypes.length > 0
    ? audienceTypes.map(t => ({ value: t.value, label: t.display_label }))
    : AUDIENCE_TYPES.map(t => ({ value: t.value, label: t.name }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createPitch(showId, {
        title: title.trim(),
        audience_type: audienceType,
        content: content.trim(),
      })
      onCreated()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Write Pitch"
      wide
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={submitting || !title.trim() || !content.trim()}>
          {submitting ? 'Saving...' : 'Save Pitch'}
        </button>
      </>}
    >
      <form onSubmit={handleSubmit}>
        <label className="input-label">Title</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Pitch title" autoFocus />

        <label className="input-label" >Audience Type</label>
        <DropdownSelect
          options={typeOptions}
          value={audienceType}
          onChange={setAudienceType}
          placeholder="Select audience type..."
        />

        <label className="input-label">Content</label>
        <textarea className="input slate-pitch-textarea" value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your pitch..." rows={8} />

        {error && <div className="field-error">{error}</div>}
      </form>
    </Modal>
  )
}

function EditTitleModal({ pitch, showId, onClose, onSaved }) {
  const [title, setTitle] = useState(pitch.title || '')
  const [content, setContent] = useState(pitch.content || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await updatePitch(showId, pitch.id, {
        title: title.trim(),
        content: content.trim(),
      })
      onSaved(result)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Edit Pitch"
      wide
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={submitting || !title.trim()}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </>}
    >
      <form onSubmit={handleSubmit}>
        <label className="input-label">Title</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />

        <label className="input-label">Content</label>
        <textarea className="input slate-pitch-textarea" value={content}
          onChange={e => setContent(e.target.value)} rows={10} />

        {error && <div className="field-error">{error}</div>}
      </form>
    </Modal>
  )
}
