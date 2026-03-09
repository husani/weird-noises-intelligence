import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  const [tools, setTools] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/registry/tools')
      .then(res => res.json())
      .then(data => {
        setTools(data)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Intelligence</h1>
        <p className="page-subtitle">Tools and automation for Weird Noises</p>
      </div>
      {!loaded ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="loading-spinner" />
        </div>
      ) : tools.length > 0 ? (
        <div className="tool-grid">
          {tools.map(tool => (
            <Link key={tool.key} to={tool.path} className="tool-card">
              <div className="tool-card-name">{tool.name}</div>
              <div className="tool-card-desc">{tool.description}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-title">No tools registered</div>
          <div className="empty-state-desc">Tools will appear here as they are built and registered.</div>
        </div>
      )}
    </div>
  )
}
