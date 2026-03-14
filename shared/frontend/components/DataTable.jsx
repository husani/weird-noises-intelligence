/**
 * DataTable — shared component implementing the design system's Data Table spec.
 *
 * Spec structure:
 *   table.data-table > thead > tr > th.sortable(.sorted) with svg.sort-icon
 *                    > tbody > tr > td with cell type classes
 *                    > optional tfoot
 *   table-controls (pagination) underneath via TableControls
 *
 * @param {Array} data - Array of row objects.
 * @param {Array} columns - Column definitions: { key, label, strong, number, render, className, sortable }.
 *   - key: field name in the row object
 *   - label: header text
 *   - strong: if true, applies cell-strong
 *   - number: if true, applies cell-number (right-aligned, tabular-nums)
 *   - render: optional (value, row) => ReactNode for custom cell content
 *   - className: optional extra class on td
 *   - sortable: if false, renders a plain th instead of SortHeader (default: true)
 * @param {function} onRowClick - Optional (row) => void, makes rows clickable.
 * @param {string} rowKey - Field name to use as React key for rows. Defaults to 'id'.
 * @param {object} footer - Optional array of cell values for tfoot row.
 * @param {object} pagination - Optional { total, page, limit, onPageChange, onLimitChange, limitOptions }.
 *   When provided, renders TableControls. When omitted, no pagination.
 * @param {object} sort - Optional controlled sort: { field, dir, onSort }.
 *   When omitted, component manages sort state internally (client-side).
 * @param {React.ReactNode} emptyState - Optional content to show when data is empty.
 */

import React, { useState, useMemo } from 'react'
import SortHeader from './SortHeader'
import TableControls from './TableControls'

function defaultCellContent(value) {
  if (value == null || value === '') return <span className="cell-muted">&mdash;</span>
  return value
}

export default function DataTable({ data, columns, onRowClick, rowKey = 'id', footer, pagination, sort: controlledSort, emptyState }) {
  const firstSortable = columns.find(c => c.sortable !== false)
  const [internalSort, setInternalSort] = useState(firstSortable?.key || '')
  const [internalDir, setInternalDir] = useState('asc')

  const sortField = controlledSort ? controlledSort.field : internalSort
  const sortDir = controlledSort ? controlledSort.dir : internalDir

  function handleSort(field, dir) {
    if (controlledSort) {
      controlledSort.onSort(field, dir)
    } else {
      setInternalSort(field)
      setInternalDir(dir)
    }
  }

  // Client-side sort when not controlled
  const sorted = useMemo(() => {
    if (controlledSort) return data
    return [...data].sort((a, b) => {
      let va = a[sortField] ?? ''
      let vb = b[sortField] ?? ''
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va
      }
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortField, sortDir, controlledSort])

  if (data.length === 0 && emptyState) return emptyState

  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              col.sortable === false
                ? <th key={col.key} className={col.number ? 'cell-number' : col.className}>{col.label}</th>
                : <SortHeader
                    key={col.key}
                    label={col.label}
                    field={col.key}
                    sort={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className={col.number ? 'cell-number' : col.className}
                  />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr
              key={row[rowKey]}
              className={onRowClick ? 'row-clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(col => {
                const value = row[col.key]
                const classes = [
                  col.strong && 'cell-strong',
                  col.number && 'cell-number',
                  col.className,
                ].filter(Boolean).join(' ') || undefined

                return (
                  <td key={col.key} className={classes}>
                    {col.render ? col.render(value, row) : defaultCellContent(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              {footer.map((cell, i) => (
                <td key={i} className={columns[i]?.number ? 'cell-number cell-strong' : 'cell-strong'}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {pagination && (
        <TableControls
          page={pagination.page}
          onPageChange={pagination.onPageChange}
          limit={pagination.limit}
          onLimitChange={pagination.onLimitChange}
          total={pagination.total}
          {...(pagination.limitOptions ? { limitOptions: pagination.limitOptions } : {})}
        />
      )}
    </>
  )
}
