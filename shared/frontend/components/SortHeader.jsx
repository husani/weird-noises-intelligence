import React from 'react'

export default function SortHeader({ label, field, sort, sortDir, onSort, className }) {
  const isSorted = sort === field
  const classes = ['sortable', isSorted && 'sorted', className].filter(Boolean).join(' ')

  return (
    <th className={classes}
      onClick={() => {
        if (isSorted) onSort(field, sortDir === 'asc' ? 'desc' : 'asc')
        else onSort(field, 'asc')
      }}>
      {label}
      <svg className="sort-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
        {isSorted && sortDir === 'asc'
          ? <path d="M2 6.5l3-3 3 3" />
          : <path d="M2 4l3 3 3-3" />}
      </svg>
    </th>
  )
}
