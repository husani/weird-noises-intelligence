/**
 * Show > Scripts / Book & Score — script version management with music files.
 * Shows processing status when a version is being analyzed.
 * Polls for updates during processing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '@shared/components/Modal'
import SelectArrow from '@shared/components/SelectArrow'
import FileUpload from '@shared/components/FileUpload'
import {
  listScripts, uploadScript, deleteScript, downloadScript,
  listMusic, uploadMusic, deleteMusic, downloadMusic,
  getLookupValues, reprocessScript,
} from '@slate/api'

export default function ShowScripts({ show, onUpdate }) {
  const [versions, setVersions] = useState([])
  const [trackTypes, setTrackTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [musicByVersion, setMusicByVersion] = useState({})
  const [uploadModal, setUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({ version_number: '', change_notes: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [musicModal, setMusicModal] = useState(null)
  const [musicForm, setMusicForm] = useState({ track_name: '', track_type_id: '', description: '' })
  const [musicFile, setMusicFile] = useState(null)
  const [musicUploading, setMusicUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const musicFileRef = useRef(null)
  const pollRef = useRef(null)

  const isMusical = show.medium?.value === 'musical'

  const load = useCallback(async () => {
    try {
      const [scriptData, typeData] = await Promise.all([
        listScripts(show.id),
        getLookupValues({ category: 'track_type' }),
      ])
      setVersions(scriptData.scripts || [])
      setTrackTypes(typeData.lookup_values || [])
      if (scriptData.scripts?.length > 0 && expanded === null) {
        setExpanded(scriptData.scripts[0].id)
      }
    } catch (err) {
      console.error('Failed to load scripts:', err)
    } finally {
      setLoading(false)
    }
  }, [show.id])

  useEffect(() => { load() }, [load])

  // Poll when any version is processing
  useEffect(() => {
    const hasProcessing = versions.some(v => v.processing_status === 'processing')
    if (hasProcessing) {
      pollRef.current = setInterval(() => {
        load()
      }, 4000)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [versions, load])

  async function loadMusic(versionId) {
    if (musicByVersion[versionId]) return
    try {
      const data = await listMusic(show.id, versionId)
      setMusicByVersion(prev => ({ ...prev, [versionId]: data.music_files || [] }))
    } catch (err) {
      console.error('Failed to load music:', err)
    }
  }

  function toggleExpand(versionId) {
    if (expanded === versionId) {
      setExpanded(null)
    } else {
      setExpanded(versionId)
      loadMusic(versionId)
    }
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!uploadFile || !uploadForm.version_number) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('version_number', uploadForm.version_number)
      fd.append('change_notes', uploadForm.change_notes)
      await uploadScript(show.id, fd)
      setUploadModal(false)
      setUploadFile(null)
      setUploadForm({ version_number: '', change_notes: '' })
      load()
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(versionId) {
    try {
      const data = await downloadScript(show.id, versionId)
      window.open(data.url, '_blank')
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  async function handleDelete(versionId) {
    if (!confirm('Delete this script version and all associated music files?')) return
    try {
      await deleteScript(show.id, versionId)
      load()
      onUpdate()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handleReprocess(versionId) {
    try {
      await reprocessScript(show.id, versionId)
      load()
      onUpdate()
    } catch (err) {
      console.error('Reprocess failed:', err)
    }
  }

  async function handleMusicUpload(e) {
    e.preventDefault()
    if (!musicFile || !musicForm.track_name.trim()) return
    setMusicUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', musicFile)
      fd.append('track_name', musicForm.track_name.trim())
      if (musicForm.track_type_id) fd.append('track_type_id', musicForm.track_type_id)
      if (musicForm.description) fd.append('description', musicForm.description)
      const versionId = musicModal
      await uploadMusic(show.id, versionId, fd)
      setMusicModal(null)
      setMusicFile(null)
      setMusicForm({ track_name: '', track_type_id: '', description: '' })
      setMusicByVersion(prev => ({ ...prev, [versionId]: undefined }))
      setTimeout(() => loadMusic(versionId), 100)
    } catch (err) {
      setError(err.message)
    } finally {
      setMusicUploading(false)
    }
  }

  async function handleMusicDownload(versionId, musicId) {
    try {
      const data = await downloadMusic(show.id, versionId, musicId)
      window.open(data.url, '_blank')
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  async function handleMusicDelete(versionId, musicId) {
    if (!confirm('Delete this music file?')) return
    try {
      await deleteMusic(show.id, versionId, musicId)
      setMusicByVersion(prev => ({ ...prev, [versionId]: undefined }))
      loadMusic(versionId)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  const statusColor = {
    pending: 'status-neutral',
    processing: 'status-warm',
    complete: 'status-sage',
    failed: 'status-rose',
  }

  function renderProcessingIndicator(version) {
    return (
      <div className="processing-panel">
        <div className="processing-panel-header">
          <span className="processing-panel-title">Script Analysis</span>
          <span className="status status-warm">
            <span className="status-dot pulse" />
            Processing
          </span>
        </div>
        <div className="processing-panel-progress">
          <div className="progress-bar-track">
            <div className="progress-bar-fill progress-bar-indeterminate" />
          </div>
        </div>
        <div className="prose text-secondary">
          Analyzing script for characters, scenes, emotional arc, casting requirements, and more. This page will update automatically when complete.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-card-title">{isMusical ? 'Book & Score' : 'Scripts'}</h2>
          <div className="section-card-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setUploadModal(true)}>Upload Version</button>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 4h16l8 8v24a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
                <path d="M24 4v8h8" />
              </svg>
            </div>
            <div className="empty-state-title">No script uploaded</div>
            <div className="empty-state-desc">Upload a script to unlock dramaturgical analysis, character breakdowns, casting requirements, and more.</div>
            <button className="btn btn-primary" onClick={() => setUploadModal(true)}>Upload Script</button>
          </div>
        ) : (
          <div className="version-stack">
            {versions.map((v, i) => {
              const isLatest = i === 0
              const isOpen = expanded === v.id
              const music = musicByVersion[v.id] || []
              const isVersionProcessing = v.processing_status === 'processing'

              return (
                <div key={v.id} className={`version-entry${isLatest ? ' version-entry-latest' : ''}${isOpen ? ' open' : ''}`}>
                  <div className="version-entry-header" onClick={() => toggleExpand(v.id)}>
                    <span className="version-entry-label">{v.version_label}</span>
                    {v.processing_status && v.processing_status !== 'complete' && (
                      <span className={`status ${statusColor[v.processing_status] || 'status-neutral'}`}>
                        <span className={`status-dot${v.processing_status === 'processing' ? ' pulse' : ''}`} />
                        {v.processing_status.charAt(0).toUpperCase() + v.processing_status.slice(1)}
                      </span>
                    )}
                    <span className="version-entry-date">
                      {v.upload_date ? new Date(v.upload_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : ''}
                    </span>
                    <svg className="version-entry-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </div>
                  <div className={`version-entry-content${isOpen ? '' : ' collapsed'}`}>
                    {v.change_notes && <div>{v.change_notes}</div>}

                    {/* Processing indicator */}
                    {isVersionProcessing && (
                      <div className="slate-processing-wrapper">
                        {renderProcessingIndicator(v)}
                      </div>
                    )}

                    <div className="version-entry-nested">
                      <div className="file-item">
                        <svg className="file-item-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                          <path d="M12 2v4h4" />
                        </svg>
                        <span className="file-item-name">{v.original_filename}</span>
                        <button className="btn-link" onClick={() => handleDownload(v.id)}>Download</button>
                        <button className="btn-link" onClick={() => handleReprocess(v.id)}>Reprocess</button>
                        <svg className="file-item-remove" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                          onClick={() => handleDelete(v.id)}>
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </div>

                      {music.map(m => (
                        <div key={m.id}>
                          <div className="file-item">
                            <svg className="file-item-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="10" cy="12" r="4" /><path d="M10 8V3M6 5l4-2 4 2" />
                            </svg>
                            <span className="file-item-name">{m.track_name}</span>
                            <span className="file-item-meta">{m.original_filename}</span>
                            {m.track_type && <span className="badge badge-neutral">{m.track_type.display_label}</span>}
                            <button className="btn-link" onClick={() => handleMusicDownload(v.id, m.id)}>Download</button>
                            <svg className="file-item-remove" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                              onClick={() => handleMusicDelete(v.id, m.id)}>
                              <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                          </div>
                          {/* Music analysis from fields on the music file record */}
                          {(m.analysis_key || m.analysis_tempo || m.analysis_mood || m.analysis_function) && (
                            <div className="slate-music-analysis">
                              {m.analysis_key && (
                                <span className="type-meta">Key: {m.analysis_key}</span>
                              )}
                              {m.analysis_tempo && (
                                <span className="type-meta">
                                  <span className="slate-middot">&middot;</span>
                                  Tempo: {m.analysis_tempo}
                                </span>
                              )}
                              {m.analysis_mood && (
                                <span className="type-meta">
                                  <span className="slate-middot">&middot;</span>
                                  Mood: {m.analysis_mood}
                                </span>
                              )}
                              {m.analysis_function && (
                                <span className="type-meta">
                                  <span className="slate-middot">&middot;</span>
                                  {m.analysis_function}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <button className="btn btn-ghost btn-sm" onClick={() => setMusicModal(v.id)}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M7 3v8M3 7h8" />
                        </svg>
                        Add Music
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {uploadModal && (
        <Modal title="Upload Script Version" onClose={() => setUploadModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setUploadModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadForm.version_number}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </>}>
          <form onSubmit={handleUpload} className="field-stack">
            <div>
              <label className="input-label">File *</label>
              <FileUpload file={uploadFile} onFile={setUploadFile} accept=".pdf,.docx,.fdx" description="PDF, DOCX, or FDX" />
            </div>
            <div>
              <label className="input-label">Version Number *</label>
              <input className="input" type="number" min="1" value={uploadForm.version_number}
                onChange={e => setUploadForm(p => ({ ...p, version_number: e.target.value }))}
                placeholder="e.g. 1" autoFocus />
            </div>
            <div>
              <label className="input-label">Change Notes</label>
              <textarea className="textarea" value={uploadForm.change_notes}
                onChange={e => setUploadForm(p => ({ ...p, change_notes: e.target.value }))}
                placeholder="What changed from the previous version" rows={3} />
            </div>
            {error && <div className="field-error">{error}</div>}
          </form>
        </Modal>
      )}

      {musicModal && (
        <Modal title="Add Music File" onClose={() => setMusicModal(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setMusicModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleMusicUpload}
              disabled={musicUploading || !musicFile || !musicForm.track_name.trim()}>
              {musicUploading ? 'Uploading...' : 'Upload'}
            </button>
          </>}>
          <form onSubmit={handleMusicUpload} className="field-stack">
            <div>
              <label className="input-label">File *</label>
              <FileUpload file={musicFile} onFile={setMusicFile} accept=".mp3,.wav,.aiff,.m4a,.flac" description="MP3, WAV, AIFF, M4A, or FLAC" />
            </div>
            <div>
              <label className="input-label">Track Name *</label>
              <input className="input" value={musicForm.track_name}
                onChange={e => setMusicForm(p => ({ ...p, track_name: e.target.value }))}
                placeholder="e.g. Opening Number Demo" autoFocus />
            </div>
            <div>
              <label className="input-label">Track Type</label>
              <div className="select-wrapper">
                <select className="select" value={musicForm.track_type_id}
                  onChange={e => setMusicForm(p => ({ ...p, track_type_id: e.target.value }))}>
                  <option value="">Select type...</option>
                  {trackTypes.map(t => <option key={t.id} value={t.id}>{t.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>
            <div>
              <label className="input-label">Description</label>
              <textarea className="textarea" value={musicForm.description}
                onChange={e => setMusicForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional notes about this track" rows={2} />
            </div>
            {error && <div className="field-error">{error}</div>}
          </form>
        </Modal>
      )}
    </div>
  )
}
