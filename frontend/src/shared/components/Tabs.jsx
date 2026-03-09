/**
 * Tab bar — horizontal tab switcher with optional counts.
 *
 * @param {Array<{key: string, label: string, count?: number}>} tabs - Tab definitions.
 * @param {string} activeKey - The currently active tab's key.
 * @param {function} onChange - Called with the new tab key when a tab is clicked.
 */

import React from 'react'

export default function Tabs({ tabs, activeKey, onChange }) {
  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`tab ${activeKey === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count != null && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}
