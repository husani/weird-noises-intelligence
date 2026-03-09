/**
 * Empty state — centered message shown when there's no content to display.
 * @param {string} title - Heading text.
 * @param {string} description - Explanatory text below the heading.
 * @param {React.ReactNode} action - Optional action element (e.g. a button).
 */

import React from 'react'

export default function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action}
    </div>
  )
}
