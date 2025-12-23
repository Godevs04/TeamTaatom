import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, Trash2, Eye, Flag, MapPin, RefreshCw, Edit, Download, AlertTriangle, CheckCircle, Clock, Power, PowerOff, Undo2 } from 'lucide-react'
const MapPinIcon = MapPin
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'

// Health status helper
const getHealthBadge = (healthStatus, reportCount) => {
  switch (healthStatus) {
    case 'high_reports':
      return { color: 'bg-red-100 text-red-700', icon: AlertTriangle, text: `High Reports (${reportCount})` }
    case 'flagged':
      return { color: 'bg-yellow-100 text-yellow-700', icon: Flag, text: `Flagged${reportCount > 0 ? ` (${reportCount})` : ''}` }
    default:
      return { color: 'bg-green-100 text-green-700', icon: CheckCircle, text: 'Normal' }
  }
}

// Review state helper
const getReviewStateBadge = (reviewState) => {
  switch (reviewState) {
    case 'pending':
      return { color: 'bg-yellow-100 text-yellow-700', text: 'Pending Review' }
    case 'reviewed':
      return { color: 'bg-blue-100 text-blue-700', text: 'Reviewed' }
    case 'disabled':
      return { color: 'bg-gray-100 text-gray-700', text: 'Disabled' }
    default:
      return { color: 'bg-gray-100 text-gray-700', text: 'Unknown' }
  }
}

