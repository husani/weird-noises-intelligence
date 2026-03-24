import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { importParse, importDedup, importConfirm } from '@producers/api'

const FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'organization', label: 'Organization' },
  { key: 'organization_role', label: 'Role' },
  { key: 'city', label: 'City' },
  { key: 'state_region', label: 'State/Region' },
  { key: 'country', label: 'Country' },
  { key: 'website', label: 'Website' },
]

const STEPS = ['Input', 'Review Parsed', 'Review Matches', 'Done']

export default function ImportPage() {
  const [step, setStep] = useState(0) // 0=input, 1=parseReview, 2=dedupReview, 3=done
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Input state
  const [inputMode, setInputMode] = useState(null) // 'file', 'url', 'text'
  const [file, setFile] = useState(null)
  const [sheetUrl, setSheetUrl] = useState('')
  const [pastedText, setPastedText] = useState('')
  const fileRef = useRef()

  // Parse results
  const [parsedRows, setParsedRows] = useState([])

  // Dedup results
  const [dedupRows, setDedupRows] = useState([])
  const [rowActions, setRowActions] = useState({}) // rowIndex -> 'create'|'skip'|'merge'
  const [resolvedConflicts, setResolvedConflicts] = useState({}) // rowIndex -> { field: value }

  // Confirm results
  const [result, setResult] = useState(null)

  const navigate = useNavigate()

  // --- Step 0: Input ---

  function handleFileDrop(e) {
    e.preventDefault()
    const dropped = e.dataTransfer?.files?.[0]
    if (dropped) {
      setFile(dropped)
      setInputMode('file')
    }
  }

  function handleFileSelect(e) {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setInputMode('file')
    }
  }

  async function handleParse() {
    setLoading(true)
    setError(null)
    try {
      let res
      if (inputMode === 'file' && file) {
        const formData = new FormData()
        formData.append('file', file)
        res = await importParse(formData)
      } else if (inputMode === 'url') {
        res = await importParse({ sheet_url: sheetUrl })
      } else if (inputMode === 'text') {
        res = await importParse({ text: pastedText })
      } else {
        setError('Choose an input method')
        setLoading(false)
        return
      }
      if (res.error) {
        setError(res.error)
      } else {
        setParsedRows(res.rows || [])
        setStep(1)
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // --- Step 1: Parse review ---

  function updateParsedRow(index, field, value) {
    setParsedRows(prev => prev.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    ))
  }

  function removeRow(index) {
    setParsedRows(prev => prev.filter((_, i) => i !== index))
  }

  async function handleDedup() {
    setLoading(true)
    setError(null)
    try {
      const res = await importDedup(parsedRows)
      if (res.error) {
        setError(res.error)
      } else {
        const rows = res.rows || []
        setDedupRows(rows)
        // Set default actions
        const actions = {}
        rows.forEach((row, i) => {
          if (row.verdict === 'clean') actions[i] = 'create'
          else actions[i] = '' // user must decide
        })
        setRowActions(actions)
        setStep(2)
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // --- Step 2: Dedup review ---

  function setAction(index, action) {
    setRowActions(prev => ({ ...prev, [index]: action }))
  }

  function resolveConflict(rowIndex, field, value) {
    setResolvedConflicts(prev => ({
      ...prev,
      [rowIndex]: { ...(prev[rowIndex] || {}), [field]: value },
    }))
  }

  function getConflicts(row) {
    if (!row.existing_producer) return []
    const conflicts = []
    const scalarFields = ['phone', 'city', 'state_region', 'country', 'website']
    for (const field of scalarFields) {
      const importVal = row[field]
      const existingVal = row.existing_producer[field]
      if (importVal && existingVal && importVal !== existingVal) {
        conflicts.push({ field, importVal, existingVal })
      }
    }
    return conflicts
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const rows = dedupRows.map((row, i) => {
        const action = rowActions[i]
        if (action === 'skip' || !action) return { action: 'skip', row_data: {} }

        const rowData = {
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone,
          city: row.city,
          state_region: row.state_region,
          country: row.country,
          website: row.website,
          email: row.email?.email || null,
        }

        if (row.organization) {
          rowData.organization = row.organization
        }

        if (action === 'create') {
          // Flatten org for create_producer
          if (rowData.organization) {
            const org = rowData.organization
            rowData.organization = org.name
            rowData.org_role = org.role_title
            delete rowData.organization_role
          }
          return { action: 'create', row_data: rowData }
        }

        if (action === 'merge') {
          return {
            action: 'merge',
            row_data: rowData,
            merge_producer_id: row.existing_producer?.id,
            resolved_fields: resolvedConflicts[i] || {},
          }
        }

        return { action: 'skip', row_data: {} }
      })

      const res = await importConfirm(rows)
      setResult(res)
      setStep(3)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const canConfirm = Object.values(rowActions).some(a => a === 'create' || a === 'merge')

  // --- Render ---

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Import</h1>
        <p className="page-subtitle">Add producers from any source — files, Google Sheets, or pasted text</p>
      </div>

      {/* Step indicator */}
      <div className="import-steps">
        {STEPS.map((label, i) => (
          <div key={i} className={`import-step${i === step ? ' import-step--active' : ''}${i < step ? ' import-step--done' : ''}`}>
            <div className="import-step-dot">{i < step ? '✓' : i + 1}</div>
            <div className="import-step-label">{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="alert alert-error">
          <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="alert-content">
            <div className="alert-title">{error}</div>
          </div>
        </div>
      )}

      {/* Step 0: Input */}
      {step === 0 && (
        <div className="section-stack">
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">Upload a File</div>
            </div>
            <div
              className={`file-upload${inputMode === 'file' ? ' file-upload--active' : ''}`}
              onClick={() => fileRef.current.click()}
              onDrop={handleFileDrop}
              onDragOver={e => e.preventDefault()}
            >
              <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              <div className="file-upload-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
              </div>
              <div className="file-upload-title">
                {file ? file.name : 'Drop a file or click to browse'}
              </div>
              <div className="file-upload-desc">CSV, TSV, XLSX</div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">Google Sheet URL</div>
            </div>
            <div className="field-stack">
              <input
                className="input"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={e => { setSheetUrl(e.target.value); setInputMode('url') }}
                onFocus={() => setInputMode('url')}
                style={{ maxWidth: '100%' }}
              />
              <div className="edit-hint">Paste a sharing link to a public or link-accessible sheet</div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">Paste Text</div>
            </div>
            <textarea
              className="textarea import-paste-area"
              placeholder="Paste names, emails, a copied table, a conference program — any format"
              value={pastedText}
              onChange={e => { setPastedText(e.target.value); setInputMode('text') }}
              onFocus={() => setInputMode('text')}
            />
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleParse}
              disabled={loading || (!file && !sheetUrl && !pastedText)}
            >
              {loading ? (
                <><span className="loading-spinner loading-spinner--sm" /> Parsing...</>
              ) : 'Parse Input'}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Parse review */}
      {step === 1 && (
        <div className="section-stack">
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">Parsed Producers</div>
              <div className="section-card-meta">{parsedRows.length} rows</div>
            </div>
            {parsedRows.length === 0 ? (
              <div className="empty-state-text">No producers found in the input</div>
            ) : (
              <div className="import-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      {FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i}>
                        {FIELDS.map(f => (
                          <td key={f.key}>
                            <input
                              className="import-cell-input"
                              value={row[f.key] || ''}
                              onChange={e => updateParsedRow(i, f.key, e.target.value)}
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td>
                          <button className="btn-ghost import-remove-btn" onClick={() => removeRow(i)} title="Remove row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
            <button
              className="btn btn-primary"
              onClick={handleDedup}
              disabled={loading || parsedRows.length === 0}
            >
              {loading ? (
                <><span className="loading-spinner loading-spinner--sm" /> Checking for matches...</>
              ) : `Check ${parsedRows.length} Rows Against Database`}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Dedup review */}
      {step === 2 && (
        <div className="section-stack">
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">Review Matches</div>
              <div className="section-card-meta">
                {dedupRows.filter(r => r.verdict === 'clean').length} clean,{' '}
                {dedupRows.filter(r => r.verdict === 'match').length} matched,{' '}
                {dedupRows.filter(r => r.verdict === 'possible_match').length} possible
              </div>
            </div>

            {dedupRows.map((row, i) => (
              <div key={i} className={`import-dedup-row import-dedup-row--${row.verdict}`}>
                <div className="import-dedup-row-header">
                  <div className="import-dedup-row-name">
                    {row.first_name} {row.last_name}
                    {row.email?.email && <span className="import-dedup-row-email">{row.email.email}</span>}
                    {row.organization && <span className="import-dedup-row-org">{row.organization.name}</span>}
                  </div>
                  <div className="import-dedup-row-controls">
                    <span className={`badge badge-${row.verdict === 'clean' ? 'sage' : row.verdict === 'match' ? 'rose' : 'warm'}`}>
                      {row.verdict === 'clean' ? 'New' : row.verdict === 'match' ? 'Match' : 'Possible Match'}
                    </span>
                    <select
                      className="import-action-select"
                      value={rowActions[i] || ''}
                      onChange={e => setAction(i, e.target.value)}
                    >
                      {row.verdict === 'clean' ? (
                        <>
                          <option value="create">Create</option>
                          <option value="skip">Skip</option>
                        </>
                      ) : (
                        <>
                          <option value="">— Choose —</option>
                          <option value="skip">Skip</option>
                          <option value="merge">Merge into existing</option>
                          <option value="create">Create anyway</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Match reasoning */}
                {row.match_reasoning && (row.verdict === 'match' || row.verdict === 'possible_match') && (
                  <div className="import-match-reasoning">
                    <span className="type-meta">Match reasoning</span>
                    <div className="import-match-reasoning-text">{row.match_reasoning}</div>
                    {row.existing_producer && (
                      <div className="import-match-existing">
                        Existing: <strong>{row.existing_producer.first_name} {row.existing_producer.last_name}</strong>
                        {row.existing_producer.organizations?.length > 0 && (
                          <> — {row.existing_producer.organizations.map(o => o.name || o).join(', ')}</>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Merge conflicts */}
                {rowActions[i] === 'merge' && row.existing_producer && (
                  <div className="import-merge-conflicts">
                    {getConflicts(row).length > 0 ? (
                      <>
                        <div className="type-meta">Conflicting fields — choose which value to keep</div>
                        {getConflicts(row).map(c => (
                          <div key={c.field} className="import-conflict">
                            <div className="import-conflict-label">{FIELDS.find(f => f.key === c.field)?.label || c.field}</div>
                            <label className={`import-conflict-option${(resolvedConflicts[i]?.[c.field] || c.existingVal) === c.existingVal ? ' import-conflict-option--selected' : ''}`}>
                              <input
                                type="radio"
                                name={`conflict-${i}-${c.field}`}
                                checked={(resolvedConflicts[i]?.[c.field] || c.existingVal) === c.existingVal}
                                onChange={() => resolveConflict(i, c.field, c.existingVal)}
                              />
                              <span className="import-conflict-value">{c.existingVal}</span>
                              <span className="badge badge-neutral">existing</span>
                            </label>
                            <label className={`import-conflict-option${resolvedConflicts[i]?.[c.field] === c.importVal ? ' import-conflict-option--selected' : ''}`}>
                              <input
                                type="radio"
                                name={`conflict-${i}-${c.field}`}
                                checked={resolvedConflicts[i]?.[c.field] === c.importVal}
                                onChange={() => resolveConflict(i, c.field, c.importVal)}
                              />
                              <span className="import-conflict-value">{c.importVal}</span>
                              <span className="badge badge-warm">import</span>
                            </label>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="edit-hint">No conflicting fields — import data will fill empty fields on the existing record</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={loading || !canConfirm}
            >
              {loading ? (
                <><span className="loading-spinner loading-spinner--sm" /> Importing...</>
              ) : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && result && (
        <div className="section-stack">
          <div className="alert alert-success">
            <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="alert-content">
              <div className="alert-title">Import complete</div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Created</div>
              <div className="stat-value stat-value--sage">{result.created?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Merged</div>
              <div className="stat-value stat-value--blue">{result.merged?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Skipped</div>
              <div className="stat-value">{result.skipped || 0}</div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => {
              setStep(0)
              setFile(null)
              setSheetUrl('')
              setPastedText('')
              setInputMode(null)
              setParsedRows([])
              setDedupRows([])
              setRowActions({})
              setResolvedConflicts({})
              setResult(null)
              setError(null)
            }}>Import More</button>
            <button className="btn btn-primary" onClick={() => navigate('/producers/list')}>
              View Producer List
            </button>
          </div>
        </div>
      )}
    </>
  )
}
