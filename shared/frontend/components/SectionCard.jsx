/**
 * Section card — a titled content container.
 * Used to group related content with an optional title and metadata label.
 *
 * @param {string} title - Section heading (Cormorant display font).
 * @param {string} meta - Upper-right metadata label (e.g. "3 items").
 */

import React from 'react'

export default function SectionCard({ title, meta, children, className = '' }) {
  return (
    <div className={`section-card ${className}`}>
      {(title || meta) && (
        <div className="section-card-header">
          {title && <div className="section-card-title">{title}</div>}
          {meta && <div className="section-card-meta">{meta}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
