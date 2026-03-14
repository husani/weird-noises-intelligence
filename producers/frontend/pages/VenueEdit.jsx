import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getVenue, createVenue, updateVenue } from '@producers/api'
import { Alert } from '@shared/components'
import LocationAutocomplete from '@shared/components/LocationAutocomplete'
import { useLookupValues } from '@shared/hooks/useLookupValues'

export default function VenueEdit() {
  const { values: venueTypeValues } = useLookupValues('venue_type', 'venue')
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [form, setForm] = useState({ name: '', venue_type_id: '', city: '', state_region: '', country: '', capacity: '', description: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [venueName, setVenueName] = useState('')
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (isNew) return
    getVenue(id)
      .then(data => {
        if (data.error) { setError(data.error); return }
        setVenueName(data.name)
        setForm({
          name: data.name || '',
          venue_type_id: data.venue_type?.id || '',
          city: data.city || '',
          state_region: data.state_region || '',
          country: data.country || '',
          capacity: data.capacity || '',
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
      const payload = {
        ...form,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        venue_type_id: form.venue_type_id ? parseInt(form.venue_type_id, 10) : null,
      }
      if (isNew) {
        const result = await createVenue(payload)
        navigate(`/producers/venues/${result.id}`)
      } else {
        await updateVenue(id, payload)
        navigate(`/producers/venues/${id}`)
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
        <Link to="/producers/venues" className="breadcrumb">Venues</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        {isNew ? (
          <span className="breadcrumb-current">New</span>
        ) : (
          <>
            <Link to={`/producers/venues/${id}`} className="breadcrumb">{venueName}</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span className="breadcrumb-current">Edit</span>
          </>
        )}
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? 'New Venue' : `Edit ${venueName}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Name *</label>
          <input
            className={`input input-full${nameError ? ' input-error' : ''}`}
            placeholder="Venue name"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
          />
          {nameError && <div className="field-error">Name is required</div>}
        </div>

        <div className="form-field">
          <label className="input-label">Type</label>
          <div className="select-wrapper">
            <select className="select" value={form.venue_type_id} onChange={e => setForm(prev => ({ ...prev, venue_type_id: e.target.value }))}>
              <option value="">Select...</option>
              {venueTypeValues.map(t => <option key={t.id} value={t.id}>{t.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
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
          <label className="input-label">Capacity</label>
          <input
            className="input input-full"
            type="number"
            placeholder="Seating capacity"
            value={form.capacity}
            onChange={e => setForm(prev => ({ ...prev, capacity: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Description</label>
          <textarea
            className="textarea textarea-full"
            placeholder="Any additional details about this venue..."
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="form-actions">
          <Link
            to={isNew ? '/producers/venues' : `/producers/venues/${id}`}
            className="btn btn-ghost"
          >
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Venue' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
