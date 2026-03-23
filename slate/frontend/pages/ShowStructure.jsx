/**
 * Show > Structure — empty state in Phase 1.
 */

import React from 'react'

export default function ShowStructure({ show }) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-card-title">Structure</h2>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="4" width="32" height="32" rx="3" />
            <path d="M4 14h32M14 14v22" />
          </svg>
        </div>
        <div className="empty-state-title">No structure data yet</div>
        <div className="empty-state-desc">
          Upload a script to see the scene breakdown, act structure, song list, and emotional arc.
        </div>
      </div>
    </div>
  )
}
