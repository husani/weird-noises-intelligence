import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getOrganization, createOrganization, updateOrganization, listSocialPlatforms } from '@producers/api'
import { Alert } from '@shared/components'
import LocationAutocomplete from '@shared/components/LocationAutocomplete'
import { useLookupValues } from '@shared/hooks/useLookupValues'

export default function OrganizationEdit() {
  const { values: orgTypeValues } = useLookupValues('org_type', 'organization')
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [form, setForm] = useState({ name: '', org_type_id: '', website: '', city: '', state_region: '', country: '', description: '', social_links: [] })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [orgName, setOrgName] = useState('')
  const [touched, setTouched] = useState({})
  const [newLink, setNewLink] = useState({ platform: '', url: '' })
  const [platforms, setPlatforms] = useState([])

  useEffect(() => {
    if (isNew) return
    getOrganization(id)
      .then(data => {
        if (data.error) { setError(data.error); return }
        setOrgName(data.name)
        setForm({
          name: data.name || '',
          org_type_id: data.org_type?.id || '',
          website: data.website || '',
          city: data.city || '',
          state_region: data.state_region || '',
          country: data.country || '',
          description: data.description || '',
          social_links: data.social_links || [],
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  useEffect(() => {
    listSocialPlatforms().then(data => setPlatforms(Array.isArray(data) ? data : data.platforms || [])).catch(() => {})
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setTouched(prev => ({ ...prev, name: true }))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        org_type_id: form.org_type_id ? parseInt(form.org_type_id, 10) : null,
      }
      if (isNew) {
        const result = await createOrganization(payload)
        navigate(`/producers/organizations/${result.id}`)
      } else {
        await updateOrganization(id, payload)
        navigate(`/producers/organizations/${id}`)
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
        <Link to="/producers/organizations" className="breadcrumb">Organizations</Link>
        <span className="breadcrumb-sep">›</span>
        {isNew ? (
          <span className="breadcrumb-current">New</span>
        ) : (
          <>
            <Link to={`/producers/organizations/${id}`} className="breadcrumb">{orgName}</Link>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Edit</span>
          </>
        )}
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? 'New Organization' : `Edit ${orgName}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Name *</label>
          <input
            className={`input input-full${nameError ? ' input-error' : ''}`}
            placeholder="Organization name"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
          />
          {nameError && <div className="field-error">Name is required</div>}
        </div>

        <div className="form-field">
          <label className="input-label">Type</label>
          <div className="select-wrapper">
            <select className="select" value={form.org_type_id} onChange={e => setForm(prev => ({ ...prev, org_type_id: e.target.value }))}>
              <option value="">Select...</option>
              {orgTypeValues.map(t => <option key={t.id} value={t.id}>{t.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-field">
          <label className="input-label">Website</label>
          <input
            className="input input-full"
            placeholder="https://..."
            value={form.website}
            onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Location</label>
          <LocationAutocomplete
            city={form.city}
            stateRegion={form.state_region}
            country={form.country}
            onChange={loc => setForm(prev => ({ ...prev, city: loc.city, state_region: loc.state_region, country: loc.country }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Profiles & Social Links</label>
          {form.social_links.length > 0 && (
            <div className="chip-input-wrapper social-links-edit">
              {form.social_links.map((link, i) => (
                <div className="chip" key={i} title={link.url}>
                  {link.platform}
                  <div className="chip-remove" onClick={() => setForm(prev => ({ ...prev, social_links: prev.social_links.filter((_, j) => j !== i) }))}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5"/></svg>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="social-link-add-row">
            <div className="select-wrapper social-link-platform">
              <select className="select" value={newLink.platform} onChange={e => setNewLink(prev => ({ ...prev, platform: e.target.value }))}>
                <option value="">Platform...</option>
                {platforms.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
            </div>
            <input
              className="input social-link-url"
              placeholder="https://..."
              value={newLink.url}
              onChange={e => setNewLink(prev => ({ ...prev, url: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter' && newLink.platform && newLink.url.trim()) {
                  e.preventDefault()
                  setForm(prev => ({ ...prev, social_links: [...prev.social_links, { platform: newLink.platform, url: newLink.url.trim() }] }))
                  setNewLink({ platform: '', url: '' })
                }
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!newLink.platform || !newLink.url.trim()}
              onClick={() => {
                setForm(prev => ({ ...prev, social_links: [...prev.social_links, { platform: newLink.platform, url: newLink.url.trim() }] }))
                setNewLink({ platform: '', url: '' })
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="form-field">
          <label className="input-label">Description</label>
          <textarea
            className="textarea textarea-full"
            placeholder="What does this organization do?"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="form-actions">
          <Link
            to={isNew ? '/producers/organizations' : `/producers/organizations/${id}`}
            className="btn btn-ghost"
          >
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Organization' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
