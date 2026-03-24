/**
 * Producer history — research metadata and change history.
 */

import React from 'react'

export default function ProducerHistory({ producer, history }) {
  return (
    <div className="pd-overview">
      {/* Research metadata as compact reference block */}
      <div className="pd-reference" style={{ gridTemplateColumns: '1fr' }}>
        <div className="pd-ref-col">
          <div className="pd-ref-item">
            <span className="pd-ref-label">Last Researched</span>
            {producer.last_research_date ? new Date(producer.last_research_date).toLocaleDateString() : 'Never'}
          </div>
          <div className="pd-ref-item">
            <span className="pd-ref-label">Intake Source</span>
            {producer.intake_source || '\u2014'}
          </div>
          {producer.research_status_detail && (
            <div className="pd-ref-item">
              <span className="pd-ref-label">Last Research Result</span>
              {producer.research_status_detail}
            </div>
          )}
          {producer.research_sources_consulted?.length > 0 && (
            <div className="pd-ref-item">
              <span className="pd-ref-label">Sources Consulted</span>
              {producer.research_sources_consulted.join(', ')}
            </div>
          )}
          {producer.research_gaps?.length > 0 && (
            <div className="pd-ref-item">
              <span className="pd-ref-label">Research Gaps</span>
              <span className="cell-muted">{producer.research_gaps.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Change history */}
      {history.length > 0 ? (
        <div className="timeline">
          {history.slice(0, 30).map(h => (
            <div key={h.id} className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-date">{new Date(h.changed_at).toLocaleDateString()} &mdash; {h.changed_by}</div>
              <div className="timeline-content">
                <strong>{h.field_name.replace(/_/g, ' ')}</strong>
                {h.new_value && <div className="line-clamp-2">{h.new_value}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="cell-muted">No changes recorded.</p>
      )}
    </div>
  )
}
