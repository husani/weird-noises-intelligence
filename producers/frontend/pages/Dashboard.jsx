import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '@producers/api'
import { EmptyState } from '@shared/components'

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return 'just now'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function overdueClass(days) {
  if (days >= 30) return 'overdue-critical'
  if (days >= 14) return 'overdue-severe'
  if (days >= 7)  return 'overdue-moderate'
  return 'overdue-mild'
}

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
)

const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
)

const ResearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
)

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  if (!data) {
    return <div className="alert alert-error"><div className="alert-content"><div className="alert-title">Failed to load dashboard</div></div></div>
  }

  const hasProducers = data.total_producers > 0

  // Separate significant AI changes (intelligence updates) from routine changes
  const intelUpdates = data.recent_ai_changes.filter(c => c.significant)
  const routineChanges = data.recent_ai_changes.filter(c => !c.significant)

  // Activity feed: human interactions + routine AI changes, chronological
  const activityFeed = [
    ...data.recent_interactions.map(i => ({
      type: 'human', date: i.date, id: `i-${i.id}`,
      producerId: i.producer_id, producerName: `${i.first_name} ${i.last_name}`,
      text: `${i.author} logged: ${i.content}`,
    })),
    ...routineChanges.map((c, idx) => ({
      type: 'ai', date: c.changed_at, id: `c-${idx}`,
      producerId: c.entity_id, producerName: c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : null,
      text: `Updated ${c.field_label.toLowerCase()}`,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12)

  const hasContent = data.researching.length > 0 ||
    intelUpdates.length > 0 || activityFeed.length > 0

  // Stagger index for entrance animation
  let sectionIdx = 0

  return (
    <>
      <div className="page-header" style={{ '--dash-i': sectionIdx++ }}>
        <h1 className="page-title">Producers</h1>
        <p className="page-subtitle">Research and relationship intelligence</p>
      </div>

      {/* Stats */}
      <div className="stat-grid dash-stats" style={{ '--dash-i': sectionIdx++ }}>
        <div className="stat-card stat-card--warm">
          <div className="stat-label">Producers</div>
          <div className="stat-value stat-value--warm">{data.total_producers}</div>
        </div>
        {data.researching.length > 0 && (
          <div className="stat-card stat-card--blue">
            <div className="stat-label">Researching</div>
            <div className="stat-value stat-value--blue">{data.researching.length}</div>
          </div>
        )}
        {data.discovery_candidates_count > 0 && (
          <div className="stat-card stat-card--sage">
            <div className="stat-label">Discoveries Pending</div>
            <div className="stat-value stat-value--sage">{data.discovery_candidates_count}</div>
            <div className="stat-note"><Link to="/producers/discovery" className="link">Review queue</Link></div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasProducers && !hasContent && (
        <EmptyState
          title="Get started with Producers"
          description="Add producers manually, import from a spreadsheet, or let the AI discover producers."
          action={
            <div className="dash-empty-actions">
              <Link to="/producers/add" className="btn btn-primary">Add Producer</Link>
              <Link to="/producers/import" className="btn btn-secondary">Import Spreadsheet</Link>
              <Link to="/producers/discovery" className="btn btn-secondary">Run Discovery</Link>
            </div>
          }
        />
      )}

      {/* Main content — two balanced columns */}
      {hasContent && (
        <div className="dash-columns" style={{ '--dash-i': sectionIdx++ }}>
          <div className="dash-main">
            {/* Intelligence updates — significant AI changes */}
            {intelUpdates.length > 0 && (
              <div className="surfacing-panel">
                <div className="surfacing-header">
                  <div className="surfacing-title">Intelligence Updates</div>
                  <span className="surfacing-count">{intelUpdates.length}</span>
                </div>
                {intelUpdates.map((u, i) => (
                  <Link key={`intel-${i}`} to={`detail/${u.entity_id}`} className="surfacing-item no-underline">
                    <div className="surfacing-icon surfacing-icon-warm">
                      <SparkIcon />
                    </div>
                    <div className="surfacing-text">
                      <strong>{u.first_name} {u.last_name}</strong> &mdash; {u.field_label.toLowerCase()} updated
                      {u.new_value && (
                        <div className="intel-preview line-clamp-2">{u.new_value}</div>
                      )}
                      <div className="surfacing-time">{relativeTime(u.changed_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Research in progress */}
            {data.researching.length > 0 && (
              <div className="surfacing-panel">
                <div className="surfacing-header">
                  <div className="surfacing-title">Research In Progress</div>
                  <span className="surfacing-count">{data.researching.length}</span>
                </div>
                {data.researching.map(p => (
                  <Link key={p.id} to={`detail/${p.id}`} className="surfacing-item no-underline">
                    <div className="surfacing-icon surfacing-icon-blue">
                      <ResearchIcon />
                    </div>
                    <div className="surfacing-text">
                      <strong>{p.first_name} {p.last_name}</strong>
                      <div className="surfacing-time">
                        <span className="status status-blue"><span className="status-dot pulse" />{p.status === 'in_progress' ? 'Researching' : p.status}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="dash-sidebar">
            {activityFeed.length > 0 && (
              <div className="section-card">
                <div className="section-card-header">
                  <h3 className="section-card-title">Recent Activity</h3>
                </div>
                <div className="timeline">
                  {activityFeed.map(item => (
                    <div key={item.id} className="timeline-item">
                      <div className={`timeline-dot timeline-dot-${item.type === 'human' ? 'warm' : 'blue'}`} />
                      <div className="timeline-date">{relativeTime(item.date)}</div>
                      <div className="timeline-content">
                        <Link to={`detail/${item.producerId}`} className="link"><strong>{item.producerName}</strong></Link> &mdash; {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
