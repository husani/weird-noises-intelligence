/**
 * Badge — a small pill-shaped label.
 * @param {'warm'|'sage'|'rose'|'blue'|'lavender'|'neutral'} variant - Color.
 *   - warm: primary/active states
 *   - sage: positive/success
 *   - rose: negative/error
 *   - blue: informational
 *   - lavender: categorization
 *   - neutral: generic
 */

import React from 'react'

export default function Badge({ variant = 'warm', children, className = '' }) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>
}
