import React, { useState, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Globe,
  Lock,
  MessageSquare,
  ShoppingBag,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getCommunityPages,
  createCommunityPage,
  updateCommunityPage,
  deleteCommunityPage,
} from '../services/communityService'

// ─────────────────────────────────────────────
// Stat Cards
// ─────────────────────────────────────────────
const StatCards = memo(({ pages, loading }) => {
  const total = pages.length
  const withSubscription = pages.filter(p => p.features?.subscription).length
<<<<<<< HEAD
  const totalMembers = pages.reduce((sum, p) => sum + (p.followerCount || 0), 0)
=======
  const totalFollowers = pages.reduce((sum, p) => sum + (p.followerCount || 0), 0)
>>>>>>> backup/local-main-8a5f597
  const withChat = pages.filter(p => p.features?.groupChat).length

  const cards = [
    { title: 'Total Pages', value: total, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'With Buy', value: withSubscription, icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50' },
<<<<<<< HEAD
    { title: 'Members', value: totalMembers, icon: Users, color: 'text-green-600', bg: 'bg-green-50', note: 'on this page' },
=======
    { title: 'Followers', value: totalFollowers, icon: Users, color: 'text-green-600', bg: 'bg-green-50', note: 'on this page' },
>>>>>>> backup/local-main-8a5f597
    { title: 'With Group Chat', value: withChat, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.title} className={`${card.bg} rounded-xl p-5 border border-gray-100`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{card.title}</span>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>
            {loading ? <span className="animate-pulse">...</span> : card.value}
          </div>
          {card.note && <p className="text-xs text-gray-500 mt-1">{card.note}</p>}
        </div>
      ))}
    </div>
  )
})
StatCards.displayName = 'StatCards'

// ─────────────────────────────────────────────
// Create / Edit Modal
// ─────────────────────────────────────────────
const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$)' },
  { code: 'AED', symbol: 'د.إ', label: 'AED (د.إ)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
  { code: 'KRW', symbol: '₩', label: 'KRW (₩)' },
  { code: 'THB', symbol: '฿', label: 'THB (฿)' },
]

