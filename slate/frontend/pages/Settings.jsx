/**
 * Slate Settings page.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { getSettings, updateSettings } from '@slate/api'

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getSettings()
      setSettings(data || {})
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  return (
    <div className="page">
      <div className="page-topbar">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Slate tool configuration</p>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-card-title">Configuration</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="16" cy="16" r="4" />
              <path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M24.5 7.5l-2.8 2.8M10.3 21.7l-2.8 2.8" />
            </svg>
          </div>
          <div className="empty-state-desc">Settings will be added as Slate features expand. AI Configuration will appear in Phase 2.</div>
        </div>
      </div>
    </div>
  )
}
