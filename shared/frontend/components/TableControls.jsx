/**
 * Table pagination controls — "Show N per page" selector + page range + page buttons.
 * Matches the design system's table-controls spec:
 *   table-controls > table-controls-left (Show + select + per page + range)
 *                   > table-pagination (page-btn prev/next + numbered buttons)
 *
 * @param {number} page - Current page (1-indexed).
 * @param {function} onPageChange - Called with new page number.
 * @param {number} limit - Items per page.
 * @param {function} onLimitChange - Called with new limit.
 * @param {number} total - Total number of items.
 * @param {number[]} limitOptions - Available per-page options. Defaults to [10, 25, 50].
 */

import React from 'react'

function getPageNumbers(page, totalPages) {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

export default function TableControls({ page, onPageChange, limit, onLimitChange, total, limitOptions = [10, 25, 50] }) {
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="table-controls">
      <div className="table-controls-left">
        <span>Show</span>
        <div className="select-wrapper">
          <select className="select" value={limit} onChange={e => { onLimitChange(Number(e.target.value)); onPageChange(1) }}>
            {limitOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <svg className="select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4.5l3 3 3-3" /></svg>
        </div>
        <span>per page</span>
        <span className="pagination-range">{(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} of {total}</span>
      </div>
      {totalPages > 1 && (
        <div className="table-pagination">
          <button className={`page-btn${page <= 1 ? ' disabled' : ''}`} onClick={() => page > 1 && onPageChange(page - 1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8.5 3.5l-4 3.5 4 3.5" /></svg>
          </button>
          {getPageNumbers(page, totalPages).map(n => (
            <button key={n} className={`page-btn${n === page ? ' active' : ''}`} onClick={() => onPageChange(n)}>{n}</button>
          ))}
          <button className={`page-btn${page >= totalPages ? ' disabled' : ''}`} onClick={() => page < totalPages && onPageChange(page + 1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5.5 3.5l4 3.5-4 3.5" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
