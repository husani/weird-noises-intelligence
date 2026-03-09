/**
 * Alert — an inline message with icon, optional title, and body.
 * @param {'error'|'warning'|'success'|'info'} variant - Controls color and icon.
 * @param {string} title - Optional bold heading inside the alert.
 */

import React from 'react'

const icons = {
  error: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8" /><path d="M10 6v5M10 13.5v.5" /></svg>,
  warning: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2L1 18h18L10 2zM10 8v4M10 14.5v.5" /></svg>,
  success: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8" /><path d="M6.5 10l2.5 2.5 5-5" /></svg>,
  info: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8" /><path d="M10 9v5M10 6.5v.5" /></svg>,
}

export default function Alert({ variant = 'info', title, children }) {
  return (
    <div className={`alert alert-${variant}`}>
      <div className="alert-icon">{icons[variant]}</div>
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}
