/**
 * Producer productions — the visual anchor of the page. Clean data table.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '@shared/components'

export default function ProducerProductions({ productions }) {
  const navigate = useNavigate()

  const columns = [
    { key: 'title', label: 'Title', strong: true },
    { key: 'venue', label: 'Venue', render: v => v ? v.name : null },
    { key: 'year', label: 'Year' },
    { key: 'role', label: 'Role', render: v => v ? v.display_label : null },
    {
      key: 'scale', label: 'Scale',
      render: v => v ? <span className={`badge ${v.css_class || 'badge-neutral'}`}>{v.display_label}</span> : null,
    },
  ]

  if (productions.length === 0) {
    return <p className="cell-muted">No production history yet.</p>
  }

  return (
    <DataTable
      data={productions}
      columns={columns}
      rowKey="production_id"
      onRowClick={row => navigate(`/producers/productions/${row.production_id}`)}
    />
  )
}
