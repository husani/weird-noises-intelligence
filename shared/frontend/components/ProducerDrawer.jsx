import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducer } from '@producers/api'
import Drawer from './Drawer'
import PlatformIcon from './PlatformIcon'

const STATE_LABELS = {
  no_contact: { label: 'No contact', variant: 'neutral' },
  new: { label: 'New', variant: 'blue' },
  active: { label: 'Active', variant: 'sage' },
  waiting: { label: 'Waiting', variant: 'warm' },
  overdue: { label: 'Overdue', variant: 'rose' },
  gone_cold: { label: 'Gone cold', variant: 'neutral' },
}

function initials(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase()
}

function ContactLine({ icon, children }) {
  return (
    <div className="drawer-contact-line">
      {icon}
      {children}
    </div>
  )
}

const ICONS = {
  email: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 4l-10 8L2 4" /></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>,
  web: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>,
  social: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>,
}

const DASH = <span className="cell-muted">&mdash;</span>

export default function ProducerDrawer({ producerId, onClose }) {
  const navigate = useNavigate()
  const [producer, setProducer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!producerId) return
    setLoading(true)
    getProducer(producerId)
      .then(data => { if (!data.error) setProducer(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [producerId])

  const state = producer ? (STATE_LABELS[producer.relationship_state] || STATE_LABELS.no_contact) : null
  const location = producer ? [producer.city, producer.state_region, producer.country].filter(Boolean).join(', ') : ''
  const socialLinks = producer?.social_links || []
  const title = loading ? 'Loading...' : producer ? `${producer.first_name} ${producer.last_name}` : 'Not found'

  return (
    <Drawer open={!!producerId} onClose={onClose} title={title} subtitle="Producer">
      {loading && <div className="disc-center"><div className="loading-spinner" /></div>}

      {!loading && producer && (
        <>
          <div className="drawer-identity">
            {producer.photo_url
              ? <img className="person-avatar-photo person-avatar-lg" src={producer.photo_url} alt="" />
              : <div className="person-avatar person-avatar-lg drawer-avatar">{initials(producer.first_name, producer.last_name)}</div>}
            <div>
              {location && <div className="drawer-location">{location}</div>}
              <span className={`status status-${state.variant}`}>
                <span className="status-dot" />
                {state.label}
              </span>
            </div>
          </div>

          <div className="drawer-section">
            <div className="type-label">Contact</div>
            <ContactLine icon={ICONS.email}>
              {producer.email
                ? <a href={`mailto:${producer.email}`} className="link">{producer.email}</a>
                : DASH}
            </ContactLine>
            <ContactLine icon={ICONS.phone}>
              {producer.phone ? <span>{producer.phone}</span> : DASH}
            </ContactLine>
            <ContactLine icon={ICONS.web}>
              {producer.website
                ? <a href={producer.website.startsWith('http') ? producer.website : `https://${producer.website}`} target="_blank" rel="noopener noreferrer" className="link link-external">
                    {producer.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                : DASH}
            </ContactLine>
            {socialLinks.map((link, i) => (
              <ContactLine key={i} icon={<PlatformIcon svg={link.icon_svg} />}>
                <a href={link.url.startsWith('http') ? link.url : `https://${link.url}`} target="_blank" rel="noopener noreferrer" className="link link-external">
                  {link.platform_name}
                </a>
              </ContactLine>
            ))}
          </div>

          <div className="drawer-section">
            <div className="type-label">Dossier</div>
            <div className="drawer-dossier-text cell-muted">TBD</div>
          </div>

          <div className="drawer-footer-link">
            <button className="btn btn-primary btn-full" onClick={() => { onClose(); navigate(`/producers/detail/${producer.id}`) }}>
              View full profile
            </button>
          </div>
        </>
      )}
    </Drawer>
  )
}
