/**
 * Show > Characters — empty state in Phase 1.
 */

import React from 'react'

export default function ShowCharacters({ show }) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-card-title">Characters</h2>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="20" cy="14" r="6" />
            <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" />
          </svg>
        </div>
        <div className="empty-state-title">No characters yet</div>
        <div className="empty-state-desc">
          Upload a script to unlock character breakdowns — names, descriptions, age ranges, vocal ranges, and more.
        </div>
      </div>
    </div>
  )
}
