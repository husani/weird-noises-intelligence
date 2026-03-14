/**
 * Empty state — centered message shown when there's no content to display.
 * Spec structure: empty-state > empty-state-icon (40x40 SVG) > empty-state-title > empty-state-desc > optional action.
 * @param {React.ReactNode} icon - Optional SVG icon (40x40). Falls back to a generic circle-plus icon.
 * @param {string} title - Heading text.
 * @param {string} description - Explanatory text below the heading.
 * @param {React.ReactNode} action - Optional action element (e.g. a button).
 */

import React from 'react'

const defaultIcon = (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="20" cy="20" r="16" /><path d="M14 20h12M20 14v12" />
  </svg>
)

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon || defaultIcon}</div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action}
    </div>
  )
}
