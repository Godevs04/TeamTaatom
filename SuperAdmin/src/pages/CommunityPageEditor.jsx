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
            {activeTab === 'website' ? 'Website Content' : 'Subscription Content'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === 'website'
              ? 'This content is visible to everyone who visits the page.'
              : 'This content is only visible to paying subscribers.'}
          </p>
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
