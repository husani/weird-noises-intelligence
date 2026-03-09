/**
 * Status indicator — a colored dot with a text label.
 * @param {'warm'|'sage'|'rose'|'blue'|'neutral'} variant - Dot and text color.
 * @param {boolean} pulse - Whether the dot should animate (for live/active states).
 */

import React from 'react'

export default function StatusIndicator({ variant = 'neutral', pulse = false, children }) {
  return (
    <span className={`status status-${variant}`}>
      <span className={`status-dot ${pulse ? 'pulse' : ''}`} />
      {children}
    </span>
  )
}
