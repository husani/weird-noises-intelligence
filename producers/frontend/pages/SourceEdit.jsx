import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getSource, createSource, updateSource } from '@producers/api'
import { Alert } from '@shared/components'

export default function SourceEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [form, setForm] = useState({ name: '', url: '', description: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (isNew) return
    getSource(id)
      .then(data => {
        if (data.error) { setError(data.error); return }
        setSourceName(data.name)
        setForm({
          name: data.name || '',
          url: data.url || '',
          description: data.description || '',
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setTouched(prev => ({ ...prev, name: true }))
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const result = await createSource(form)
        if (result.error) { setError(result.error); setSaving(false); return }
        navigate(`/producers/data-sources/${result.id}`)
      } else {
        await updateSource(id, form)
        navigate(`/producers/data-sources/${id}`)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  const nameError = touched.name && !form.name.trim()

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/data-sources" className="breadcrumb">Data Sources</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        {isNew ? (
          <span className="breadcrumb-current">New</span>
        ) : (
          <>
            <Link to={`/producers/data-sources/${id}`} className="breadcrumb">{sourceName}</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span className="breadcrumb-current">Edit</span>
          </>
        )}
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? 'New Data Source' : `Edit ${sourceName}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Name *</label>
          <input
            className={`input input-full${nameError ? ' input-error' : ''}`}
            placeholder="Source name"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
          />
          {nameError && <div className="field-error">Name is required</div>}
        </div>

        <div className="form-field">
          <label className="input-label">URL</label>
          <input
            className="input input-full"
            placeholder="https://..."
            value={form.url}
            onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Description</label>
          <textarea
            className="textarea textarea-full"
            placeholder="What does this source cover?"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="form-actions">
          <Link
            to={isNew ? '/producers/data-sources' : `/producers/data-sources/${id}`}
            className="btn btn-ghost"
          >
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Data Source' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
