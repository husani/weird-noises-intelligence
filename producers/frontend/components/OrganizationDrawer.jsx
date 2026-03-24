import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrganization } from '@producers/api'
import { Drawer, PlatformIcon } from '@shared/components'

export default function OrganizationDrawer({ organizationId, onClose }) {
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    getOrganization(organizationId)
      .then(data => { if (!data.error) setOrg(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [organizationId])

  const title = loading ? 'Loading…' : org ? org.name : 'Not found'
  const DASH = <span className="cell-muted">&mdash;</span>

  return (
    <Drawer open={!!organizationId} onClose={onClose} title={title} subtitle="Organization">
      {loading && <div className="disc-center"><div className="loading-spinner" /></div>}

      {!loading && org && (
        <>
          <div className="drawer-section">
            <div className="sidebar-field">
              <div className="type-label">Type</div>
              {org.org_type
                ? <span className={`badge ${org.org_type.css_class}`}>{org.org_type.display_label}</span>
                : DASH}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Location</div>
              {[org.city, org.state_region, org.country].filter(Boolean).length > 0
                ? <div>{[org.city, org.state_region, org.country].filter(Boolean).join(', ')}</div>
                : DASH}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Website</div>
              {org.website
                ? <a href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                    target="_blank" rel="noopener noreferrer" className="link link-external">
                    {org.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                : DASH}
            </div>

            {(org.social_links || []).length > 0 && (
              <div className="sidebar-field">
                <div className="type-label">Profiles</div>
                <div className="social-links-list">
                  {org.social_links.map((link, i) => (
                    <a key={i} href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                      target="_blank" rel="noopener noreferrer" className="link link-external social-link-with-icon">
                      <PlatformIcon svg={link.icon_svg} />
                      {link.platform_name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="drawer-section">
            <div className="type-label">Description</div>
            {org.description
              ? <div className="drawer-dossier-text">{org.description}</div>
              : DASH}
          </div>

          {(org.producers || []).length > 0 && (
            <div className="drawer-section">
              <div className="type-label">Producers ({org.producers.length})</div>
              <ul className="item-list">
                {org.producers.slice(0, 10).map(p => (
                  <li key={p.affiliation_id} className="item-row">
                    <div>
                      <span className="item-primary">{p.last_name}, {p.first_name}</span>
                      {p.role_title && <span className="item-secondary"> · {p.role_title}</span>}
                    </div>
                  </li>
                ))}
                {org.producers.length > 10 && (
                  <li className="item-row"><span className="cell-muted">+{org.producers.length - 10} more</span></li>
                )}
              </ul>
            </div>
          )}

          <div className="drawer-footer-link">
            <button className="btn btn-primary btn-full" onClick={() => { onClose(); navigate(`/producers/organizations/${org.id}`) }}>
              View full organization
            </button>
          </div>
        </>
      )}
    </Drawer>
  )
}
