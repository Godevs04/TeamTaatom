import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Star, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ContentBuilder from '../components/ContentBuilder'
import {
  getCommunityPageContent,
  updateCommunityPageContent,
  uploadContentImage,
} from '../services/communityService'
import logger from '../utils/logger'

const TABS = [
  { key: 'website', label: 'Website', icon: Globe, color: 'text-blue-600 border-blue-600' },
  { key: 'subscription', label: 'Subscription', icon: Star, color: 'text-purple-600 border-purple-600' },
]

export default function CommunityPageEditor() {
  const { pageId } = useParams()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('website')
  const [websiteBlocks, setWebsiteBlocks] = useState([])
  const [subscriptionBlocks, setSubscriptionBlocks] = useState([])
  const [websiteBackground, setWebsiteBackground] = useState('')
  const [websiteTextColor, setWebsiteTextColor] = useState('')
  const [subscriptionBackground, setSubscriptionBackground] = useState('')
  const [subscriptionTextColor, setSubscriptionTextColor] = useState('')
  const [pageName, setPageName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // ── Load existing content ──────────────────────
  useEffect(() => {
    let cancelled = false
    const loadContent = async () => {
      try {
        setLoading(true)
        const data = await getCommunityPageContent(pageId)
        if (cancelled) return
        setPageName(data.name || 'Community Page')
        setWebsiteBlocks(data.websiteContent || [])
        setSubscriptionBlocks(data.subscriptionContent || [])
        setWebsiteBackground(data.websiteBackground || '')
        setWebsiteTextColor(data.websiteTextColor || '')
        setSubscriptionBackground(data.subscriptionBackground || '')
        setSubscriptionTextColor(data.subscriptionTextColor || '')
      } catch (err) {
        logger.error('Failed to load content:', err)
        toast.error('Failed to load page content')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadContent()
    return () => { cancelled = true }
  }, [pageId])

  // ── Block change handlers (mark dirty) ─────────
  const handleWebsiteChange = useCallback((blocks) => {
    setWebsiteBlocks(blocks)
    setDirty(true)
  }, [])

  const handleSubscriptionChange = useCallback((blocks) => {
    setSubscriptionBlocks(blocks)
    setDirty(true)
  }, [])

  // ── Image upload for content blocks ────────────
  const handleImageUpload = useCallback(async (blockIndex, file) => {
    try {
      const result = await uploadContentImage(pageId, file)
      const storageKey = result.storageKey || ''
      const displayUrl = result.url || result.signedUrl || ''
      if (!storageKey) {
        toast.error('Upload succeeded but no storage key returned')
        return
      }
      // Store storageKey as content (persisted to DB), displayUrl for preview
      if (activeTab === 'website') {
        setWebsiteBlocks(prev => {
          const updated = [...prev]
          updated[blockIndex] = { ...updated[blockIndex], content: storageKey, _displayUrl: displayUrl }
          return updated
        })
      } else {
        setSubscriptionBlocks(prev => {
          const updated = [...prev]
          updated[blockIndex] = { ...updated[blockIndex], content: storageKey, _displayUrl: displayUrl }
          return updated
        })
      }
      setDirty(true)
      toast.success('Image uploaded')
    } catch (err) {
      logger.error('Image upload failed:', err?.response?.data || err)
      const msg = err?.response?.data?.message || err?.message || 'Failed to upload image'
      toast.error(msg)
    }
  }, [pageId, activeTab])

  // ── Save ───────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      await updateCommunityPageContent(pageId, {
        websiteContent: websiteBlocks,
        subscriptionContent: subscriptionBlocks,
        websiteBackground,
        websiteTextColor,
        subscriptionBackground,
        subscriptionTextColor,
      })
      setDirty(false)
      toast.success('Content saved successfully')
    } catch (err) {
      logger.error('Save failed:', err)
      toast.error('Failed to save content')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading state ──────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const currentBlocks = activeTab === 'website' ? websiteBlocks : subscriptionBlocks
  const currentOnChange = activeTab === 'website' ? handleWebsiteChange : handleSubscriptionChange

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/community-pages')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{pageName}</h1>
            <p className="text-sm text-gray-500">Drag-and-drop content editor</p>
          </div>
        </div>

        {activeTab !== 'website' && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              dirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {TABS.map(tab => {
            const TabIcon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? tab.color
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Builder area */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            {activeTab === 'website' ? 'Website' : 'Subscription Content'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === 'website'
              ? 'Stacked content blocks. Add headings, text, images, videos, and buttons — this is what visitors see.'
              : 'This content is only visible to paying subscribers.'}
          </p>
        </div>

        {/* Page-level colors */}
        <div className="mb-5 flex gap-4 flex-wrap">
          <PageColorField
            label="Page background"
            value={activeTab === 'website' ? websiteBackground : subscriptionBackground}
            onChange={(c) => {
              if (activeTab === 'website') setWebsiteBackground(c)
              else setSubscriptionBackground(c)
              setDirty(true)
            }}
          />
          <PageColorField
            label="Default text color"
            value={activeTab === 'website' ? websiteTextColor : subscriptionTextColor}
            onChange={(c) => {
              if (activeTab === 'website') setWebsiteTextColor(c)
              else setSubscriptionTextColor(c)
              setDirty(true)
            }}
          />
        </div>

        <ContentBuilder
          blocks={currentBlocks}
          onChange={currentOnChange}
          onImageUpload={handleImageUpload}
        />
      </div>

      {/* Unsaved changes warning */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-2.5 rounded-full shadow-lg text-sm font-medium">
          You have unsaved changes
        </div>
      )}
    </div>
  )
}

const PAGE_PRESET_COLORS = [
  '#FFFFFF', '#FAF7F2', '#F5F5F5', '#1E1E1E', '#000000',
  '#4A90E2', '#5856D6', '#9A1750', '#FF3B30',
  '#FF6B35', '#FFD700', '#E8C547', '#34C759',
  '#2C5530', '#0F4C5C', '#6B4F8A', '#D4A373',
]

function PageColorField({ label, value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs"
      >
        <span
          className="inline-block h-5 w-5 rounded-full border border-gray-300"
          style={{ backgroundColor: value || 'transparent' }}
        />
        <span className="text-gray-700">{value || 'None'}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="flex flex-wrap gap-2">
            {PAGE_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false) }}
                className="h-7 w-7 rounded-full border-2"
                style={{
                  backgroundColor: c,
                  borderColor: value && value.toLowerCase() === c.toLowerCase() ? '#3b82f6' : '#e5e7eb',
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="h-7 w-7 rounded-full border border-gray-300 bg-white text-xs text-gray-500"
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
