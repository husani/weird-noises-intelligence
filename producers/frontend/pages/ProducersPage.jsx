/**
 * Producers tool — main page with sidebar navigation and sub-routing.
 * Sidebar groups pages into sections: Overview, People, Management, Data, Advanced.
 * Lazy-loads sub-pages.
 */

import React, { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getDiscoveryCandidates, createProducer, checkDuplicates, listOrganizations } from '@producers/api'
import Modal from '@shared/components/Modal'
import '@producers/styles/producers.css'

const Dashboard = lazy(() => import('./Dashboard'))
const ProducerList = lazy(() => import('./ProducerList'))
const ProducerDetail = lazy(() => import('./ProducerDetail'))
const AddProducer = lazy(() => import('./AddProducer'))
const ImportPage = lazy(() => import('./ImportPage'))
const DiscoveryQueue = lazy(() => import('./DiscoveryQueue'))
const AIQuery = lazy(() => import('./AIQuery'))
const Settings = lazy(() => import('./Settings'))
const OrganizationsPage = lazy(() => import('./OrganizationsPage'))
const OrganizationDetail = lazy(() => import('./OrganizationDetail'))
const OrganizationEdit = lazy(() => import('./OrganizationEdit'))
const ProductionDetail = lazy(() => import('./ProductionDetail'))
const ProductionEdit = lazy(() => import('./ProductionEdit'))
const ShowsPage = lazy(() => import('./ShowsPage'))
const ShowDetail = lazy(() => import('./ShowDetail'))
const ShowEdit = lazy(() => import('./ShowEdit'))
const VenuesPage = lazy(() => import('./VenuesPage'))
const VenueDetail = lazy(() => import('./VenueDetail'))
const VenueEdit = lazy(() => import('./VenueEdit'))
const SocialPlatformsPage = lazy(() => import('./SocialPlatformsPage'))
const SocialPlatformDetail = lazy(() => import('./SocialPlatformDetail'))
const SocialPlatformEdit = lazy(() => import('./SocialPlatformEdit'))
const TagsPage = lazy(() => import('./TagsPage'))
const TagDetail = lazy(() => import('./TagDetail'))
const TagEdit = lazy(() => import('./TagEdit'))
const OptionsPage = lazy(() => import('./OptionsPage'))
const OptionEdit = lazy(() => import('./OptionEdit'))
const SourcesPage = lazy(() => import('./SourcesPage'))
const SourceDetail = lazy(() => import('./SourceDetail'))
const SourceEdit = lazy(() => import('./SourceEdit'))
const AIConfig = lazy(() => import('./AIConfig'))

function QuickAddModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', organization: '', org_role: '' })
  const [duplicates, setDuplicates] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [orgQuery, setOrgQuery] = useState('')
  const [orgSuggestions, setOrgSuggestions] = useState([])
  const debounceRef = React.useRef(null)

  useEffect(() => {
    if (form.last_name.length < 2) { setDuplicates([]); return }
    const timer = setTimeout(() => {
      checkDuplicates(form.first_name, form.last_name, form.email, form.organization).then(setDuplicates).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [form.first_name, form.last_name, form.email, form.organization])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (orgQuery.length < 2) { setOrgSuggestions([]); return }
    debounceRef.current = setTimeout(() => {
      listOrganizations({ search: orgQuery, limit: 6 })
        .then(data => setOrgSuggestions(data.organizations || []))
        .catch(() => {})
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [orgQuery])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createProducer(form)
      onCreated(result)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Quick Add Producer" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={submitting || !form.first_name.trim() || !form.last_name.trim()}>
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </>}>
      {duplicates.length > 0 && (
        <div className="alert alert-warning alert-compact">
          <div className="alert-content">
            <div className="alert-title">Possible duplicate{duplicates.length > 1 ? 's' : ''}</div>
            {duplicates.map(d => (
              <div key={d.id} className="quick-add-dup-entry">
                {d.first_name} {d.last_name}
                {d.current_organization && <span className="cell-muted"> — {d.current_organization}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="alert alert-error alert-compact">
          <div className="alert-content"><div className="alert-title">{error}</div></div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-grid-2col-sm mb-16">
          <div>
            <label className="input-label">First Name *</label>
            <input className="input" value={form.first_name}
              onChange={e => setForm(prev => ({ ...prev, first_name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="input-label">Last Name *</label>
            <input className="input" value={form.last_name}
              onChange={e => setForm(prev => ({ ...prev, last_name: e.target.value }))} />
          </div>
        </div>
        <div className="mb-16">
          <label className="input-label">Email</label>
          <input className="input input-full" type="email" value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
        </div>
        <div className="form-grid-2col-sm">
          <div className="relative">
            <label className="input-label">Organization</label>
            <input className="input" value={orgQuery}
              onChange={e => { setOrgQuery(e.target.value); setForm(prev => ({ ...prev, organization: e.target.value })) }}
              placeholder="Type to search..." />
            {orgSuggestions.length > 0 && (
              <div className="autocomplete-dropdown autocomplete-dropdown--compact">
                {orgSuggestions.map(org => (
                  <div key={org.id} className="autocomplete-option autocomplete-option--sm"
                    onMouseDown={() => { setOrgQuery(org.name); setForm(prev => ({ ...prev, organization: org.name })); setOrgSuggestions([]) }}>
                    {org.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="input-label">Role</label>
            <input className="input" value={form.org_role}
              onChange={e => setForm(prev => ({ ...prev, org_role: e.target.value }))} placeholder="e.g. Producer" />
          </div>
        </div>
      </form>
    </Modal>
  )
}

// SVG icons for sidebar links
const icons = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  query: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" /><path d="M9 21h6" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>,
  discovery: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  building: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22V12h6v10" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>,
  show: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  theatre: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>,
  venue: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
  options: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="18" r="2" fill="currentColor" /></svg>,
  source: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  brain: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a7 7 0 00-4.6 12.3c.6.5 1 1.2 1.1 2l.1 1.2a1.5 1.5 0 001.5 1.5h3.8a1.5 1.5 0 001.5-1.5l.1-1.2c.1-.8.5-1.5 1.1-2A7 7 0 0012 2z" /><path d="M10 21.5h4M9.5 9.5c0-1.4 1.1-2.5 2.5-2.5M8 12c-1.1 0-2-.9-2-2s.9-2 2-2M16 12c1.1 0 2-.9 2-2s-.9-2-2-2" /></svg>,
}

function Sidebar({ onQuickAdd }) {
  const [discoveryCount, setDiscoveryCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  const producersActive = /^\/producers\/(list|add|detail)/.test(pathname)
  const orgsActive = /^\/producers\/organizations/.test(pathname)
  const showsActive = /^\/producers\/shows/.test(pathname)
  const venuesActive = /^\/producers\/venues/.test(pathname)
  const platformsActive = /^\/producers\/social-platforms/.test(pathname)
  const tagsActive = /^\/producers\/tags/.test(pathname)
  const optionsActive = /^\/producers\/options/.test(pathname)
  const sourcesActive = /^\/producers\/data-sources/.test(pathname)
  const aiConfigActive = /^\/producers\/ai-config/.test(pathname)

  useEffect(() => {
    getDiscoveryCandidates('pending')
      .then(c => setDiscoveryCount(c.length))
      .catch(() => {})
  }, [])

  // Close sidebar on navigation (mobile)
  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
        </svg>
      </button>
      <div className={`sidebar-backdrop${mobileOpen ? ' open' : ''}`} onClick={() => setMobileOpen(false)} />
      <aside className={`sidebar-nav${mobileOpen ? ' open' : ''}`}>
        <div className="sidebar-nav-header">
          <button className="btn btn-primary btn-full"
            onClick={onQuickAdd}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Quick Add
          </button>
        </div>

        <nav>
          <NavLink to="/producers" end className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
            {icons.dashboard} Dashboard
          </NavLink>
          <NavLink to="/producers/query" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
            {icons.query} AI Query
          </NavLink>

          <div className="sidebar-nav-section">People</div>
          <NavLink to="/producers/list" className={() => `sidebar-nav-link${producersActive ? ' active' : ''}`}>
            {icons.users} All Producers
          </NavLink>
          <NavLink to="/producers/discovery" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
            {icons.discovery} Discovery
            {discoveryCount > 0 && <span className="sidebar-nav-badge">{discoveryCount}</span>}
          </NavLink>
          <NavLink to="/producers/import" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
            {icons.upload} Import
          </NavLink>

          <div className="sidebar-nav-section">Management</div>
          <NavLink to="/producers/organizations" className={() => `sidebar-nav-link${orgsActive ? ' active' : ''}`}>
            {icons.building} Organizations
          </NavLink>
          <NavLink to="/producers/shows" className={() => `sidebar-nav-link${showsActive ? ' active' : ''}`}>
            {icons.show} Shows
          </NavLink>
          <NavLink to="/producers/venues" className={() => `sidebar-nav-link${venuesActive ? ' active' : ''}`}>
            {icons.venue} Venues
          </NavLink>
          <NavLink to="/producers/social-platforms" className={() => `sidebar-nav-link${platformsActive ? ' active' : ''}`}>
            {icons.link} Social Platforms
          </NavLink>

          <div className="sidebar-nav-section">Data</div>
          <NavLink to="/producers/tags" className={() => `sidebar-nav-link${tagsActive ? ' active' : ''}`}>
            {icons.tag} Tags
          </NavLink>
          <NavLink to="/producers/options" className={() => `sidebar-nav-link${optionsActive ? ' active' : ''}`}>
            {icons.options} Options
          </NavLink>
          <NavLink to="/producers/data-sources" className={() => `sidebar-nav-link${sourcesActive ? ' active' : ''}`}>
            {icons.source} Data Sources
          </NavLink>

          <div className="sidebar-nav-section">Advanced</div>
          <NavLink to="/producers/ai-config" className={() => `sidebar-nav-link${aiConfigActive ? ' active' : ''}`}>
            {icons.brain} AI Configuration
          </NavLink>
        </nav>

        <div className="sidebar-nav-spacer" />

        <div className="sidebar-nav-footer">
          <NavLink to="/producers/settings" className={({ isActive }) => `sidebar-nav-link sidebar-nav-link--no-margin${isActive ? ' active' : ''}`}>
            {icons.settings} Settings
          </NavLink>
        </div>
      </aside>
    </>
  )
}

export default function ProducersPage() {
  const [quickAdd, setQuickAdd] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="sidebar-layout">
      <Sidebar onQuickAdd={() => setQuickAdd(true)} />
      <div className="main-content">
        <Suspense fallback={
          <div className="page-loading">
            <div className="loading-spinner" />
          </div>
        }>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="list" element={<ProducerList />} />
            <Route path="add" element={<AddProducer />} />
            <Route path="detail/:id" element={<ProducerDetail />} />
            <Route path="discovery" element={<DiscoveryQueue />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="query" element={<AIQuery />} />
            <Route path="settings" element={<Settings />} />
            <Route path="ai-config" element={<AIConfig />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/new" element={<OrganizationEdit />} />
            <Route path="organizations/:id" element={<OrganizationDetail />} />
            <Route path="organizations/:id/edit" element={<OrganizationEdit />} />
            <Route path="shows" element={<ShowsPage />} />
            <Route path="shows/new" element={<ShowEdit />} />
            <Route path="shows/:id" element={<ShowDetail />} />
            <Route path="shows/:id/edit" element={<ShowEdit />} />
            <Route path="productions/new" element={<ProductionEdit />} />
            <Route path="productions/:id" element={<ProductionDetail />} />
            <Route path="productions/:id/edit" element={<ProductionEdit />} />
            <Route path="venues" element={<VenuesPage />} />
            <Route path="venues/new" element={<VenueEdit />} />
            <Route path="venues/:id" element={<VenueDetail />} />
            <Route path="venues/:id/edit" element={<VenueEdit />} />
            <Route path="social-platforms" element={<SocialPlatformsPage />} />
            <Route path="social-platforms/new" element={<SocialPlatformEdit />} />
            <Route path="social-platforms/:id" element={<SocialPlatformDetail />} />
            <Route path="social-platforms/:id/edit" element={<SocialPlatformEdit />} />
            <Route path="options" element={<OptionsPage />} />
            <Route path="options/new" element={<OptionEdit />} />
            <Route path="options/:id/edit" element={<OptionEdit />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="tags/new" element={<TagEdit />} />
            <Route path="tags/:id" element={<TagDetail />} />
            <Route path="tags/:id/edit" element={<TagEdit />} />
            <Route path="data-sources" element={<SourcesPage />} />
            <Route path="data-sources/new" element={<SourceEdit />} />
            <Route path="data-sources/:id" element={<SourceDetail />} />
            <Route path="data-sources/:id/edit" element={<SourceEdit />} />
            <Route path="*" element={<Navigate to="/producers" replace />} />
          </Routes>
        </Suspense>
      </div>
      {quickAdd && (
        <QuickAddModal
          onClose={() => setQuickAdd(false)}
          onCreated={result => {
            setQuickAdd(false)
            navigate(`/producers/detail/${result.id}`)
          }}
        />
      )}
    </div>
  )
}
