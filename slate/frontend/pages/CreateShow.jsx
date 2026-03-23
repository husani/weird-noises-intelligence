/**
 * Create Show — form for creating a new WN show.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SelectArrow from '@shared/components/SelectArrow'
import { createShow, getLookupValues } from '@slate/api'

export default function CreateShow() {
  const [form, setForm] = useState({
    title: '',
    medium_id: '',
    genre: '',
    logline: '',
    summary: '',
    rights_status_id: '',
    development_stage_id: '',
  })
  const [mediums, setMediums] = useState([])
  const [stages, setStages] = useState([])
  const [rightsStatuses, setRightsStatuses] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

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

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const data = {
        title: form.title.trim(),
        medium_id: form.medium_id ? parseInt(form.medium_id) : null,
        genre: form.genre || null,
        logline: form.logline || null,
        summary: form.summary || null,
        rights_status_id: form.rights_status_id ? parseInt(form.rights_status_id) : null,
        development_stage_id: form.development_stage_id ? parseInt(form.development_stage_id) : null,
      }
      const result = await createShow(data)
      navigate(`/slate/shows/${result.id}/overview`)
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
          <p className="page-subtitle">Add a new project to the slate</p>
        </div>
      </div>

      <div className="section-card">
        <form onSubmit={handleSubmit}>
          <div className="field-stack">
            <div>
              <label className="input-label">Title *</label>
              <input className="input" value={form.title}
                onChange={e => update('title', e.target.value)} placeholder="Show title" autoFocus />
            </div>

            <div>
              <label className="input-label">Medium</label>
              <div className="select-wrapper">
                <select className="select" value={form.medium_id}
                  onChange={e => update('medium_id', e.target.value)}>
                  <option value="">Select medium...</option>
                  {mediums.map(m => <option key={m.id} value={m.id}>{m.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>

            <div>
              <label className="input-label">Rights Status</label>
              <div className="select-wrapper">
                <select className="select" value={form.rights_status_id}
                  onChange={e => update('rights_status_id', e.target.value)}>
                  <option value="">Select rights status...</option>
                  {rightsStatuses.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>

            <div>
              <label className="input-label">Development Stage</label>
              <div className="select-wrapper">
                <select className="select" value={form.development_stage_id}
                  onChange={e => update('development_stage_id', e.target.value)}>
                  <option value="">Select stage...</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>

            <div>
              <label className="input-label">Genre</label>
              <input className="input" value={form.genre}
                onChange={e => update('genre', e.target.value)} placeholder="e.g. political satire, family drama" />
            </div>

            <div>
              <label className="input-label">Logline</label>
              <textarea className="textarea" value={form.logline}
                onChange={e => update('logline', e.target.value)}
                placeholder="One-to-two sentence pitch" rows={2} />
            </div>

            <div>
              <label className="input-label">Summary</label>
              <textarea className="textarea" value={form.summary}
                onChange={e => update('summary', e.target.value)}
                placeholder="Longer description" rows={4} />
            </div>

            {error && <div className="field-error">{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/slate/shows')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !form.title.trim()}>
                {submitting ? 'Creating...' : 'Create Show'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
