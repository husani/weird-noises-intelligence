import React, { useEffect, useState } from 'react'
import {
  getSettings, updateSetting,
  getPrompts, getModelSettings,
} from '@producers/api'

function PromptSection({ label, promptKey, currentText, defaultText, variables, onSave }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const isCustom = currentText != null

  function handleEdit() {
    setEditVal(currentText ?? defaultText)
    setEditing(true)
  }

  function handleSave() {
    onSave(promptKey, editVal)
    setEditing(false)
  }

  function handleReset() {
    onSave(promptKey, null)
    setEditing(false)
  }

  return (
    <div className="ai-prompt-section">
      <div className="ai-prompt-header">
        <div className="ai-prompt-label">
          {label}
          {isCustom && <span className="ai-customized-badge">customized</span>}
        </div>
        <div className="ai-prompt-actions">
          {isCustom && !editing && (
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>Reset to default</button>
          )}
          {!editing && (
            <button className="btn btn-ghost btn-sm" onClick={handleEdit}>Edit</button>
          )}
        </div>
      </div>
      {variables && variables.length > 0 && (
        <div className="ai-var-ref">
          {variables.map(v => <code key={v} className="ai-var-tag">{v}</code>)}
        </div>
      )}
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
          {currentText ?? defaultText}
        </div>
      )}
    </div>
  )
}

export default function AIConfig() {
  const [prompts, setPrompts] = useState([])
  const [modelData, setModelData] = useState({ options: {}, behaviors: [] })
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [promptTab, setPromptTab] = useState('system')
  const [pendingModel, setPendingModel] = useState(null)

  function loadAll() {
    setLoading(true)
    Promise.all([getPrompts(), getModelSettings(), getSettings()])
      .then(([p, m, s]) => {
        setPrompts(p)
        setModelData(m)
        setSettings(s)
        if (!selected && p.length > 0) setSelected(p[0].behavior)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  async function handleSave(key, value) {
    await updateSetting(key, value)
    loadAll()
  }

  if (loading) {
    return <div className="disc-center"><div className="loading-spinner" /></div>
  }

  const modelByBehavior = {}
  for (const b of modelData.behaviors) {
    modelByBehavior[b.behavior] = b
  }

  const allModels = [].concat(
    ...(Object.values(modelData.options).map(models => models || []))
  )

  const selectedPrompt = prompts.find(p => p.behavior === selected)
  const selectedModel = modelByBehavior[selected]

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
          {prompts.map(p => {
            const mb = modelByBehavior[p.behavior]
            return (
              <button
                key={p.behavior}
                className={`ai-workbench-nav-item${selected === p.behavior ? ' selected' : ''}`}
                onClick={() => { setSelected(p.behavior); setPendingModel(null) }}
              >
                <div className="ai-nav-item-top">
                  <span className="ai-nav-item-name">{p.label}</span>
                </div>
                <span className="ai-model-tag">
                  {mb ? getModelLabel(mb.current) : '\u2014'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="ai-workbench-editor">
          {selectedPrompt && (
            <>
              <div className="ai-editor-header">
                <h2 className="ai-editor-title">{selectedPrompt.label}</h2>
                {selectedModel && (() => {
                  const displayModel = pendingModel ?? selectedModel.current
                  const hasChange = pendingModel != null && pendingModel !== selectedModel.current
                  return (
                    <div className="ai-editor-model-controls">
                      <div className="select-wrapper">
                        <select
                          className="select"
                          value={displayModel}
                          onChange={e => setPendingModel(e.target.value)}
                        >
                          {Object.entries(modelData.options).map(([provider, models]) => (
                            <optgroup key={provider} label={provider === 'anthropic' ? 'Anthropic' : 'Google'}>
                              {models.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.label}{m.id === selectedModel.default ? ' (default)' : ''}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <svg className="select-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 5.5l3.5 3.5 3.5-3.5" /></svg>
                      </div>
                      {hasChange ? (
                        <>
                          <button className="btn btn-primary btn-sm"
                            onClick={() => { handleSave(selectedModel.setting_key, pendingModel); setPendingModel(null) }}>
                            Save
                          </button>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => setPendingModel(null)}>
                            Cancel
                          </button>
                        </>
                      ) : selectedModel.current !== selectedModel.default ? (
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => { handleSave(selectedModel.setting_key, null); setPendingModel(null) }}>
                          Reset
                        </button>
                      ) : null}
                    </div>
                  )
                })()}
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
                <PromptSection
                  label="System Prompt"
                  promptKey={selectedPrompt.system_key}
                  currentText={selectedPrompt.system_current}
                  defaultText={selectedPrompt.system_default}
                  variables={(selectedPrompt.variables || {}).system}
                  onSave={handleSave}
                />
              )}
              {promptTab === 'user' && (
                <PromptSection
                  label="User Prompt Template"
                  promptKey={selectedPrompt.user_key}
                  currentText={selectedPrompt.user_current}
                  defaultText={selectedPrompt.user_default}
                  variables={(selectedPrompt.variables || {}).user}
                  onSave={handleSave}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
