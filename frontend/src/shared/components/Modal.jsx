/**
 * Modal dialog with backdrop, title, body, and optional footer.
 * Clicking the backdrop or the X button calls onClose.
 *
 * @param {string} title - Modal heading.
 * @param {function} onClose - Called when the modal should close.
 * @param {React.ReactNode} footer - Optional footer content (usually buttons).
 */

import React from 'react'

export default function Modal({ title, onClose, footer, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
