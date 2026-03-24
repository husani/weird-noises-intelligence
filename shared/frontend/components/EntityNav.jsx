/**
 * EntityNav — shared entity-level navigation bar.
 *
 * Two modes:
 *   - Route mode (default): links navigate to different pages via React Router.
 *     Used by Slate for show-level navigation.
 *   - Anchor mode (anchor=true): links scroll to sections on the same page.
 *     The nav sticks to the top and highlights the section currently in view.
 *     Used by Producers for the detail page.
 *
 * Props:
 *   title       — entity title (e.g. show name, producer name)
 *   backText    — text for the back link (e.g. "All Shows", "Producers")
 *   backPath    — path the back link navigates to
 *   links       — array of { label, path } (route paths) or { label, anchor } (section IDs)
 *   anchor      — if true, use anchor scroll mode instead of route mode
 */

import React, { useState, useEffect, useCallback } from 'react'
import { NavLink, Link } from 'react-router-dom'

export default function EntityNav({ title, backText, backPath, links = [], anchor = false }) {
  const [activeAnchor, setActiveAnchor] = useState(links[0]?.anchor || '')

  const handleScroll = useCallback(() => {
    if (!anchor) return
    const offset = 120 // account for sticky nav height + buffer
    for (let i = links.length - 1; i >= 0; i--) {
      const el = document.getElementById(links[i].anchor)
      if (el && el.getBoundingClientRect().top <= offset) {
        setActiveAnchor(links[i].anchor)
        return
      }
    }
    if (links.length > 0) setActiveAnchor(links[0].anchor)
  }, [anchor, links])

  useEffect(() => {
    if (!anchor) return
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [anchor, handleScroll])

  function scrollTo(anchorId) {
    if (anchorId === links[0]?.anchor) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const el = document.getElementById(anchorId)
    if (el) {
      const offset = 130
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <div className={`entity-nav${anchor ? ' entity-nav-sticky' : ''}`}>
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
        {anchor ? (
          links.map((link, i) => (
            <a
              key={i}
              className={`entity-nav-link${activeAnchor === link.anchor ? ' entity-nav-link-active' : ''}`}
              onClick={e => { e.preventDefault(); scrollTo(link.anchor) }}
              href={`#${link.anchor}`}
            >
              {link.label}
            </a>
          ))
        ) : (
          links.map((link, i) => (
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
          ))
        )}
      </div>
    </div>
  )
}
