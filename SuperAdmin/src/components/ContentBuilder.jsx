import React, { useState, useRef, useCallback } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import {
  GripVertical,
  Plus,
  Trash2,
  Type,
  Heading,
  Image as ImageIcon,
  Video,
  Link2,
  Minus,
  Code,
  ChevronDown,
  Upload,
  ExternalLink,
  X,
} from 'lucide-react'

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: Heading, color: 'text-blue-600 bg-blue-50' },
  { type: 'text', label: 'Text', icon: Type, color: 'text-gray-600 bg-gray-50' },
  { type: 'image', label: 'Image', icon: ImageIcon, color: 'text-green-600 bg-green-50' },
  { type: 'video', label: 'Video', icon: Video, color: 'text-purple-600 bg-purple-50' },
  { type: 'button', label: 'Button', icon: Link2, color: 'text-amber-600 bg-amber-50' },
  { type: 'divider', label: 'Divider', icon: Minus, color: 'text-gray-400 bg-gray-50' },
  { type: 'embed', label: 'Embed', icon: Code, color: 'text-red-600 bg-red-50' },
]

const ITEM_TYPE = 'CONTENT_BLOCK'

// ─────────────────────────────────────────────
// Draggable Block
// ─────────────────────────────────────────────
function DraggableBlock({ block, index, moveBlock, updateBlock, removeBlock, onImageUpload }) {
  const ref = useRef(null)

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_TYPE,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  const [, drop] = useDrop({
    accept: ITEM_TYPE,
    hover(item, monitor) {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) return

      const hoverBoundingRect = ref.current.getBoundingClientRect()
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const clientOffset = monitor.getClientOffset()
      const hoverClientY = clientOffset.y - hoverBoundingRect.top

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return

      moveBlock(dragIndex, hoverIndex)
      item.index = hoverIndex
    },
  })

  preview(drop(ref))

  const blockMeta = BLOCK_TYPES.find(b => b.type === block.type) || BLOCK_TYPES[1]
  const BlockIcon = blockMeta.icon

  return (
    <div
      ref={ref}
      className={`group relative border rounded-lg mb-2 transition-all ${
        isDragging ? 'opacity-30 border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start">
        {/* Drag handle */}
        <div
          ref={drag}
          className="flex-shrink-0 p-3 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 self-stretch flex items-center"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Block content */}
        <div className="flex-1 py-3 pr-3 min-w-0">
          {/* Block type badge */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${blockMeta.color}`}>
              <BlockIcon className="w-3 h-3" />
              {blockMeta.label}
            </span>
            {block.stacked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                ⬆ Stacked
              </span>
            )}
            {block.type !== 'divider' && (
              <>
                {/* Width chips: 12 = full, 6 = half, 4 = third */}
                <div className="flex items-center gap-0.5 ml-2 rounded-md border border-gray-200 p-0.5">
                  {[
                    { col: 12, label: 'Full' },
                    { col: 6, label: 'Half' },
                    { col: 4, label: 'Third' },
                  ].map(({ col, label }) => {
                    const active = (block.col ?? 12) === col
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => updateBlock(index, { col })}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          active ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {/* Per-block color swatches */}
                <InlineColorSwatch
                  title="Block background"
                  value={block.backgroundColor || ''}
                  onChange={(c) => updateBlock(index, { backgroundColor: c })}
                  fallbackLabel="BG"
                />
                {(block.type === 'heading' || block.type === 'text' || block.type === 'button') && (
                  <InlineColorSwatch
                    title="Text color"
                    value={block.color || ''}
                    onChange={(c) => updateBlock(index, { color: c })}
                    fallbackLabel="A"
                  />
                )}
                {(block.type === 'heading' || block.type === 'text') && (
                  <>
                    <button
                      type="button"
                      title="Bold"
                      onClick={() => updateBlock(index, { bold: !block.bold })}
                      className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-black ${block.bold ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500'}`}
                    >
                      B
                    </button>
                    {/* Alignment */}
                    {(['left', 'center', 'right'] as const).map((a) => {
                      const defaultAlign = block.type === 'heading' ? 'center' : 'left';
                      const active = (block.align || defaultAlign) === a;
                      return (
                        <button
                          key={a}
                          type="button"
                          title={`Align ${a}`}
                          onClick={() => updateBlock(index, { align: a })}
                          className={`h-5 w-5 rounded border flex items-center justify-center text-[9px] font-semibold ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500'}`}
                        >
                          {a === 'left' ? '⬅' : a === 'center' ? '≡' : '➡'}
                        </button>
                      );
                    })}
                    {/* Font size */}
                    {(['small', 'normal', 'large'] as const).map((s) => {
                      const active = (block.fontSize || 'normal') === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          title={`Size ${s}`}
                          onClick={() => updateBlock(index, { fontSize: s })}
                          className={`h-5 w-5 rounded border flex items-center justify-center font-bold ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500'} ${s === 'small' ? 'text-[8px]' : s === 'large' ? 'text-[12px]' : 'text-[10px]'}`}
                        >
                          {s === 'small' ? 'S' : s === 'normal' ? 'M' : 'L'}
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>

          {/* Render based on type */}
          {block.type === 'heading' && (
            <input
              type="text"
              value={block.content}
              onChange={(e) => updateBlock(index, { content: e.target.value })}
              placeholder="Enter heading..."
              className={`w-full text-lg border-0 border-b border-transparent focus:border-gray-300 focus:outline-none bg-transparent px-0 py-1 ${block.bold ? 'font-extrabold' : 'font-bold'}`}
            />
          )}

          {block.type === 'text' && (
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(index, { content: e.target.value })}
              placeholder="Enter text content..."
              rows={3}
              className={`w-full text-sm border-0 border-b border-transparent focus:border-gray-300 focus:outline-none bg-transparent px-0 py-1 resize-none ${block.bold ? 'font-bold' : ''}`}
            />
          )}

          {block.type === 'image' && (
            <div>
              {block.content ? (
                <div className="relative">
                  <img src={block._displayUrl || block.content} alt="" className="max-h-48 rounded-lg border border-gray-200 object-contain" />
                  <button
                    onClick={() => updateBlock(index, { content: '', _displayUrl: '' })}
                    className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white shadow"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Click to upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && onImageUpload) onImageUpload(index, file)
                    }}
                  />
                </label>
              )}
            </div>
          )}

          {block.type === 'video' && (
            <input
              type="url"
              value={block.content}
              onChange={(e) => updateBlock(index, { content: e.target.value })}
              placeholder="Paste video URL..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}

          {block.type === 'button' && (
            <div className="space-y-2">
              <input
                type="text"
                value={block.content}
                onChange={(e) => updateBlock(index, { content: e.target.value })}
                placeholder="Button label..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="url"
                  value={block.url || ''}
                  onChange={(e) => updateBlock(index, { url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {block.type === 'divider' && (
            <hr className="border-t-2 border-gray-200 my-2" />
          )}

          {block.type === 'embed' && (
            <div className="space-y-2">
              <select
                value={block.embedType || 'youtube'}
                onChange={(e) => updateBlock(index, { embedType: e.target.value })}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="youtube">YouTube</option>
                <option value="map">Google Map</option>
                <option value="custom">Custom Embed</option>
              </select>
              <input
                type="url"
                value={block.content}
                onChange={(e) => updateBlock(index, { content: e.target.value })}
                placeholder={block.embedType === 'youtube' ? 'YouTube URL...' : block.embedType === 'map' ? 'Google Maps URL...' : 'Embed URL...'}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* Stack toggle + Remove */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 p-2 self-start">
          {index > 0 && (
            <button
              type="button"
              title={block.stacked ? 'Unstackback' : 'Stack into column above'}
              onClick={() => updateBlock(index, { stacked: !block.stacked })}
              className={`p-1 rounded border text-[10px] transition-colors ${block.stacked ? 'border-blue-400 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500'}`}
            >
              ⬆
            </button>
          )}
          <button
            onClick={() => removeBlock(index)}
            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
            title="Remove block"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Add Block Menu
// ─────────────────────────────────────────────
function AddBlockMenu({ onAdd }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Block
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {BLOCK_TYPES.map(({ type, label, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => {
                onAdd(type)
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${color}`}>
                <Icon className="w-4 h-4" />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Content Builder (main export)
// ─────────────────────────────────────────────
export default function ContentBuilder({ blocks, onChange, onImageUpload }) {
  const moveBlock = useCallback((dragIndex, hoverIndex) => {
    const updated = [...blocks]
    const [removed] = updated.splice(dragIndex, 1)
    updated.splice(hoverIndex, 0, removed)
    onChange(updated.map((b, i) => ({ ...b, order: i })))
  }, [blocks, onChange])

  const updateBlock = useCallback((index, fields) => {
    const updated = [...blocks]
    updated[index] = { ...updated[index], ...fields }
    onChange(updated)
  }, [blocks, onChange])

  const removeBlock = useCallback((index) => {
    const updated = blocks.filter((_, i) => i !== index)
    onChange(updated.map((b, i) => ({ ...b, order: i })))
  }, [blocks, onChange])

  const addBlock = useCallback((type) => {
    const newBlock = {
      type,
      content: type === 'divider' ? '---' : '',
      order: blocks.length,
      url: '',
      embedType: type === 'embed' ? 'youtube' : '',
      col: 12,
      backgroundColor: '',
      color: '',
      bold: false,
      align: type === 'heading' ? 'center' : 'left',
      fontSize: 'normal',
      stacked: false,
    }
    onChange([...blocks, newBlock])
  }, [blocks, onChange])

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-1">
        {blocks.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Type className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No content blocks yet. Add your first block below.</p>
          </div>
        )}

        {blocks.map((block, index) => (
          <DraggableBlock
            key={block._id || `block-${index}`}
            block={block}
            index={index}
            moveBlock={moveBlock}
            updateBlock={updateBlock}
            removeBlock={removeBlock}
            onImageUpload={onImageUpload}
          />
        ))}

        <AddBlockMenu onAdd={addBlock} />
      </div>
    </DndProvider>
  )
}

const BLOCK_PRESET_COLORS = [
  '#FFFFFF', '#000000', '#F5F5F5', '#1E1E1E',
  '#4A90E2', '#5856D6', '#9A1750', '#FF3B30',
  '#FF6B35', '#FFD700', '#E8C547', '#34C759',
  '#2C5530', '#0F4C5C', '#6B4F8A', '#D4A373',
]

function InlineColorSwatch({ title, value, onChange, fallbackLabel }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center text-[8px] font-bold text-gray-500"
        style={value ? { backgroundColor: value } : undefined}
      >
        {!value && fallbackLabel}
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-52 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false) }}
                className="h-5 w-5 rounded-full border-2"
                style={{
                  backgroundColor: c,
                  borderColor: value && value.toLowerCase() === c.toLowerCase() ? '#3b82f6' : '#e5e7eb',
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="h-5 w-5 rounded-full border border-gray-300 bg-white text-[10px] text-gray-500"
              title="Clear"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
