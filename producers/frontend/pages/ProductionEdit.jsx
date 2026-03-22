import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getProductionDetail, getShow, createProduction, updateProduction, listVenues } from '@producers/api'
import { Alert } from '@shared/components'
import { useLookupValues } from '@shared/hooks/useLookupValues'

/* ── Venue search typeahead ── */

function VenueSearch({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      listVenues({ search: query, limit: 8 })
        .then(d => {
          setResults(d.venues || [])
          setOpen((d.venues || []).length > 0)
        })
        .catch(() => {})
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  if (value) {
    return (
      <div className="producer-search-selected">
        <span className="cell-strong">{value.name}</span>
        <button type="button" className="producer-search-clear" onClick={() => { onChange(null); setQuery('') }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="producer-search">
      <input
        className="input input-full"
        placeholder="Search venues..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="producer-search-dropdown">
          {results.map(v => (
            <div key={v.id} className="producer-search-option" onClick={() => { onChange(v); setOpen(false); setQuery('') }}>
              <span className="cell-strong">{v.name}</span>
              {[v.city, v.state_region, v.country].filter(Boolean).length > 0 && (
                <span className="cell-muted"> — {[v.city, v.state_region, v.country].filter(Boolean).join(', ')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */

export default function ProductionEdit() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !id
  const { values: scaleValues } = useLookupValues('scale', 'production')
  const { values: productionTypeValues } = useLookupValues('production_type', 'production')
  const { values: budgetTierValues } = useLookupValues('budget_tier', 'production')
  const { values: fundingTypeValues } = useLookupValues('funding_type', 'production')
  const [form, setForm] = useState({ year: '', scale_id: '', run_length: '', description: '', production_type_id: '', capitalization: '', budget_tier_id: '', recouped: '', funding_type_id: '' })
  const [show, setShow] = useState(null)
  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isNew) {
      const showId = searchParams.get('show_id')
      if (showId) {
        getShow(showId)
          .then(data => {
            if (!data.error) setShow(data)
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    } else {
      getProductionDetail(id)
        .then(data => {
          if (data.error) { setError(data.error); return }
          setForm({
            year: data.year || '',
            scale_id: data.scale?.id || '',
            run_length: data.run_length || '',
            description: data.description || '',
            production_type_id: data.production_type?.id || '',
            capitalization: data.capitalization || '',
            budget_tier_id: data.budget_tier?.id || '',
            recouped: data.recouped != null ? String(data.recouped) : '',
            funding_type_id: data.funding_type?.id || '',
          })
          if (data.show) setShow(data.show)
          if (data.venue) setVenue(data.venue)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [id, isNew, searchParams])

  const backUrl = show ? `/producers/shows/${show.id}` : '/producers/shows'

  async function handleSave(e) {
    e.preventDefault()
    if (!show) {
      setError('Show is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        year: form.year ? parseInt(form.year, 10) : null,
        scale_id: form.scale_id ? parseInt(form.scale_id, 10) : null,
        show_id: show.id,
        venue_id: venue ? venue.id : null,
        production_type_id: form.production_type_id ? parseInt(form.production_type_id, 10) : null,
        capitalization: form.capitalization ? parseInt(form.capitalization, 10) : null,
        budget_tier_id: form.budget_tier_id ? parseInt(form.budget_tier_id, 10) : null,
        recouped: form.recouped === '' ? null : form.recouped === 'true',
        funding_type_id: form.funding_type_id ? parseInt(form.funding_type_id, 10) : null,
      }
      if (isNew) {
        await createProduction(payload)
      } else {
        await updateProduction(id, payload)
      }
      navigate(backUrl)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  const showTitle = show ? show.title : 'Production'

  return (
    <>
      <div className="breadcrumbs">
        <Link to="/producers/shows" className="breadcrumb">Shows</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        {show && (
          <>
            <Link to={`/producers/shows/${show.id}`} className="breadcrumb">{show.title}</Link>
            <span className="breadcrumb-sep">&rsaquo;</span>
          </>
        )}
        <span className="breadcrumb-current">{isNew ? 'New Production' : 'Edit Production'}</span>
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? `New Production of ${showTitle}` : `Edit Production of ${showTitle}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="form-field">
          <label className="input-label">Year</label>
          <input
            className="input input-full"
            type="number"
            placeholder="e.g. 2024"
            value={form.year}
            onChange={e => setForm(prev => ({ ...prev, year: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Scale</label>
          <div className="select-wrapper">
            <select className="select" value={form.scale_id} onChange={e => setForm(prev => ({ ...prev, scale_id: e.target.value }))}>
              <option value="">Select...</option>
              {scaleValues.map(s => <option key={s.id} value={s.id}>{s.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-field">
          <label className="input-label">Venue</label>
          <VenueSearch value={venue} onChange={setVenue} />
        </div>

        <div className="form-field">
          <label className="input-label">Run Length</label>
          <input
            className="input input-full"
            placeholder="e.g. 12 weeks, open-ended..."
            value={form.run_length}
            onChange={e => setForm(prev => ({ ...prev, run_length: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Description</label>
          <textarea
            className="textarea textarea-full"
            placeholder="Description of this production..."
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Production Type</label>
          <div className="select-wrapper">
            <select className="select" value={form.production_type_id} onChange={e => setForm(prev => ({ ...prev, production_type_id: e.target.value }))}>
              <option value="">Select...</option>
              {productionTypeValues.map(v => <option key={v.id} value={v.id}>{v.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-field">
          <label className="input-label">Capitalization ($)</label>
          <input
            className="input input-full"
            type="number"
            placeholder="e.g. 5000000"
            value={form.capitalization}
            onChange={e => setForm(prev => ({ ...prev, capitalization: e.target.value }))}
          />
        </div>

        <div className="form-field">
          <label className="input-label">Budget Tier</label>
          <div className="select-wrapper">
            <select className="select" value={form.budget_tier_id} onChange={e => setForm(prev => ({ ...prev, budget_tier_id: e.target.value }))}>
              <option value="">Select...</option>
              {budgetTierValues.map(v => <option key={v.id} value={v.id}>{v.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-field">
          <label className="input-label">Recouped</label>
          <div className="select-wrapper">
            <select className="select" value={form.recouped} onChange={e => setForm(prev => ({ ...prev, recouped: e.target.value }))}>
              <option value="">Unknown</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-field">
          <label className="input-label">Funding Type</label>
          <div className="select-wrapper">
            <select className="select" value={form.funding_type_id} onChange={e => setForm(prev => ({ ...prev, funding_type_id: e.target.value }))}>
              <option value="">Select...</option>
              {fundingTypeValues.map(v => <option key={v.id} value={v.id}>{v.display_label}</option>)}
            </select>
            <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
          </div>
        </div>

        <div className="form-actions">
          <Link to={backUrl} className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Production' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
