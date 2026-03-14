import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProducer, checkDuplicates, listOrganizations, extractUrl, listSocialPlatforms } from '@producers/api'
import LocationAutocomplete from '@shared/components/LocationAutocomplete'

function ChipInput({ value = [], onChange, placeholder = 'Add tag...' }) {
  const [inputVal, setInputVal] = useState('')

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = inputVal.trim().replace(/,$/, '')
      if (tag && !value.includes(tag)) {
        onChange([...value, tag])
      }
      setInputVal('')
    } else if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function removeTag(tag) {
    onChange(value.filter(t => t !== tag))
  }

  return (
    <div className="chip-input-wrapper" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
      {value.map(tag => (
        <span key={tag} className="chip">
          {tag}
          <button type="button" className="chip-remove" onClick={() => removeTag(tag)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        className="chip-input"
        placeholder={value.length === 0 ? placeholder : ''}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function OrgAutocomplete({ value, onChange, onRoleChange, role }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(() => {
      listOrganizations({ search: query, limit: 8 })
        .then(data => setSuggestions(data.organizations || []))
        .catch(() => {})
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  return (
    <div className="form-grid-2col-sm">
      <div className="relative">
        <label className="input-label">Organization</label>
        <input
          className="input"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setShowSuggestions(true) }}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Type to search..."
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="autocomplete-dropdown">
            {suggestions.map(org => (
              <div
                key={org.id}
                className="autocomplete-option"
                onMouseDown={() => { setQuery(org.name); onChange(org.name); setShowSuggestions(false) }}
              >
                {org.name}
                {org.org_type && <span className="cell-muted ml-8 fs-meta">{org.org_type}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="input-label">Role at Organization</label>
        <input className="input" value={role} onChange={e => onRoleChange(e.target.value)} placeholder="e.g. Executive Producer" />
      </div>
    </div>
  )
}

export default function AddProducer() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    organization: '', org_role: '',
    city: '', state_region: '', country: '',
    website: '', social_links: [],
    intake_source: 'manual', intake_source_url: '', notes: '',
  })
  const [tags, setTags] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [extracting, setExtracting] = useState(false)
  const [platforms, setPlatforms] = useState([])
  const [newLink, setNewLink] = useState({ platform: '', url: '' })

  useEffect(() => {
    listSocialPlatforms().then(data => setPlatforms(Array.isArray(data) ? data : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.last_name.length < 2) { setDuplicates([]); return }
    const timer = setTimeout(() => {
      checkDuplicates(form.first_name, form.last_name, form.email, form.organization).then(setDuplicates).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [form.first_name, form.last_name, form.email, form.organization])

  function update(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function clearError(field) {
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const errors = {}
    if (!form.first_name.trim()) errors.first_name = 'First name is required'
    if (!form.last_name.trim()) errors.last_name = 'Last name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email address'
    if (form.intake_source_url && !/^https?:\/\/.+/.test(form.intake_source_url)) errors.intake_source_url = 'Must start with http:// or https://'
    return errors
  }

  async function handleExtractUrl() {
    const url = form.intake_source_url
    if (!url || !/^https?:\/\/.+/.test(url)) return
    setExtracting(true)
    setError(null)
    try {
      const data = await extractUrl(url)
      if (data.error) {
        setError(data.error)
      } else {
        setForm(prev => ({
          ...prev,
          first_name: data.first_name || prev.first_name,
          last_name: data.last_name || prev.last_name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          organization: data.organization || prev.organization,
          org_role: data.org_role || prev.org_role,
          city: data.city || prev.city,
          state_region: data.state_region || prev.state_region,
          country: data.country || prev.country,
          website: data.website || prev.website,
          social_links: data.social_links ? [...prev.social_links, ...data.social_links] : prev.social_links,
          notes: data.notes || prev.notes,
          intake_source: 'url',
        }))
      }
    } catch (err) {
      setError(err.message)
    }
    setExtracting(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSubmitting(true)
    setError(null)
    try {
      const data = { ...form, tags }
      const result = await createProducer(data)
      navigate(`/producers/detail/${result.id}`)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  return (
    <>
      <div className="breadcrumbs">
        <span className="breadcrumb" onClick={() => navigate('/producers/list')}>Producers</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Add Producer</span>
      </div>

      <div className="page-header">
        <h1 className="page-title">Add Producer</h1>
        <p className="page-subtitle">Create a new producer record manually or extract from a URL</p>
      </div>

      {/* URL extraction — featured prominently */}
      <div className="section-card section-card--accent-blue mb-24">
        <div className="extract-layout">
          <div className="surfacing-icon surfacing-icon-blue extract-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div className="extract-section-body">
            <div className="extract-title">Quick start from URL</div>
            <div className="edit-hint extract-hint">
              Paste a Playbill article, BroadwayWorld page, LinkedIn profile, or any URL — the AI will extract producer details.
            </div>
            <div className="extract-input-row">
              <input
                className={`input extract-url-input${fieldErrors.intake_source_url ? ' input-error' : ''}`}
                placeholder="https://..."
                value={form.intake_source_url}
                onChange={e => {
                  update('intake_source_url')(e)
                  setForm(prev => ({ ...prev, intake_source: e.target.value ? 'url' : 'manual' }))
                  clearError('intake_source_url')
                }}
              />
              <button type="button" className="btn btn-primary nowrap"
                onClick={handleExtractUrl}
                disabled={extracting || !form.intake_source_url || !/^https?:\/\/.+/.test(form.intake_source_url)}>
                {extracting ? (
                  <span className="btn-inline-spinner">
                    <div className="loading-spinner spinner-sm" /> Extracting...
                  </span>
                ) : 'Extract Info'}
              </button>
            </div>
            {fieldErrors.intake_source_url && <div className="field-error">{fieldErrors.intake_source_url}</div>}
          </div>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicates.length > 0 && (
        <div className="alert alert-error alert-compact-24">
          <div className="alert-content">
            <div className="alert-title">Possible duplicates found</div>
            <div className="dup-list">
              {duplicates.map(d => (
                <div key={d.id} className="dup-item">
                  <div className="dup-avatar">
                    {(d.first_name?.[0] || '') + (d.last_name?.[0] || '')}
                  </div>
                  <div className="dup-body">
                    <span className="link value-bold" onClick={() => navigate(`/producers/detail/${d.id}`)}>
                      {d.first_name} {d.last_name}
                    </span>
                    {d.current_organization && <span className="cell-muted ml-6">{d.current_organization}</span>}
                  </div>
                  <span className="badge badge-rose">{d.match_type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error alert-compact-24">
          <div className="alert-content"><div className="alert-title">{error}</div></div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-container">
          {/* Identity — Name + Organization */}
          <div className="section-card section-mb-20">
            <div className="section-card-header">
              <div className="section-card-title">Identity</div>
            </div>
            <div className="form-grid-2col mb-20">
              <div>
                <label className="input-label">First Name *</label>
                <input className={`input${fieldErrors.first_name ? ' input-error' : ''}`} value={form.first_name} onChange={e => { update('first_name')(e); clearError('first_name') }} />
                {fieldErrors.first_name && <div className="field-error">{fieldErrors.first_name}</div>}
              </div>
              <div>
                <label className="input-label">Last Name *</label>
                <input className={`input${fieldErrors.last_name ? ' input-error' : ''}`} value={form.last_name} onChange={e => { update('last_name')(e); clearError('last_name') }} />
                {fieldErrors.last_name && <div className="field-error">{fieldErrors.last_name}</div>}
              </div>
            </div>
            <OrgAutocomplete
              value={form.organization}
              onChange={val => setForm(prev => ({ ...prev, organization: val }))}
              role={form.org_role}
              onRoleChange={val => setForm(prev => ({ ...prev, org_role: val }))}
            />
          </div>

          {/* Contact + Location */}
          <div className="section-card section-mb-20">
            <div className="section-card-header">
              <div className="section-card-title">Contact & Location</div>
            </div>
            <div className="form-grid-2col mb-20">
              <div>
                <label className="input-label">Email</label>
                <input className={`input${fieldErrors.email ? ' input-error' : ''}`} type="email" value={form.email} onChange={e => { update('email')(e); clearError('email') }} />
                {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
              </div>
              <div>
                <label className="input-label">Phone</label>
                <input className="input" value={form.phone} onChange={update('phone')} />
              </div>
            </div>
            <LocationAutocomplete
              city={form.city}
              stateRegion={form.state_region}
              country={form.country}
              onChange={loc => setForm(prev => ({ ...prev, city: loc.city, state_region: loc.state_region, country: loc.country }))}
            />
          </div>

          {/* Online profiles */}
          <div className="section-card section-mb-20">
            <div className="section-card-header">
              <div className="section-card-title">Online</div>
            </div>
            <div className="form-field">
              <label className="input-label">Website</label>
              <input className="input input-full" value={form.website} onChange={update('website')} placeholder="https://..." />
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
          </div>

          {/* Notes & Tags */}
          <div className="section-card mb-24">
            <div className="section-card-header">
              <div className="section-card-title">Notes & Tags</div>
            </div>
            <div className="mb-16">
              <label className="input-label">Notes</label>
              <textarea className="textarea textarea-full" placeholder="How you know them, context..." value={form.notes} onChange={update('notes')} />
            </div>
            <div>
              <label className="input-label">Tags</label>
              <ChipInput value={tags} onChange={setTags} placeholder="Type a tag and press Enter" />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Producer'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/producers/list')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
