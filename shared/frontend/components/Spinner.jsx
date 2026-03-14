/**
 * Loading spinner — animated circular indicator.
 * @param {number} size - Diameter in pixels (default 24).
 */

import React from 'react'

export default function Spinner({ size = 24 }) {
  return <div className="loading-spinner" style={{ '--spinner-size': `${size}px` }} />
}
