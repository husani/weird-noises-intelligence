/**
 * Create Show — one form to create a show and upload its first script.
 * The backend creates a show record + version record + uploads to GCS + triggers AI.
 * The user fills out one form and hits one button.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SelectArrow from '@shared/components/SelectArrow'
import { createShow, uploadScript, getLookupValues } from '@slate/api'

export default function CreateShow() {
  const [title, setTitle] = useState('')
  const [mediumId, setMediumId] = useState('')
  const [rightsStatusId, setRightsStatusId] = useState('')
  const [developmentStageId, setDevelopmentStageId] = useState('')
  const [scriptFile, setScriptFile] = useState(null)
  const [mediums, setMediums] = useState([])
  const [stages, setStages] = useState([])
  const [rightsStatuses, setRightsStatuses] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const fileRef = useRef(null)

  useEffect(() => {
    Promise.all([
      getLookupValues({ category: 'medium' }),
      getLookupValues({ category: 'development_stage' }),
      getLookupValues({ category: 'rights_status' }),
    ]).then(([m, s, r]) => {
      setMediums(m.lookup_values || [])
      setStages(s.lookup_values || [])
      setRightsStatuses(r.lookup_values || [])
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      // 1. Create the show
      const showData = {
        title: title.trim(),
        medium_id: mediumId ? parseInt(mediumId) : null,
        rights_status_id: rightsStatusId ? parseInt(rightsStatusId) : null,
        development_stage_id: developmentStageId ? parseInt(developmentStageId) : null,
      }
      const show = await createShow(showData)

      // 2. If a script was attached, upload it as version 1
      if (scriptFile) {
        const fd = new FormData()
        fd.append('file', scriptFile)
        fd.append('version_number', '1')
        fd.append('change_notes', '')
        await uploadScript(show.id, fd)
      }

      navigate(`/slate/shows/${show.id}/overview`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-topbar">
        <div>
          <h1 className="page-title">New Show</h1>
          <p className="page-subtitle">Add a project to the slate</p>
        </div>
      </div>

      <div className="section-card">
        <form onSubmit={handleSubmit}>
          <div className="field-stack">
            <div>
              <label className="input-label">Title *</label>
              <input className="input" value={title}
                onChange={e => setTitle(e.target.value)} placeholder="Show title" autoFocus />
            </div>

            <div>
              <label className="input-label">Medium</label>
              <div className="select-wrapper">
                <select className="select" value={mediumId}
                  onChange={e => setMediumId(e.target.value)}>
                  <option value="">Select medium...</option>
                  {mediums.map(m => <option key={m.id} value={m.id}>{m.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>

            <div>
              <label className="input-label">Development Stage</label>
              <div className="select-wrapper">
                <select className="select" value={developmentStageId}
                  onChange={e => setDevelopmentStageId(e.target.value)}>
                  <option value="">Select stage...</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>

            <div>
              <label className="input-label">Rights Status</label>
              <div className="select-wrapper">
                <select className="select" value={rightsStatusId}
                  onChange={e => setRightsStatusId(e.target.value)}>
                  <option value="">Select rights status...</option>
                  {rightsStatuses.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>

            <div>
              <label className="input-label">Script</label>
              <div className="file-upload" onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) setScriptFile(f) }}>
                <div className="file-upload-icon">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 24V10M12 16l6-6 6 6" /><path d="M6 22v6a2 2 0 002 2h20a2 2 0 002-2v-6" />
                  </svg>
                </div>
                <div className="file-upload-title">
                  {scriptFile ? scriptFile.name : <>Drop script here or <span className="file-upload-link">browse</span></>}
                </div>
                <div className="file-upload-desc">PDF, DOCX, or FDX — uploaded as Version 1</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.fdx" hidden
                onChange={e => setScriptFile(e.target.files[0])} />
            </div>

            {error && <div className="field-error">{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/slate/shows')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim()}>
                {submitting ? 'Creating...' : 'Create Show'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
