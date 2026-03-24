/**
 * DropdownSelect — custom select replacing native <select> elements.
 *
 * Spec structure (from design-system.html):
 *   div.dropdown-select(.open)
 *     > button.dropdown-select-trigger
 *       > span.dropdown-select-value(.dropdown-select-placeholder)
 *       > svg.dropdown-select-arrow
 *     > div.dropdown-select-panel
 *       > div.dropdown-select-search (optional, sticky)
 *         > svg.dropdown-select-search-icon + input.dropdown-select-search-input
 *       > div.dropdown-select-option(.dropdown-select-option-selected, .highlighted)
 *         > svg.dropdown-select-check | div.dropdown-select-check-empty
 *         > label text
 *       > div.dropdown-select-no-results
 *
 * @param {Array} options - Array of { value, label } objects.
 * @param {string|null} value - Currently selected value (null for no selection).
 * @param {function} onChange - (value) => void, called when an option is selected.
 * @param {string} placeholder - Text shown when no value is selected.
 * @param {boolean} searchable - Whether to show the search/filter input. Default: false.
 * @param {string} className - Optional extra class on the root element.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'

export default function DropdownSelect({
  options = [],
  value = null,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(-1)
  const ref = useRef(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)

  const selected = options.find(o => o.value === value)

  const filtered = searchable && search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
        setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search input when opening
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open, searchable])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlighted(-1)
  }, [search])

  function toggle() {
    setOpen(v => !v)
    if (open) {
      setSearch('')
      setHighlighted(-1)
    }
  }

  function select(optionValue) {
    onChange(optionValue)
    setOpen(false)
    setSearch('')
    setHighlighted(-1)
  }

  const handleKeyDown = useCallback((e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(prev => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlighted >= 0 && highlighted < filtered.length) {
          select(filtered[highlighted].value)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setSearch('')
        setHighlighted(-1)
        break
    }
  }, [open, highlighted, filtered])

  return (
    <div
      ref={ref}
      className={`dropdown-select${open ? ' open' : ''}${className ? ' ' + className : ''}`}
      onKeyDown={handleKeyDown}
    >
      <button
        className="dropdown-select-trigger"
        type="button"
        onClick={toggle}
      >
        <span className={`dropdown-select-value${!selected ? ' dropdown-select-placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="dropdown-select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 5.5l3.5 3.5 3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div className="dropdown-select-panel" ref={listRef}>
          {searchable && (
            <div className="dropdown-select-search">
              <svg className="dropdown-select-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="4" /><path d="M9 9l3 3" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                className="dropdown-select-search-input"
                placeholder="Filter..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="dropdown-select-no-results">No matching options</div>
          ) : (
            filtered.map((option, i) => {
              const isSelected = option.value === value
              const isHighlighted = i === highlighted
              return (
                <div
                  key={option.value}
                  className={`dropdown-select-option${isSelected ? ' dropdown-select-option-selected' : ''}${isHighlighted ? ' highlighted' : ''}`}
                  onClick={e => { e.stopPropagation(); select(option.value) }}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  {isSelected ? (
                    <svg className="dropdown-select-check" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7.5l3 3 5-6" />
                    </svg>
                  ) : (
                    <div className="dropdown-select-check-empty" />
                  )}
                  {option.label}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
