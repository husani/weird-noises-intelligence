import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getSocialPlatform, createSocialPlatform, updateSocialPlatform } from '@producers/api'
import { Alert, PlatformIcon } from '@shared/components'

function parseSvgFile(text) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) return null
  return svg.innerHTML.trim()
}

export default function SocialPlatformEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [form, setForm] = useState({ name: '', base_url: '', icon_svg: '', description: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [platformName, setPlatformName] = useState('')
  const [touched, setTouched] = useState({})
  const [showMarkup, setShowMarkup] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isNew) return
    getSocialPlatform(id)
      .then(data => {
        if (data.error) { setError(data.error); return }
        setPlatformName(data.name)
        setForm({
          name: data.name || '',
          base_url: data.base_url || '',
          icon_svg: data.icon_svg || '',
          description: data.description || '',
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function handleFile(file) {
    if (!file || !file.name.endsWith('.svg')) return
    const reader = new FileReader()
    reader.onload = e => {
      const inner = parseSvgFile(e.target.result)
      if (inner) setForm(prev => ({ ...prev, icon_svg: inner }))
    }
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    handleFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

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
        const result = await createSocialPlatform(form)
        navigate(`/producers/social-platforms/${result.id}`)
      } else {
        await updateSocialPlatform(id, form)
        navigate(`/producers/social-platforms/${id}`)
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
  const hasIcon = !!form.icon_svg.trim()

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/social-platforms" className="breadcrumb">Social Platforms</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        {isNew ? (
          <span className="breadcrumb-current">New</span>
        ) : (
          <>
            <Link to={`/producers/social-platforms/${id}`} className="breadcrumb">{platformName}</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span className="breadcrumb-current">Edit</span>
          </>
        )}
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? 'New Platform' : `Edit ${platformName}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Name *</label>
          <input
            className={`input input-full${nameError ? ' input-error' : ''}`}
            placeholder="Platform name"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
          />
          {nameError && <div className="field-error">Name is required</div>}
        </div>

        <div className="form-field">
          <label className="input-label">Base URL</label>
          <input
            className="input input-full"
            placeholder="https://..."
            value={form.base_url}
            onChange={e => setForm(prev => ({ ...prev, base_url: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Icon</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg"
            className="sr-only"
            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }}
          />

          {hasIcon ? (
            <div className="icon-upload-preview">
              <PlatformIcon svg={form.icon_svg} size={48} />
              <div className="icon-upload-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>Replace</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(prev => ({ ...prev, icon_svg: '' }))}>Remove</button>
              </div>
            </div>
          ) : (
            <div
              className={`icon-upload-zone${dragOver ? ' icon-upload-drag' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setDragOver(false)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Upload SVG</span>
            </div>
          )}

          <button type="button" className="link-subtle" onClick={() => setShowMarkup(!showMarkup)}>
            {showMarkup ? 'Hide markup' : 'Edit markup'}
          </button>
          {showMarkup && (
            <textarea
              className="textarea textarea-full textarea-code"
              placeholder='SVG inner content, e.g. <rect x="2" y="2" width="20" height="20" rx="5" />'
              rows={3}
              value={form.icon_svg}
              onChange={e => setForm(prev => ({ ...prev, icon_svg: e.target.value }))}
            />
          )}
        </div>

        <div className="form-field">
          <label className="input-label">Description</label>
          <textarea
            className="textarea textarea-full"
            placeholder="What is this platform used for?"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="form-actions">
          <Link
            to={isNew ? '/producers/social-platforms' : `/producers/social-platforms/${id}`}
            className="btn btn-ghost"
          >
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Platform' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