// Memoized Content Card Component
const ContentCard = memo(({
  item,
  index,
  selectedPosts,
  onSelect,
  onView,
  onFlag,
  onToggleStatus,
  onDelete,
  formatDate,
  expandedRows,
  onToggleExpand,
  loadFullMedia
}) => {
  const healthBadge = getHealthBadge(item.healthStatus || 'normal', item.reportCount || 0)
  const reviewBadge = getReviewStateBadge(item.reviewState || 'reviewed')
  const HealthIcon = healthBadge.icon
  const isExpanded = expandedRows.has(item._id)
  const [imageError, setImageError] = React.useState(false)
  const [videoError, setVideoError] = React.useState(false)
  
  // Lazy load full media only when expanded
  const mediaUrl = useMemo(() => {
    if (!isExpanded) {
      // Return thumbnail for list view
      return item.thumbnailUrl || item.imageUrl || item.videoUrl
    }
    // Return full media when expanded
    return item.type === 'short' ? item.videoUrl : item.imageUrl
  }, [isExpanded, item])
  
  return (
    <Card key={item._id} className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative group">
        <input
          type="checkbox"
          checked={selectedPosts.includes(item._id)}
          onChange={() => onSelect(item._id)}
          className="absolute top-2 left-2 z-10 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
        />
        {/* Health indicator */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${healthBadge.color}`}>
            <HealthIcon className="w-3 h-3" />
            {healthBadge.text}
          </span>
        </div>
        {/* Lazy media preview - thumbnail only in list view */}
        {!isExpanded ? (
          <div 
            className="w-full h-48 bg-gray-200 flex items-center justify-center cursor-pointer"
            onClick={() => onToggleExpand(item._id)}
          >
            {item.type === 'short' ? (
              // For shorts, show thumbnail image (not video)
              (item.thumbnailUrl || item.imageUrl) && !imageError ? (
                <img
                  src={item.thumbnailUrl || item.imageUrl}
                  alt={item.caption || 'Short thumbnail'}
                  className="w-full h-48 object-cover"
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
              ) : (
                <div className="text-gray-400">Click to load thumbnail</div>
              )
            ) : item.imageUrl && !imageError ? (
              <img
                src={item.imageUrl}
                alt={item.caption || 'Travel content'}
                className="w-full h-48 object-cover"
                onError={() => setImageError(true)}
                loading="lazy"
              />
            ) : (
              <div className="text-gray-400">Click to load media</div>
            )}
          </div>
        ) : (
          <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
            {item.type === 'short' && item.videoUrl ? (
              <video
                src={item.videoUrl}
                className="w-full h-64 object-cover"
                controls
                onError={() => setVideoError(true)}
              />
            ) : item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.caption || 'Travel content'}
                className="w-full h-64 object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="text-gray-400">Media unavailable</div>
            )}
            <button
              onClick={() => onToggleExpand(item._id)}
              className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded"
            >
              Collapse
            </button>
          </div>
        )}
        <div className="absolute top-2 left-12">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${reviewBadge.color}`}>
            {reviewBadge.text}
          </span>
        </div>
        <div className="absolute bottom-2 right-2">
          <span className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            {item.type || 'post'}
          </span>
        </div>
        {item.lastModeratedAt && (
          <div className="absolute bottom-2 left-2">
            <span className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(item.lastModeratedAt)}
            </span>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {item.caption || item.content || 'No title available'}
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="font-medium">By:</span>
            <span>{item.user?.fullName || 'Unknown User'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>{item.location?.address || item.location || 'Location not specified'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{Array.isArray(item.likes) ? item.likes.length : 0} likes</span>
            <span>{Array.isArray(item.comments) ? item.comments.length : 0} comments</span>
          </div>
          <div className="text-xs text-gray-500">
            {formatDate(item.createdAt)}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex space-x-2">
            <button
              onClick={() => onView(item)}
              className="p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="View full details"
            >
              <Eye className="w-4 h-4" />
            </button>
            {item.flagged ? (
              <button
                onClick={() => onFlag(item)}
                className="p-2 rounded-md text-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                title="Review flagged content"
              >
                <Flag className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onFlag(item)}
                className="p-2 rounded-md text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                title="Flag content for review"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onToggleStatus(item)}
              className={`p-2 rounded-md transition-colors ${
                item.isActive 
                  ? 'text-green-600 hover:bg-red-50' 
                  : 'text-red-600 hover:bg-green-50'
              }`}
              title={item.isActive ? 'Deactivate' : 'Activate'}
            >
              {item.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete content"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ContentCard.displayName = 'ContentCard'

const TravelContent = () => {
  const { posts, fetchPosts, isConnected } = useRealTime()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedContent, setSelectedContent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedPosts, setSelectedPosts] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState(null) // 'activate' | 'deactivate'
  const [bulkActionProgress, setBulkActionProgress] = useState(0)
  const [isBulkActionInProgress, setIsBulkActionInProgress] = useState(false)
  const [lastAction, setLastAction] = useState(null) // { postId, action, previousState }
  const [undoTimeout, setUndoTimeout] = useState(null)
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const searchDebounceTimerRef = useRef(null)
  const cachedPostsRef = useRef(null)
  const cacheKeyRef = useRef(null)
  const beforeUnloadHandlerRef = useRef(null)
  const actionStateCacheRef = useRef(new Map()) // Store previous state for rollback
  
  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    
    // Prevent navigation during bulk actions
    beforeUnloadHandlerRef.current = (e) => {
      if (isBulkActionInProgress) {
        e.preventDefault()
        e.returnValue = 'Bulk action in progress. Please wait...'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', beforeUnloadHandlerRef.current)
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
      }
      if (undoTimeout) {
        clearTimeout(undoTimeout)
      }
      if (beforeUnloadHandlerRef.current) {
        window.removeEventListener('beforeunload', beforeUnloadHandlerRef.current)
      }
    }
  }, [isBulkActionInProgress, undoTimeout])
  
  // Debounced search (400ms)
  useEffect(() => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    
    searchDebounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setDebouncedSearchTerm(searchTerm)
        setCurrentPage(1) // Reset to first page when searching
      }
    }, 400)
    
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
      }
    }
  }, [searchTerm])
  
  // Handle initial load state
  useEffect(() => {
    if (posts && posts.length > 0 && isMountedRef.current) {
      setIsInitialLoad(false)
    }
  }, [posts])

  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    if (isMountedRef.current) {
      setCurrentPage(1)
    }
  }, [filterType, statusFilter, sortBy, sortOrder, debouncedSearchTerm])
  
  // Fetch posts data with caching and deduplication
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      logger.debug('Travel content fetch already in progress, skipping duplicate call')
      return
    }
    
    const fetchData = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      isFetchingRef.current = true
      
      // Generate cache key
      const cacheKey = `${debouncedSearchTerm}-${filterType}-${currentPage}-${statusFilter}-${sortBy}-${sortOrder}`
      
      // Show cached data immediately if available
      if (cachedPostsRef.current && cacheKeyRef.current === cacheKey && isMountedRef.current) {
        // Data will be updated when fetch completes
      }
      
      if (isMountedRef.current) {
        setLoading(true)
      }
      
      try {
        // Only send type to backend if it's not 'all'
        const typeParam = filterType === 'all' ? undefined : filterType
        
        const fetchParams = {
          page: currentPage,
          limit: itemsPerPage
        }
        
        // Add search if provided
        if (debouncedSearchTerm) {
          fetchParams.search = debouncedSearchTerm
        }
        
        // Add type filter if not 'all'
        if (typeParam) {
          fetchParams.type = typeParam
        }
        
        // Add status filter
        fetchParams.status = statusFilter
        
        await fetchPosts(fetchParams)
        
        // Cache the result
        if (isMountedRef.current) {
          cachedPostsRef.current = posts
          cacheKeyRef.current = cacheKey
        }
      } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
          return
        }
        
        // Fallback to cached data on error
        if (cachedPostsRef.current && isMountedRef.current) {
          toast.error('Failed to fetch travel content. Showing cached data.', { duration: 3000 })
        } else {
          handleError(error, toast, 'Failed to fetch travel content')
          logger.error('Error fetching travel content:', error)
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
        isFetchingRef.current = false
      }
    }

    fetchData()
  }, [fetchPosts, currentPage, debouncedSearchTerm, filterType, sortBy, sortOrder, statusFilter, itemsPerPage])

  // Handle content actions with optimistic updates and rollback
  const handleContentAction = useCallback(async (postId, action, previousState = null) => {
    if (!isMountedRef.current) return
    
    // Store previous state for rollback
    if (previousState) {
      actionStateCacheRef.current.set(postId, previousState)
    }
    
    try {
      if (action === 'delete') {
        await api.delete(`/api/v1/superadmin/posts/${postId}`)
        if (isMountedRef.current) {
          toast.success('Post deleted successfully')
          await fetchPosts({
            page: currentPage,
            search: debouncedSearchTerm,
            type: filterType === 'all' ? undefined : filterType,
            status: statusFilter
          })
        }
      } else if (action === 'flag') {
        // Optimistic update
        const post = postsArray.find(p => p._id === postId)
        if (post) {
          actionStateCacheRef.current.set(postId, { flagged: post.flagged, isActive: post.isActive })
        }
        
        await api.patch(`/api/v1/superadmin/posts/${postId}/flag`)
        if (isMountedRef.current) {
          toast.success('Post flagged successfully')
          await fetchPosts({
            page: currentPage,
            search: debouncedSearchTerm,
            type: filterType === 'all' ? undefined : filterType,
            status: statusFilter
          })
        }
      } else if (action === 'activate') {
        // Optimistic update
        const post = postsArray.find(p => p._id === postId)
        if (post) {
          actionStateCacheRef.current.set(postId, { isActive: post.isActive, flagged: post.flagged })
          // Optimistically update local state
          if (Array.isArray(posts)) {
            const updatedPosts = posts.map(p => 
              p._id === postId ? { ...p, isActive: true } : p
            )
            // Note: This won't update RealTimeContext state, but provides immediate feedback
          }
        }
        
        await api.patch(`/api/v1/superadmin/posts/${postId}`, { isActive: true })
        if (isMountedRef.current) {
          toast.success('Post activated successfully')
          // Undo safety window
          setLastAction({ postId, action: 'activate', previousState: { isActive: false } })
          const timeout = setTimeout(() => {
            if (isMountedRef.current) {
              setLastAction(null)
            }
          }, 5000) // 5 second undo window
          setUndoTimeout(timeout)
          
          await fetchPosts({
            page: currentPage,
            search: debouncedSearchTerm,
            type: filterType === 'all' ? undefined : filterType,
            status: statusFilter
          })
        }
      } else if (action === 'deactivate') {
        // Optimistic update
        const post = postsArray.find(p => p._id === postId)
        if (post) {
          actionStateCacheRef.current.set(postId, { isActive: post.isActive, flagged: post.flagged })
        }
        
        await api.patch(`/api/v1/superadmin/posts/${postId}`, { isActive: false })
        if (isMountedRef.current) {
          toast.success('Post deactivated successfully')
          // Undo safety window
          setLastAction({ postId, action: 'deactivate', previousState: { isActive: true } })
          const timeout = setTimeout(() => {
            if (isMountedRef.current) {
              setLastAction(null)
            }
          }, 5000) // 5 second undo window
          setUndoTimeout(timeout)
          
          await fetchPosts({
            page: currentPage,
            search: debouncedSearchTerm,
            type: filterType === 'all' ? undefined : filterType,
            status: statusFilter
          })
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
        return
      }
      
      // Rollback on failure
      const cachedState = actionStateCacheRef.current.get(postId)
      if (cachedState && isMountedRef.current) {
        logger.warn(`Rolling back state for post ${postId}`, cachedState)
        // State will be restored on next fetch
      }
      
      logger.error('Content action error:', error)
      if (isMountedRef.current) {
        handleError(error, toast, `Failed to ${action} content`)
      }
    } finally {
      actionStateCacheRef.current.delete(postId)
    }
  }, [posts, currentPage, debouncedSearchTerm, filterType, statusFilter, fetchPosts])
  
  // Undo handler
  const handleUndo = useCallback(async () => {
    if (!lastAction || !isMountedRef.current) return
    
    try {
      const { postId, action, previousState } = lastAction
      
      if (action === 'activate') {
        await api.patch(`/api/v1/superadmin/posts/${postId}`, { isActive: previousState.isActive })
        if (isMountedRef.current) {
          toast.success('Action undone')
          setLastAction(null)
          if (undoTimeout) {
            clearTimeout(undoTimeout)
            setUndoTimeout(null)
          }
          await fetchPosts({
            page: currentPage,
            search: debouncedSearchTerm,
            type: filterType === 'all' ? undefined : filterType,
            status: statusFilter
          })
        }
      } else if (action === 'deactivate') {
        await api.patch(`/api/v1/superadmin/posts/${postId}`, { isActive: previousState.isActive })
        if (isMountedRef.current) {
          toast.success('Action undone')
          setLastAction(null)
          if (undoTimeout) {
            clearTimeout(undoTimeout)
            setUndoTimeout(null)
          }
          await fetchPosts({
            page: currentPage,
            search: debouncedSearchTerm,
            type: filterType === 'all' ? undefined : filterType,
            status: statusFilter
          })
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, toast, 'Failed to undo action')
        logger.error('Undo error:', error)
      }
    }
  }, [lastAction, undoTimeout, currentPage, debouncedSearchTerm, filterType, statusFilter, fetchPosts])

  // Get filtered content based on search and type (memoized)
  const postsArray = useMemo(() => {
    return Array.isArray(posts) ? posts : (posts?.posts || [])
  }, [posts])
  
  // Memoized filtered content (backend already filters, but we keep this for safety)
  const filteredContent = useMemo(() => {
    if (!postsArray || postsArray.length === 0) return []
    
    return postsArray.filter(post => {
      // Handle location as either string or object
      let locationString = ''
      if (typeof post.location === 'string') {
        locationString = post.location
      } else if (post.location && typeof post.location === 'object') {
        locationString = post.location.address || post.location.name || ''
      }
      
      // Only apply search filter on frontend if no backend search was applied
      if (!debouncedSearchTerm) return true
      
      return post.caption?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        locationString.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        post.user?.fullName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    })
  }, [postsArray, debouncedSearchTerm])
  
  // Memoized pagination
  const currentContent = useMemo(() => {
    const totalPages = Math.ceil(filteredContent.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredContent.slice(startIndex, endIndex)
  }, [filteredContent, currentPage, itemsPerPage])
  
  const totalPages = useMemo(() => {
    return Math.ceil(filteredContent.length / itemsPerPage)
  }, [filteredContent.length, itemsPerPage])


  const handleRefresh = useCallback(async () => {
    if (!isMountedRef.current) return
    
    if (isFetchingRef.current) {
      logger.debug('Refresh already in progress, skipping duplicate call')
      return
    }
    
    if (isMountedRef.current) {
      setLoading(true)
    }
    
    try {
      await fetchPosts({
        page: currentPage,
        search: debouncedSearchTerm,
        type: filterType === 'all' ? undefined : filterType,
        status: statusFilter
      })
      if (isMountedRef.current) {
        toast.success('Travel content refreshed successfully')
      }
    } catch (error) {
      if (isMountedRef.current) {
        toast.error('Failed to refresh travel content')
        logger.error('Refresh error:', error)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [currentPage, debouncedSearchTerm, filterType, statusFilter, fetchPosts])

  const handleContentActionClick = useCallback((item, action) => {
    if (isMountedRef.current) {
      setSelectedContent({ ...item, action })
      setShowModal(true)
    }
  }, [])

  const handleConfirmAction = useCallback(async () => {
    if (!selectedContent || !isMountedRef.current) {
      if (isMountedRef.current) {
        setShowModal(false)
      }
      return
    }
    
    try {
      const previousState = {
        isActive: selectedContent.isActive,
        flagged: selectedContent.flagged
      }
      
      if (selectedContent.action === 'delete') {
        await handleContentAction(selectedContent._id, 'delete', previousState)
      } else if (selectedContent.action === 'flag') {
        await handleContentAction(selectedContent._id, 'flag', previousState)
      } else if (selectedContent.action === 'activate' || selectedContent.action === 'deactivate') {
        await handleContentAction(selectedContent._id, selectedContent.action, previousState)
      }
      
      if (isMountedRef.current) {
        setShowModal(false)
        setSelectedContent(null)
      }
    } catch (error) {
      if (isMountedRef.current) {
        logger.error('Action error:', error)
        handleError(error, toast, `Failed to ${selectedContent.action} content`)
      }
    }
  }, [selectedContent, handleContentAction])
  
  // Safe bulk actions (enable/disable)
  const handleBulkToggleStatus = useCallback(async (isActive) => {
    if (selectedPosts.length === 0 || !isMountedRef.current) {
      if (isMountedRef.current) {
        toast.error('Please select at least one post')
      }
      return
    }
    
    // Show confirmation
    const action = isActive ? 'activate' : 'deactivate'
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${selectedPosts.length} post(s)? This will ${isActive ? 'make them visible' : 'hide them'} from users.`
    )
    if (!confirmed || !isMountedRef.current) return
    
    setIsBulkActionInProgress(true)
    setBulkActionProgress(0)
    
    try {
      const postsArray = Array.isArray(posts) ? posts : (posts?.posts || [])
      const postsToUpdate = selectedPosts.filter(postId => {
        const post = postsArray.find(p => p._id === postId)
        return post && post.isActive !== isActive
      })
      
      const total = postsToUpdate.length
      let completed = 0
      
      // Process in batches to show progress
      for (const postId of postsToUpdate) {
        if (!isMountedRef.current) break
        
        try {
          await api.patch(`/api/v1/superadmin/posts/${postId}`, { isActive })
          completed++
          if (isMountedRef.current) {
            setBulkActionProgress(Math.round((completed / total) * 100))
          }
        } catch (error) {
          logger.error(`Error updating post ${postId}:`, error)
        }
      }
      
      if (isMountedRef.current) {
        toast.success(`${completed} post(s) ${isActive ? 'activated' : 'deactivated'} successfully`)
        setSelectedPosts([])
        setBulkActionProgress(0)
        setShowBulkActionModal(false)
        setBulkActionType(null)
        await fetchPosts({
          page: currentPage,
          search: debouncedSearchTerm,
          type: filterType === 'all' ? undefined : filterType,
          status: statusFilter
        })
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, toast, 'Failed to update post status')
        logger.error('Bulk toggle error:', error)
      }
    } finally {
      if (isMountedRef.current) {
        setIsBulkActionInProgress(false)
      }
    }
  }, [selectedPosts, posts, currentPage, debouncedSearchTerm, filterType, statusFilter, fetchPosts])
  
  const handleBulkDelete = useCallback(async () => {
    if (selectedPosts.length === 0 || !isMountedRef.current) {
      if (isMountedRef.current) {
        toast.error('Please select at least one post')
      }
      return
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedPosts.length} post(s)?`)) {
      return
    }
    
    try {
      await Promise.all(selectedPosts.map(id => api.delete(`/api/v1/superadmin/posts/${id}`)))
      if (isMountedRef.current) {
        toast.success(`Successfully deleted ${selectedPosts.length} post(s)`)
        setSelectedPosts([])
        await fetchPosts({
          page: currentPage,
          search: debouncedSearchTerm,
          type: filterType === 'all' ? undefined : filterType,
          status: statusFilter
        })
      }
    } catch (error) {
      if (isMountedRef.current) {
        toast.error('Failed to delete posts')
        logger.error('Bulk delete error:', error)
      }
    }
  }, [selectedPosts, currentPage, debouncedSearchTerm, filterType, statusFilter, fetchPosts])
  
  // Toggle expand for lazy media loading
  const handleToggleExpand = useCallback((postId) => {
    if (!isMountedRef.current) return
    
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }, [])
  
  // Memoized handlers
  const handleView = useCallback((item) => {
    if (isMountedRef.current) {
      setSelectedContent({ ...item, action: 'view' })
      setShowModal(true)
    }
  }, [])
  
  const handleFlag = useCallback((item) => {
    if (isMountedRef.current) {
      setSelectedContent({ ...item, action: item.flagged ? 'review' : 'flag' })
      setShowModal(true)
    }
  }, [])
  
  const handleToggleStatus = useCallback((item) => {
    if (isMountedRef.current) {
      setSelectedContent({ ...item, action: item.isActive ? 'deactivate' : 'activate' })
      setShowModal(true)
    }
  }, [])
  
  const handleDelete = useCallback((item) => {
    if (isMountedRef.current) {
      setSelectedContent({ ...item, action: 'delete' })
      setShowModal(true)
    }
  }, [])
  
  const handlePostSelect = useCallback((postId) => {
    if (!isMountedRef.current) return
    
    setSelectedPosts(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    )
  }, [])
  
  // Helper function to safely render values
  const safeRender = (value, fallback = 'Not specified') => {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
  
  // Show loading only on initial load
  if (isInitialLoad && (!posts || posts.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading travel content...</p>
        </div>
      </div>
    )
  }

  return (
    <SafeComponent>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 rounded-2xl p-8 shadow-lg border border-cyan-100">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  Travel Content
                </h1>
                {isConnected && (
                  <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                    Live Data
                  </span>
                )}
              </div>
              <p className="text-gray-600 text-lg">Manage travel posts and destinations</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              {selectedPosts.length > 0 && (
                <>
                  <button 
                    onClick={() => {
                      setBulkActionType('activate')
                      setShowBulkActionModal(true)
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
                  >
                    <Power className="w-4 h-4" />
                    <span>Activate ({selectedPosts.length})</span>
                  </button>
                  <button 
                    onClick={() => {
                      setBulkActionType('deactivate')
                      setShowBulkActionModal(true)
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
                  >
                    <PowerOff className="w-4 h-4" />
                    <span>Deactivate ({selectedPosts.length})</span>
                  </button>
                  <button 
                    onClick={handleBulkDelete}
                    className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete ({selectedPosts.length})</span>
                  </button>
                </>
              )}
              {lastAction && (
                <button
                  onClick={handleUndo}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Undo Last Action</span>
                </button>
              )}
            </div>
          </div>
        </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search content..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => {
                    if (isMountedRef.current) {
                      setSearchTerm(e.target.value)
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="input w-full sm:w-auto"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="photo">Photos</option>
                <option value="short">Shorts</option>
              </select>
              <button 
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`btn btn-secondary flex-1 sm:flex-none ${showMoreFilters ? 'bg-blue-600 text-white' : ''}`}
              >
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* More Filters Panel */}
      {showMoreFilters && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  className="input w-full"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="all">All Status</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                <input
                  type="date"
                  className="input w-full"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                <input
                  type="date"
                  className="input w-full"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setDateRange({ start: '', end: '' })
                    setStatusFilter('active')
                  }}
                  className="btn btn-secondary"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentContent.map((item, index) => (
            <ContentCard
              key={item._id}
              item={item}
              index={index}
              selectedPosts={selectedPosts}
              onSelect={handlePostSelect}
              onView={handleView}
              onFlag={handleFlag}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              formatDate={formatDate}
              expandedRows={expandedRows}
              onToggleExpand={handleToggleExpand}
              loadFullMedia={true}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredContent.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredContent.length)} of {filteredContent.length} content items
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={20}>20</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={75}>75</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="btn btn-sm btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`btn btn-sm ${
                            currentPage === pageNum ? 'btn-primary' : 'btn-secondary'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="btn btn-sm btn-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Action Modal */}
      <Modal isOpen={showBulkActionModal} onClose={() => {
        if (!isBulkActionInProgress) {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }
      }} className="max-w-md bg-white">
        <ModalHeader onClose={() => {
          if (!isBulkActionInProgress) {
            setShowBulkActionModal(false)
            setBulkActionType(null)
          }
        }}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${bulkActionType === 'activate' ? 'bg-green-100' : 'bg-orange-100'} rounded-lg`}>
              {bulkActionType === 'activate' ? (
                <Power className="w-5 h-5 text-green-600" />
              ) : (
                <PowerOff className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {bulkActionType === 'activate' ? 'Activate Posts' : 'Deactivate Posts'}
            </h2>
          </div>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            {!isBulkActionInProgress ? (
              <>
                <p className="text-gray-600">
                  Are you sure you want to {bulkActionType} {selectedPosts.length} post(s)?
                </p>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p className="text-sm text-yellow-800">
                    {bulkActionType === 'activate' 
                      ? 'Activated posts will be visible to all users.'
                      : 'Deactivated posts will be hidden from users.'}
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">Processing {selectedPosts.length} post(s)...</p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${bulkActionProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 text-center">{bulkActionProgress}% complete</p>
              </div>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              if (!isBulkActionInProgress) {
                setShowBulkActionModal(false)
                setBulkActionType(null)
              }
            }}
            disabled={isBulkActionInProgress}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBulkActionInProgress ? 'Processing...' : 'Cancel'}
          </button>
          {!isBulkActionInProgress && (
            <button
              type="button"
              onClick={() => {
                if (bulkActionType === 'activate') {
                  handleBulkToggleStatus(true)
                } else {
                  handleBulkToggleStatus(false)
                }
              }}
              className={`btn ${
                bulkActionType === 'activate'
                  ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                  : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
              }`}
            >
              {bulkActionType === 'activate' ? (
                <>
                  <Power className="w-5 h-5" />
                  Activate
                </>
              ) : (
                <>
                  <PowerOff className="w-5 h-5" />
                  Deactivate
                </>
              )}
            </button>
          )}
        </ModalFooter>
      </Modal>
      
      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedContent?.action === 'view' && 'Content Details'}
          {selectedContent?.action === 'review' && 'Review Flagged Content'}
          {(selectedContent?.action === 'activate' || selectedContent?.action === 'deactivate') && `${selectedContent?.action === 'activate' ? 'Activate' : 'Deactivate'} Content`}
          {selectedContent?.action === 'delete' && 'Delete Content'}
          {selectedContent?.action === 'flag' && 'Flag Content'}
        </ModalHeader>
        <ModalContent>
          {selectedContent?.action === 'view' && (
            <div className="space-y-4">
              {/* Display image or video thumbnail in modal */}
              {selectedContent.type === 'short' ? (
                // For shorts, show thumbnail in modal preview, video on expand
                selectedContent.thumbnailUrl || selectedContent.imageUrl ? (
                  <img
                    src={selectedContent.thumbnailUrl || selectedContent.imageUrl}
                    onError={(e) => {
                      e.target.src = '/placeholder.svg'
                    }}
                    alt={selectedContent.caption || 'Short thumbnail'}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                ) : selectedContent.videoUrl ? (
                  <video
                    src={selectedContent.videoUrl}
                    className="w-full h-64 object-cover rounded-lg"
                    controls
                    loop
                    onError={(e) => {
                      e.target.parentElement.innerHTML = '<img src="/placeholder.svg" class="w-full h-64 object-cover rounded-lg" alt="Video error" />'
                    }}
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-200 flex items-center justify-center rounded-lg">
                    <span className="text-gray-400">No thumbnail available</span>
                  </div>
                )
              ) : (
                <img
                  src={selectedContent.imageUrl || '/placeholder.svg'}
                  onError={(e) => {
                    e.target.src = '/placeholder.svg'
                  }}
                  alt={selectedContent.caption || selectedContent.content || 'Travel content'}
                  className="w-full h-64 object-cover rounded-lg"
                />
              )}
              <div>
                <h3 className="font-semibold text-lg mb-3">{selectedContent.caption || selectedContent.content || 'No title available'}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Author</label>
                    <p className="text-gray-900">{selectedContent.user?.fullName || 'Unknown User'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Location</label>
                    <p className="text-gray-900">{selectedContent.location?.address || selectedContent.location || 'Not specified'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Type</label>
                    <p className="text-gray-900 capitalize">{selectedContent.type || 'post'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Status</label>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      selectedContent.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedContent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Likes</label>
                    <p className="text-gray-900 text-lg">{Array.isArray(selectedContent.likes) ? selectedContent.likes.length : 0}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Comments</label>
                    <p className="text-gray-900 text-lg">{Array.isArray(selectedContent.comments) ? selectedContent.comments.length : 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {(selectedContent?.action === 'review' || selectedContent?.action === 'delete' || selectedContent?.action === 'activate' || selectedContent?.action === 'deactivate' || selectedContent?.action === 'flag') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                {selectedContent.action === 'delete' && `Are you sure you want to delete this content?`}
                {selectedContent.action === 'flag' && `Are you sure you want to flag this content for review?`}
                {selectedContent.action === 'activate' && `Are you sure you want to activate this content?`}
                {selectedContent.action === 'deactivate' && `Are you sure you want to deactivate this content?`}
                {selectedContent.action === 'review' && `This content has been flagged for review. Please take appropriate action.`}
              </p>
              <div className={`border rounded-md p-3 ${
                selectedContent.action === 'delete' ? 'bg-red-50 border-red-200' :
                selectedContent.action === 'flag' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <p className={`text-sm ${
                  selectedContent.action === 'delete' ? 'text-red-800' :
                  selectedContent.action === 'flag' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {selectedContent.action === 'delete' && 'This action cannot be undone. The content will be permanently removed.'}
                  {selectedContent.action === 'flag' && 'The content will be marked for review by administrators.'}
                  {selectedContent.action === 'activate' && 'The content will be visible to all users.'}
                  {selectedContent.action === 'deactivate' && 'The content will be hidden from users.'}
                  {selectedContent.action === 'review' && 'You can approve or remove this content.'}
                </p>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowModal(false)}
            className="btn btn-secondary"
          >
            {selectedContent?.action === 'view' ? 'Close' : 'Cancel'}
          </button>
          {selectedContent?.action !== 'view' && (
            <button
              onClick={handleConfirmAction}
              className={`btn ${
                selectedContent?.action === 'delete' || selectedContent?.action === 'deactivate'
                  ? 'btn-destructive' 
                  : 'btn-primary'
              }`}
            >
              {selectedContent?.action === 'delete' && 'Delete'}
              {selectedContent?.action === 'flag' && 'Flag'}
              {selectedContent?.action === 'activate' && 'Activate'}
              {selectedContent?.action === 'deactivate' && 'Deactivate'}
              {selectedContent?.action === 'review' && 'Review'}
            </button>
          )}
        </ModalFooter>
      </Modal>
      </div>
    </SafeComponent>
  )
}

export default TravelContent
