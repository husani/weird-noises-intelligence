/**
 * SelectArrow — the chevron SVG that sits inside select-wrapper.
 * Matches the design system's select-arrow pattern.
 */

import React from 'react'

export default function SelectArrow() {
  return (
    <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 5.5l3.5 3.5 3.5-3.5" />
    </svg>
  )
}
