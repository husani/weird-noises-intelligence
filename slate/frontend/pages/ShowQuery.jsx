/**
 * Show Query — AI query interface scoped to a specific show.
 * Simple question-and-answer flow with conversation history.
 */

import React, { useCallback, useRef, useState } from 'react'
import { showQuery } from '@slate/api'

export default function ShowQuery({ show }) {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault()
    const q = query.trim()
    if (!q || loading) return

    setLoading(true)
    setQuery('')

    // Add the question to history immediately
    const entry = { question: q, answer: null, sources: null, loading: true }
    setHistory(prev => [...prev, entry])

    try {
      const result = await showQuery(show.id, q)
      setHistory(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        updated[updated.length - 1] = {
          ...last,
          answer: result.response || result.answer || '',
          sources: result.sources || [],
          loading: false,
        }
        return updated
      })
    } catch (err) {
      console.error('Query failed:', err)
      setHistory(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...prev[prev.length - 1],
          answer: 'Sorry, something went wrong. Please try again.',
          loading: false,
        }
        return updated
      })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.focus()
    }
  }, [query, loading, show.id])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="slate-query-page">
      <div className="section-card-header">
        <h2 className="section-card-title">Ask about {show.title}</h2>
      </div>

      {history.length > 0 && (
        <div className="slate-query-history">
          {history.map((entry, i) => (
            <div key={i} className="slate-query-pair">
              <div className="slate-query-question">
                <span className="type-meta">Q</span>
                <span className="slate-query-question-text">{entry.question}</span>
              </div>
              {entry.loading ? (
                <div className="slate-query-answer-loading">
                  <div className="loading-spinner" />
                </div>
              ) : (
                <div className="query-result-prose">
                  <p className="prose">{entry.answer}</p>
                  {entry.sources && entry.sources.length > 0 && (
                    <div className="query-result-sources">
                      {entry.sources.map((src, j) => (
                        <span key={j} className="query-result-source">{src}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="slate-query-form" onSubmit={handleSubmit}>
        <div className="query-bar">
          <svg className="query-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7.5" cy="7.5" r="5.5" />
            <path d="M12 12l4 4" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="query-input"
            placeholder="Ask anything about this show..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
        </div>
      </form>
    </div>
  )
}
