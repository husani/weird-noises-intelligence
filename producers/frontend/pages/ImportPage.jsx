import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { importSpreadsheet, getProducer } from '@producers/api'

const PRODUCER_FIELDS = [
  { key: '', label: '— Skip —' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'organization', label: 'Organization' },
  { key: 'org_role', label: 'Role at Org' },
  { key: 'city', label: 'City' },
  { key: 'state_region', label: 'State/Region' },
  { key: 'country', label: 'Country' },
  { key: 'website', label: 'Website' },
  { key: 'notes', label: 'Notes' },
  { key: 'tags', label: 'Tags (comma-separated)' },
]

// Auto-map common header names to fields
const HEADER_MAP = {
  first_name: 'first_name', firstname: 'first_name', first: 'first_name', 'given name': 'first_name',
  last_name: 'last_name', lastname: 'last_name', last: 'last_name', surname: 'last_name', 'family name': 'last_name',
  name: 'last_name',
  email: 'email', 'e-mail': 'email', 'email_address': 'email',
  phone: 'phone', telephone: 'phone', tel: 'phone', mobile: 'phone',
  organization: 'organization', org: 'organization', company: 'organization', 'org name': 'organization',
  org_role: 'org_role', role: 'org_role', title: 'org_role', position: 'org_role',
  city: 'city', town: 'city',
  state: 'state_region', state_region: 'state_region', region: 'state_region', province: 'state_region',
  country: 'country',
  website: 'website', url: 'website', web: 'website',
  notes: 'notes', note: 'notes', comments: 'notes', comment: 'notes',
  tags: 'tags', tag: 'tags',
}

function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current.trim())
  return values
}

function parseCSVRaw(text) {
  const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''))
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).filter(l => l.trim()).map(line => parseCSVLine(line))
  return { headers, rows }
}

