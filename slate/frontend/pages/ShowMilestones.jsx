/**
 * Show > Milestones — development timeline with add/edit/delete.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { ActionMenu, Modal } from '@shared/components'
import SelectArrow from '@shared/components/SelectArrow'
import { listMilestones, createMilestone, updateMilestone, deleteMilestone, getLookupValues, listScripts } from '@slate/api'

export default function ShowMilestones({ show, onUpdate }) {
  const [milestones, setMilestones] = useState([])
  const [milestoneTypes, setMilestoneTypes] = useState([])
  const [scripts, setScripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [form, setForm] = useState({ title: '', date: '', description: '', milestone_type_id: '', script_version_id: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [mData, typeData, scriptData] = await Promise.all([
        listMilestones(show.id),
        getLookupValues({ category: 'milestone_type' }),
        listScripts(show.id),
      ])
      setMilestones(mData.milestones || [])
      setMilestoneTypes(typeData.lookup_values || [])
      setScripts(scriptData.scripts || [])
    } catch (err) {
      console.error('Failed to load milestones:', err)
    } finally {
      setLoading(false)
    }
  }, [show.id])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setForm({ title: '', date: '', description: '', milestone_type_id: '', script_version_id: '' })
    setModal('add')
    setError(null)
  }

  function openEdit(m) {
    setForm({
      title: m.title,
      date: m.date || '',
      description: m.description || '',
      milestone_type_id: m.milestone_type?.id || '',
      script_version_id: m.script_version_id || '',
    })
    setModal(m)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.date) return
    setSubmitting(true)
    setError(null)
    try {
      const data = {
        title: form.title.trim(),
        date: form.date,
        description: form.description || null,
        milestone_type_id: form.milestone_type_id ? parseInt(form.milestone_type_id) : null,
        script_version_id: form.script_version_id ? parseInt(form.script_version_id) : null,
      }
      if (modal === 'add') {
        await createMilestone(show.id, data)
      } else {
        await updateMilestone(show.id, modal.id, data)
      }
      setModal(null)
      load()
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    try {
      await deleteMilestone(show.id, deleteConfirm.id)
      setDeleteConfirm(null)
      load()
      onUpdate()
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleteConfirm(null)
    }
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  return (
    <div>
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-card-title">Development Timeline</h2>
          <div className="section-card-actions">
            <button className="btn btn-secondary btn-sm" onClick={openAdd}>Add Milestone</button>
          </div>
        </div>

        {milestones.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="20" cy="20" r="16" />
                <path d="M20 10v10l7 5" />
              </svg>
            </div>
            <div className="empty-state-title">No milestones yet</div>
            <div className="empty-state-desc">Track readings, workshops, submissions, and other development events.</div>
            <button className="btn btn-primary" onClick={openAdd}>Add First Milestone</button>
          </div>
        ) : (
          <div className="timeline">
            {milestones.map((m, i) => (
              <div key={m.id} className="timeline-item">
                <div className={`timeline-dot${i === 0 ? ' timeline-dot-active' : ''}`} />
                <div className="timeline-date">
                  {m.date ? new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </div>
                <div className="timeline-content">
                  <strong>{m.title}</strong>
                  {m.milestone_type && (
                    <span className={`badge ${m.milestone_type.css_class || 'badge-neutral'}`}>
                      {m.milestone_type.display_label}
                    </span>
                  )}
                  <ActionMenu items={[
                    { label: 'Edit', icon: 'M11 1.5l2 2-7.5 7.5H3.5v-2L11 1.5z', onClick: () => openEdit(m) },
                    { divider: true },
                    { label: 'Delete', icon: 'M2 4h11M5.5 4V2.5h4V4M3.5 4v8.5a1 1 0 001 1h6a1 1 0 001-1V4', onClick: () => setDeleteConfirm(m), destructive: true },
                  ]} />
                  {m.description && <div>{m.description}</div>}
                  {m.script_version_label && (
                    <div className="type-meta">Script: {m.script_version_label}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Milestone' : 'Edit Milestone'} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}
              disabled={submitting || !form.title.trim() || !form.date}>
              {submitting ? 'Saving...' : (modal === 'add' ? 'Add' : 'Save')}
            </button>
          </>}>
          <form onSubmit={handleSubmit} className="field-stack">
            <div>
              <label className="input-label">Title *</label>
              <input className="input" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Workshop at NYTW" autoFocus />
            </div>
            <div>
              <label className="input-label">Date *</label>
              <input className="input" type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Type</label>
              <div className="select-wrapper">
                <select className="select" value={form.milestone_type_id}
                  onChange={e => setForm(p => ({ ...p, milestone_type_id: e.target.value }))}>
                  <option value="">Select type...</option>
                  {milestoneTypes.map(t => <option key={t.id} value={t.id}>{t.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>
            <div>
              <label className="input-label">Description</label>
              <textarea className="textarea" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Notes, outcomes, observations" rows={3} />
            </div>
            {scripts.length > 0 && (
              <div>
                <label className="input-label">Linked Script Version</label>
                <div className="select-wrapper">
                  <select className="select" value={form.script_version_id}
                    onChange={e => setForm(p => ({ ...p, script_version_id: e.target.value }))}>
                    <option value="">None</option>
                    {scripts.map(s => <option key={s.id} value={s.id}>{s.version_label}</option>)}
                  </select>
                  <SelectArrow />
                </div>
              </div>
            )}
            {error && <div className="field-error">{error}</div>}
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Delete Milestone" onClose={() => setDeleteConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={confirmDelete}>Delete</button>
          </>}>
          <p className="confirm-body">
            Permanently delete <strong>{deleteConfirm.title}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
