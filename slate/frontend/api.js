/**
 * Slate API client.
 */

const BASE = '/api/slate'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

// Shows
export function listShows(params = {}) {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.stage) qs.set('stage', params.stage)
  if (params.medium) qs.set('medium', params.medium)
  if (params.sort) qs.set('sort', params.sort)
  if (params.sort_dir) qs.set('sort_dir', params.sort_dir)
  if (params.limit) qs.set('limit', params.limit)
  if (params.offset) qs.set('offset', params.offset)
  return request(`/shows?${qs}`)
}

export function getShow(id) {
  return request(`/shows/${id}`)
}

export function createShow(data) {
  return request('/shows', { method: 'POST', body: JSON.stringify(data) })
}

export function updateShow(id, data) {
  return request(`/shows/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteShow(id) {
  return request(`/shows/${id}`, { method: 'DELETE' })
}

// Script versions
export function listScripts(showId) {
  return request(`/shows/${showId}/scripts`)
}

export function getScript(showId, versionId) {
  return request(`/shows/${showId}/scripts/${versionId}`)
}

export function uploadScript(showId, formData) {
  return fetch(`${BASE}/shows/${showId}/scripts`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json())
}

export function updateScript(showId, versionId, data) {
  return request(`/shows/${showId}/scripts/${versionId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteScript(showId, versionId) {
  return request(`/shows/${showId}/scripts/${versionId}`, { method: 'DELETE' })
}

export function downloadScript(showId, versionId) {
  return request(`/shows/${showId}/scripts/${versionId}/download`)
}

// Music files
export function listMusic(showId, versionId) {
  return request(`/shows/${showId}/scripts/${versionId}/music`)
}

export function uploadMusic(showId, versionId, formData) {
  return fetch(`${BASE}/shows/${showId}/scripts/${versionId}/music`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json())
}

export function updateMusic(showId, versionId, musicId, data) {
  return request(`/shows/${showId}/scripts/${versionId}/music/${musicId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteMusic(showId, versionId, musicId) {
  return request(`/shows/${showId}/scripts/${versionId}/music/${musicId}`, { method: 'DELETE' })
}

export function downloadMusic(showId, versionId, musicId) {
  return request(`/shows/${showId}/scripts/${versionId}/music/${musicId}/download`)
}

export function reorderMusic(showId, versionId, ids) {
  return request(`/shows/${showId}/scripts/${versionId}/music/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  })
}

// Recent milestones (across all shows)
export function getRecentMilestones(limit = 10) {
  return request(`/milestones/recent?limit=${limit}`)
}

// Milestones
export function listMilestones(showId) {
  return request(`/shows/${showId}/milestones`)
}

export function createMilestone(showId, data) {
  return request(`/shows/${showId}/milestones`, { method: 'POST', body: JSON.stringify(data) })
}

export function updateMilestone(showId, milestoneId, data) {
  return request(`/shows/${showId}/milestones/${milestoneId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteMilestone(showId, milestoneId) {
  return request(`/shows/${showId}/milestones/${milestoneId}`, { method: 'DELETE' })
}

// Visual assets
export function listVisualAssets(showId) {
  return request(`/shows/${showId}/visual`)
}

export function uploadVisualAsset(showId, formData) {
  return fetch(`${BASE}/shows/${showId}/visual`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json())
}

export function updateVisualAsset(showId, assetId, data) {
  return request(`/shows/${showId}/visual/${assetId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteVisualAsset(showId, assetId) {
  return request(`/shows/${showId}/visual/${assetId}`, { method: 'DELETE' })
}

export function downloadVisualAsset(showId, assetId) {
  return request(`/shows/${showId}/visual/${assetId}/download`)
}

// Show data
export function getShowData(showId, params = {}) {
  const qs = new URLSearchParams()
  if (params.version_id) qs.set('version_id', params.version_id)
  return request(`/shows/${showId}/data?${qs}`)
}

export function getShowDataByType(showId, dataType) {
  return request(`/shows/${showId}/data/${dataType}`)
}

export function createShowData(showId, data) {
  return request(`/shows/${showId}/data`, { method: 'POST', body: JSON.stringify(data) })
}

export function updateShowData(showId, dataId, data) {
  return request(`/shows/${showId}/data/${dataId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteShowData(showId, dataId) {
  return request(`/shows/${showId}/data/${dataId}`, { method: 'DELETE' })
}

// Reprocessing
export function reprocessScript(showId, versionId) {
  return request(`/shows/${showId}/scripts/${versionId}/reprocess`, { method: 'POST' })
}

export function reprocessDataType(showId, versionId, dataType) {
  return request(`/shows/${showId}/scripts/${versionId}/reprocess/${dataType}`, { method: 'POST' })
}

// Model options
export function getModelOptions() {
  return request('/settings/models')
}

// Lookup values
export function getLookupValues(params = {}) {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.entity_type) qs.set('entity_type', params.entity_type)
  return request(`/lookup-values?${qs}`)
}

export function getLookupValue(id) {
  return request(`/lookup-values/${id}`)
}

export function createLookupValue(data) {
  return request('/lookup-values', { method: 'POST', body: JSON.stringify(data) })
}

export function updateLookupValue(id, data) {
  return request(`/lookup-values/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function reorderLookupValues(ids) {
  return request('/lookup-values/reorder', { method: 'PUT', body: JSON.stringify({ ids }) })
}

export function deleteLookupValue(id) {
  return request(`/lookup-values/${id}`, { method: 'DELETE' })
}

// Settings
export function getSettings() {
  return request('/settings')
}

export function updateSettings(settings) {
  return request('/settings', { method: 'PUT', body: JSON.stringify({ settings }) })
}

// AI behaviors
export function getAIBehaviors() {
  return request('/settings/ai-behaviors')
}

export function updateAIBehavior(id, data) {
  return request(`/settings/ai-behaviors/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

// Pitches
export function listPitches(showId) {
  return request(`/shows/${showId}/pitches`)
}

export function getPitch(showId, pitchId) {
  return request(`/shows/${showId}/pitches/${pitchId}`)
}

export function createPitch(showId, data) {
  return request(`/shows/${showId}/pitches`, { method: 'POST', body: JSON.stringify(data) })
}

export function generatePitch(showId, data) {
  return request(`/shows/${showId}/pitches/generate`, { method: 'POST', body: JSON.stringify(data) })
}

export function updatePitch(showId, pitchId, data) {
  return request(`/shows/${showId}/pitches/${pitchId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deletePitch(showId, pitchId) {
  return request(`/shows/${showId}/pitches/${pitchId}`, { method: 'DELETE' })
}

export function listPitchMaterials(showId, pitchId) {
  return request(`/shows/${showId}/pitches/${pitchId}/materials`)
}

export function uploadPitchMaterial(showId, pitchId, formData) {
  return fetch(`${BASE}/shows/${showId}/pitches/${pitchId}/materials`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json())
}

export function deletePitchMaterial(showId, pitchId, materialId) {
  return request(`/shows/${showId}/pitches/${pitchId}/materials/${materialId}`, { method: 'DELETE' })
}

export function downloadPitchMaterial(showId, pitchId, materialId) {
  return request(`/shows/${showId}/pitches/${pitchId}/materials/${materialId}/download`)
}

// AI Query
export function showQuery(showId, query) {
  return request(`/shows/${showId}/query`, { method: 'POST', body: JSON.stringify({ query }) })
}

export function slateQuery(query) {
  return request('/query', { method: 'POST', body: JSON.stringify({ query }) })
}
