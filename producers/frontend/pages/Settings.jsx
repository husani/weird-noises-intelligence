import React, { useEffect, useState } from 'react'
import { Alert } from '@shared/components'
import {
  getSettings, updateSetting,
  refreshAllProducers, getJobStatus,
} from '@producers/api'

function relativeTime(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const diffMs = d - new Date()
  if (diffMs < 0) {
    const ago = Math.abs(diffMs)
    const days = Math.floor(ago / (1000 * 60 * 60 * 24))
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    return `${days} days ago`
  }
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `in ${days} day${days !== 1 ? 's' : ''}`
  if (hours > 0) return `in ${hours} hour${hours !== 1 ? 's' : ''}`
  const mins = Math.floor(diffMs / (1000 * 60))
  return `in ${mins} minute${mins !== 1 ? 's' : ''}`
}

const THRESHOLDS = [
  {
    cluster: 'Contact Health',
    items: [
      { key: 'gone_cold_threshold_days', label: 'Gone cold threshold', hint: 'Days without contact before a relationship is considered cold', defaultVal: 90 },
    ],
  },
  {
    cluster: 'Research Cadence',
    items: [
      { key: 'refresh_baseline_days', label: 'Baseline refresh interval', hint: 'Days between automatic dossier refreshes for all producers', defaultVal: 30 },
      { key: 'refresh_active_days', label: 'Active relationship refresh', hint: 'Days between refreshes for producers with recent interactions', defaultVal: 14 },
      { key: 'active_window_days', label: 'Active relationship window', hint: 'A producer counts as active if contacted within this many days', defaultVal: 90 },
      { key: 'discovery_interval_days', label: 'Discovery scan interval', hint: 'Days between automatic scans for new producers', defaultVal: 7 },
    ],
  },
]

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [jobStatus, setJobStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [refreshAllMsg, setRefreshAllMsg] = useState(null)

  function loadAll() {
    setLoading(true)
    Promise.all([getSettings(), getJobStatus()])
      .then(([s, js]) => { setSettings(s); setJobStatus(js) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  async function handleSave(key, value) {
    await updateSetting(key, value)
    loadAll()
  }

  async function handleRefreshAll() {
    setRefreshingAll(true)
    try {
      const result = await refreshAllProducers()
      const count = result?.queued || 'all'
      setRefreshAllMsg(`Dossier refresh queued for ${count} producers. Research is running in the background.`)
      setTimeout(() => setRefreshAllMsg(null), 10000)
    } catch (err) {
      console.error('Refresh all failed:', err)
    }
    setRefreshingAll(false)
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure how the Producers tool behaves</p>
        </div>
      </div>

      <div className="section-card mb-24">
        <div className="section-card-header">
          <h3 className="section-card-title">Thresholds</h3>
        </div>
        {THRESHOLDS.map((cluster, ci) => (
          <div key={cluster.cluster}>
            {ci > 0 && <div className="settings-cluster-divider" />}
            <div className="settings-cluster-label">{cluster.cluster}</div>
            {cluster.items.map(item => {
              const val = settings[item.key] ?? item.defaultVal
              return (
                <div key={item.key} className="settings-threshold">
                  <div className="settings-threshold-info">
                    <div className="settings-threshold-label">{item.label}</div>
                    <div className="settings-threshold-hint">{item.hint}</div>
                  </div>
                  <div className="settings-threshold-control">
                    <input
                      className="input settings-threshold-input"
                      type="number"
                      value={val}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0
                        setSettings(prev => ({ ...prev, [item.key]: v }))
                      }}
                      onBlur={e => {
                        const v = parseInt(e.target.value) || 0
                        if (v !== (settings[item.key] ?? item.defaultVal)) {
                          // value was already updated optimistically in onChange
                        }
                        handleSave(item.key, v)
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                    />
                    <span className="settings-threshold-unit">days</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {refreshAllMsg && <Alert variant="info" title={refreshAllMsg} />}

      <div className="section-card">
        <div className="section-card-header">
          <h3 className="section-card-title">Scheduled Jobs</h3>
          <button className="btn btn-secondary"
            onClick={handleRefreshAll} disabled={refreshingAll}>
            {refreshingAll ? 'Refreshing...' : 'Refresh All Producers'}
          </button>
        </div>
        <ul className="item-list">
          {Object.entries(jobStatus).map(([id, job]) => (
            <li key={id} className="item-row">
              <div className="job-row-left">
                <span className={`status ${job.next_run ? 'status-sage' : 'status-neutral'}`}>
                  <span className="status-dot" />
                </span>
                <div>
                  <div className="item-primary">{job.label}</div>
                  <div className="item-secondary">
                    {job.last_run && <span>Last run: {relativeTime(job.last_run)}</span>}
                    {job.last_run && job.next_run && <span> &mdash; </span>}
                    Next run: {job.next_run ? relativeTime(job.next_run) : 'Not scheduled'}
                  </div>
                  {job.last_result && (
                    <div className="item-secondary job-detail-sub">
                      Result: {job.last_result}
                    </div>
                  )}
                </div>
              </div>
              <span className={`status ${job.next_run ? 'status-sage' : 'status-neutral'}`}>
                <span className="status-dot" />
                {job.next_run ? 'Active' : 'Inactive'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
