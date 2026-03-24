/**
 * Slate tool — main page with sidebar navigation and sub-routing.
 */

import React, { lazy, Suspense, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import Modal from '@shared/components/Modal'
import { createShow } from '@slate/api'
import '@slate/styles/slate.css'

const Dashboard = lazy(() => import('./Dashboard'))
const ShowList = lazy(() => import('./ShowList'))
const CreateShow = lazy(() => import('./CreateShow'))
const ShowDetail = lazy(() => import('./ShowDetail'))
const OptionsPage = lazy(() => import('./OptionsPage'))
const OptionEdit = lazy(() => import('./OptionEdit'))
const Settings = lazy(() => import('./Settings'))
const AIConfig = lazy(() => import('./AIConfig'))
const SlateQuery = lazy(() => import('./SlateQuery'))

// SVG icons for sidebar links
const icons = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  query: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7" /><path d="M16 16l5 5" /></svg>,
  shows: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 10h16M4 14h12M4 18h8" /></svg>,
  options: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="18" r="2" fill="currentColor" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  ai: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v1a3 3 0 01-3 3h-1v4a4 4 0 01-8 0v-4H7a3 3 0 01-3-3v-1a3 3 0 013-3h1V6a4 4 0 014-4z" /><circle cx="10" cy="10" r="1" fill="currentColor" /><circle cx="14" cy="10" r="1" fill="currentColor" /></svg>,
}

function Sidebar({ onQuickAdd }) {
  return (
    <aside className="sidebar-nav">
      <div className="sidebar-nav-header">
        <button className="btn btn-primary btn-full" onClick={onQuickAdd}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 1v10M1 6h10" />
          </svg>
          New Show
        </button>
      </div>

      <nav>
        <NavLink to="/slate" end className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
          {icons.dashboard} Dashboard
        </NavLink>
        <NavLink to="/slate/query" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
          {icons.query} AI Query
        </NavLink>

        <div className="sidebar-nav-section">Slate</div>
        <NavLink to="/slate/shows" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
          {icons.shows} All Shows
        </NavLink>

        <div className="sidebar-nav-section">Data</div>
        <NavLink to="/slate/options" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
          {icons.options} Options
        </NavLink>

        <div className="sidebar-nav-section">Advanced</div>
        <NavLink to="/slate/ai-config" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
          {icons.ai} AI Configuration
        </NavLink>
      </nav>

      <div className="sidebar-nav-spacer" />

      <div className="sidebar-nav-footer">
        <NavLink to="/slate/settings" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
          {icons.settings} Settings
        </NavLink>
      </div>
    </aside>
  )
}

function QuickAddModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createShow({ title: title.trim() })
      onCreated(result)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal title="New Show" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={submitting || !title.trim()}>
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </>}>
      <form onSubmit={handleSubmit}>
        <label className="input-label">Title</label>
        <input className="input" value={title}
          onChange={e => setTitle(e.target.value)} placeholder="Show title" autoFocus />
        {error && <div className="field-error">{error}</div>}
      </form>
    </Modal>
  )
}

export default function SlatePage() {
  const [quickAdd, setQuickAdd] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="sidebar-layout">
      <Sidebar onQuickAdd={() => setQuickAdd(true)} />
      <div className="main-content">
        <Suspense fallback={<div className="page-loading"><div className="loading-spinner" /></div>}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="query" element={<SlateQuery />} />
            <Route path="shows" element={<ShowList />} />
            <Route path="shows/new" element={<CreateShow />} />
            <Route path="shows/:showId/*" element={<ShowDetail />} />
            <Route path="options" element={<OptionsPage />} />
            <Route path="options/new" element={<OptionEdit />} />
            <Route path="options/:id/edit" element={<OptionEdit />} />
            <Route path="settings" element={<Settings />} />
            <Route path="ai-config" element={<AIConfig />} />
          </Routes>
        </Suspense>
      </div>
      {quickAdd && (
        <QuickAddModal
          onClose={() => setQuickAdd(false)}
          onCreated={(result) => {
            setQuickAdd(false)
            navigate(`/slate/shows/${result.id}/overview`)
          }}
        />
      )}
    </div>
  )
}
