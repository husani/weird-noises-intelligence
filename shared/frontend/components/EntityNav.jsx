/**
 * EntityNav — shared entity-level navigation bar.
 *
 * Sits at the top of the content area when inside an entity.
 * Uses the entity-nav CSS pattern from the design system.
 *
 * Props:
 *   title       — entity title (e.g. show name)
 *   backText    — text for the back link (e.g. "All Shows")
 *   backPath    — path the back link navigates to
 *   links       — array of { label, path } for nav links
 */

import React from 'react'
import { NavLink, Link } from 'react-router-dom'

export default function EntityNav({ title, backText, backPath, links = [] }) {
  return (
    <div className="entity-nav">
      <Link to={backPath} className="entity-nav-back">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8.5 3.5l-4 3.5 4 3.5" />
        </svg>
        {backText}
      </Link>
      <div className="entity-nav-identity">
        <span className="entity-nav-title">{title}</span>
      </div>
      <div className="entity-nav-links">
        {links.map((link, i) => (
          <NavLink
            key={i}
            to={link.path}
            end={link.end}
            className={({ isActive }) =>
              `entity-nav-link${isActive ? ' entity-nav-link-active' : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
