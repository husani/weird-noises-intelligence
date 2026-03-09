/**
 * Application layout — persistent nav bar + content area.
 *
 * The nav bar fetches the tool list from /api/registry/tools on mount,
 * so new tools appear automatically when registered. Shows the user's
 * profile picture (or initials) on the right.
 *
 * Active tool is highlighted based on the current URL path.
 */

import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthGuard'

export default function Layout({ children }) {
  const [tools, setTools] = useState([])
  const location = useLocation()
  const user = useAuth()

  useEffect(() => {
    fetch('/api/registry/tools')
      .then(res => res.json())
      .then(setTools)
      .catch(() => {})
  }, [])

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      <nav className="nav">
        <Link to="/" className="nav-wordmark">Intelligence</Link>
        <div className="nav-tools">
          {tools.map(tool => (
            <Link
              key={tool.key}
              to={tool.path}
              className={`nav-tool ${location.pathname === tool.path || location.pathname.startsWith(tool.path + '/') ? 'nav-tool-active' : ''}`}
            >
              {tool.name}
            </Link>
          ))}
        </div>
        {user?.picture ? (
          <div className="nav-user">
            <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
          </div>
        ) : (
          <div className="nav-user">{initials}</div>
        )}
      </nav>
      <main>{children}</main>
    </>
  )
}
