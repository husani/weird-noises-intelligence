/**
 * Show > Structure — scene breakdown, song list, and emotional arc.
 * Read-only display of AI-generated structure analysis from domain tables.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { listScenes, listSongs, listArcPoints } from '@slate/api'

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  return (
    <div className="slate-arc-tooltip">
      <div className="slate-arc-tooltip-label">{data.label}</div>
      {data.tone && <div className="slate-arc-tooltip-tone">{data.tone}</div>}
      <div className="slate-arc-tooltip-value">Intensity: {data.intensity}</div>
    </div>
  )
}

export default function ShowStructure({ show }) {
  const [scenes, setScenes] = useState([])
  const [songs, setSongs] = useState([])
  const [arcPoints, setArcPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedActs, setExpandedActs] = useState({})

  const isMusical = show.medium?.value === 'musical'

  const load = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        listScenes(show.id),
        listSongs(show.id),
        listArcPoints(show.id),
      ])

      const [sceneRes, songRes, arcRes] = results
      if (sceneRes.status === 'fulfilled') setScenes(sceneRes.value.scenes || [])
      if (songRes.status === 'fulfilled') setSongs(songRes.value.songs || [])
      if (arcRes.status === 'fulfilled') setArcPoints(arcRes.value.points || [])
    } catch (err) {
      console.error('Failed to load structure data:', err)
    } finally {
      setLoading(false)
    }
  }, [show.id])

  useEffect(() => { load() }, [load])

  function toggleAct(actKey) {
    setExpandedActs(prev => ({ ...prev, [actKey]: !prev[actKey] }))
  }

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>

  const hasData = scenes.length > 0 || songs.length > 0 || arcPoints.length > 0

  if (!hasData) {
    return (
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-card-title">Structure</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="32" height="32" rx="3" />
              <path d="M4 14h32M14 14v22" />
            </svg>
          </div>
          <div className="empty-state-title">No structure data yet</div>
          <div className="empty-state-desc">
            Upload a script to see the scene breakdown, act structure, song list, and emotional arc.
          </div>
        </div>
      </div>
    )
  }

  // Group scenes by act
  const scenesByAct = {}
  scenes.forEach(scene => {
    const act = scene.act_number ? `Act ${scene.act_number}` : 'Act 1'
    if (!scenesByAct[act]) scenesByAct[act] = []
    scenesByAct[act].push(scene)
  })

  const actKeys = Object.keys(scenesByAct)

  // Initialize all acts as expanded on first render
  if (actKeys.length > 0 && Object.keys(expandedActs).length === 0) {
    const initial = {}
    actKeys.forEach(k => { initial[k] = true })
    // Use a timeout to avoid setting state during render
    setTimeout(() => setExpandedActs(initial), 0)
  }

  // Emotional arc chart data
  const arcData = arcPoints.map(p => ({
    position: p.position,
    intensity: p.intensity,
    label: p.label || '',
    tone: p.tone || '',
  }))

  // Arc summary from the show object
  const arcSummary = show.emotional_arc_summary

  return (
    <div className="section-stack">
      {/* Scene Breakdown */}
      {actKeys.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-card-title">Scene Breakdown</h2>
            <div className="section-card-meta">
              {actKeys.length} {actKeys.length === 1 ? 'act' : 'acts'}
            </div>
          </div>
          <div className="slate-act-stack">
            {actKeys.map(actKey => (
              <div key={actKey} className="slate-act-group">
                <button className="slate-act-header" onClick={() => toggleAct(actKey)}>
                  <span className="slate-act-title">{actKey}</span>
                  <span className="slate-act-count">{scenesByAct[actKey].length} scenes</span>
                  <svg
                    className={`slate-act-chevron${expandedActs[actKey] ? ' open' : ''}`}
                    width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
                {expandedActs[actKey] && (
                  <div className="slate-scene-list">
                    {scenesByAct[actKey].map(scene => (
                      <div key={scene.id} className="slate-scene-block">
                        <div className="slate-scene-header">
                          <span className="slate-scene-number">
                            {scene.scene_number || `Scene`}
                          </span>
                          {scene.title && (
                            <span className="slate-scene-title">{scene.title}</span>
                          )}
                          {scene.estimated_minutes && (
                            <span className="type-meta">{scene.estimated_minutes} min</span>
                          )}
                        </div>
                        {scene.location && (
                          <div className="type-meta slate-scene-location">{scene.location}</div>
                        )}
                        {scene.characters && scene.characters.length > 0 && (
                          <div className="type-meta slate-scene-characters">
                            {Array.isArray(scene.characters) ? scene.characters.join(', ') : scene.characters}
                          </div>
                        )}
                        {scene.description && (
                          <div className="prose text-secondary">{scene.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Song List */}
      {isMusical && songs.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-card-title">Song List</h2>
            <div className="section-card-meta">{songs.length} songs</div>
          </div>
          <div className="slate-song-list">
            {songs.map(song => (
              <div key={song.id} className="slate-song-block">
                <div className="slate-song-header">
                  <span className="slate-song-title">{song.title}</span>
                  {song.song_type && <span className="badge badge-neutral">{song.song_type}</span>}
                </div>
                {(song.act_number || song.scene_number) && (
                  <div className="type-meta">
                    {song.act_number && <span>Act {song.act_number}</span>}
                    {song.act_number && song.scene_number && <span>, </span>}
                    {song.scene_number && <span>Scene {song.scene_number}</span>}
                  </div>
                )}
                {song.characters && (
                  <div className="type-meta">
                    {Array.isArray(song.characters) ? song.characters.join(', ') : song.characters}
                  </div>
                )}
                {song.description && <div className="prose text-secondary">{song.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emotional Arc */}
      {arcData.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-card-title">Emotional Arc</h2>
          </div>
          <div className="slate-arc-chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={arcData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="arcGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c4915a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c4915a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="position"
                  tick={false}
                  axisLine={{ stroke: 'rgba(239,233,223,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={false}
                  axisLine={{ stroke: 'rgba(239,233,223,0.1)' }}
                  tickLine={false}
                  width={0}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="intensity"
                  stroke="#c4915a"
                  strokeWidth={2}
                  fill="url(#arcGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#c4915a', stroke: '#232120', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {arcSummary && (
            <div className="prose text-secondary slate-arc-summary">{arcSummary}</div>
          )}
        </div>
      )}
    </div>
  )
}
