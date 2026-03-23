/**
 * Show > Edit — edit form for a show's metadata.
 */

import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Alert } from '@shared/components'
import SelectArrow from '@shared/components/SelectArrow'
import { getShow, updateShow, getLookupValues } from '@slate/api'

export default function ShowEdit() {
  const { showId } = useParams()
  const navigate = useNavigate()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [mediums, setMediums] = useState([])
  const [stages, setStages] = useState([])
  const [rightsStatuses, setRightsStatuses] = useState([])

  const [title, setTitle] = useState('')
  const [mediumId, setMediumId] = useState('')
  const [stageId, setStageId] = useState('')
  const [rightsStatusId, setRightsStatusId] = useState('')
  const [genre, setGenre] = useState('')
  const [logline, setLogline] = useState('')
  const [summary, setSummary] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const [showData, mData, sData, rData] = await Promise.all([
          getShow(showId),
          getLookupValues({ category: 'medium' }),
          getLookupValues({ category: 'development_stage' }),
          getLookupValues({ category: 'rights_status' }),
        ])
        setShow(showData)
        setMediums(mData.lookup_values || [])
        setStages(sData.lookup_values || [])
        setRightsStatuses(rData.lookup_values || [])

        setTitle(showData.title || '')
        setMediumId(showData.medium?.id || '')
        setStageId(showData.development_stage?.id || '')
        setRightsStatusId(showData.rights_status?.id || '')
        setGenre(showData.genre || '')
        setLogline(showData.logline || '')
        setSummary(showData.summary || '')
      } catch (err) {
        console.error('Failed to load show:', err)
        setError('Failed to load show data.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [showId])

  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateShow(showId, {
        title: title.trim(),
        medium_id: mediumId ? parseInt(mediumId) : null,
        development_stage_id: stageId ? parseInt(stageId) : null,
        rights_status_id: rightsStatusId ? parseInt(rightsStatusId) : null,
        genre: genre.trim() || null,
        logline: logline.trim() || null,
        summary: summary.trim() || null,
      })
      navigate(`/slate/shows/${showId}/overview`)
    } catch (err) {
      setError(err.message || 'Failed to save changes.')
      setSaving(false)
    }
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  return (
    <div className="page">
      <nav className="breadcrumbs">
        <Link to="/slate/shows" className="breadcrumb">All Shows</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to={`/slate/shows/${showId}/overview`} className="breadcrumb">{show?.title || 'Show'}</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Edit</span>
      </nav>

      <div className="page-header">
        <h1 className="page-title">Edit {show?.title || 'Show'}</h1>
      </div>

      {error && <Alert variant="error" title="Error">{error}</Alert>}

      <form className="form-card" onSubmit={handleSave}>
        <div className="field-stack">
          <div>
            <label className="input-label">Title</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Show title"
            />
          </div>

          <div>
            <label className="input-label">Medium</label>
            <div className="select-wrapper">
              <select className="select" value={mediumId} onChange={e => setMediumId(e.target.value)}>
                <option value="">Not set</option>
                {mediums.map(m => <option key={m.id} value={m.id}>{m.display_label}</option>)}
              </select>
              <SelectArrow />
            </div>
          </div>

          <div>
            <label className="input-label">Development Stage</label>
            <div className="select-wrapper">
              <select className="select" value={stageId} onChange={e => setStageId(e.target.value)}>
                <option value="">Not set</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
              </select>
              <SelectArrow />
            </div>
          </div>

          <div>
            <label className="input-label">Rights Status</label>
            <div className="select-wrapper">
              <select className="select" value={rightsStatusId} onChange={e => setRightsStatusId(e.target.value)}>
                <option value="">Not set</option>
                {rightsStatuses.map(r => <option key={r.id} value={r.id}>{r.display_label}</option>)}
              </select>
              <SelectArrow />
            </div>
          </div>

          <div>
            <label className="input-label">Genre</label>
            <input
              className="input"
              value={genre}
              onChange={e => setGenre(e.target.value)}
              placeholder="e.g. Drama, Comedy, Thriller"
            />
          </div>

          <div>
            <label className="input-label">Logline</label>
            <textarea
              className="textarea"
              value={logline}
              onChange={e => setLogline(e.target.value)}
              placeholder="A one- or two-sentence summary of the show"
              rows={2}
            />
          </div>

          <div>
            <label className="input-label">Summary</label>
            <textarea
              className="textarea"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="A longer description of the show, its themes, and its current state"
              rows={5}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(`/slate/shows/${showId}/overview`)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