export default function ImportPage() {
  const [rawHeaders, setRawHeaders] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [columnMap, setColumnMap] = useState({}) // headerIndex -> fieldKey
  const [result, setResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')
  const [importProgress, setImportProgress] = useState(null) // { created: [...], total: N }
  const fileRef = useRef()
  const navigate = useNavigate()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { headers, rows } = parseCSVRaw(ev.target.result)
      setRawHeaders(headers)
      setRawRows(rows)
      setResult(null)
      setImportProgress(null)
      // Auto-map headers
      const map = {}
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        const mapped = HEADER_MAP[normalized]
        if (mapped) map[i] = mapped
      })
      setColumnMap(map)
    }
    reader.readAsText(file)
  }

  function getMappedRows() {
    return rawRows.map(row => {
      const mapped = {}
      Object.entries(columnMap).forEach(([idx, field]) => {
        if (field && row[parseInt(idx)]) {
          if (field === 'tags') {
            mapped[field] = row[parseInt(idx)].split(',').map(t => t.trim()).filter(Boolean)
          } else {
            mapped[field] = row[parseInt(idx)]
          }
        }
      })
      return mapped
    }).filter(r => r.first_name || r.last_name)
  }

  async function handleImport() {
    const mapped = getMappedRows()
    if (mapped.length === 0) return
    setImporting(true)
    try {
      const res = await importSpreadsheet(mapped)
      setResult(res)
      // Track research progress for created producers
      if (res.created && res.created.length > 0) {
        setImportProgress({
          ids: res.created.map(c => c.id),
          statuses: res.created.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, status: 'pending' })),
        })
      }
    } catch (err) {
      setResult({ error: err.message })
    }
    setImporting(false)
  }

  // Poll research status for imported producers
  useEffect(() => {
    if (!importProgress || importProgress.ids.length === 0) return
    const allDone = importProgress.statuses.every(s => s.status === 'complete' || s.status === 'failed')
    if (allDone) return

    const timer = setInterval(async () => {
      const updated = await Promise.all(
        importProgress.statuses.map(async s => {
          if (s.status === 'complete' || s.status === 'failed') return s
          try {
            const p = await getProducer(s.id)
            return { ...s, status: p.research_status || 'pending' }
          } catch {
            return s
          }
        })
      )
      setImportProgress(prev => ({ ...prev, statuses: updated }))
    }, 5000)

    return () => clearInterval(timer)
  }, [importProgress])

  const mappedRows = rawRows.length > 0 ? getMappedRows() : []
  const hasNameMapping = Object.values(columnMap).includes('first_name') || Object.values(columnMap).includes('last_name')

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Spreadsheet Import</h1>
        <p className="page-subtitle">Upload a CSV with producer data. Map columns to fields, then import.</p>
      </div>

      <div className="file-upload" onClick={() => fileRef.current.click()}>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        <div className="file-upload-title">{fileName || 'Click to choose a CSV file'}</div>
        <div className="file-upload-desc">Supports any column headers — you'll map them in the next step</div>
      </div>

      {rawHeaders.length > 0 && !result && (
        <>
          {/* Column mapping */}
          <div className="section-card mt-24 mb-24">
            <div className="section-card-header">
              <div className="section-card-title">Column Mapping</div>
              <div className="section-card-meta">{rawHeaders.length} columns</div>
            </div>
            <div className="form-grid-auto">
              {rawHeaders.map((h, i) => {
                const isMapped = !!columnMap[i]
                const wasAutoMapped = (() => {
                  const normalized = h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                  return !!HEADER_MAP[normalized]
                })()
                return (
                  <div key={i} className={`column-map-card${isMapped ? ' column-map-card--mapped' : ''}`}>
                    <div className="column-map-header">
                      <div className="input-label column-map-label">{h}</div>
                      {wasAutoMapped && isMapped && <span className="column-map-auto">auto</span>}
                    </div>
                    <div className="select-wrapper">
                      <select className="select" value={columnMap[i] || ''}
                        onChange={e => setColumnMap(prev => ({ ...prev, [i]: e.target.value }))}>
                        {PRODUCER_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                      <span className="select-arrow">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 5l3 3 3-3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="table-controls">
            <span>{mappedRows.length} valid rows (of {rawRows.length} total)</span>
            {!hasNameMapping && <span className="import-name-warning">Map at least a name column to import</span>}
          </div>
          <div className="import-preview-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {rawHeaders.map((h, i) => (
                    <th key={i} className={columnMap[i] ? 'import-preview-th--mapped' : 'import-preview-th--unmapped'}>
                      {columnMap[i] ? PRODUCER_FIELDS.find(f => f.key === columnMap[i])?.label : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j} className={columnMap[j] ? 'import-preview-td--mapped' : 'import-preview-td--unmapped'}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rawRows.length > 20 && (
            <div className="edit-hint mb-16">Showing first 20 of {rawRows.length} rows</div>
          )}
          <button className="btn btn-primary" onClick={handleImport} disabled={importing || !hasNameMapping || mappedRows.length === 0}>
            {importing ? 'Importing...' : `Import ${mappedRows.length} Producers`}
          </button>
        </>
      )}

      {result && !result.error && (
        <div className="section-card mt-24">
          <div className="section-card-header">
            <div className="section-card-title">Import Complete</div>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Created</div>
              <div className="stat-value stat-value--sage">{result.created.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Duplicates Skipped</div>
              <div className={`stat-value${result.duplicates.length > 0 ? ' stat-value--rose' : ''}`}>{result.duplicates.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Rows</div>
              <div className="stat-value stat-value--warm">{result.total}</div>
            </div>
          </div>

          {/* Per-row research progress */}
          {importProgress && importProgress.statuses.length > 0 && (
            <div className="mb-16">
              <div className="type-meta mb-8">Research Progress</div>
              <ul className="item-list">
                {importProgress.statuses.map(s => (
                  <li key={s.id} className="item-row">
                    <span className="fw-light">{s.name}</span>
                    {s.status === 'pending' || s.status === 'in_progress' ? (
                      <span className="status status-blue"><span className="status-dot pulse" />{s.status === 'in_progress' ? 'researching' : 'pending'}</span>
                    ) : s.status === 'failed' ? (
                      <span className="import-status--failed">failed</span>
                    ) : (
                      <span className="import-status--complete">complete</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.duplicates.length > 0 && (
            <>
              <div className="type-meta mb-8">Skipped duplicates</div>
              <ul className="item-list">
                {result.duplicates.map((d, i) => (
                  <li key={i} className="item-row">
                    <span className="fw-light">{d.row.first_name} {d.row.last_name}</span>
                    <span className="badge badge-rose">matches: {d.duplicates.map(dd => `${dd.first_name} ${dd.last_name}`).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="btn btn-secondary mt-16" onClick={() => navigate('/producers/list')}>
            View Producer List
          </button>
        </div>
      )}

      {result?.error && (
        <div className="alert alert-error mt-24">
          <div className="alert-content"><div className="alert-title">{result.error}</div></div>
        </div>
      )}
    </>
  )
}
