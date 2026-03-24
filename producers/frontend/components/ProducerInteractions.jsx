/**
 * Producer interactions — composer in a card, timeline below.
 */

import React, { useState, useRef } from 'react'
import {
  addInteraction, editInteraction, deleteInteraction, transcribeAudio,
} from '@producers/api'

export default function ProducerInteractions({ producerId, interactions, onUpdate }) {
  const [text, setText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  async function handleAdd(e) {
    e.preventDefault()
    if (!text.trim()) return
    setProcessing(true)
    await addInteraction(producerId, text)
    setText('')
    onUpdate()
    setTimeout(async () => { await onUpdate(); setProcessing(false) }, 5000)
  }

  async function handleEdit(intId) {
    if (!editContent.trim()) return
    await editInteraction(producerId, intId, editContent)
    setEditingId(null)
    setEditContent('')
    onUpdate()
  }

  async function handleDelete(intId) {
    await deleteInteraction(producerId, intId)
    onUpdate()
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const result = await transcribeAudio(producerId, blob)
          if (result.text) setText(prev => prev ? `${prev}\n\n${result.text}` : result.text)
        } catch (err) { console.error('Transcription failed:', err) }
        setTranscribing(false)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) { console.error('Mic denied:', err) }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  return (
    <>
      <div className="section-card">
        <form onSubmit={handleAdd}>
          <textarea className="textarea textarea-full" placeholder="Log an interaction\u2026"
            value={text} onChange={e => setText(e.target.value)} rows={3} />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!text.trim() || processing}>
              {processing ? 'Processing\u2026' : 'Log Interaction'}
            </button>
            {recording
              ? <button type="button" className="btn btn-secondary" onClick={stopRecording}>Stop Recording</button>
              : <button type="button" className="btn btn-ghost" onClick={startRecording} disabled={transcribing}>
                  {transcribing ? 'Transcribing\u2026' : 'Voice Memo'}
                </button>
            }
          </div>
        </form>
      </div>

      {interactions.length > 0 && (
        <div className="timeline">
          {interactions.map((int, i) => (
            <div key={int.id} className="timeline-item">
              <div className={`timeline-dot${i === 0 ? ' timeline-dot-active' : ''}`} />
              <div className="timeline-date">{int.date ? new Date(int.date).toLocaleDateString() : ''} &mdash; {int.author}</div>
              {editingId === int.id ? (
                <div className="field-stack">
                  <textarea className="textarea textarea-full" value={editContent}
                    onChange={e => setEditContent(e.target.value)} autoFocus rows={4} />
                  <div className="form-actions">
                    <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => handleEdit(int.id)}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="timeline-content">{int.content}</div>
                  <div className="pd-timeline-actions">
                    <button className="link link-subtle" onClick={() => { setEditingId(int.id); setEditContent(int.content) }}>Edit</button>
                    <button className="link link-subtle" onClick={() => handleDelete(int.id)}>Delete</button>
                  </div>
                </>
              )}
              {int.follow_up_signals?.length > 0 && (
                <div className="pd-followup-signals">
                  {int.follow_up_signals.map(f => (
                    <span key={f.id} className={`badge ${f.resolved ? 'badge-neutral' : 'badge-warm'}`}>
                      {f.resolved ? '\u2713 ' : ''}{f.implied_action}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
