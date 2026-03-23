/**
 * Show Detail — entity nav + sub-routing for a specific show.
 */

import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Routes, Route, useParams, Navigate } from 'react-router-dom'
import EntityNav from '@shared/components/EntityNav'
import { getShow } from '@slate/api'

const ShowOverview = lazy(() => import('./ShowOverview'))
const ShowCharacters = lazy(() => import('./ShowCharacters'))
const ShowStructure = lazy(() => import('./ShowStructure'))
const ShowMilestones = lazy(() => import('./ShowMilestones'))
const ShowVisual = lazy(() => import('./ShowVisual'))
const ShowScripts = lazy(() => import('./ShowScripts'))
const ShowEdit = lazy(() => import('./ShowEdit'))

export default function ShowDetail() {
  const { showId } = useParams()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await getShow(showId)
      setShow(data)
    } catch (err) {
      console.error('Failed to load show:', err)
    } finally {
      setLoading(false)
    }
  }, [showId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>
  if (!show) return <div className="page"><div className="empty-state"><div className="empty-state-title">Show not found</div></div></div>

  const isMusical = show.medium?.value === 'musical'
  const scriptsLabel = isMusical ? 'Book & Score' : 'Scripts'
  const basePath = `/slate/shows/${showId}`

  const links = [
    { label: 'Overview', path: `${basePath}/overview`, end: true },
    { label: 'Characters', path: `${basePath}/characters` },
    { label: 'Structure', path: `${basePath}/structure` },
    { label: 'Milestones', path: `${basePath}/milestones` },
    { label: 'Visual Identity', path: `${basePath}/visual` },
    { label: scriptsLabel, path: `${basePath}/scripts` },
  ]

  return (
    <div className="page">
      <EntityNav
        title={show.title}
        backText="All Shows"
        backPath="/slate/shows"
        links={links}
      />
      <Suspense fallback={<div className="page-loading"><div className="loading-spinner" /></div>}>
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<ShowOverview show={show} onUpdate={load} />} />
          <Route path="characters" element={<ShowCharacters show={show} />} />
          <Route path="structure" element={<ShowStructure show={show} />} />
          <Route path="milestones" element={<ShowMilestones show={show} onUpdate={load} />} />
          <Route path="visual" element={<ShowVisual show={show} onUpdate={load} />} />
          <Route path="scripts" element={<ShowScripts show={show} onUpdate={load} />} />
          <Route path="edit" element={<ShowEdit show={show} onUpdate={load} />} />
        </Routes>
      </Suspense>
    </div>
  )
}
