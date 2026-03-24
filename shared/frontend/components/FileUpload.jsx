/**
 * FileUpload — drag-and-drop file upload zone.
 *
 * Props:
 *   file        — the currently selected File object (or null)
 *   onFile      — (file) => void, called when a file is selected or dropped
 *   accept      — file input accept string (e.g. ".pdf,.docx,.fdx")
 *   description — text shown below the title (e.g. "PDF, DOCX, or FDX")
 */

import React, { useRef, useState } from 'react'

export default function FileUpload({ file, onFile, accept, description }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)

  function handleDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div>
      <div
        className={`file-upload${dragging ? ' file-upload-active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="file-upload-icon">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 24V10M12 16l6-6 6 6" />
            <path d="M6 22v6a2 2 0 002 2h20a2 2 0 002-2v-6" />
          </svg>
        </div>
        <div className="file-upload-title">
          {file
            ? file.name
            : dragging
              ? 'Drop to upload'
              : <>Drop file here or <span className="file-upload-link">browse</span></>
          }
        </div>
        {description && !dragging && <div className="file-upload-desc">{description}</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]) }}
      />
    </div>
  )
}
