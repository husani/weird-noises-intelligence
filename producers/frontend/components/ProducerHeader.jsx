/**
 * Producer header — the first thing you see. Name, org, status, contact, actions.
 * Editorial feel — the name is dominant, everything else supports it.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionMenu } from '@shared/components'
import PlatformIcon from '@shared/components/PlatformIcon'

const STATE_CONFIG = {
  no_contact: { label: 'No contact', variant: 'neutral' },
  new: { label: 'New', variant: 'blue' },
  active: { label: 'Active', variant: 'sage' },
  waiting: { label: 'Waiting', variant: 'warm' },
  overdue: { label: 'Overdue', variant: 'rose' },
  gone_cold: { label: 'Gone cold', variant: 'neutral' },
}

export default function ProducerHeader({ producer, organizations, refreshing, onRefresh, onDelete }) {
  const navigate = useNavigate()
  const state = STATE_CONFIG[producer.relationship_state] || STATE_CONFIG.no_contact
  const currentOrg = organizations.find(o => !o.end_date)
  const initials = `${(producer.first_name || '')[0] || ''}${(producer.last_name || '')[0] || ''}`.toUpperCase()

  return (
    <header className="pd-header">
      <div className="pd-header-identity">
        <div className="person-avatar person-avatar-lg pd-avatar">
          {producer.photo_url
            ? <img className="person-avatar-photo person-avatar-lg" src={producer.photo_url} alt="" />
            : initials
          }
        </div>
        <div className="pd-header-text">
          <h1 className="pd-name">{producer.first_name} {producer.last_name}</h1>
          <div className="pd-subtitle">
            {currentOrg && (
              <span className="pd-org">
                {currentOrg.role_title && `${currentOrg.role_title}, `}{currentOrg.name}
              </span>
            )}
            <span className={`status status-${state.variant}`}>
              <span className="status-dot" />{state.label}
            </span>
          </div>
          <div className="pd-contact-row">
            {producer.email && <a href={`mailto:${producer.email}`} className="pd-contact-icon" title={producer.email}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            </a>}
            {producer.phone && <a href={`tel:${producer.phone}`} className="pd-contact-icon" title={producer.phone}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            </a>}
            {producer.website && <a href={producer.website} target="_blank" rel="noopener noreferrer" className="pd-contact-icon" title={producer.website}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            </a>}
            {(producer.social_links || []).map((link, i) => (
              <a key={i} href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                target="_blank" rel="noopener noreferrer" className="pd-contact-icon" title={link.platform_name}>
                <PlatformIcon svg={link.icon_svg} />
              </a>
            ))}
            {!producer.email && !producer.phone && !producer.website && (producer.social_links || []).length === 0 && (
              <span className="pd-no-contact">No contact info</span>
            )}
          </div>
        </div>
      </div>
      <div className="pd-header-actions">
        <button className="btn btn-secondary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Researching\u2026' : 'Refresh Dossier'}
        </button>
        <ActionMenu items={[
          { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => navigate(`/producers/detail/${producer.id}/edit`) },
          { divider: true },
          { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', destructive: true, onClick: onDelete },
        ]} />
      </div>
    </header>
  )
}
