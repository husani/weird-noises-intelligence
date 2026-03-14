import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getShow, createShow, updateShow } from '@producers/api'
import { Alert } from '@shared/components'
import { useLookupValues } from '@shared/hooks/useLookupValues'

export default function ShowEdit() {
  const { values: mediumValues } = useLookupValues('medium', 'show')
  const { values: workOriginValues } = useLookupValues('work_origin', 'show')
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [form, setForm] = useState({ title: '', medium_id: '', original_year: '', description: '', genre: '', themes: '', summary: '', work_origin_id: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showTitle, setShowTitle] = useState('')
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (isNew) return
    getShow(id)
      .then(data => {
        if (data.error) { setError(data.error); return }
        setShowTitle(data.title)
        setForm({
          title: data.title || '',
          medium_id: data.medium?.id || '',
          original_year: data.original_year || '',
          description: data.description || '',
          genre: data.genre || '',
          themes: data.themes || '',
          summary: data.summary || '',
          work_origin_id: data.work_origin?.id || '',
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setTouched(prev => ({ ...prev, title: true }))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title: form.title.trim(),
        medium_id: form.medium_id ? parseInt(form.medium_id, 10) : null,
        original_year: form.original_year ? parseInt(form.original_year, 10) : null,
        description: form.description.trim() || null,
        genre: form.genre.trim() || null,
        themes: form.themes.trim() || null,
        summary: form.summary.trim() || null,
        work_origin_id: form.work_origin_id ? parseInt(form.work_origin_id, 10) : null,
      }
      if (isNew) {
        const result = await createShow(payload)
        navigate(`/producers/shows/${result.id}`)
      } else {
        await updateShow(id, payload)
        navigate(`/producers/shows/${id}`)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  const titleError = touched.title && !form.title.trim()

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/shows" className="breadcrumb">Shows</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        {isNew ? (
          <span className="breadcrumb-current">New</span>
        ) : (
          <>
            <Link to={`/producers/shows/${id}`} className="breadcrumb">{showTitle}</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span className="breadcrumb-current">Edit</span>
          </>
        )}
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? 'New Show' : `Edit ${showTitle}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Title *</label>
          <input
            className={`input input-full${titleError ? ' input-error' : ''}`}
            placeholder="Show title"
            value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            onBlur={() => setTouched(prev => ({ ...prev, title: true }))}
          />
          {titleError && <div className="field-error">Title is required</div>}
        </div>

        <div className="form-field">
          <label className="input-label">Medium</label>
          <div className="select-wrapper">
            <select className="select" value={form.medium_id} onChange={e => setForm(prev => ({ ...prev, medium_id: e.target.value }))}>
              <option value="">Select...</option>
              {mediumValues.map(m => <option key={m.id} value={m.id}>{m.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-field">
          <label className="input-label">Original Year</label>
          <input
            className="input"
            type="number"
            placeholder="e.g. 2015"
            value={form.original_year}
            onChange={e => setForm(prev => ({ ...prev, original_year: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Description</label>
          <textarea
            className="textarea textarea-full"
            placeholder="What is this show about?"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Genre</label>
          <textarea
            className="textarea textarea-full"
            placeholder="Genre description..."
            value={form.genre}
            onChange={e => setForm(prev => ({ ...prev, genre: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Themes</label>
          <textarea
            className="textarea textarea-full"
            placeholder="Key themes..."
            value={form.themes}
            onChange={e => setForm(prev => ({ ...prev, themes: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Summary</label>
          <textarea
            className="textarea textarea-full"
            placeholder="Summary of the show..."
            value={form.summary}
            onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Work Origin</label>
          <div className="select-wrapper">
            <select className="select" value={form.work_origin_id} onChange={e => setForm(prev => ({ ...prev, work_origin_id: e.target.value }))}>
              <option value="">Select...</option>
              {workOriginValues.map(w => <option key={w.id} value={w.id}>{w.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-actions">
          <Link
            to={isNew ? '/producers/shows' : `/producers/shows/${id}`}
            className="btn btn-ghost"
          >
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Show' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
