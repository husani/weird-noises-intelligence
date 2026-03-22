import React, { useEffect, useState } from 'react'
import {
  getAIBehaviors, updateAIBehavior, getModelSettings,
} from '@producers/api'

function PromptEditor({ label, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')

  function handleEdit() {
    setEditVal(value || '')
    setEditing(true)
  }

  function handleSave() {
    onSave(editVal)
    setEditing(false)
  }

  return (
    <div className="ai-prompt-section">
      <div className="ai-prompt-header">
        <div className="ai-prompt-label">{label}</div>
        <div className="ai-prompt-actions">
          {!editing && (
            <button className="btn btn-ghost btn-sm" onClick={handleEdit}>Edit</button>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <textarea
            className="ai-prompt-editor"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            autoFocus
          />
          <div className="ai-prompt-save-row">
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="ai-prompt-preview">
          {value || '(empty)'}
        </div>
      )}
    </div>
  )
}

export default function AIConfig() {
  const [behaviors, setBehaviors] = useState([])
  const [modelOptions, setModelOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [promptTab, setPromptTab] = useState('system')
  const [pendingModel, setPendingModel] = useState(null)
  const [saving, setSaving] = useState(false)

  function loadAll() {
    setLoading(true)
    Promise.all([getAIBehaviors(), getModelSettings()])
      .then(([b, m]) => {
        setBehaviors(b)
        setModelOptions(m.options || {})
        if (!selected && b.length > 0) setSelected(b[0].name)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  async function handleSavePrompt(field, value) {
    const behavior = behaviors.find(b => b.name === selected)
    if (!behavior) return
    setSaving(true)
    try {
      await updateAIBehavior(behavior.id, { [field]: value })
      loadAll()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveModel(modelId) {
    const behavior = behaviors.find(b => b.name === selected)
    if (!behavior) return
    setSaving(true)
    try {
      await updateAIBehavior(behavior.id, { model: modelId })
      setPendingModel(null)
      loadAll()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  const allModels = [].concat(
    ...(Object.values(modelOptions).map(models => models || []))
  )

  const selectedBehavior = behaviors.find(b => b.name === selected)

  function getModelLabel(modelId) {
    const m = allModels.find(m => m.id === modelId)
    return m ? m.label : modelId
  }

  return (
    <>
      <div className="page-topbar">
        <div className="page-header">
          <h1 className="page-title">AI Configuration</h1>
          <p className="page-subtitle">Models and prompts for each AI behavior</p>
        </div>
      </div>

      <div className="ai-workbench">
        <div className="ai-workbench-nav">
          {behaviors.map(b => (
            <button
              key={b.name}
              className={`ai-workbench-nav-item${selected === b.name ? ' selected' : ''}`}
              onClick={() => { setSelected(b.name); setPendingModel(null); setPromptTab('system') }}
            >
              <div className="ai-nav-item-top">
                <span className="ai-nav-item-name">{b.display_label}</span>
              </div>
              <span className="ai-model-tag">
                {getModelLabel(b.model)}
              </span>
            </button>
          ))}
        </div>

        <div className="ai-workbench-editor">
          {selectedBehavior && (
            <>
              <div className="ai-editor-header">
                <h2 className="ai-editor-title">{selectedBehavior.display_label}</h2>
                <div className="ai-editor-model-controls">
                  <div className="select-wrapper">
                    <select
                      className="select"
                      value={pendingModel ?? selectedBehavior.model}
                      onChange={e => setPendingModel(e.target.value)}
                    >
                      {Object.entries(modelOptions).map(([provider, models]) => (
                        <optgroup key={provider} label={provider === 'anthropic' ? 'Anthropic' : 'Google'}>
                          {(models || []).map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
                  </div>
                  {pendingModel && pendingModel !== selectedBehavior.model && (
                    <>
                      <button className="btn btn-primary btn-sm" disabled={saving}
                        onClick={() => handleSaveModel(pendingModel)}>
                        Save
                      </button>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => setPendingModel(null)}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="tab-bar mb-24">
                <button
                  className={`tab${promptTab === 'system' ? ' active' : ''}`}
                  onClick={() => setPromptTab('system')}
                >
                  System Prompt
                </button>
                <button
                  className={`tab${promptTab === 'user' ? ' active' : ''}`}
                  onClick={() => setPromptTab('user')}
                >
                  User Prompt
                </button>
              </div>

              {promptTab === 'system' && (
                <PromptEditor
                  label="System Prompt"
                  value={selectedBehavior.system_prompt}
                  onSave={(val) => handleSavePrompt('system_prompt', val)}
                />
              )}
              {promptTab === 'user' && (
                <PromptEditor
                  label="User Prompt Template"
                  value={selectedBehavior.user_prompt}
                  onSave={(val) => handleSavePrompt('user_prompt', val)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
