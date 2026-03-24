/**
 * Show > Visual Identity — asset gallery with upload, download, delete, set primary.
 * Shows visual analysis alongside assets when available.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '@shared/components/Modal'
import SelectArrow from '@shared/components/SelectArrow'
import { listVisualAssets, uploadVisualAsset, updateVisualAsset, deleteVisualAsset, downloadVisualAsset, getLookupValues, getShowData } from '@slate/api'

export default function ShowVisual({ show, onUpdate }) {
  const [assets, setAssets] = useState([])
  const [assetTypes, setAssetTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({ label: '', asset_type_id: '', version: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [error, setError] = useState(null)
  const [visualAnalysis, setVisualAnalysis] = useState({})
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [assetData, typeData] = await Promise.all([
        listVisualAssets(show.id),
        getLookupValues({ category: 'asset_type' }),
      ])
      setAssets(assetData.assets || [])
      setAssetTypes(typeData.lookup_values || [])
    } catch (err) {
      console.error('Failed to load assets:', err)
    } finally {
      setLoading(false)
    }
  }, [show.id])

  const loadAnalysis = useCallback(async () => {
    try {
      const res = await getShowData(show.id)
      const allData = [
        ...(res.script_data || []),
        ...(res.music_data || []),
        ...(res.visual_data || []),
      ]
      const analysisMap = {}
      allData.forEach(d => {
        if (d.data_type === 'visual_analysis' && d.source_type === 'visual_asset' && d.source_id) {
          analysisMap[d.source_id] = d.content
        }
      })
      setVisualAnalysis(analysisMap)
    } catch (err) {
      // Ignore errors loading analysis
    }
  }, [show.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadAnalysis() }, [loadAnalysis])

  function openUploadModal() {
    setUploadForm({ label: '', asset_type_id: '', version: '' })
    setUploadFile(null)
    setError(null)
    setUploadModal(true)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!uploadFile || !uploadForm.label.trim()) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('label', uploadForm.label.trim())
      if (uploadForm.asset_type_id) fd.append('asset_type_id', uploadForm.asset_type_id)
      if (uploadForm.version) fd.append('version', uploadForm.version)
      await uploadVisualAsset(show.id, fd)
      setUploadModal(false)
      setUploadFile(null)
      setUploadForm({ label: '', asset_type_id: '', version: '' })
      load()
      loadAnalysis()
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(assetId) {
    try {
      const data = await downloadVisualAsset(show.id, assetId)
      window.open(data.url, '_blank')
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  async function handleDelete(assetId) {
    if (!confirm('Delete this asset?')) return
    try {
      await deleteVisualAsset(show.id, assetId)
      load()
      onUpdate()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handleSetPrimary(assetId) {
    try {
      await updateVisualAsset(show.id, assetId, { is_current: true })
      load()
    } catch (err) {
      console.error('Update failed:', err)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) setUploadFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  return (
    <div>
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-card-title">Visual Identity</h2>
        </div>

        {assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="6" width="32" height="28" rx="3" />
                <circle cx="14" cy="17" r="4" />
                <path d="M4 28l10-8 6 4 8-9 8 7" />
              </svg>
            </div>
            <div className="empty-state-title">No assets yet</div>
            <div className="empty-state-desc">Upload logos, key art, mood boards, and other visual materials for this show.</div>
            <button className="btn btn-primary" onClick={openUploadModal}>Upload Assets</button>
          </div>
        ) : (
          <div className="asset-gallery">
            {assets.map(a => {
              const analysis = visualAnalysis[a.id]
              const isAssetProcessing = a.processing_status === 'processing'

              return (
                <div key={a.id} className="asset-card">
                  <div className="asset-card-preview">
                    {a.is_current && <span className="asset-card-overlay">Primary</span>}
                    <div className="asset-card-actions">
                      <div className="asset-card-action" onClick={(e) => { e.stopPropagation(); handleDownload(a.id) }} title="Download">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M7 2v8M4 7l3 3 3-3" /><path d="M2 10v2h10v-2" />
                        </svg>
                      </div>
                      {!a.is_current && (
                        <div className="asset-card-action" onClick={(e) => { e.stopPropagation(); handleSetPrimary(a.id) }} title="Set as primary">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M7 1l1.8 3.6L13 5.3l-3 2.9.7 4.1L7 10.3 3.3 12.3l.7-4.1-3-2.9 4.2-.7z" />
                          </svg>
                        </div>
                      )}
                      <div className="asset-card-action" onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 3l8 8M11 3l-8 8" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="asset-card-info">
                    <div className="asset-card-label">
                      {a.label}{a.version ? ` \u2014 ${a.version}` : ''}
                      {isAssetProcessing && (
                        <span className="status status-warm slate-visual-processing-badge">
                          <span className="status-dot pulse" />
                          Processing
                        </span>
                      )}
                    </div>
                    <div className="asset-card-type">{a.asset_type?.display_label || 'Asset'}</div>
                  </div>
                  {analysis && (
                    <div className="slate-visual-analysis">
                      {analysis.mood && (
                        <div className="slate-visual-analysis-row">
                          <span className="type-label">Mood</span>
                          <span className="text-secondary">{analysis.mood}</span>
                        </div>
                      )}
                      {analysis.tone && (
                        <div className="slate-visual-analysis-row">
                          <span className="type-label">Tone</span>
                          <span className="text-secondary">{analysis.tone}</span>
                        </div>
                      )}
                      {analysis.visual_themes && (
                        <div className="slate-visual-analysis-row">
                          <span className="type-label">Themes</span>
                          <span className="text-secondary">
                            {Array.isArray(analysis.visual_themes) ? analysis.visual_themes.join(', ') : analysis.visual_themes}
                          </span>
                        </div>
                      )}
                      {analysis.color_palette && (
                        <div className="slate-visual-analysis-row">
                          <span className="type-label">Palette</span>
                          <span className="text-secondary">
                            {Array.isArray(analysis.color_palette) ? analysis.color_palette.join(', ') : analysis.color_palette}
                          </span>
                        </div>
                      )}
                      {analysis.communicates && (
                        <div className="slate-visual-analysis-comm">
                          <div className="prose text-secondary">{analysis.communicates}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="asset-card-upload" onClick={openUploadModal}>
              <div className="asset-card-upload-icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 8v12M8 14h12" />
                </svg>
              </div>
              <div className="asset-card-upload-text">Upload asset</div>
            </div>
          </div>
        )}
      </div>

      {uploadModal && (
        <Modal title="Upload Visual Asset" onClose={() => setUploadModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setUploadModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadForm.label.trim()}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </>}>
          <form onSubmit={handleUpload} className="field-stack">
            <div>
              <div className="file-upload" onClick={() => fileRef.current?.click()}
                onDrop={handleDrop} onDragOver={handleDragOver}>
                <div className="file-upload-icon">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 24V10M12 16l6-6 6 6"/><path d="M6 22v6a2 2 0 002 2h20a2 2 0 002-2v-6"/></svg>
                </div>
                <div className="file-upload-title">
                  {uploadFile ? uploadFile.name : <>Drop file here or <span className="file-upload-link">browse</span></>}
                </div>
                <div className="file-upload-desc">PNG, JPG, SVG, or PDF</div>
              </div>
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.pdf" hidden
                onChange={e => setUploadFile(e.target.files[0])} />
            </div>
            <div>
              <label className="input-label">Label *</label>
              <input className="input" value={uploadForm.label}
                onChange={e => setUploadForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Logo v2" />
            </div>
            <div>
              <label className="input-label">Asset Type</label>
              <div className="select-wrapper">
                <select className="select" value={uploadForm.asset_type_id}
                  onChange={e => setUploadForm(p => ({ ...p, asset_type_id: e.target.value }))}>
                  <option value="">Select type...</option>
                  {assetTypes.map(t => <option key={t.id} value={t.id}>{t.display_label}</option>)}
                </select>
                <SelectArrow />
              </div>
            </div>
            <div>
              <label className="input-label">Version</label>
              <input className="input" value={uploadForm.version}
                onChange={e => setUploadForm(p => ({ ...p, version: e.target.value }))} placeholder="e.g. v2" />
            </div>
            {error && <div className="field-error">{error}</div>}
          </form>
        </Modal>
      )}
    </div>
  )
}
