import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Star, Save, Loader2, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import ContentBuilder from '../components/ContentBuilder'
import {
  getCommunityPageContent,
  updateCommunityPageContent,
  uploadContentImage,
  getCommunityPageEvents,
  updateCommunityPageEvent,
  createCommunityPageEvent,
} from '../services/communityService'
import logger from '../utils/logger'

const TABS = [
  { key: 'website', label: 'Website', icon: Globe, color: 'text-blue-600 border-blue-600' },
  { key: 'subscription', label: 'Subscription', icon: Star, color: 'text-purple-600 border-purple-600' },
  { key: 'events', label: 'Events', icon: Calendar, color: 'text-amber-600 border-amber-600' },
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
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventBusyId, setEventBusyId] = useState(null)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventStarts, setNewEventStarts] = useState('')
  const [newEventEnds, setNewEventEnds] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [newEventMax, setNewEventMax] = useState('')
  const [newEventMode, setNewEventMode] = useState('individual')
  const [newEventVisibility, setNewEventVisibility] = useState('members')
  const ALL_ENTRY_MEDIA = ['post', 'short', 'long_video']
  const [newEventAllowedMedia, setNewEventAllowedMedia] = useState(() => [...ALL_ENTRY_MEDIA])
  const [newEventRegistrationOpen, setNewEventRegistrationOpen] = useState(true)
  const [creatingEvent, setCreatingEvent] = useState(false)

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

  const loadEvents = useCallback(async () => {
    if (!pageId) return
    try {
      setEventsLoading(true)
      const data = await getCommunityPageEvents(pageId)
      setEvents(data.events || [])
    } catch (err) {
      logger.error('Failed to load community events:', err)
      toast.error('Failed to load events')
    } finally {
      setEventsLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    if (activeTab === 'events') void loadEvents()
  }, [activeTab, loadEvents])

  const moderateEvent = async (eventId, body, okMsg) => {
    if (eventBusyId) return
    setEventBusyId(eventId)
    try {
      await updateCommunityPageEvent(pageId, eventId, body)
      toast.success(okMsg)
      await loadEvents()
    } catch (err) {
      logger.error('Event moderation failed:', err)
      toast.error('Failed to update event')
    } finally {
      setEventBusyId(null)
    }
  }

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

        {activeTab !== 'website' && activeTab !== 'events' && (
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

      {activeTab === 'events' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Community events</h2>
              <p className="text-xs text-gray-400 mt-1">
                Create events here, or assign a Taatom host on Community Pages (Edit → pick a joined member) so they can create from the app Spaces → Events.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadEvents()}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          <div className="mb-5 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Create event</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Title</span>
                <input
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Event title"
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Starts</span>
                <input
                  type="datetime-local"
                  value={newEventStarts}
                  onChange={(e) => setNewEventStarts(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ends (optional)</span>
                <input
                  type="datetime-local"
                  value={newEventEnds}
                  onChange={(e) => setNewEventEnds(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Location</span>
                <input
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  placeholder="Venue or address (optional)"
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Max participants</span>
                <input
                  type="number"
                  min="1"
                  value={newEventMax}
                  onChange={(e) => setNewEventMax(e.target.value)}
                  placeholder="Unlimited if empty"
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Visibility</span>
                <select
                  value={newEventVisibility}
                  onChange={(e) => setNewEventVisibility(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="members">Members only</option>
                  <option value="public">Public</option>
                  <option value="private">Request</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Who can join</span>
                <select
                  value={newEventMode}
                  onChange={(e) => setNewEventMode(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="individual">Individual</option>
                  <option value="group">Team</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Allowed entries</span>
                <p className="mb-2 text-xs text-gray-500">Choose any mix — posts, shorts, and/or long videos</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { key: 'post', label: 'Posts' },
                    { key: 'short', label: 'Shorts' },
                    { key: 'long_video', label: 'Videos' },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={newEventAllowedMedia.includes(opt.key)}
                        onChange={() => {
                          setNewEventAllowedMedia((prev) => {
                            if (prev.includes(opt.key)) {
                              return prev.filter((k) => k !== opt.key)
                            }
                            return ALL_ENTRY_MEDIA.filter((k) => k === opt.key || prev.includes(k))
                          })
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 sm:col-span-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newEventRegistrationOpen}
                  onChange={(e) => setNewEventRegistrationOpen(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Registration open
              </label>
              <button
                type="button"
                disabled={creatingEvent}
                onClick={async () => {
                  if (!newEventTitle.trim() || !newEventStarts.trim()) {
                    toast.error('Title and start date & time are required')
                    return
                  }
                  if (!newEventAllowedMedia.length) {
                    toast.error('Select at least one allowed entry type')
                    return
                  }
                  setCreatingEvent(true)
                  try {
                    const startsAt = new Date(newEventStarts)
                    if (Number.isNaN(startsAt.getTime())) throw new Error('Invalid start time')
                    const endsAt = newEventEnds.trim() ? new Date(newEventEnds) : null
                    if (newEventEnds.trim() && (!endsAt || Number.isNaN(endsAt.getTime()))) {
                      throw new Error('Invalid end time')
                    }
                    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
                      throw new Error('End time must be after the start time')
                    }
                    await createCommunityPageEvent(pageId, {
                      title: newEventTitle.trim(),
                      startsAt: startsAt.toISOString(),
                      endsAt: endsAt ? endsAt.toISOString() : null,
                      location: { address: newEventLocation.trim() },
                      maxParticipants: newEventMax.trim() ? Number(newEventMax.trim()) : null,
                      participationMode: newEventMode,
                      visibility: newEventVisibility,
                      allowedEntryMedia: newEventAllowedMedia,
                      registrationOpen: newEventRegistrationOpen,
                    })
                    toast.success('Event created')
                    setNewEventTitle('')
                    setNewEventStarts('')
                    setNewEventEnds('')
                    setNewEventLocation('')
                    setNewEventMax('')
                    setNewEventMode('individual')
                    setNewEventVisibility('members')
                    setNewEventAllowedMedia([...ALL_ENTRY_MEDIA])
                    setNewEventRegistrationOpen(true)
                    await loadEvents()
                  } catch (err) {
                    logger.error('Create event failed:', err)
                    const msg =
                      err?.response?.data?.message ||
                      err?.message ||
                      'Failed to create event — assign a valid Host on the page first'
                    toast.error(msg)
                  } finally {
                    setCreatingEvent(false)
                  }
                }}
                className="h-10 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 sm:col-span-2"
              >
                {creatingEvent ? 'Creating…' : 'Create event'}
              </button>
            </div>
          </div>

          {eventsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No events on this community yet.</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div
                  key={ev._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{ev.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {ev.startsAt ? new Date(ev.startsAt).toLocaleString() : 'No start'}
                      {' · '}
                      {ev.participationMode}
                      {' · '}
                      {ev.status}
                      {ev.competition?.enabled ? ' · competition on' : ''}
                      {' · '}
                      {ev.participantCount || 0} joined
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ev.registrationOpen !== false && ev.status !== 'cancelled' ? (
                      <button
                        type="button"
                        disabled={eventBusyId === ev._id}
                        onClick={() =>
                          void moderateEvent(ev._id, { registrationOpen: false }, 'Registration closed')
                        }
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Close reg
                      </button>
                    ) : null}
                    {ev.status !== 'cancelled' ? (
                      <button
                        type="button"
                        disabled={eventBusyId === ev._id}
                        onClick={() =>
                          void moderateEvent(ev._id, { status: 'cancelled' }, 'Event cancelled')
                        }
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={eventBusyId === ev._id}
                        onClick={() =>
                          void moderateEvent(ev._id, { status: 'published' }, 'Event restored')
                        }
                        className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
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
      )}

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
