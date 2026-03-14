import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getTag, createTag, updateTag } from '@producers/api'
import { Alert } from '@shared/components'

export default function TagEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tagName, setTagName] = useState('')
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (isNew) return
    getTag(id)
      .then(data => {
        if (data.error) { setError(data.error); return }
        setTagName(data.name)
        setForm({
          name: data.name || '',
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
        const result = await createTag(form)
        if (result.error) { setError(result.error); setSaving(false); return }
        navigate(`/producers/tags/${result.id}`)
      } else {
        await updateTag(id, form)
        navigate(`/producers/tags/${id}`)
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
        <Link to="/producers/tags" className="breadcrumb">Tags</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        {isNew ? (
          <span className="breadcrumb-current">New</span>
        ) : (
          <>
            <Link to={`/producers/tags/${id}`} className="breadcrumb">{tagName}</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span className="breadcrumb-current">Edit</span>
          </>
        )}
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? 'New Tag' : `Edit ${tagName}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Name *</label>
          <input
            className={`input input-full${nameError ? ' input-error' : ''}`}
            placeholder="Tag name"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
          />
          {nameError && <div className="field-error">Name is required</div>}
        </div>

        <div className="form-field">
          <label className="input-label">Description</label>
          <textarea
            className="textarea textarea-full"
            placeholder="What is this tag used for?"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="form-actions">
          <Link
            to={isNew ? '/producers/tags' : `/producers/tags/${id}`}
            className="btn btn-ghost"
          >
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Tag' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
