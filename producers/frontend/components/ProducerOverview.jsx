/**
 * Producer overview — the person at a glance.
 * Relationship stats, dossier prose, contact/identity reference, tags.
 * No sub-section headings. Information flows naturally.
 */

import React, { useState } from 'react'

function ChipInput({ tags = [], onAdd, onRemove }) {
  const [inputVal, setInputVal] = useState('')
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = inputVal.trim().replace(/,$/, '')
      if (tag) { onAdd(tag); setInputVal('') }
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    }
  }
  return (
    <div className="chip-input-wrapper" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
      {tags.map(t => (
        <span key={t} className="chip">{t}
          <button type="button" className="chip-remove" onClick={() => onRemove(t)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l6 6M8 2l-6 6" /></svg>
          </button>
        </span>
      ))}
      <input type="text" className="chip-input" placeholder={tags.length === 0 ? 'Add tag\u2026' : ''}
        value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKeyDown} />
    </div>
  )
}

function relativeTime(dateStr) {
  if (!dateStr) return 'Never'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function ProducerOverview({ producer, relationship, traits, intel, onAddTag, onRemoveTag }) {
  const hasTraits = traits && traits.length > 0
  const hasIntel = intel && intel.length > 0
  const hasDossier = hasTraits || hasIntel

  // Group traits by category for prose display
  const traitsByCategory = {}
  if (hasTraits) {
    traits.forEach(t => {
      const cat = t.category?.display_label || 'General'
      if (!traitsByCategory[cat]) traitsByCategory[cat] = []
      traitsByCategory[cat].push(t)
    })
  }

  // Build identity line
  const hometown = [producer.hometown, producer.hometown_state, producer.hometown_country].filter(Boolean).join(', ')
  const identityFields = [
    { label: 'Pronouns', value: producer.pronouns },
    { label: 'Born', value: producer.birthdate },
    { label: 'College', value: producer.college },
    { label: 'From', value: hometown },
    { label: 'Partner', value: producer.spouse_partner },
    { label: 'Languages', value: producer.languages },
    { label: 'Also in', value: producer.seasonal_location },
  ]

  return (
    <div className="pd-overview">
      {/* Relationship at a glance */}
      {relationship && (
        <div className="pd-stats">
          <div className="stat-card">
            <div className="stat-label">Interactions</div>
            <div className="stat-value">{relationship.interaction_count || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Frequency</div>
            <div className="stat-value">{relationship.interaction_frequency ? `${Math.round(relationship.interaction_frequency)}d` : '\u2014'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Contact</div>
            <div className="stat-value">{relativeTime(relationship.last_contact_date)}</div>
          </div>
          {relationship.pending_follow_ups?.filter(f => !f.resolved).length > 0 && (
            <div className="stat-card">
              <div className="stat-label">Follow-ups</div>
              <div className="stat-value" style={{ color: 'var(--accent-warm)' }}>
                {relationship.pending_follow_ups.filter(f => !f.resolved).length}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dossier — prose observations */}
      {hasDossier && (
        <div className="pd-dossier">
          {Object.entries(traitsByCategory).map(([category, items]) => (
            <div key={category} className="pd-dossier-block">
              <span className="pd-dossier-label">{category}</span>
              {items.map(t => (
                <span key={t.id} className="prose">{t.value}</span>
              ))}
            </div>
          ))}
          {hasIntel && intel.map(i => (
            <div key={i.id} className="pd-dossier-block">
              <span className="pd-dossier-label">{i.category?.display_label || 'Intel'}</span>
              <span className="prose">{i.observation}</span>
              {i.source_url && <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="link link-external link-subtle">source</a>}
            </div>
          ))}
        </div>
      )}
      {/* No dossier? Show nothing — same as any other empty section */}

      {/* Contact & identity — compact reference block */}
      <div className="pd-reference">
        <div className="pd-ref-col">
          <div className="pd-ref-item">
            <span className="pd-ref-label">Email</span>
            {producer.email ? <a href={`mailto:${producer.email}`} className="link">{producer.email}</a> : <span className="cell-muted">\u2014</span>}
          </div>
          <div className="pd-ref-item">
            <span className="pd-ref-label">Phone</span>
            {producer.phone ? <a href={`tel:${producer.phone}`} className="link">{producer.phone}</a> : <span className="cell-muted">\u2014</span>}
          </div>
          <div className="pd-ref-item">
            <span className="pd-ref-label">Location</span>
            {[producer.city, producer.state_region, producer.country].filter(Boolean).join(', ') || <span className="cell-muted">\u2014</span>}
          </div>
          <div className="pd-ref-item">
            <span className="pd-ref-label">Website</span>
            {producer.website
              ? <a href={producer.website} target="_blank" rel="noopener noreferrer" className="link link-external">{producer.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
              : <span className="cell-muted">\u2014</span>}
          </div>
        </div>
        <div className="pd-ref-col">
          {identityFields.map(f => (
            <div key={f.label} className="pd-ref-item">
              <span className="pd-ref-label">{f.label}</span>
              {f.value || <span className="cell-muted">\u2014</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <ChipInput tags={producer.tags || []} onAdd={onAddTag} onRemove={onRemoveTag} />
    </div>
  )
}
