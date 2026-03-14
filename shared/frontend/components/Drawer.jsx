import React, { useEffect, useState, useRef, useCallback } from 'react'

export default function Drawer({ open, onClose, title, subtitle, children }) {
  const [visible, setVisible] = useState(false)
  const [animOpen, setAnimOpen] = useState(false)
  const drawerRef = useRef(null)

  // Mount: render offscreen, wait for paint, then trigger slide-in
  useEffect(() => {
    if (open) {
      setVisible(true)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimOpen(true))
      })
      return () => cancelAnimationFrame(raf)
    } else if (visible) {
      handleClose()
    }
  }, [open])

  // Close: animate out, then unmount after transition
  const handleClose = useCallback(() => {
    setAnimOpen(false)
    const el = drawerRef.current
    if (el) {
      el.addEventListener('transitionend', () => {
        setVisible(false)
        onClose()
      }, { once: true })
    } else {
      setVisible(false)
      onClose()
    }
  }, [onClose])

  // Escape key
  useEffect(() => {
    if (!visible) return
    function handleKey(e) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [visible, handleClose])

  if (!visible) return null

  return (
    <>
      <div className={`drawer-backdrop${animOpen ? ' drawer-open' : ''}`} onClick={handleClose} />
      <div ref={drawerRef} className={`drawer${animOpen ? ' drawer-open' : ''}`}>
        <div className="drawer-header">
          <div>
            {subtitle && <div className="drawer-subtitle">{subtitle}</div>}
            <span className="drawer-title">{title}</span>
          </div>
          <button className="modal-close" onClick={handleClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
    </>
  )
}
