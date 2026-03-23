/**
 * Slate Dashboard — the creative portfolio at a glance.
 *
 * Main column: project cards for every show — title, logline, stage, last milestone.
 * Sidebar: attention flags + recent activity timeline.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import StageProgression from '@shared/components/StageProgression'
import { listShows, getLookupValues, getRecentMilestones } from '@slate/api'

const MEDIUM_ACCENT = {
  musical: 'warm',
  play: 'sage',
  screenplay: 'blue',
  feature_film: 'blue',
  short_film: 'blue',
  teleplay: 'lavender',
  limited_series: 'lavender',
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function Dashboard() {
  const [shows, setShows] = useState([])
  const [stages, setStages] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const [showData, lvData, msData] = await Promise.all([
        listShows({ limit: 50 }),
        getLookupValues({ category: 'development_stage' }),
        getRecentMilestones(8),
      ])
      setShows(showData.shows || [])
      setStages(lvData.lookup_values || [])
      setMilestones(msData.milestones || [])
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  if (shows.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Slate</h1>
          <p className="page-subtitle">WN's development slate</p>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="32" height="32" rx="4" />
              <path d="M12 20h16M20 12v16" />
            </svg>
          </div>
          <div className="empty-state-title">No shows yet</div>
          <div className="empty-state-desc">Create your first show to start building the slate.</div>
          <button className="btn btn-primary" onClick={() => navigate('/slate/shows/new')}>Create Show</button>
        </div>
      </div>
    )
  }

  // Build milestone map: show_id → most recent milestone
  const lastMilestoneByShow = {}
  milestones.forEach(ms => {
    if (!lastMilestoneByShow[ms.show_id]) {
      lastMilestoneByShow[ms.show_id] = ms
    }
  })

  // Attention flags
  const stalledShows = shows.filter(s => daysSince(s.updated_at) > 60)
  const noScriptShows = shows.filter(s => !s.current_script_version)
  const hasAttention = stalledShows.length > 0 || noScriptShows.length > 0

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Slate</h1>
        <p className="page-subtitle">{shows.length} project{shows.length !== 1 ? 's' : ''} in development</p>
      </div>

      <div className="dash-columns">
        <div className="dash-main">
          {shows.map(show => {
            const accent = MEDIUM_ACCENT[show.medium?.value] || 'warm'
            const lastMs = lastMilestoneByShow[show.id]

            return (
              <Link
                key={show.id}
                to={`/slate/shows/${show.id}/overview`}
                className={`section-card section-card--accent-${accent} slate-project-card`}
              >
                <div className="slate-project-card-header">
                  <h2 className="type-display-2">{show.title}</h2>
                  <div className="slate-project-card-badges">
                    {show.medium && (
                      <span className={`badge ${show.medium.css_class || 'badge-neutral'}`}>{show.medium.display_label}</span>
                    )}
                    {show.development_stage && (
                      <span className={`badge ${show.development_stage.css_class || 'badge-neutral'}`}>{show.development_stage.display_label}</span>
                    )}
                  </div>
                </div>

                {show.logline && (
                  <div className="prose line-clamp-2">{show.logline}</div>
                )}

                <div className="slate-project-card-footer">
                  <span className="type-meta">
                    {lastMs
                      ? `${formatDate(lastMs.date)} — ${lastMs.title}`
                      : 'No milestones'}
                  </span>
                  <span className="type-meta">
                    {show.current_script_version
                      ? `Script: ${show.current_script_version}`
                      : 'No script'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="dash-sidebar">
          {/* Attention flags */}
          {hasAttention && (
            <div className="surfacing-panel">
              <div className="surfacing-header">
                <span className="surfacing-title">Needs Attention</span>
                <span className="surfacing-count">{stalledShows.length + noScriptShows.length}</span>
              </div>
              {stalledShows.map(s => (
                <Link key={`stalled-${s.id}`} to={`/slate/shows/${s.id}/overview`} className="surfacing-item no-underline">
                  <div className="surfacing-icon surfacing-icon-rose">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" />
                    </svg>
                  </div>
                  <div>
                    <div className="surfacing-text"><strong>{s.title}</strong> — no activity in {daysSince(s.updated_at)} days</div>
                    <div className="surfacing-time">{relativeTime(s.updated_at)}</div>
                  </div>
                </Link>
              ))}
              {noScriptShows.map(s => (
                <Link key={`noscript-${s.id}`} to={`/slate/shows/${s.id}/scripts`} className="surfacing-item no-underline">
                  <div className="surfacing-icon surfacing-icon-warm">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M9 2v3h3" />
                    </svg>
                  </div>
                  <div>
                    <div className="surfacing-text"><strong>{s.title}</strong> — no script uploaded</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Recent activity */}
          {milestones.length > 0 && (
            <div className="section-card">
              <div className="section-card-header">
                <h3 className="section-card-title">Recent Activity</h3>
              </div>
              <div className="timeline">
                {milestones.map((ms, i) => (
                  <div key={ms.id || i} className="timeline-item">
                    <div className={`timeline-dot${i === 0 ? ' timeline-dot-active' : ''}`} />
                    <div className="timeline-date">{formatDate(ms.date)}</div>
                    <div className="timeline-content">
                      <Link to={`/slate/shows/${ms.show_id}/milestones`} className="link">
                        <strong>{ms.show_title}</strong>
                      </Link>
                      {' — '}{ms.title}
                      {ms.milestone_type && (
                        <>{' '}<span className={`badge ${ms.milestone_type.css_class || 'badge-neutral'}`}>{ms.milestone_type.display_label}</span></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
