/**
 * FileUpload — drag-and-drop file upload zone.
 *
 * When no file is selected: shows the drop zone.
 * When a file is selected: shows the filename with a remove button.
 *
 * Props:
 *   file        — the currently selected File object (or null)
 *   onFile      — (file | null) => void, called on select, drop, or clear
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

  function handleClear(e) {
    e.stopPropagation()
    onFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (file) {
    return (
      <div className="file-item">
        <svg className="file-item-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
          <path d="M12 2v4h4" />
        </svg>
        <span className="file-item-name">{file.name}</span>
        <span className="file-item-meta">{(file.size / 1024).toFixed(0)} KB</span>
        <svg className="file-item-remove" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          onClick={handleClear}>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </div>
    )
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
          {dragging
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