function CommunityFormModal({ isOpen, onClose, onSave, editPage }) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [type, setType] = useState('public')
  const [website, setWebsite] = useState(false)
  const [groupChat, setGroupChat] = useState(false)
  const [subscription, setSubscription] = useState(false)
  const [profileImage, setProfileImage] = useState(null)
  const [bannerImage, setBannerImage] = useState(null)
  const [profilePreview, setProfilePreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const [buyItems, setBuyItems] = useState([])
  const [saving, setSaving] = useState(false)

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (editPage) {
        setName(editPage.name || '')
        setBio(editPage.bio || '')
        setType(editPage.type || 'public')
        setWebsite(editPage.features?.website || false)
        setGroupChat(editPage.features?.groupChat || false)
        setSubscription(editPage.features?.subscription || false)
        setProfilePreview(editPage.profileImage || '')
        setBannerPreview(editPage.bannerImage || '')
        setBuyItems(
          Array.isArray(editPage.buyItems)
            ? editPage.buyItems.map((item) => ({
                ...item,
                imagePreview: '',
                imageFile: null,
              }))
            : []
        )
      } else {
        setName('')
        setBio('')
        setType('public')
        setWebsite(false)
        setGroupChat(false)
        setSubscription(false)
        setProfilePreview('')
        setBannerPreview('')
        setBuyItems([])
      }
      setProfileImage(null)
      setBannerImage(null)
    }
  }, [isOpen, editPage])

  const handleImageChange = (e, setter, previewSetter) => {
    const file = e.target.files?.[0]
    if (file) {
      setter(file)
      previewSetter(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 3) {
      toast.error('Page name must be at least 3 characters')
      return
    }

    if (subscription) {
      for (const item of buyItems) {
        if (!item.name.trim()) {
          toast.error('Each item must have a name')
          return
        }
        if (item.price === '' || isNaN(parseFloat(item.price)) || parseFloat(item.price) < 0) {
          toast.error('Each item must have a valid non-negative price')
          return
        }
      }
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('bio', bio.trim())
      formData.append('type', type)
      formData.append('features', JSON.stringify({ website, groupChat, subscription }))

      if (subscription) {
        formData.append(
          'buyItems',
          JSON.stringify(
            buyItems.map((item) => ({
              _id: item._id,
              name: item.name.trim(),
              description: item.description?.trim() || '',
              price: parseFloat(item.price) || 0,
              imageUrl: item.imageUrl || '',
              active: item.active !== false,
            }))
          )
        )
        buyItems.forEach((item, idx) => {
          if (item.imageFile) {
            formData.append(`buyItemImage_${idx}`, item.imageFile)
          }
        })
      }

      if (profileImage) formData.append('profileImage', profileImage)
      if (bannerImage) formData.append('bannerImage', bannerImage)

      await onSave(formData, editPage?._id)
      onClose()
    } catch (error) {
      logger.error('Error saving community page:', error)
      const parsed = handleError(error)
      toast.error(parsed?.adminMessage || parsed?.userMessage || 'Failed to save community page')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>
        <h3 className="text-lg font-semibold text-gray-900">
          {editPage ? 'Edit Community Page' : 'Create Community Page'}
        </h3>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* Images — at top */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Image</label>
              <label className="cursor-pointer block">
                {profilePreview ? (
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                    <ImageIcon className="w-8 h-8 mb-1" />
                    <span className="text-xs">Upload</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageChange(e, setProfileImage, setProfilePreview)}
                />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image</label>
              <label className="cursor-pointer block">
                {bannerPreview ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200">
                    <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                    <ImageIcon className="w-8 h-8 mb-1" />
                    <span className="text-xs">Upload</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageChange(e, setBannerImage, setBannerPreview)}
                />
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Backpackers India"
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">{name.length}/50 characters</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe this community..."
              maxLength={250}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{bio.length}/250 characters</p>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('public')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === 'public'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-4 h-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setType('private')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === 'private'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Lock className="w-4 h-4" /> Private
              </button>
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
            <div className="space-y-2">
              {[
                { key: 'website', label: 'Website Page', icon: FileText, state: website, setter: setWebsite },
                { key: 'groupChat', label: 'Group Chat', icon: MessageSquare, state: groupChat, setter: setGroupChat },
                { key: 'subscription', label: 'Buy', icon: ShoppingBag, state: subscription, setter: setSubscription },
              ].map(({ key, label, icon: Icon, state, setter }) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    state ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={state}
                    onChange={(e) => setter(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    state ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {state && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <Icon className={`w-4 h-4 ${state ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${state ? 'text-blue-700' : 'text-gray-600'}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Buy Items Section (only when Buy feature enabled) */}
          {subscription && (
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-purple-950">Buy Items</label>
                <button
                  type="button"
                  disabled={buyItems.length >= 5}
                  onClick={() => setBuyItems([...buyItems, { name: '', description: '', price: '', active: true, imageUrl: '', imagePreview: '', imageFile: null }])}
                  className="px-2.5 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item ({buyItems.length}/5)
                </button>
              </div>

              {buyItems.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-purple-100 space-y-3 relative">
                  <button
                    type="button"
                    onClick={() => setBuyItems(buyItems.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 p-1 rounded-full text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Item Image Upload */}
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Item Photo</label>
                      <label className="cursor-pointer block">
                        {item.imagePreview || item.imageUrl ? (
                          <div className="relative w-full aspect-video rounded border border-gray-200 overflow-hidden">
                            <img src={item.imagePreview || item.imageUrl} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Upload className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full aspect-video rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-600 transition-colors">
                            <ImageIcon className="w-6 h-6 mb-0.5" />
                            <span className="text-[10px]">Upload</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const updated = [...buyItems]
                              updated[idx].imageFile = file
                              updated[idx].imagePreview = URL.createObjectURL(file)
                              setBuyItems(updated)
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Heading/Name & Price */}
                    <div className="sm:col-span-2 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Item Heading / Name *</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => {
                            const updated = [...buyItems]
                            updated[idx].name = e.target.value
                            setBuyItems(updated)
                          }}
                          placeholder="e.g. Premium T-shirt"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Price (INR) *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => {
                              const updated = [...buyItems]
                              updated[idx].price = e.target.value
                              setBuyItems(updated)
                            }}
                            placeholder="Price"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <div className="flex items-end pl-1">
                          <label className="flex items-center gap-1.5 cursor-pointer pb-1.5">
                            <input
                              type="checkbox"
                              checked={item.active !== false}
                              onChange={(e) => {
                                const updated = [...buyItems]
                                updated[idx].active = e.target.checked
                                setBuyItems(updated)
                              }}
                              className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                            />
                            <span className="text-xs font-medium text-gray-600">Active</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Caption/Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Item Caption / Description</label>
                    <textarea
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...buyItems]
                        updated[idx].description = e.target.value
                        setBuyItems(updated)
                      }}
                      placeholder="Enter a compelling caption or details to admire users..."
                      rows={2}
                      maxLength={500}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                    />
                  </div>
                </div>
              ))}

              {buyItems.length === 0 && (
                <p className="text-center text-xs text-purple-600/70 italic py-2">
                  No items listed yet. Click &quot;Add Item&quot; to list items for users to buy!
                </p>
              )}
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            editPage ? 'Update Page' : 'Create Page'
          )}
        </button>
      </ModalFooter>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// Delete Confirmation Modal
// ─────────────────────────────────────────────
function DeleteModal({ isOpen, onClose, onConfirm, pageName, deleting }) {
  if (!isOpen) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Archive Community Page
        </h3>
      </ModalHeader>
      <ModalContent>
        <p className="text-sm text-gray-600">
          Are you sure you want to archive <strong>{pageName}</strong>? The page will be hidden from the community tab but can be restored later.
        </p>
      </ModalContent>
      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
        >
          {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Archive
        </button>
      </ModalFooter>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// Page Row
// ─────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-green-50 text-green-700 border-green-200',
    inactive: 'bg-gray-50 text-gray-700 border-gray-200',
    archived: 'bg-gray-50 text-gray-700 border-gray-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${map[status] || map.inactive}`}>
      {status || 'unknown'}
    </span>
  )
}

const PageRow = memo(({ page, onEdit, onDelete, onEditContent }) => {
  const featureBadges = []
  if (page.features?.website) featureBadges.push({ label: 'Website', color: 'bg-blue-100 text-blue-700' })
  if (page.features?.groupChat) featureBadges.push({ label: 'Chat', color: 'bg-amber-100 text-amber-700' })
  if (page.features?.subscription) featureBadges.push({ label: 'Buy', color: 'bg-purple-100 text-purple-700' })

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {page.profileImage ? (
            <img src={page.profileImage} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-100" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
              {(page.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate max-w-[160px]">{page.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          {page.type === 'private' ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
          {page.type || 'public'}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {featureBadges.length > 0 ? featureBadges.map((b) => (
            <span key={b.label} className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.color}`}>
              {b.label}
            </span>
          )) : (
            <span className="text-xs text-gray-400">None</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right text-sm">
        {page.features?.subscription && page.subscriptionPrice
          ? `₹${page.subscriptionPrice}`
          : <span className="text-gray-400">—</span>}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
          <Users className="w-3 h-3" />
          {page.followerCount || 0}
        </span>
      </TableCell>
      <TableCell><StatusBadge status={page.status} /></TableCell>
      <TableCell className="text-xs text-gray-500">
        {page.createdAt ? formatDate(page.createdAt) : '—'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onEditContent(page)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 border border-gray-200 transition-colors"
            title="Edit Content"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(page)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(page)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition-colors"
            title="Archive"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
})
PageRow.displayName = 'PageRow'

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function CommunityPages() {
  const navigate = useNavigate()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editPage, setEditPage] = useState(null)
  const [deletePage, setDeletePage] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPages = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const data = await getCommunityPages({ page, limit: 20, status: statusFilter })
      setPages(data.pages || [])
      setPagination(data.pagination || { page, limit: 20, total: 0, totalPages: 0 })
    } catch (error) {
      logger.error('Error loading community pages:', error)
      toast.error('Failed to load community pages')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const handleSave = async (formData, pageId) => {
    if (pageId) {
      await updateCommunityPage(pageId, formData)
      toast.success('Community page updated')
    } else {
      await createCommunityPage(formData)
      toast.success('Community page created')
    }
    // Re-fetch in background — errors handled inside fetchPages
    fetchPages(pagination.page).catch(() => {})
  }

  const handleDelete = async () => {
    if (!deletePage) return
    setDeleting(true)
    try {
      await deleteCommunityPage(deletePage._id)
      toast.success('Community page archived')
      setDeletePage(null)
      fetchPages(pagination.page)
    } catch (error) {
      logger.error('Error archiving community page:', error)
      toast.error('Failed to archive community page')
    } finally {
      setDeleting(false)
    }
  }

  const filteredPages = search
    ? pages.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.bio?.toLowerCase().includes(search.toLowerCase()))
    : pages

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-600" />
            Community Pages
          </h1>
          <p className="text-sm text-gray-500 mt-1">Admin community pages visible in the Community tab</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPages(pagination.page)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => { setEditPage(null); setShowCreateModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Page
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatCards pages={pages} loading={loading} />

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>All Community Pages</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages..."
                  className="w-48 pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {['all', 'active', 'archived', 'suspended'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Features</TableHead>
                <TableHead className="text-right">Buy Price</TableHead>
<<<<<<< HEAD
                <TableHead>Members</TableHead>
=======
                <TableHead>Followers</TableHead>
>>>>>>> backup/local-main-8a5f597
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && filteredPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No community pages found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPages.map((page) => (
                  <PageRow
                    key={page._id}
                    page={page}
                    onEditContent={(p) => navigate(`/community-pages/${p._id}/edit`)}
                    onEdit={(p) => { setEditPage(p); setShowCreateModal(true) }}
                    onDelete={(p) => setDeletePage(p)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} pages
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchPages(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => fetchPages(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <CommunityFormModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditPage(null) }}
        onSave={handleSave}
        editPage={editPage}
      />

      {/* Delete Modal */}
      <DeleteModal
        isOpen={!!deletePage}
        onClose={() => setDeletePage(null)}
        onConfirm={handleDelete}
        pageName={deletePage?.name}
        deleting={deleting}
      />
    </div>
  )
}
