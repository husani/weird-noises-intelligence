/**
 * Producer organizations section — affiliations with roles and dates.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Modal } from '@shared/components'
import { listOrganizations, addAffiliation, updateAffiliation, removeAffiliation } from '@producers/api'

export default function ProducerOrganizations({ producerId, organizations, onUpdate }) {
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [orgQuery, setOrgQuery] = useState('')
  const [orgSuggestions, setOrgSuggestions] = useState([])
  const [form, setForm] = useState({ organization_name: '', role_title: '', start_date: '', end_date: '' })
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (orgQuery.length < 2) { setOrgSuggestions([]); return }
    debounceRef.current = setTimeout(() => {
      listOrganizations({ search: orgQuery, limit: 8 })
        .then(data => setOrgSuggestions(data.organizations || []))
        .catch(() => {})
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [orgQuery])

  function openAdd() {
    setForm({ organization_name: '', role_title: '', start_date: '', end_date: '' })
    setOrgQuery('')
    setOrgSuggestions([])
    setAddModal(true)
  }

  function openEdit(org) {
    setForm({
      organization_name: org.name,
      role_title: org.role_title || '',
      start_date: org.start_date || '',
      end_date: org.end_date || '',
    })
    setEditModal(org)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.organization_name.trim()) return
    await addAffiliation(producerId, form)
    setAddModal(false)
    onUpdate()
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editModal) return
    await updateAffiliation(producerId, editModal.id, {
      role_title: form.role_title,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    })
    setEditModal(null)
    onUpdate()
  }

  async function handleRemove(affId) {
    await removeAffiliation(producerId, affId)
    onUpdate()
  }

  return (
    <div>
      <div className="producer-section-header">
        <h3 className="type-display-2">Organizations</h3>
        <button className="btn btn-ghost" onClick={openAdd}>Add</button>
      </div>

      {organizations.length === 0 ? (
        <div className="cell-muted">No organization affiliations yet.</div>
      ) : (
        <ul className="item-list">
          {organizations.map(o => (
            <li key={o.id || o.organization_id} className="item-row">
              <div>
                <div className="item-primary">{o.name}</div>
                <div className="item-secondary">
                  {o.role_title || ''}
                  {o.start_date && ` \u2014 since ${o.start_date}`}
                  {!o.end_date && o.start_date && ' (current)'}
                </div>
              </div>
              <div className="item-row-actions">
                <button className="btn btn-ghost" onClick={() => openEdit(o)}>Edit</button>
                <button className="btn btn-ghost" onClick={() => handleRemove(o.id || o.organization_id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addModal && (
        <Modal title="Add Organization" onClose={() => setAddModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!form.organization_name.trim()}>Add</button>
          </>}>
          <form onSubmit={handleAdd}>
            <div className="field-stack">
              <div style={{ position: 'relative' }}>
                <label className="input-label">Organization</label>
                <input className="input" placeholder="Type to search..."
                  value={orgQuery}
                  onChange={e => { setOrgQuery(e.target.value); setForm(prev => ({ ...prev, organization_name: e.target.value })) }}
                  autoFocus />
                {orgSuggestions.length > 0 && (
                  <div className="dropdown-select-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4 }}>
                    {orgSuggestions.map(org => (
                      <div key={org.id} className="dropdown-select-option"
                        onMouseDown={() => { setOrgQuery(org.name); setForm(prev => ({ ...prev, organization_name: org.name })); setOrgSuggestions([]) }}>
                        <div className="dropdown-select-check-empty" />
                        {org.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="input-label">Role / Title</label>
                <input className="input" placeholder="e.g. Executive Producer"
                  value={form.role_title} onChange={e => setForm(prev => ({ ...prev, role_title: e.target.value }))} />
              </div>
              <div className="producer-detail-grid">
                <div>
                  <label className="input-label">Start Date</label>
                  <input className="input" type="date" value={form.start_date}
                    onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">End Date</label>
                  <input className="input" type="date" value={form.end_date}
                    onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))} />
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {editModal && (
        <Modal title={`Edit \u2014 ${editModal.name}`} onClose={() => setEditModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdate}>Save</button>
          </>}>
          <form onSubmit={handleUpdate}>
            <div className="field-stack">
              <div>
                <label className="input-label">Role / Title</label>
                <input className="input" value={form.role_title}
                  onChange={e => setForm(prev => ({ ...prev, role_title: e.target.value }))} autoFocus />
              </div>
              <div className="producer-detail-grid">
                <div>
                  <label className="input-label">Start Date</label>
                  <input className="input" type="date" value={form.start_date}
                    onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">End Date</label>
                  <input className="input" type="date" value={form.end_date}
                    onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))} />
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
