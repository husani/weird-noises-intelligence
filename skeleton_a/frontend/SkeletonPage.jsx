import React, { useState } from 'react'

function TestResult({ label, result, loading }) {
  if (loading) {
    return (
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-card-header">
          <div className="section-card-title">{label}</div>
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }
  if (!result) return null

  const isError = result.error
  return (
    <div className="section-card" style={{ marginBottom: 16 }}>
      <div className="section-card-header">
        <div className="section-card-title">{label}</div>
        <span className={`badge ${isError ? 'badge-rose' : 'badge-sage'}`}>
          {isError ? 'Failed' : 'Passed'}
        </span>
      </div>
      <pre style={{
        fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 300,
        color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
      }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}

export default function SkeletonPage() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  async function runTests() {
    setLoading(true)
    setResults(null)
    try {
      const res = await fetch('/api/skeleton/test/all')
      const data = await res.json()
      setResults(data)
    } catch (e) {
      setResults({ error: e.message })
    }
    setLoading(false)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Skeleton</h1>
        <p className="page-subtitle">Infrastructure verification tool. Tests every piece of shared infrastructure end-to-end, including cross-tool MCP access.</p>
      </div>

      <button className="btn btn-primary" onClick={runTests} disabled={loading} style={{ marginBottom: 32 }}>
        {loading ? 'Running tests...' : 'Run all infrastructure tests'}
      </button>

      {loading && !results && (
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="loading-spinner" />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>Running infrastructure tests...</span>
          </div>
        </div>
      )}

      {results && !results.error && (
        <>
          <TestResult label="Authentication" result={results.auth} />
          <TestResult label="Database" result={results.db} />
          <TestResult label="AI Clients" result={results.ai} />
          <TestResult label="File Storage" result={results.storage} />
          <TestResult label="Cross-Tool MCP (code-to-code)" result={results.mcp} />
          <TestResult label="LLM via MCP (Claude calling tools)" result={results.mcp_llm} />
        </>
      )}

      {results?.error && (
        <div className="alert alert-error">
          <div className="alert-content">
            <div className="alert-title">Test suite failed</div>
            <div>{results.error}</div>
          </div>
        </div>
      )}
    </div>
  )
}
