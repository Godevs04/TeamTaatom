import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Type, Image as ImageIcon, Video as VideoIcon,
  Eye, Save, Loader2, X, Trash2, Palette,
} from 'lucide-react'
import toast from 'react-hot-toast'
import logger from '../utils/logger'
import {
  getCommunityCanvas,
  updateCommunityCanvas,
  uploadContentImage,
  uploadContentVideo,
} from '../services/communityService'

const PRESET_BG_COLORS = [
  '#000000', '#FFFFFF', '#1E1E1E', '#FAF7F2',
  '#0F4C5C', '#9A1750', '#E8C547', '#2C5530',
  '#4A90E2', '#FF6B35', '#6B4F8A', '#D4A373',
]

const PRESET_TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FFD700', '#FF6B35',
  '#4A90E2', '#9A1750', '#2C5530', '#0F4C5C',
  '#E8C547', '#FF3B30', '#6B4F8A', '#D4A373',
]

const newId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// Convert pointer position to normalized (0..1) frame coordinates
const toNormalized = (clientX, clientY, frameRect) => ({
  nx: (clientX - frameRect.left) / frameRect.width,
  ny: (clientY - frameRect.top) / frameRect.height,
})

// ─────────────────────────────────────────────
// Single canvas element renderer + gesture handler
// ─────────────────────────────────────────────
function CanvasElementView({
  element, isSelected, editable,
  frameWidth, frameHeight, frameRef,
  onSelect, onChange, onDelete, onRequestEdit,
}) {
  const isText = element.type === 'text'

  // Pixel position (top-left) and pixel size
  const elPxW = isText ? 'auto' : element.w * frameWidth
  const elPxH = isText ? 'auto' : element.h * frameHeight
  const elPxCenterX = element.x * frameWidth
  const elPxCenterY = element.y * frameHeight

  // For images/videos, we know w/h; for text we measure DOM size
  const wrapRef = useRef(null)
  const [textSize, setTextSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!isText || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    if (Math.abs(rect.width - textSize.w) > 1 || Math.abs(rect.height - textSize.h) > 1) {
      setTextSize({ w: rect.width, h: rect.height })
    }
  }, [isText, element.content, element.fontSize, element.fontWeight, textSize.w, textSize.h])

  const renderedW = isText ? textSize.w : elPxW
  const renderedH = isText ? textSize.h : elPxH

  // Gesture: drag (pan)
  const dragRef = useRef(null)
  const onElementPointerDown = (e) => {
    if (!editable) return
    if (e.target.dataset?.handle) return  // resize / rotate handle takes over
    e.preventDefault()
    e.stopPropagation()
    onSelect?.()
    const startX = e.clientX
    const startY = e.clientY
    const startEl = { x: element.x, y: element.y }
    dragRef.current = { startX, startY, startEl }

    const onMove = (ev) => {
      if (!dragRef.current || !frameRef.current) return
      const rect = frameRef.current.getBoundingClientRect()
      const dx = (ev.clientX - dragRef.current.startX) / rect.width
      const dy = (ev.clientY - dragRef.current.startY) / rect.height
      const nx = Math.max(0, Math.min(1, dragRef.current.startEl.x + dx))
      const ny = Math.max(0, Math.min(1, dragRef.current.startEl.y + dy))
      onChange?.({ x: nx, y: ny })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Gesture: resize (bottom-right corner)
  const onResizePointerDown = (e) => {
    if (!editable) return
    e.preventDefault()
    e.stopPropagation()
    onSelect?.()
    const startX = e.clientX
    const startY = e.clientY
    const startEl = {
      w: element.w,
      h: element.h,
      fontSize: element.fontSize || 24,
    }

    const onMove = (ev) => {
      if (!frameRef.current) return
      const rect = frameRef.current.getBoundingClientRect()
      const dx = (ev.clientX - startX) / rect.width
      const dy = (ev.clientY - startY) / rect.height
      if (isText) {
        // Drive text size by max of dx/dy as a scale factor
        const factor = 1 + (dx + dy) * 1.5
        const newFont = Math.max(8, Math.min(300, startEl.fontSize * factor))
        onChange?.({ fontSize: newFont })
      } else {
        const newW = Math.max(0.05, startEl.w + dx)
        const newH = Math.max(0.03, startEl.h + dy)
        onChange?.({ w: newW, h: newH })
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Gesture: rotate (top handle)
  const onRotatePointerDown = (e) => {
    if (!editable) return
    e.preventDefault()
    e.stopPropagation()
    onSelect?.()
    const startRotation = element.rotation || 0

    const onMove = (ev) => {
      if (!frameRef.current) return
      const rect = frameRef.current.getBoundingClientRect()
      const centerScreenX = rect.left + elPxCenterX
      const centerScreenY = rect.top + elPxCenterY
      const angle = Math.atan2(ev.clientY - centerScreenY, ev.clientX - centerScreenX)
      // Handle is "above" (12 o'clock) at start; convert so dragging clockwise increases rotation
      const angleDeg = (angle * 180) / Math.PI + 90
      onChange?.({ rotation: angleDeg })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onClick = (e) => {
    if (!editable) return
    e.stopPropagation()
    if (!isSelected) onSelect?.()
  }

  const onDoubleClick = (e) => {
    if (!editable || !isText) return
    e.stopPropagation()
    onRequestEdit?.()
  }

  // Inner content
  let inner = null
  if (isText) {
    const isEmpty = !element.content || !element.content.trim()
    inner = (
      <span
        style={{
          color: isEmpty ? 'rgba(255,255,255,0.5)' : (element.color || '#FFFFFF'),
          fontStyle: isEmpty ? 'italic' : 'normal',
          fontSize: element.fontSize || 24,
          fontWeight: element.fontWeight || 600,
          backgroundColor: element.backgroundColor || 'transparent',
          padding: '4px 10px',
          whiteSpace: 'pre-wrap',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          userSelect: 'none',
          display: 'inline-block',
          minWidth: 40,
          minHeight: 20,
        }}
      >
        {isEmpty ? 'Double-click to edit' : element.content}
      </span>
    )
  } else if (element.type === 'image') {
    inner = (
      <img
        src={element.content}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, pointerEvents: 'none' }}
      />
    )
  } else if (element.type === 'video') {
    inner = (
      <video
        src={element.content}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, pointerEvents: 'none' }}
      />
    )
  }

  // Position: x/y is the CENTER of the element. Use translate(-50%, -50%).
  // For text: display:inline-block makes width shrink-to-fit reliably (more robust
  // than width:auto on an absolute-positioned div, which collapses in some browsers).
  const wrapStyle = {
    position: 'absolute',
    left: elPxCenterX,
    top: elPxCenterY,
    transform: `translate(-50%, -50%) rotate(${element.rotation || 0}deg)`,
    transformOrigin: 'center center',
    zIndex: element.zIndex || 0,
    cursor: editable ? 'move' : 'default',
    border: isSelected ? '1.5px dashed #4A90E2' : 'none',
    borderRadius: 4,
    boxSizing: 'border-box',
    touchAction: 'none',
    ...(isText
      ? { display: 'inline-block' }
      : { width: elPxW, height: elPxH }),
  }

  return (
    <div
      ref={wrapRef}
      style={wrapStyle}
      onPointerDown={onElementPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {inner}
      {isSelected && editable && (
        <>
          {/* Delete badge */}
          <button
            data-handle="delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete?.() }}
            style={{
              position: 'absolute',
              top: -14, right: -14,
              width: 26, height: 26, borderRadius: 13,
              background: '#FFFFFF', border: 'none',
              cursor: 'pointer', padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Delete"
          >
            <X size={16} color="#FF3B30" />
          </button>

          {/* Rotate handle (top) */}
          <div
            data-handle="rotate"
            onPointerDown={onRotatePointerDown}
            style={{
              position: 'absolute',
              top: -28, left: '50%',
              width: 14, height: 14, borderRadius: 7,
              background: '#4A90E2', border: '2px solid #fff',
              transform: 'translateX(-50%)',
              cursor: 'grab',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
            title="Rotate"
          />

          {/* Resize handle (bottom-right) */}
          <div
            data-handle="resize"
            onPointerDown={onResizePointerDown}
            style={{
              position: 'absolute',
              bottom: -8, right: -8,
              width: 14, height: 14, borderRadius: 2,
              background: '#4A90E2', border: '2px solid #fff',
              cursor: 'nwse-resize',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
            title={isText ? 'Resize text' : 'Resize'}
          />
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Canvas Editor
// ─────────────────────────────────────────────
export default function CanvasEditor({ pageId }) {
  const [elements, setElements] = useState([])
  const [background, setBackground] = useState('#000000')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [pendingNewTextId, setPendingNewTextId] = useState(null)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 })

  const frameRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputImageRef = useRef(null)
  const fileInputVideoRef = useRef(null)

  // ── Load canvas ──
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const data = await getCommunityCanvas(pageId)
        if (cancelled) return
        const withIds = (data.canvasContent || []).map((el, idx) => ({
          ...el,
          _id: el._id || newId(),
          zIndex: el.zIndex ?? idx,
        }))
        setElements(withIds)
        setBackground(data.canvasBackground || '#000000')
      } catch (err) {
        logger.error('Canvas load failed:', err)
        toast.error('Failed to load canvas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [pageId])

  // ── Compute 9:16 frame fitting available container ──
  // Re-run after `loading` flips to false: while loading we return the spinner JSX,
  // so the container div doesn't exist yet and ResizeObserver has nothing to attach to.
  useEffect(() => {
    if (loading) return
    const compute = () => {
      if (!containerRef.current) return
      const c = containerRef.current.getBoundingClientRect()
      const padding = 32
      const availW = c.width - padding
      const availH = Math.max(400, c.height - padding)
      const targetRatio = 9 / 16
      let w = availW
      let h = w / targetRatio
      if (h > availH) {
        h = availH
        w = h * targetRatio
      }
      const fw = Math.max(0, Math.floor(w))
      const fh = Math.max(0, Math.floor(h))
      setFrameSize({ w: fw, h: fh })
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [loading])

  const updateElement = useCallback((id, updates) => {
    setElements((prev) => prev.map((el) => (el._id === id ? { ...el, ...updates } : el)))
    setHasChanges(true)
  }, [])

  const deleteElement = useCallback((id) => {
    setElements((prev) => prev.filter((el) => el._id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
    setHasChanges(true)
  }, [])

  // ── Add elements ──
  const addText = () => {
    const id = newId()
    const defaultColor = background.toUpperCase() === '#FFFFFF' ? '#000000' : '#FFFFFF'
    setElements((prev) => [
      ...prev,
      {
        _id: id,
        type: 'text',
        content: '',
        x: 0.5, y: 0.5, w: 0.6, h: 0.12,
        rotation: 0,
        zIndex: prev.length,
        fontSize: 32,
        color: defaultColor,
        fontWeight: '600',
        backgroundColor: 'transparent',
      },
    ])
    setSelectedId(id)
    setEditingId(id)
    setEditingText('')
    setPendingNewTextId(id)
    setHasChanges(true)
  }

  const addImage = async (file) => {
    if (!file || !pageId) return
    try {
      const upload = await uploadContentImage(pageId, file)
      const url = upload.url || upload.signedUrl
      if (!url) { toast.error('Upload returned no URL'); return }

      // Estimate aspect from natural image
      const img = new Image()
      img.onload = () => {
        const aspect = img.width / img.height
        const frameAspect = frameSize.w / frameSize.h
        let elW = 0.6
        let elH = elW * (frameAspect / aspect)
        if (elH > 0.8) {
          elH = 0.8
          elW = elH * (aspect / frameAspect)
        }
        const id = newId()
        setElements((prev) => [
          ...prev,
          {
            _id: id, type: 'image', content: url,
            x: 0.5, y: 0.5, w: elW, h: elH,
            rotation: 0, zIndex: prev.length,
          },
        ])
        setSelectedId(id)
        setHasChanges(true)
      }
      img.src = url
    } catch (err) {
      logger.error('Image upload failed:', err)
      toast.error(err?.response?.data?.message || 'Failed to upload image')
    }
  }

  const addVideo = async (file) => {
    if (!file || !pageId) return
    try {
      const upload = await uploadContentVideo(pageId, file)
      const url = upload.signedUrl || upload.url
      if (!url) { toast.error('Upload returned no URL'); return }

      // Default 9:16-friendly box; user can resize
      const id = newId()
      setElements((prev) => [
        ...prev,
        {
          _id: id, type: 'video', content: url,
          x: 0.5, y: 0.5, w: 0.7, h: 0.5,
          rotation: 0, zIndex: prev.length,
        },
      ])
      setSelectedId(id)
      setHasChanges(true)
    } catch (err) {
      logger.error('Video upload failed:', err)
      toast.error(err?.response?.data?.message || 'Failed to upload video')
    }
  }

  // ── Save ──
  const handleSave = async () => {
    if (!pageId) return
    try {
      setSaving(true)
      const payload = elements.map(({ _id, ...rest }) => rest)
      await updateCommunityCanvas(pageId, payload, background)
      setHasChanges(false)
      toast.success('Canvas saved')
    } catch (err) {
      logger.error('Save canvas error:', err)
      toast.error(err?.response?.data?.message || 'Failed to save canvas')
    } finally {
      setSaving(false)
    }
  }

  // ── Text editing ──
  const openTextEdit = (id) => {
    const el = elements.find((e) => e._id === id)
    if (!el || el.type !== 'text') return
    setEditingId(id)
    setEditingText(el.content)
  }

  const commitTextEdit = () => {
    if (!editingId) return
    const trimmed = editingText.trim()
    if (!trimmed) {
      deleteElement(editingId)
    } else {
      updateElement(editingId, { content: trimmed })
    }
    setEditingId(null)
    setEditingText('')
    setPendingNewTextId(null)
  }

  // Backdrop / Escape: if user typed something, commit it (don't lose work).
  // Only treat as cancel if the textarea is empty.
  const dismissTextEdit = () => {
    if (editingText.trim()) {
      commitTextEdit()
    } else {
      cancelTextEdit()
    }
  }

  const cancelTextEdit = () => {
    if (pendingNewTextId && editingId === pendingNewTextId) {
      deleteElement(pendingNewTextId)
    }
    setEditingId(null)
    setEditingText('')
    setPendingNewTextId(null)
  }

  const selectedTextElement = useMemo(
    () => (selectedId ? elements.find((e) => e._id === selectedId && e.type === 'text') : null),
    [selectedId, elements]
  )

  const onFrameClick = (e) => {
    // Click on empty frame area deselects
    if (e.target === frameRef.current) setSelectedId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={addText}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Type className="w-4 h-4" /> Text
          </button>
          <button
            onClick={() => fileInputImageRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            <ImageIcon className="w-4 h-4" /> Image
          </button>
          <input
            ref={fileInputImageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) addImage(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputVideoRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            <VideoIcon className="w-4 h-4" /> Video
          </button>
          <input
            ref={fileInputVideoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) addVideo(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => setShowBgPicker(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            title="Background color"
          >
            <span
              className="inline-block w-4 h-4 rounded-full border border-gray-300"
              style={{ backgroundColor: background }}
            />
            BG
          </button>
          {selectedTextElement && (
            <button
              onClick={() => setShowTextColorPicker(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
              title="Text color"
            >
              <Palette className="w-4 h-4" />
              <span
                className="inline-block w-4 h-4 rounded-full border border-gray-300"
                style={{ backgroundColor: selectedTextElement.color || '#FFFFFF' }}
              />
            </button>
          )}
          {selectedId && (
            <button
              onClick={() => deleteElement(selectedId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            disabled={elements.length === 0}
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Frame container */}
      <div
        ref={containerRef}
        className="flex items-center justify-center w-full bg-gray-100 rounded-xl border border-gray-200"
        style={{ minHeight: 600 }}
      >
        {frameSize.w > 0 && (
          <div
            ref={frameRef}
            onClick={onFrameClick}
            style={{
              width: frameSize.w,
              height: frameSize.h,
              backgroundColor: background,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              touchAction: 'none',
            }}
          >
            {elements
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map((el) => (
                <CanvasElementView
                  key={el._id}
                  element={el}
                  isSelected={selectedId === el._id}
                  editable
                  frameWidth={frameSize.w}
                  frameHeight={frameSize.h}
                  frameRef={frameRef}
                  onSelect={() => setSelectedId(el._id)}
                  onChange={(updates) => updateElement(el._id, updates)}
                  onDelete={() => deleteElement(el._id)}
                  onRequestEdit={() => openTextEdit(el._id)}
                />
              ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Drag to move • Bottom-right handle to resize • Top handle to rotate • Double-click text to edit
      </p>

      {/* Text edit modal */}
      {editingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={dismissTextEdit}
        >
          <div
            className="bg-white rounded-xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-3">Edit text</h3>
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); dismissTextEdit() }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitTextEdit() }
              }}
              autoFocus
              rows={4}
              placeholder="Type something..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">Tip: ⌘/Ctrl + Enter to save, Esc to dismiss.</p>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={cancelTextEdit}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={commitTextEdit}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background color picker */}
      {showBgPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowBgPicker(false)}
        >
          <div
            className="bg-white rounded-xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-3">Background color</h3>
            <div className="grid grid-cols-6 gap-3">
              {PRESET_BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setBackground(c)
                    setHasChanges(true)
                    setShowBgPicker(false)
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-11 h-11 rounded-full border-2 ${
                    background.toUpperCase() === c.toUpperCase()
                      ? 'border-blue-500 ring-2 ring-blue-300'
                      : 'border-gray-200'
                  }`}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Text color picker */}
      {showTextColorPicker && selectedTextElement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowTextColorPicker(false)}
        >
          <div
            className="bg-white rounded-xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-3">Text color</h3>
            <div className="grid grid-cols-6 gap-3">
              {PRESET_TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    updateElement(selectedTextElement._id, { color: c })
                    setShowTextColorPicker(false)
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-11 h-11 rounded-full border-2 ${
                    (selectedTextElement.color || '').toUpperCase() === c.toUpperCase()
                      ? 'border-blue-500 ring-2 ring-blue-300'
                      : 'border-gray-200'
                  }`}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full-screen preview */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          onClick={() => setShowPreview(false)}
        >
          <PreviewFrame elements={elements} background={background} />
          <button
            onClick={() => setShowPreview(false)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Preview frame: 9:16 fit to viewport
// ─────────────────────────────────────────────
function PreviewFrame({ elements, background }) {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const compute = () => {
      const sw = window.innerWidth
      const sh = window.innerHeight
      const targetRatio = 9 / 16
      const screenRatio = sw / sh
      let w, h
      if (screenRatio > targetRatio) {
        h = sh
        w = h * targetRatio
      } else {
        w = sw
        h = w / targetRatio
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  if (!size.w) return null

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: size.w,
        height: size.h,
        backgroundColor: background,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {elements
        .slice()
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        .map((el) => (
          <CanvasElementView
            key={el._id}
            element={el}
            isSelected={false}
            editable={false}
            frameWidth={size.w}
            frameHeight={size.h}
            frameRef={ref}
          />
        ))}
    </div>
  )
}
