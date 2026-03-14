/**
 * Producers API client.
 * All fetch calls to /api/producers/* endpoints.
 */

const BASE = '/api/producers'

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

// Producer CRUD
export const listProducers = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(qs ? `?${qs}` : '')
}
export const getProducer = (id) => request(`/${id}`)
export const createProducer = (data) => request('', { method: 'POST', body: JSON.stringify(data) })
export const updateProducer = (id, data) => request(`/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProducer = (id) => request(`/${id}`, { method: 'DELETE' })

// Dashboard
export const getDashboard = () => request('/dashboard')

// Interactions
export const getInteractions = (id) => request(`/${id}/interactions`)
export const addInteraction = (id, content) => request(`/${id}/interactions`, {
  method: 'POST', body: JSON.stringify({ content }),
})

// Interactions — edit/delete
export const editInteraction = (producerId, interactionId, content) => request(`/${producerId}/interactions/${interactionId}`, {
  method: 'PUT', body: JSON.stringify({ content }),
})
export const deleteInteraction = (producerId, interactionId) => request(`/${producerId}/interactions/${interactionId}`, {
  method: 'DELETE',
})

// Audio transcription
export const transcribeAudio = async (producerId, audioBlob) => {
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.webm')
  const res = await fetch(`${BASE}/${producerId}/interactions/transcribe`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

// Follow-ups
export const resolveFollowUp = (producerId, signalId) => request(`/${producerId}/follow-ups/${signalId}/resolve`, { method: 'POST' })
export const updateFollowUp = (producerId, signalId, data) => request(`/${producerId}/follow-ups/${signalId}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteFollowUp = (producerId, signalId) => request(`/${producerId}/follow-ups/${signalId}`, { method: 'DELETE' })

// Productions & orgs
export const getProductions = (id) => request(`/${id}/productions`)
export const getOrganizations = (id) => request(`/${id}/organizations`)
export const addAffiliation = (producerId, data) => request(`/${producerId}/organizations`, {
  method: 'POST', body: JSON.stringify(data),
})
export const updateAffiliation = (producerId, affiliationId, data) => request(`/${producerId}/organizations/${affiliationId}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const removeAffiliation = (producerId, affiliationId) => request(`/${producerId}/organizations/${affiliationId}`, {
  method: 'DELETE',
})

// Producer shows (IP-level)
export const getProducerShows = (id) => request(`/${id}/shows`)

// Relationship
export const getRelationship = (id) => request(`/${id}/relationship`)

// Tags
export const addTag = (id, tag) => request(`/${id}/tags`, {
  method: 'POST', body: JSON.stringify({ tag }),
})
export const removeTag = (id, tagName) => request(`/${id}/tags/${encodeURIComponent(tagName)}`, {
  method: 'DELETE',
})
export const listTags = () => request('/tags')
export const createTag = (data) => request('/tags', {
  method: 'POST', body: JSON.stringify(data),
})
export const getTag = (tagId, params = {}) => {
  const q = new URLSearchParams(params).toString()
  return request(`/tags/${tagId}${q ? '?' + q : ''}`)
}
export const updateTag = (tagId, data) => request(`/tags/${tagId}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteTag = (tagId) => request(`/tags/${tagId}`, { method: 'DELETE' })

// Change history
export const getHistory = (id) => request(`/${id}/history`)

// Refresh
export const refreshProducer = (id) => request(`/${id}/refresh`, { method: 'POST' })

// URL extraction
export const extractUrl = (url) => request('/extract-url', {
  method: 'POST', body: JSON.stringify({ url }),
})

// Duplicates
export const checkDuplicates = (firstName, lastName, email = '', organization = '') => request('/check-duplicates', {
  method: 'POST', body: JSON.stringify({ first_name: firstName, last_name: lastName, email, organization }),
})

// Import
export const importSpreadsheet = (rows) => request('/import', {
  method: 'POST', body: JSON.stringify({ rows }),
})

// Discovery
export const getDiscoveryCandidates = (status = 'pending') => request(`/discovery?status=${status}`)
export const getDiscoverySchedule = () => request('/discovery/schedule')
export const triggerDiscovery = (focus = null) => request('/discovery/trigger', {
  method: 'POST', body: JSON.stringify({ focus }),
})
export const reviewDiscovery = (id, action, reason = null, editedData = null) => request(`/discovery/${id}/review`, {
  method: 'POST', body: JSON.stringify({ action, reason, edited_data: editedData }),
})

// Discovery: scan history
export const getScanHistory = (limit = 25, offset = 0) => request(`/discovery/scans?limit=${limit}&offset=${offset}`)
export const getScanDetail = (scanId) => request(`/discovery/scans/${scanId}`)

// Discovery: focus areas
export const getFocusAreas = () => request('/discovery/focus-areas')
export const createFocusArea = (name, description = null) => request('/discovery/focus-areas', {
  method: 'POST', body: JSON.stringify({ name, description }),
})
export const updateFocusArea = (id, data) => request(`/discovery/focus-areas/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteFocusArea = (id) => request(`/discovery/focus-areas/${id}`, { method: 'DELETE' })

// Discovery: intelligence & calibration
export const getIntelligenceProfile = () => request('/discovery/profile')
export const regenerateProfile = () => request('/discovery/regenerate-profile', { method: 'POST' })
export const getCalibrationSummary = () => request('/discovery/calibration')
export const regenerateCalibration = () => request('/discovery/regenerate-calibration', { method: 'POST' })

// AI Query
export const aiQuery = (query) => request('/query', {
  method: 'POST', body: JSON.stringify({ query }),
})

// Settings
export const getModelSettings = () => request('/settings/models')
export const getPrompts = () => request('/settings/prompts')
export const getSettings = () => request('/settings')
export const updateSetting = (key, value) => request('/settings', {
  method: 'PUT', body: JSON.stringify({ key, value }),
})
// Sources
export const listSources = () => request('/data-sources')
export const getSource = (id) => request(`/sources/${id}`)
export const createSource = (data) => request('/data-sources', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateSource = (id, data) => request(`/sources/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const reorderSources = (sourceIds) => request('/data-sources/reorder', {
  method: 'PUT', body: JSON.stringify({ source_ids: sourceIds }),
})
export const deleteSource = (id) => request(`/sources/${id}`, {
  method: 'DELETE',
})
export const refreshAllProducers = () => request('/settings/refresh-all', { method: 'POST' })
export const getJobStatus = () => request('/settings/job-status')

// Tag merge
export const mergeTags = (sourceTagId, targetTagId) => request('/tags/merge', {
  method: 'POST', body: JSON.stringify({ source_tag_id: sourceTagId, target_tag_id: targetTagId }),
})

// Organizations CRUD
export const listOrganizations = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/organizations${qs ? `?${qs}` : ''}`)
}
export const getOrganization = (id) => request(`/organizations/${id}`)
export const createOrganization = (data) => request('/organizations', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateOrganization = (id, data) => request(`/organizations/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteOrganization = (id) => request(`/organizations/${id}`, { method: 'DELETE' })

// Shows CRUD
export const listShows = ({ search = '', limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  params.set('limit', limit)
  params.set('offset', offset)
  return request(`/shows?${params}`)
}
export const getShow = (id) => request(`/shows/${id}`)
export const createShow = (data) => request('/shows', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateShow = (id, data) => request(`/shows/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteShow = (id) => request(`/shows/${id}`, { method: 'DELETE' })
export const addProducerToShow = (showId, data) => request(`/shows/${showId}/producers`, {
  method: 'POST', body: JSON.stringify(data),
})
export const removeProducerFromShow = (showId, linkId) => request(`/shows/${showId}/producers/${linkId}`, {
  method: 'DELETE',
})
export const addShowProduction = (showId, productionId) => request(`/shows/${showId}/productions/${productionId}`, { method: 'POST' })
export const removeShowProduction = (showId, productionId) => request(`/shows/${showId}/productions/${productionId}`, { method: 'DELETE' })

// Productions CRUD
export const listAllProductions = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/productions${qs ? `?${qs}` : ''}`)
}
export const getProductionDetail = (id) => request(`/productions/${id}`)
export const createProduction = (data) => request('/productions', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateProduction = (id, data) => request(`/productions/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteProduction = (id) => request(`/productions/${id}`, { method: 'DELETE' })
export const addProducerToProduction = (productionId, data) => request(`/productions/${productionId}/producers`, {
  method: 'POST', body: JSON.stringify(data),
})
export const updateProducerRole = (productionId, linkId, data) => request(`/productions/${productionId}/producers/${linkId}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const removeProducerFromProduction = (productionId, linkId) => request(`/productions/${productionId}/producers/${linkId}`, {
  method: 'DELETE',
})

// Venues CRUD
export const listVenues = ({ search = '', limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  params.set('limit', limit)
  params.set('offset', offset)
  return request(`/venues?${params}`)
}
export const createVenue = (data) => request('/venues', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateVenue = (id, data) => request(`/venues/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const getVenue = (id) => request(`/venues/${id}`)
export const deleteVenue = (id) => request(`/venues/${id}`, { method: 'DELETE' })
export const addVenueProduction = (venueId, productionId) => request(`/venues/${venueId}/productions/${productionId}`, { method: 'POST' })
export const removeVenueProduction = (venueId, productionId) => request(`/venues/${venueId}/productions/${productionId}`, { method: 'DELETE' })

// Awards CRUD
export const createAward = (data) => request('/awards', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateAward = (id, data) => request(`/awards/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteAward = (id) => request(`/awards/${id}`, { method: 'DELETE' })

// Batch operations
export const batchRefresh = (producerIds) => request('/batch/refresh', {
  method: 'POST', body: JSON.stringify({ producer_ids: producerIds }),
})
export const batchAddTag = (producerIds, tag) => request('/batch/tag', {
  method: 'POST', body: JSON.stringify({ producer_ids: producerIds, tag }),
})
export const batchRemoveTag = (producerIds, tag) => request('/batch/tag', {
  method: 'DELETE', body: JSON.stringify({ producer_ids: producerIds, tag }),
})

// Social Platforms CRUD
export const listSocialPlatforms = () => request('/social-platforms')
export const getSocialPlatform = (id) => request(`/social-platforms/${id}`)
export const createSocialPlatform = (data) => request('/social-platforms', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateSocialPlatform = (id, data) => request(`/social-platforms/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteSocialPlatform = (id) => request(`/social-platforms/${id}`, { method: 'DELETE' })
export const addPlatformProducer = (platformId, producerId, url) => request(`/social-platforms/${platformId}/producers`, {
  method: 'POST', body: JSON.stringify({ producer_id: producerId, url }),
})
export const removePlatformProducer = (platformId, producerId) => request(`/social-platforms/${platformId}/producers/${producerId}`, { method: 'DELETE' })
export const addPlatformOrg = (platformId, orgId, url) => request(`/social-platforms/${platformId}/organizations`, {
  method: 'POST', body: JSON.stringify({ organization_id: orgId, url }),
})
export const removePlatformOrg = (platformId, orgId) => request(`/social-platforms/${platformId}/organizations/${orgId}`, { method: 'DELETE' })
export const updatePlatformLink = (platformId, entityType, entityId, url) => request(`/social-platforms/${platformId}/link`, {
  method: 'PUT', body: JSON.stringify({ entity_type: entityType, entity_id: entityId, url }),
})

// Lookup Values
export const getLookupValues = (category, entityType) => {
  const params = new URLSearchParams({ category, entity_type: entityType })
  return request(`/lookup-values?${params}`)
}
export const getAllLookupValues = () => request('/lookup-values')
export const getLookupValue = (id) => request(`/lookup-values/${id}`)
export const createLookupValue = (data) => request('/lookup-values', {
  method: 'POST', body: JSON.stringify(data),
})
export const updateLookupValue = (id, data) => request(`/lookup-values/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteLookupValue = (id) => request(`/lookup-values/${id}`, { method: 'DELETE' })
export const reorderLookupValues = (category, entityType, orderedIds) => request('/lookup-values/reorder', {
  method: 'PUT', body: JSON.stringify({ category, entity_type: entityType, ordered_ids: orderedIds }),
})

// Producer Traits
export const getProducerTraits = (producerId) => request(`/${producerId}/traits`)
export const createProducerTrait = (producerId, data) => request(`/${producerId}/traits`, {
  method: 'POST', body: JSON.stringify(data),
})
export const updateProducerTrait = (producerId, traitId, data) => request(`/${producerId}/traits/${traitId}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteProducerTrait = (producerId, traitId) => request(`/${producerId}/traits/${traitId}`, {
  method: 'DELETE',
})

// Producer Intel
export const getProducerIntel = (producerId) => request(`/${producerId}/intel`)
export const createProducerIntel = (producerId, data) => request(`/${producerId}/intel`, {
  method: 'POST', body: JSON.stringify(data),
})
export const updateProducerIntel = (producerId, intelId, data) => request(`/${producerId}/intel/${intelId}`, {
  method: 'PUT', body: JSON.stringify(data),
})
export const deleteProducerIntel = (producerId, intelId) => request(`/${producerId}/intel/${intelId}`, {
  method: 'DELETE',
})

// Entity Emails
// entityPrefix maps: 'producer' -> '', 'organization' -> '/organizations', 'venue' -> '/venues'
const emailPrefix = (entityType, entityId) => {
  if (entityType === 'producer') return `/${entityId}/emails`
  if (entityType === 'organization') return `/organizations/${entityId}/emails`
  if (entityType === 'venue') return `/venues/${entityId}/emails`
}
export const getEmails = (entityType, entityId) => request(emailPrefix(entityType, entityId))
export const addEmail = (entityType, entityId, data) => request(emailPrefix(entityType, entityId), {
  method: 'POST', body: JSON.stringify(data),
})
export const removeEmail = (entityType, entityId, emailId) => request(`${emailPrefix(entityType, entityId)}/${emailId}`, {
  method: 'DELETE',
})
export const setPrimaryEmail = (entityType, entityId, emailId) => request(`${emailPrefix(entityType, entityId)}/${emailId}/primary`, {
  method: 'PUT',
})
