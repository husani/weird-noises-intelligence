/**
 * StageProgression — discrete lifecycle stage indicator.
 *
 * Renders the stage-progression pattern from the design system.
 * Two variants: full (with labels) and compact (dots only).
 *
 * Props:
 *   stages       — array of { value, display_label } in order
 *   currentValue — the value string of the current stage
 *   compact      — boolean, renders compact (dots only) variant
 */

import React from 'react'

export default function StageProgression({ stages, currentValue, compact }) {
  const currentIdx = stages.findIndex(s => s.value === currentValue)
  return (
    <div className={`stage-progression${compact ? ' stage-progression-compact' : ''}`}>
      {stages.map((stage, i) => {
        let dotClass = 'stage-dot'
        let labelClass = 'stage-label'
        if (i < currentIdx) {
          dotClass += ' stage-dot-past'
        } else if (i === currentIdx) {
          dotClass += ' stage-dot-current'
          labelClass += ' stage-label-current'
        } else {
          dotClass += ' stage-dot-future'
          labelClass += ' stage-label-future'
        }
        return (
          <React.Fragment key={stage.value}>
            {i > 0 && (
              <div className={`stage-connector ${i <= currentIdx ? 'stage-connector-past' : 'stage-connector-future'}`} />
            )}
            <div className="stage-node">
              <div className={dotClass} />
              <div className={labelClass}>{stage.display_label}</div>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
