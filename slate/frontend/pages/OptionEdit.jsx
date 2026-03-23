/**
 * Option Edit — create or edit a single lookup value.
 * Same pattern as Producers OptionEdit.
 */

import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert } from '@shared/components'
import { getLookupValue, createLookupValue, updateLookupValue } from '@slate/api'
import { NAV_SECTIONS, ALL_GROUPS } from './OptionsPage'

function findGroupLabel(category, entityType) {
  const group = ALL_GROUPS.find(g => g.category === category && g.entity_type === entityType)
  return group ? group.label : category
}

const BADGE_OPTIONS = [
  { value: 'badge-warm', label: 'Warm' },
  { value: 'badge-sage', label: 'Sage' },
  { value: 'badge-rose', label: 'Rose' },
  { value: 'badge-blue', label: 'Blue' },
  { value: 'badge-teal', label: 'Teal' },
  { value: 'badge-lavender', label: 'Lavender' },
  { value: 'badge-neutral', label: 'Neutral' },
  { value: null, label: 'None' },
]

function BadgePicker({ value, onChange }) {
  return (
    <div className="options-badge-picker">
      {BADGE_OPTIONS.map(opt => (
        <button
          key={opt.value || 'none'}
          type="button"
          className={`options-badge-swatch${value === opt.value ? ' selected' : ''} ${opt.value ? `badge ${opt.value}` : 'options-badge-none'}`}
          onClick={() => onChange(opt.value)}
          title={opt.label}
        >
          {opt.value ? '' : '\u2014'}
        </button>
      ))}
    </div>
  )
}

export default function OptionEdit() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !id

  const [form, setForm] = useState({
    value: '',
    display_label: '',
    description: '',
    css_class: null,
    category: searchParams.get('category') || '',
    entity_type: searchParams.get('entity_type') || '',
  })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [itemName, setItemName] = useState('')
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (isNew) return
    getLookupValue(id)
      .then(data => {
        if (data.error) { setError(data.error); return }
        setItemName(data.display_label)
        setForm({
          value: data.value || '',
          display_label: data.display_label || '',
          description: data.description || '',
          css_class: data.css_class || null,
          category: data.category || '',
          entity_type: data.entity_type || '',
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const groupLabel = findGroupLabel(form.category, form.entity_type)
  const backUrl = `/slate/options?selected=${encodeURIComponent(`${form.category}:${form.entity_type}`)}`

  async function handleSave(e) {
    e.preventDefault()
    if (!form.value.trim() || !form.display_label.trim()) {
      setTouched({ value: true, display_label: true })
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        value: form.value.trim(),
        display_label: form.display_label.trim(),
        description: form.description.trim() || null,
        css_class: form.css_class,
      }
      if (isNew) {
        payload.category = form.category
        payload.entity_type = form.entity_type
        await createLookupValue(payload)
      } else {
        await updateLookupValue(id, payload)
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

  const valueError = touched.value && !form.value.trim()
  const labelError = touched.display_label && !form.display_label.trim()

  return (
    <>
      <div className="breadcrumbs">
        <Link to={backUrl} className="breadcrumb">Options</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <Link to={backUrl} className="breadcrumb">{groupLabel}</Link>
        <span className="breadcrumb-sep">&rsaquo;</span>
        <span className="breadcrumb-current">{isNew ? 'New' : 'Edit'}</span>
      </div>

      <div className="page-header">
        <h1 className="page-title">{isNew ? `New ${groupLabel} Option` : `Edit ${itemName}`}</h1>
      </div>

      {error && <Alert variant="error" title={error} />}

      <form className="form-card" onSubmit={handleSave}>
        <div className="field-stack">
          <div>
            <label className="input-label">Value *</label>
            <input
              className={`input input-full${valueError ? ' input-error' : ''}`}
              placeholder="internal-key"
              value={form.value}
              onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))}
              onBlur={() => setTouched(prev => ({ ...prev, value: true }))}
            />
            {valueError && <div className="field-error">Value is required</div>}
          </div>

          <div>
            <label className="input-label">Display Label *</label>
            <input
              className={`input input-full${labelError ? ' input-error' : ''}`}
              placeholder="Display Name"
              value={form.display_label}
              onChange={e => setForm(prev => ({ ...prev, display_label: e.target.value }))}
              onBlur={() => setTouched(prev => ({ ...prev, display_label: true }))}
            />
            {labelError && <div className="field-error">Display label is required</div>}
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea
              className="textarea textarea-full"
              placeholder="Optional description for context"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div>
            <label className="input-label">Badge Color</label>
            <BadgePicker value={form.css_class} onChange={v => setForm(prev => ({ ...prev, css_class: v }))} />
          </div>

          <div className="form-actions">
            <Link to={backUrl} className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (isNew ? 'Create' : 'Save')}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
