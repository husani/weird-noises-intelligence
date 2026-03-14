import React, { useState } from 'react'
import { aiQuery } from '@producers/api'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn-icon"
      title="Copy to clipboard"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}

export default function AIQuery() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await aiQuery(query)
      const entry = { query, result: res.result, time: new Date().toLocaleTimeString() }
      setResult(entry)
      setHistory(prev => [entry, ...prev])
      setQuery('')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">AI Query</h1>
        <p className="page-subtitle">Strategic analysis and reasoning across the producer database</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-32">
        <div className="query-bar mb-12">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
            <path d="M9 21h6M10 17v4M14 17v4" />
          </svg>
          <input
            className="query-input"
            placeholder="e.g. Which producers would be the best fit for Moonshot and why?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary"
            disabled={loading || !query.trim()}>
            {loading ? (
              <span className="btn-inline-spinner">
                <div className="loading-spinner spinner-sm" /> Thinking...
              </span>
            ) : 'Ask'}
          </button>
        </div>
      </form>

      {error && (
        <div className="alert alert-error mb-20">
          <div className="alert-content"><div className="alert-title">{error}</div></div>
        </div>
      )}

      {loading && (
        <div className="section-card section-card--accent-blue mb-20">
          <div className="section-card-header mb-16">
            <div className="loading-spinner" />
            <span className="type-meta">Reasoning across the producer database...</span>
          </div>
          <div className="ai-skeleton-block">
            <div className="loading-skeleton ai-skeleton-90" />
            <div className="loading-skeleton ai-skeleton-75" />
            <div className="loading-skeleton ai-skeleton-82" />
          </div>
        </div>
      )}

      {history.map((entry, i) => (
        <div key={i} className="section-card mb-16">
          <div className="section-card-header">
            <div className="ai-query-label">{entry.query}</div>
            <div className="section-card-header">
              <span className="type-meta">{entry.time}</span>
              <CopyButton text={entry.result} />
            </div>
          </div>
          <div className="prose">{entry.result}</div>
        </div>
      ))}

      {history.length === 0 && !loading && (
        <div className="section-card empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
              <path d="M9 21h6" />
            </svg>
          </div>
          <div className="empty-state-title">Ask a strategic question</div>
          <div className="empty-state-desc">
            This isn't search — it's reasoning. Ask analytical questions like "Which lapsed relationships are worth reviving?", "Who would champion a show like Moonshot?", or "What patterns do you see across producers who passed?"
          </div>
        </div>
      )}
    </>
  )
}
