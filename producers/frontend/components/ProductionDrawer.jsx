import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProductionDetail } from '@producers/api'
import { Drawer } from '@shared/components'

export default function ProductionDrawer({ productionId, onClose, onProducerClick }) {
  const navigate = useNavigate()
  const [production, setProduction] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productionId) return
    setLoading(true)
    getProductionDetail(productionId)
      .then(data => { if (!data.error) setProduction(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productionId])

  const title = loading ? 'Loading...' : production ? production.title : 'Not found'

  function formatDate(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const DASH = <span className="cell-muted">&mdash;</span>

  return (
    <Drawer open={!!productionId} onClose={onClose} title={title} subtitle="Production">
      {loading && <div className="disc-center"><div className="loading-spinner" /></div>}

      {!loading && production && (
        <>
          {/* Identity: venue, year, scale */}
          <div className="drawer-identity">
            <div>
              {production.venue
                ? <div>{production.venue.name}</div>
                : <div className="cell-muted">No venue</div>}
              <div className="drawer-location">
                {[production.year, production.scale?.display_label].filter(Boolean).join(' · ') || '\u00A0'}
              </div>
            </div>
            {production.scale && (
              <span className={`badge ${production.scale.css_class}`}>{production.scale.display_label}</span>
            )}
          </div>

          {/* Producers */}
          <div className="drawer-section">
            <div className="type-label">Producers</div>
            {(production.producers || []).length > 0 ? (
              <ul className="item-list">
                {production.producers.map(p => (
                  <li
                    key={p.link_id}
                    className="item-row"
                    style={{ cursor: onProducerClick ? 'pointer' : undefined }}
                    onClick={() => onProducerClick && onProducerClick(p.producer_id)}
                  >
                    <div>
                      <span className="item-primary">{p.last_name}, {p.first_name}</span>
                      {p.role && (
                        <span className={`badge ${p.role.css_class}`} style={{ marginLeft: 8 }}>{p.role.display_label}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="cell-muted">No producers linked</div>
            )}
          </div>

          {/* Supporting details */}
          <div className="drawer-section">
            <div className="type-label">Details</div>

            <div className="sidebar-field">
              <div className="type-label">Show</div>
              {production.show
                ? <div>{production.show.title}</div>
                : DASH}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Dates</div>
              {production.start_date || production.end_date
                ? <div>{formatDate(production.start_date) || '?'} — {formatDate(production.end_date) || 'present'}</div>
                : DASH}
            </div>

            <div className="sidebar-field">
              <div className="type-label">Run Length</div>
              {production.run_length
                ? <div>{production.run_length}</div>
                : DASH}
            </div>
          </div>

          {/* Description */}
          <div className="drawer-section">
            <div className="type-label">Description</div>
            {production.description
              ? <div className="drawer-dossier-text">{production.description}</div>
              : DASH}
          </div>

          <div className="drawer-footer-link">
            <button className="btn btn-primary btn-full" onClick={() => { onClose(); navigate(`/producers/productions/${production.id}`) }}>
              View full production
            </button>
          </div>
        </>
      )}
    </Drawer>
  )
}
