import React, { useState, useRef, useEffect } from 'react'

/**
 * ActionMenu — kebab trigger that opens a dropdown of contextual actions.
 *
 * Spec structure:
 *   div.action-trigger (kebab icon)
 *   div.action-menu (dropdown)
 *     > div.action-menu-item (with optional .action-menu-item-destructive)
 *       > svg.action-menu-item-icon (15x15) + label text
 *     > div.action-menu-divider
 *
 * @param {Array} items - Array of { label, icon (SVG path), onClick, destructive? }
 *   Insert { divider: true } for a separator.
 */
export default function ActionMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="action-trigger" onClick={e => { e.stopPropagation(); setOpen(v => !v) }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </div>
      {open && (
        <div className="action-menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10 }}>
          {items.map((item, i) => {
            if (item.divider) return <div key={i} className="action-menu-divider" />
            return (
              <div
                key={i}
                className={`action-menu-item${item.destructive ? ' action-menu-item-destructive' : ''}`}
                onClick={e => { e.stopPropagation(); setOpen(false); item.onClick() }}
              >
                {item.icon && (
                  <svg className="action-menu-item-icon" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d={item.icon} />
                  </svg>
                )}
                {item.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
