/**
 * Show > Characters — readable cast breakdown from AI analysis.
 * Each character displayed as a content block, not a database table.
 * Editing via ActionMenu → modal.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { ActionMenu, Modal } from '@shared/components'
import { getShowDataByType, updateShowData, getShowData } from '@slate/api'

export default function ShowCharacters({ show }) {
  const [characters, setCharacters] = useState(null)
  const [dataRecord, setDataRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [addModal, setAddModal] = useState(false)

  const isMusical = show.medium?.value === 'musical'

  const load = useCallback(async () => {
    try {
      const res = await getShowDataByType(show.id, 'character_breakdown')
      if (res && res.content) {
        setDataRecord(res)
        setCharacters(res.content.characters || res.content.items || [])
      } else {
        setCharacters(null)
        setDataRecord(null)
      }
    } catch (err) {
      // 404 means no data yet
      setCharacters(null)
      setDataRecord(null)
    } finally {
      setLoading(false)
    }
  }, [show.id])

  useEffect(() => { load() }, [load])

  function openEditModal(character, index) {
    setEditForm({
      index,
      name: character.name || '',
      description: character.description || '',
      age_range: character.age_range || '',
      gender: character.gender || '',
      line_count: character.line_count || '',
      vocal_range: character.vocal_range || '',
      song_count: character.song_count || '',
      dance_requirements: character.dance_requirements || '',
      notes: character.notes || '',
    })
    setEditModal(true)
  }

  function openAddModal() {
    setEditForm({
      index: -1,
      name: '',
      description: '',
      age_range: '',
      gender: '',
      line_count: '',
      vocal_range: '',
      song_count: '',
      dance_requirements: '',
      notes: '',
    })
    setAddModal(true)
  }

  async function handleSaveCharacter(e) {
    e.preventDefault()
    if (!editForm.name.trim()) return
    setSaving(true)
    try {
      const updated = [...(characters || [])]
      const charData = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        age_range: editForm.age_range.trim(),
        gender: editForm.gender.trim(),
        line_count: editForm.line_count ? parseInt(editForm.line_count, 10) || editForm.line_count : '',
        vocal_range: editForm.vocal_range.trim(),
        song_count: editForm.song_count ? parseInt(editForm.song_count, 10) || editForm.song_count : '',
        dance_requirements: editForm.dance_requirements.trim(),
        notes: editForm.notes.trim(),
      }

      if (editForm.index >= 0) {
        updated[editForm.index] = { ...updated[editForm.index], ...charData }
      } else {
        updated.push(charData)
      }

      const content = { ...(dataRecord?.content || {}), characters: updated }
      await updateShowData(show.id, dataRecord.id, { content })
      setEditModal(false)
      setAddModal(false)
      load()
    } catch (err) {
      console.error('Failed to save character:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCharacter(index) {
    if (!confirm('Remove this character from the breakdown?')) return
    try {
      const updated = [...characters]
      updated.splice(index, 1)
      const content = { ...(dataRecord?.content || {}), characters: updated }
      await updateShowData(show.id, dataRecord.id, { content })
      load()
    } catch (err) {
      console.error('Failed to delete character:', err)
    }
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  if (!characters || characters.length === 0) {
    return (
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-card-title">Characters</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="20" cy="14" r="6" />
              <path d="M8 34c0-6.627 5.373-12 12-12s12 5.373 12 12" />
            </svg>
          </div>
          <div className="empty-state-title">No characters yet</div>
          <div className="empty-state-desc">
            Upload a script to unlock character breakdowns — names, descriptions, age ranges, vocal ranges, and more.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-card-title">Characters</h2>
          <div className="section-card-actions">
            <button className="btn btn-secondary btn-sm" onClick={openAddModal}>Add Character</button>
          </div>
        </div>
        <div className="slate-character-list">
          {characters.map((char, i) => {
            const metaParts = []
            if (char.age_range) metaParts.push(char.age_range)
            if (char.gender) metaParts.push(char.gender)
            if (char.line_count) metaParts.push(`${char.line_count} lines`)
            if (isMusical && char.vocal_range) metaParts.push(char.vocal_range)
            if (isMusical && char.song_count) metaParts.push(`${char.song_count} songs`)
            if (isMusical && char.dance_requirements) metaParts.push(char.dance_requirements)

            return (
              <div key={i} className="slate-character-block">
                <div className="slate-character-header">
                  <h3 className="type-display-2">{char.name}</h3>
                  <ActionMenu items={[
                    {
                      label: 'Edit',
                      icon: 'M13.5 3.5l3 3L5.5 17.5H2.5v-3L13.5 3.5z',
                      onClick: () => openEditModal(char, i),
                    },
                    { divider: true },
                    {
                      label: 'Remove',
                      icon: 'M2 4h11M5 4V2.5h5V4M3.5 4v9a1.5 1.5 0 001.5 1.5h5a1.5 1.5 0 001.5-1.5V4',
                      destructive: true,
                      onClick: () => handleDeleteCharacter(i),
                    },
                  ]} />
                </div>
                {char.description && <div className="prose">{char.description}</div>}
                {metaParts.length > 0 && (
                  <div className="slate-character-meta">
                    {metaParts.map((part, j) => (
                      <span key={j} className="type-meta">
                        {j > 0 && <span className="slate-middot">&middot;</span>}
                        {part}
                      </span>
                    ))}
                  </div>
                )}
                {char.notes && <div className="text-secondary slate-character-notes">{char.notes}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit / Add modal */}
      {(editModal || addModal) && (
        <Modal
          title={editModal ? 'Edit Character' : 'Add Character'}
          onClose={() => { setEditModal(false); setAddModal(false) }}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => { setEditModal(false); setAddModal(false) }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveCharacter} disabled={saving || !editForm.name.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveCharacter} className="field-stack">
            <div>
              <label className="input-label">Name *</label>
              <input className="input" value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Character name" autoFocus />
            </div>
            <div>
              <label className="input-label">Description</label>
              <textarea className="textarea" value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Character description" rows={3} />
            </div>
            <div className="slate-form-grid">
              <div>
                <label className="input-label">Age Range</label>
                <input className="input" value={editForm.age_range}
                  onChange={e => setEditForm(p => ({ ...p, age_range: e.target.value }))}
                  placeholder="e.g. 25-35" />
              </div>
              <div>
                <label className="input-label">Gender</label>
                <input className="input" value={editForm.gender}
                  onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))}
                  placeholder="e.g. Female" />
              </div>
            </div>
            <div>
              <label className="input-label">Line Count</label>
              <input className="input" value={editForm.line_count}
                onChange={e => setEditForm(p => ({ ...p, line_count: e.target.value }))}
                placeholder="Approximate number of lines" />
            </div>
            {isMusical && (
              <>
                <div className="slate-form-grid">
                  <div>
                    <label className="input-label">Vocal Range</label>
                    <input className="input" value={editForm.vocal_range}
                      onChange={e => setEditForm(p => ({ ...p, vocal_range: e.target.value }))}
                      placeholder="e.g. Alto, G3-E5" />
                  </div>
                  <div>
                    <label className="input-label">Song Count</label>
                    <input className="input" value={editForm.song_count}
                      onChange={e => setEditForm(p => ({ ...p, song_count: e.target.value }))}
                      placeholder="Number of songs" />
                  </div>
                </div>
                <div>
                  <label className="input-label">Dance Requirements</label>
                  <input className="input" value={editForm.dance_requirements}
                    onChange={e => setEditForm(p => ({ ...p, dance_requirements: e.target.value }))}
                    placeholder="e.g. Heavy movement, ballet" />
                </div>
              </>
            )}
            <div>
              <label className="input-label">Notes</label>
              <textarea className="textarea" value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Additional notes" rows={2} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
