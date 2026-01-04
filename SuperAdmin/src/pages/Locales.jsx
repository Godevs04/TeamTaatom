import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { handleModalClose } from '../utils/modalUtils'
import { sanitizeText } from '../utils/sanitize'
import { 
  MapPin, 
  Search, 
  Upload, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Image as ImageIcon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getLocales, uploadLocale, deleteLocale, toggleLocaleStatus, updateLocale, getLocaleById } from '../services/localeService'
import { motion, AnimatePresence } from 'framer-motion'
import { searchPlace, geocodeAddress, areCoordinatesNearby, buildAddressString } from '../utils/geocoding'

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Helper function to check if coordinates are valid
const isValidCoordinate = (lat, lng) => {
  return lat != null && lng != null && 
         typeof lat === 'number' && typeof lng === 'number' &&
         !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180
}

// Helper function to normalize string for comparison
const normalizeString = (str) => {
  return (str || '').toLowerCase().trim()
}

// Helper function to check if two strings are similar (Levenshtein-like simple check)
const areSimilarNames = (name1, name2, threshold = 0.8) => {
  const n1 = normalizeString(name1)
  const n2 = normalizeString(name2)
  if (n1 === n2) return true
  // Simple similarity check: if one contains the other (for partial matches)
  if (n1.length > 3 && n2.length > 3) {
    return n1.includes(n2) || n2.includes(n1)
  }
  return false
}

const Locales = () => {
  const [locales, setLocales] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountryCode, setSelectedCountryCode] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const currentPageRef = useRef(1) // Ref to track current page for fetch operations
  const [totalPages, setTotalPages] = useState(1)
  const [totalLocales, setTotalLocales] = useState(0)
  const [backendStatistics, setBackendStatistics] = useState(null) // Statistics from backend (total, active, inactive)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [localeToDelete, setLocaleToDelete] = useState(null)
  const [localeToEdit, setLocaleToEdit] = useState(null)
  const [previewLocale, setPreviewLocale] = useState(null)
  const [editing, setEditing] = useState(false)
  const [sortField, setSortField] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedLocales, setSelectedLocales] = useState([])
  const [expandedLocales, setExpandedLocales] = useState(new Set()) // For lazy detail loading
  const [expandedLocaleDetails, setExpandedLocaleDetails] = useState(new Map()) // Cache expanded details
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState(null) // 'enable' or 'disable'
  const [bulkActionProgress, setBulkActionProgress] = useState({ current: 0, total: 0 })
  const [isBulkActionInProgress, setIsBulkActionInProgress] = useState(false)
  
  // Place detection state
  const [showDetectPlaceModal, setShowDetectPlaceModal] = useState(false)
  const [detectPlaceName, setDetectPlaceName] = useState('')
  const [detectedPlace, setDetectedPlace] = useState(null)
  const [isSearchingPlace, setIsSearchingPlace] = useState(false)
  const [isEditModeForDetect, setIsEditModeForDetect] = useState(false)
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const cachedLocalesRef = useRef(null)
  const previousStateRef = useRef(null) // For rollback on bulk operation failure
  const lastFiltersRef = useRef({ selectedCountryCode, sortField, sortOrder }) // Track filter changes
  const lastFetchKeyRef = useRef(null) // Track last fetch key to prevent duplicates
  const debounceTimeoutRef = useRef(null) // Track debounce timer for cleanup
  const trackedFetchKeysRef = useRef(new Set()) // Track analytics events per fetchKey
  const hasInitialFetchRef = useRef(false) // Track if initial fetch has been performed
  const FETCH_LIMIT = 20 // Fixed limit for fetchKey consistency
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    countryCode: '',
    stateProvince: '',
    city: '',
    description: '',
    displayOrder: '0',
    spotTypes: [],
    travelInfo: 'Drivable',
    file: null,
    latitude: null,
    longitude: null
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    country: '',
    countryCode: '',
    stateProvince: '',
    city: '',
    description: '',
    displayOrder: '0',
    spotTypes: [],
    travelInfo: 'Drivable',
    latitude: null,
    longitude: null
  })

  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    // Reset fetch tracking on mount to ensure fresh fetch
    hasInitialFetchRef.current = false
    lastFetchKeyRef.current = null
    isFetchingRef.current = false
    
    return () => {
      isMountedRef.current = false
      // Clear debounce timer
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
      // Abort in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Prevent navigation during bulk operations
  useEffect(() => {
    if (isBulkActionInProgress) {
      const handleBeforeUnload = (e) => {
        e.preventDefault()
        e.returnValue = 'A bulk operation is in progress. Are you sure you want to leave?'
        return e.returnValue
      }
      
      window.addEventListener('beforeunload', handleBeforeUnload)
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [isBulkActionInProgress])

  // Reset to page 1 when filters change (but not on initial mount or if already on page 1)
  const isInitialMountRef = useRef(true)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      lastFiltersRef.current = { selectedCountryCode, sortField, sortOrder }
      return
    }
    
    const currentFilters = { selectedCountryCode, sortField, sortOrder }
    const lastFilters = lastFiltersRef.current
    
    // Check if filters actually changed
    const filtersChanged = 
      currentFilters.selectedCountryCode !== lastFilters.selectedCountryCode ||
      currentFilters.sortField !== lastFilters.sortField ||
      currentFilters.sortOrder !== lastFilters.sortOrder
    
    if (filtersChanged && isMountedRef.current && currentPage !== 1) {
      lastFiltersRef.current = currentFilters
      setCurrentPage(1)
    } else if (filtersChanged) {
      lastFiltersRef.current = currentFilters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryCode, sortField, sortOrder]) // Removed currentPage to prevent loop

  // Shared fetch function - used by both automatic and manual fetches
  // Handles 304 responses as complete no-ops
  const performFetch = useCallback(async (fetchKey, params, forceFetch = false) => {
    const { searchQuery: sq, selectedCountryCode: scc, currentPage: cp } = params
    
    // Hard guard: if already fetching, abort (unless forcing)
    if (isFetchingRef.current && !forceFetch) {
      console.debug('[Locales] Fetch blocked: already in progress')
      return
    }
    
    // If forcing, abort any in-flight requests and reset guards
    if (forceFetch) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isFetchingRef.current = false
      console.debug('[Locales] Force fetch: resetting guards')
    }
    
    // Abort previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true // Set immediately before fetch
    
    if (isMountedRef.current) {
      setLoading(true)
    }
    
    try {
      // Make API call - use getLocales but intercept to check for 304
      // We need to use axios directly to access response status
      const api = (await import('../services/api')).default
      const paramsObj = new URLSearchParams()
      if (sq) paramsObj.append('search', sq)
      if (scc && scc !== 'all') paramsObj.append('countryCode', scc)
      paramsObj.append('page', cp.toString())
      paramsObj.append('limit', FETCH_LIMIT.toString())
      paramsObj.append('includeInactive', 'true')
      
      const response = await api.get(`/api/v1/locales?${paramsObj.toString()}`, {
        signal: abortControllerRef.current.signal,
        validateStatus: (status) => status === 200 || status === 304 // Accept both 200 and 304
      })
      
      if (abortControllerRef.current?.signal?.aborted || !isMountedRef.current) {
        return
      }
      
      // STRICT 304 NO-OP HANDLING
      if (response.status === 304) {
        console.debug('[Locales] Fetch ignored (304)')
        // Complete no-op: do NOT update state, refs, or analytics
        return
      }
      
      // Only process 200 responses
      const result = response.data
      
      if (abortControllerRef.current?.signal?.aborted || !isMountedRef.current) {
        return
      }
      
        // Handle both response structures: direct data or nested in data property
        const locales = result.locales || result.data?.locales || []
        const pagination = result.pagination || result.data?.pagination
        const statistics = result.statistics || result.data?.statistics
        
        console.debug('[Locales] Response parsed:', { 
          hasLocales: !!locales, 
          localesCount: locales?.length || 0,
          resultKeys: Object.keys(result),
          pagination: pagination ? { totalPages: pagination.totalPages, total: pagination.total } : null,
          statistics: statistics
        })
        
        if (locales && Array.isArray(locales)) {
          const minimalLocales = locales.map(locale => ({
          _id: locale._id,
          name: locale.name,
          country: locale.country,
          countryCode: locale.countryCode,
          stateProvince: locale.stateProvince,
          city: locale.city,
          displayOrder: locale.displayOrder,
          createdAt: locale.createdAt,
          isActive: locale.isActive ?? true,
          imageUrl: locale.imageUrl,
          latitude: isValidCoordinate(locale.latitude, locale.longitude) ? locale.latitude : null,
          longitude: isValidCoordinate(locale.latitude, locale.longitude) ? locale.longitude : null,
          description: null,
          fullDataLoaded: false
        }))
        
        console.debug('[Locales] Setting locales:', minimalLocales.length)
        setLocales(minimalLocales)
        setTotalPages(pagination?.totalPages || 1)
        setTotalLocales(pagination?.total || 0)
        if (statistics) {
          setBackendStatistics(statistics)
        }
        cachedLocalesRef.current = minimalLocales
        
        // Analytics: track only once per fetchKey on successful 200 response
        if (!trackedFetchKeysRef.current.has(fetchKey)) {
          trackedFetchKeysRef.current.add(fetchKey)
          // Analytics tracking would go here if needed - decoupled from locales array
          // Example: trackListViewed(fetchKey) - but NOT depending on locales state
        }
      } else {
        logger.error('Unexpected response structure:', { result, locales, pagination })
        console.error('[Locales] Failed to parse response:', { 
          result, 
          hasLocales: !!locales, 
          localesType: typeof locales,
          isArray: Array.isArray(locales)
        })
        if (isMountedRef.current) {
          setLocales([])
          setTotalPages(1)
          setTotalLocales(0)
          setBackendStatistics(null)
        }
      }
    } catch (error) {
      if (abortControllerRef.current?.signal?.aborted || error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
        return
      }
      
      // Check if error is 304 (shouldn't happen with validateStatus, but defensive)
      if (error.response?.status === 304) {
        console.debug('[Locales] Fetch ignored (304 in error)')
        return
      }
      
      handleError(error, toast, 'Failed to load locales')
      logger.error('Error loading locales:', error)
      
      if (cachedLocalesRef.current) {
        setLocales(cachedLocalesRef.current)
      } else {
        setLocales([])
        setTotalPages(1)
        setTotalLocales(0)
        setBackendStatistics(null)
      }
    } finally {
      // Reset isFetchingRef ONLY in finally block
      if (isMountedRef.current) {
        setLoading(false)
      }
      isFetchingRef.current = false
    }
  }, [])
  
  // Sync currentPageRef with currentPage state
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])
  
  // Load locales function - used for manual calls (refresh, etc.)
  const loadLocales = useCallback(async (force = false, pageOverride = null) => {
    console.debug('[Locales] loadLocales called:', { force, pageOverride, isFetching: isFetchingRef.current })
    
    // Hard guard: prevent duplicate concurrent calls (but allow force)
    if (isFetchingRef.current && !force) {
      console.debug('[Locales] Fetch skipped: already in progress')
      return
    }
    
    // If forcing, reset fetch guard
    if (force) {
      isFetchingRef.current = false
    }
    
    // Use pageOverride if provided, otherwise use current page from ref (for immediate updates)
    const pageToUse = pageOverride !== null ? pageOverride : currentPageRef.current
    
    // Generate fetchKey
    // If forcing, add timestamp to make key unique and bypass cache
    const fetchKey = force 
      ? `${searchQuery}|${selectedCountryCode}|${pageToUse}|${FETCH_LIMIT}|${Date.now()}`
      : `${searchQuery}|${selectedCountryCode}|${pageToUse}|${FETCH_LIMIT}`
    
    console.debug('[Locales] Generated fetchKey:', { fetchKey, lastKey: lastFetchKeyRef.current, force })
    
    // LAST FETCH KEY LOCK: if same key, return immediately (unless forcing)
    // When forcing, fetchKey includes timestamp so it will always be different
    if (fetchKey === lastFetchKeyRef.current && !force) {
      console.debug('[Locales] Fetch skipped (same key)', fetchKey)
      return
    }
    
    // Update lastFetchKeyRef BEFORE starting fetch
    lastFetchKeyRef.current = fetchKey
    
    const params = { searchQuery, selectedCountryCode, currentPage: pageToUse }
    console.debug('[Locales] Calling performFetch with params:', params, 'force:', force)
    await performFetch(fetchKey, params, force)
  }, [searchQuery, selectedCountryCode, performFetch])
  
  // SINGLE useEffect - depends ONLY on fetchKey string
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // HARD ISOLATE FETCH TRIGGER: Create fetchKey string
    // Use currentPageRef to get the latest page value immediately
    const fetchKey = `${searchQuery}|${selectedCountryCode}|${currentPageRef.current}|${FETCH_LIMIT}`
    
    // ALWAYS fetch on initial mount (first render)
    const isInitialFetch = !hasInitialFetchRef.current
    
    // LAST FETCH KEY LOCK: If fetchKey === lastFetchKeyRef.current → RETURN immediately (unless initial fetch)
    if (fetchKey === lastFetchKeyRef.current && !isInitialFetch) {
      console.debug('[Locales] Fetch skipped (same key)', fetchKey)
      return
    }
    
    // ISFETCHING HARD GUARD: If isFetchingRef.current === true → RETURN (unless initial fetch)
    if (isFetchingRef.current && !isInitialFetch) {
      console.debug('[Locales] Fetch skipped: already in progress')
      // Update lastFetchKeyRef to prevent retry on next render
      lastFetchKeyRef.current = fetchKey
      return
    }
    
    // Mark that initial fetch is being attempted
    if (isInitialFetch) {
      hasInitialFetchRef.current = true
      console.debug('[Locales] Initial fetch triggered')
    }
    
    // Update lastFetchKeyRef BEFORE starting debounce or request
    lastFetchKeyRef.current = fetchKey
    
    // Clear any existing debounce timer
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    // For initial fetch, execute immediately without debounce
    if (isInitialFetch) {
      console.debug('[Locales] Initial fetch - executing immediately without debounce')
      // Execute fetch immediately using inline logic
      const params = { searchQuery, selectedCountryCode, currentPage: currentPageRef.current }
      const { searchQuery: sq, selectedCountryCode: scc, currentPage: cp } = params
      
      // Set fetching flag
      isFetchingRef.current = true
      if (isMountedRef.current) {
        setLoading(true)
      }
      
      // Abort previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      
      // Make API call immediately
      import('../services/api').then(({ default: api }) => {
        const paramsObj = new URLSearchParams()
        if (sq) paramsObj.append('search', sq)
        if (scc && scc !== 'all') paramsObj.append('countryCode', scc)
        paramsObj.append('page', cp.toString())
        paramsObj.append('limit', FETCH_LIMIT.toString())
        paramsObj.append('includeInactive', 'true')
        
        return api.get(`/api/v1/locales?${paramsObj.toString()}`, {
          signal: abortControllerRef.current.signal,
          validateStatus: (status) => status === 200 || status === 304
        })
      }).then((response) => {
        if (abortControllerRef.current?.signal?.aborted || !isMountedRef.current) {
          return
        }
        
        if (response.status === 304) {
          console.debug('[Locales] Initial fetch ignored (304)')
          return
        }
        
        const result = response.data
        const locales = result.locales || result.data?.locales || []
        const pagination = result.pagination || result.data?.pagination
        const statistics = result.statistics || result.data?.statistics
        
        console.debug('[Locales] Initial fetch response:', { 
          hasLocales: !!locales, 
          localesCount: locales?.length || 0,
          statistics: statistics
        })
        
        if (locales && Array.isArray(locales)) {
          const minimalLocales = locales.map(locale => ({
            _id: locale._id,
            name: locale.name,
            country: locale.country,
            countryCode: locale.countryCode,
            stateProvince: locale.stateProvince,
            city: locale.city,
            displayOrder: locale.displayOrder,
            createdAt: locale.createdAt,
            isActive: locale.isActive ?? true,
            imageUrl: locale.imageUrl,
            latitude: isValidCoordinate(locale.latitude, locale.longitude) ? locale.latitude : null,
            longitude: isValidCoordinate(locale.latitude, locale.longitude) ? locale.longitude : null,
            description: null,
            fullDataLoaded: false
          }))
          
          setLocales(minimalLocales)
          setTotalPages(pagination?.totalPages || 1)
          setTotalLocales(pagination?.total || 0)
          if (statistics) {
            setBackendStatistics(statistics)
          }
          cachedLocalesRef.current = minimalLocales
        }
      }).catch((error) => {
        if (abortControllerRef.current?.signal?.aborted || error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
          return
        }
        logger.error('[Locales] Initial fetch error:', error)
        handleError(error, toast, 'Failed to load locales')
      }).finally(() => {
        if (isMountedRef.current) {
          setLoading(false)
        }
        isFetchingRef.current = false
      })
      
      return
    }
    
    // Debounce safety: Apply debounce (≈400ms) for subsequent fetches
    debounceTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        console.debug('[Locales] Fetch aborted: component unmounted')
        return
      }
      
      // Re-check fetchKey after debounce - strict comparison
      // Use currentPageRef to get the latest page value
      const latestFetchKey = `${searchQuery}|${selectedCountryCode}|${currentPageRef.current}|${FETCH_LIMIT}`
      
      // If fetchKey reverted during debounce, cancel fetch
      if (latestFetchKey !== lastFetchKeyRef.current) {
        console.debug('[Locales] Fetch cancelled: key changed during debounce', { latestFetchKey, lastKey: lastFetchKeyRef.current })
        return
      }
      
      // Final check - are we still supposed to fetch?
      if (isFetchingRef.current) {
        console.debug('[Locales] Fetch skipped: fetch started during debounce')
        return
      }
      
      console.debug('[Locales] Fetch start', latestFetchKey)
      
      // Inline fetch to avoid callback dependency
      const params = { searchQuery, selectedCountryCode, currentPage: currentPageRef.current }
      const { searchQuery: sq, selectedCountryCode: scc, currentPage: cp } = params
      
      // Hard guard: if already fetching, abort
      if (isFetchingRef.current) {
        console.debug('[Locales] Fetch blocked: already in progress')
        return
      }
      
      // Abort previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      abortControllerRef.current = new AbortController()
      isFetchingRef.current = true // Set immediately before fetch
      
      if (isMountedRef.current) {
        setLoading(true)
      }
      
      // Make API call with 304 handling
      import('../services/api').then(({ default: api }) => {
        const paramsObj = new URLSearchParams()
        if (sq) paramsObj.append('search', sq)
        if (scc && scc !== 'all') paramsObj.append('countryCode', scc)
        paramsObj.append('page', cp.toString())
        paramsObj.append('limit', FETCH_LIMIT.toString())
        paramsObj.append('includeInactive', 'true')
        
        return api.get(`/api/v1/locales?${paramsObj.toString()}`, {
          signal: abortControllerRef.current.signal,
          validateStatus: (status) => status === 200 || status === 304
        })
      }).then((response) => {
        if (abortControllerRef.current?.signal?.aborted || !isMountedRef.current) {
          return
        }
        
        // STRICT 304 NO-OP HANDLING
        if (response.status === 304) {
          console.debug('[Locales] Fetch ignored (304)')
          // Complete no-op: do NOT update state, refs, or analytics
          return
        }
        
        // Only process 200 responses
        // Backend sends: { success: true, message, locales: [...], pagination: {...} }
        const result = response.data
        
        if (abortControllerRef.current?.signal?.aborted || !isMountedRef.current) {
          return
        }
        
        // Handle both response structures: direct data or nested in data property
        const locales = result.locales || result.data?.locales || []
        const pagination = result.pagination || result.data?.pagination
        const statistics = result.statistics || result.data?.statistics
        
        console.debug('[Locales] Response received:', { 
          hasLocales: !!locales, 
          localesCount: locales?.length || 0,
          resultKeys: Object.keys(result),
          pagination,
          statistics
        })
        
        if (locales && Array.isArray(locales)) {
          const minimalLocales = locales.map(locale => ({
            _id: locale._id,
            name: locale.name,
            country: locale.country,
            countryCode: locale.countryCode,
            stateProvince: locale.stateProvince,
            city: locale.city,
            displayOrder: locale.displayOrder,
            createdAt: locale.createdAt,
            isActive: locale.isActive ?? true,
            imageUrl: locale.imageUrl,
            latitude: isValidCoordinate(locale.latitude, locale.longitude) ? locale.latitude : null,
            longitude: isValidCoordinate(locale.latitude, locale.longitude) ? locale.longitude : null,
            description: locale.description || null,
            spotTypes: Array.isArray(locale.spotTypes) ? locale.spotTypes : (locale.spotTypes ? [locale.spotTypes] : []),
            travelInfo: locale.travelInfo || 'Drivable',
            fullDataLoaded: false
          }))
          
          setLocales(minimalLocales)
          setTotalPages(pagination?.totalPages || 1)
          setTotalLocales(pagination?.total || 0)
          if (statistics) {
            setBackendStatistics(statistics)
          }
          cachedLocalesRef.current = minimalLocales
          
          // Analytics: track only once per fetchKey on successful 200 response
          if (!trackedFetchKeysRef.current.has(latestFetchKey)) {
            trackedFetchKeysRef.current.add(latestFetchKey)
            // Analytics tracking would go here if needed - decoupled from locales array
          }
        } else {
          logger.error('Unexpected response structure:', result)
          if (isMountedRef.current) {
            setLocales([])
            setTotalPages(1)
            setTotalLocales(0)
            setBackendStatistics(null)
          }
        }
      }).catch((error) => {
        if (abortControllerRef.current?.signal?.aborted || error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
          return
        }
        
        // Check if error is 304 (shouldn't happen with validateStatus, but defensive)
        if (error.response?.status === 304) {
          console.debug('[Locales] Fetch ignored (304 in error)')
          return
        }
        
        handleError(error, toast, 'Failed to load locales')
        logger.error('Error loading locales:', error)
        
        if (cachedLocalesRef.current) {
          setLocales(cachedLocalesRef.current)
        } else {
          setLocales([])
          setTotalPages(1)
          setTotalLocales(0)
          setBackendStatistics(null)
        }
      }).finally(() => {
        // Reset isFetchingRef ONLY in finally block
        if (isMountedRef.current) {
          setLoading(false)
        }
        isFetchingRef.current = false
      })
    }, 400) // 400ms debounce
    
    return () => {
      // CLEANUP & ABORT: Clear debounce timer and abort in-flight requests
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [searchQuery, selectedCountryCode, currentPage]) // Dependencies: only fetch params (fetchKey components), NO derived state, NO callbacks

  // Handle opening detect place modal
  const handleOpenDetectPlace = useCallback((isEditMode = false) => {
    setIsEditModeForDetect(isEditMode)
    setDetectPlaceName('')
    setDetectedPlace(null)
    setShowDetectPlaceModal(true)
  }, [])

  // Handle searching for a place
  const handleSearchPlace = useCallback(async () => {
    if (!detectPlaceName || detectPlaceName.trim().length === 0) {
      toast.error('Please enter a place name')
      return
    }

    setIsSearchingPlace(true)
    setDetectedPlace(null)

    try {
      const placeResult = await searchPlace(detectPlaceName.trim())
      
      if (placeResult) {
        setDetectedPlace(placeResult)
      } else {
        toast.error('Place not found. Please try a different name.')
        setDetectedPlace(null)
      }
    } catch (error) {
      console.error('Error searching place:', error)
      toast.error('Error searching for place. Please try again.')
      setDetectedPlace(null)
    } finally {
      setIsSearchingPlace(false)
    }
  }, [detectPlaceName])

  // Handle confirming detected place and populating fields
  const handleConfirmDetectedPlace = useCallback(() => {
    if (!detectedPlace) return

    if (isEditModeForDetect) {
      // Populate edit form
      setEditFormData({
        name: detectedPlace.name || editFormData.name,
        country: detectedPlace.country || editFormData.country,
        countryCode: detectedPlace.countryCode || editFormData.countryCode,
        stateProvince: detectedPlace.stateProvince || editFormData.stateProvince,
        city: detectedPlace.city || editFormData.city,
        description: editFormData.description,
        displayOrder: editFormData.displayOrder,
        spotTypes: editFormData.spotTypes,
        travelInfo: editFormData.travelInfo,
        latitude: detectedPlace.lat,
        longitude: detectedPlace.lng
      })
    } else {
      // Populate add form
      setFormData({
        ...formData,
        name: detectedPlace.name || formData.name,
        country: detectedPlace.country || formData.country,
        countryCode: detectedPlace.countryCode || formData.countryCode,
        stateProvince: detectedPlace.stateProvince || formData.stateProvince,
        city: detectedPlace.city || formData.city,
        description: formData.description,
        displayOrder: formData.displayOrder,
        spotTypes: formData.spotTypes,
        travelInfo: formData.travelInfo,
        latitude: detectedPlace.lat,
        longitude: detectedPlace.lng
      })
    }

    setShowDetectPlaceModal(false)
    setDetectPlaceName('')
    setDetectedPlace(null)
    toast.success('Place details populated successfully!')
  }, [detectedPlace, isEditModeForDetect, formData, editFormData])

  // Detect duplicate locales (similar names and coordinates within radius)
  const duplicateHints = useMemo(() => {
    const hints = new Map()
    const DUPLICATE_RADIUS_KM = 1 // 1 km radius for duplicate detection
    
    locales.forEach((locale, index) => {
      const duplicates = []
      
      locales.forEach((otherLocale, otherIndex) => {
        if (index === otherIndex) return
        
        // Check similar names
        const similarName = areSimilarNames(locale.name, otherLocale.name)
        
        // Check coordinates within radius
        let nearbyCoordinates = false
        if (isValidCoordinate(locale.latitude, locale.longitude) && 
            isValidCoordinate(otherLocale.latitude, otherLocale.longitude)) {
          const distance = calculateDistance(
            locale.latitude, locale.longitude,
            otherLocale.latitude, otherLocale.longitude
          )
          nearbyCoordinates = distance !== null && distance < DUPLICATE_RADIUS_KM
        }
        
        if (similarName || nearbyCoordinates) {
          duplicates.push({
            id: otherLocale._id,
            name: otherLocale.name,
            reason: similarName && nearbyCoordinates ? 'name and location' : 
                    similarName ? 'similar name' : 'nearby location'
          })
        }
      })
      
      if (duplicates.length > 0) {
        hints.set(locale._id, duplicates)
      }
    })
    
    return hints
  }, [locales])

  // Calculate statistics - use backend statistics if available, otherwise calculate from current page
  const statistics = useMemo(() => {
    // If backend provided statistics (accurate counts), use them
    if (backendStatistics) {
      return backendStatistics
    }
    
    // Fallback: calculate from current page's locales (less accurate with pagination)
    const activeLocales = locales.filter(l => l.isActive).length
    
    return {
      total: totalLocales,
      active: activeLocales,
      inactive: totalLocales - activeLocales
    }
  }, [backendStatistics, locales, totalLocales])

  // Sort locales
  const sortedLocales = useMemo(() => {
    return [...locales].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (sortField === 'displayOrder') {
        aVal = a.displayOrder || 0
        bVal = b.displayOrder || 0
      } else if (sortField === 'createdAt') {
        aVal = new Date(a.createdAt).getTime()
        bVal = new Date(b.createdAt).getTime()
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }, [locales, sortField, sortOrder])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }
      // Validate image type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, WebP, GIF)')
        return
      }
      setFormData({ ...formData, file })
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    
    if (!formData.file) {
      toast.error('Please select an image file')
      return
    }

    // Validate required fields
    const name = sanitizeText(formData.name)
    const country = sanitizeText(formData.country)
    const countryCode = sanitizeText(formData.countryCode).toUpperCase().trim()

    if (!name || name.trim().length === 0) {
      toast.error('Name is required and must be between 1 and 200 characters')
      return
    }
    if (name.length > 200) {
      toast.error('Name must be less than 200 characters')
      return
    }

    if (!country || country.trim().length === 0) {
      toast.error('Country is required and must be between 1 and 200 characters')
      return
    }
    if (country.length > 200) {
      toast.error('Country must be less than 200 characters')
      return
    }

    if (!countryCode || countryCode.trim().length === 0) {
      toast.error('Country code is required and must be between 1 and 10 characters')
      return
    }
    if (countryCode.length > 10) {
      toast.error('Country code must be less than 10 characters')
      return
    }

    // Validate city (required)
    const city = sanitizeText(formData.city).trim()
    if (!city || city.length === 0) {
      toast.error('City is required and must be between 1 and 50 characters')
      return
    }
    if (city.length > 50) {
      toast.error('City must be less than 50 characters')
      return
    }
    
    // Validate optional fields
    const stateProvince = formData.stateProvince ? sanitizeText(formData.stateProvince).trim() : ''
    const description = formData.description ? sanitizeText(formData.description).trim() : ''
    
    if (stateProvince && stateProvince.length > 200) {
      toast.error('State/Province must be less than 200 characters')
      return
    }
    if (description && description.length > 1000) {
      toast.error('Description must be less than 1000 characters')
      return
    }

    // Validate displayOrder - ensure it's a valid integer
    const displayOrder = formData.displayOrder ? parseInt(formData.displayOrder) : 0
    if (isNaN(displayOrder) || displayOrder < 0) {
      toast.error('Display order must be a positive number')
      return
    }

    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('image', formData.file)
      uploadFormData.append('name', name.trim())
      uploadFormData.append('country', country.trim())
      uploadFormData.append('countryCode', countryCode)
      uploadFormData.append('city', city)
      if (stateProvince) {
        uploadFormData.append('stateProvince', stateProvince)
      }
      if (description) {
        uploadFormData.append('description', description)
      }
      // Always send displayOrder as integer string (FormData requires string)
      uploadFormData.append('displayOrder', displayOrder.toString())
      // Send spotTypes as JSON string array (single item array from dropdown)
      if (formData.spotTypes && Array.isArray(formData.spotTypes) && formData.spotTypes.length > 0) {
        uploadFormData.append('spotTypes', JSON.stringify(formData.spotTypes))
      }
      // Send travelInfo
      if (formData.travelInfo) {
        uploadFormData.append('travelInfo', formData.travelInfo)
      }
      
      // Send latitude and longitude if available
      if (formData.latitude && formData.longitude) {
        uploadFormData.append('latitude', formData.latitude.toString())
        uploadFormData.append('longitude', formData.longitude.toString())
      }

      const response = await uploadLocale(uploadFormData)
      toast.success(response.message || 'Locale uploaded successfully')
      handleModalClose(setShowUploadModal, null, () => {
        setFormData({ 
          name: '', 
          country: '', 
          countryCode: '', 
          stateProvince: '', 
          city: '', 
          description: '', 
          displayOrder: '0',
          spotTypes: [],
          travelInfo: 'Drivable',
          file: null,
          latitude: null,
          longitude: null
        })
      })
      // Force refresh after upload - reset page to 1 and clear fetchKey to trigger fetch
      // This is intentional - new locale added, need to refresh list
      setCurrentPage(1)
      currentPageRef.current = 1
      lastFetchKeyRef.current = null
      trackedFetchKeysRef.current.clear() // Clear tracked keys to allow re-fetch
      isFetchingRef.current = false // Reset fetch guard
      // Fetch immediately with page 1 override
      console.debug('[Locales] Triggering refresh after upload')
      await loadLocales(true, 1)
    } catch (error) {
      handleError(error, toast, 'Failed to upload locale')
      logger.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteClick = (locale) => {
    setLocaleToDelete(locale)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!localeToDelete) return

    try {
      await deleteLocale(localeToDelete._id)
      toast.success('Locale deleted successfully')
      setShowDeleteModal(false)
      setLocaleToDelete(null)
      // Force refresh after delete - reset page to 1 and clear fetchKey to trigger fetch
      // This is intentional - locale deleted, need to refresh list
      setCurrentPage(1)
      currentPageRef.current = 1
      lastFetchKeyRef.current = null
      // Fetch immediately with page 1 override
      await loadLocales(true, 1)
    } catch (error) {
      handleError(error, toast, 'Failed to delete locale')
      logger.error('Delete error:', error)
    }
  }

  // Lazy load full locale details when expanded
  const handleExpandLocale = useCallback(async (localeId) => {
    if (expandedLocales.has(localeId)) {
      // Already expanded, just toggle
      const newExpanded = new Set(expandedLocales)
      newExpanded.delete(localeId)
      setExpandedLocales(newExpanded)
      return
    }

    // Check cache first
    if (expandedLocaleDetails.has(localeId)) {
      const newExpanded = new Set(expandedLocales)
      newExpanded.add(localeId)
      setExpandedLocales(newExpanded)
      return
    }

    // Fetch full details
    try {
      const fullLocale = await getLocaleById(localeId)
      if (!isMountedRef.current) return

      // Update cache
      const newDetails = new Map(expandedLocaleDetails)
      newDetails.set(localeId, fullLocale)
      setExpandedLocaleDetails(newDetails)

      // Update locale in list with full data
      setLocales(prev => prev.map(locale => 
        locale._id === localeId 
          ? { ...locale, ...fullLocale, fullDataLoaded: true }
          : locale
      ))

      // Mark as expanded
      const newExpanded = new Set(expandedLocales)
      newExpanded.add(localeId)
      setExpandedLocales(newExpanded)
    } catch (error) {
      if (!isMountedRef.current) return
      logger.error('Error loading locale details:', error)
      toast.error('Failed to load locale details')
    }
  }, [expandedLocales, expandedLocaleDetails])

  const handleToggleStatus = useCallback(async (localeId, currentStatus) => {
    if (!isMountedRef.current) return

    // Prevent toggle during fetch to avoid state conflicts
    if (isFetchingRef.current) {
      toast.error('Please wait for current operation to complete')
      return
    }

    const previousState = locales.find(l => l._id === localeId)
    if (!previousState) return

    const newStatus = !currentStatus

    // Optimistic update - does NOT trigger fetch (fetchKey unchanged)
    setLocales(prev => prev.map(locale => 
      locale._id === localeId 
        ? { ...locale, isActive: newStatus }
        : locale
    ))

    try {
      await toggleLocaleStatus(localeId, newStatus)
      
      if (!isMountedRef.current) return
      
      toast.success(`Locale ${newStatus ? 'activated' : 'deactivated'} successfully`)
      
      // Update cached data to match server state - does NOT trigger fetch
      if (cachedLocalesRef.current) {
        cachedLocalesRef.current = cachedLocalesRef.current.map(locale => 
          locale._id === localeId 
            ? { ...locale, isActive: newStatus }
            : locale
        )
      }
      
      // DO NOT call loadLocales() - fetchKey hasn't changed, would cause unnecessary fetch
      // The optimistic update already handles the UI, and cache is synced above
    } catch (error) {
      if (!isMountedRef.current) return
      
      // Rollback on error - does NOT trigger fetch (fetchKey unchanged)
      setLocales(prev => prev.map(locale => 
        locale._id === localeId 
          ? previousState
          : locale
      ))
      
      handleError(error, toast, 'Failed to toggle locale status')
      logger.error('Toggle error:', error)
    }
  }, [locales])

  // Bulk enable/disable
  const handleBulkToggleStatus = useCallback(async (isActive) => {
    if (selectedLocales.length === 0) {
      toast.error('Please select at least one locale')
      return
    }

    // Prevent bulk actions during fetch to avoid state conflicts
    if (isFetchingRef.current) {
      toast.error('Please wait for current operation to complete')
      return
    }

    // Store previous state for rollback
    previousStateRef.current = locales.filter(l => selectedLocales.includes(l._id))

    setIsBulkActionInProgress(true)
    setBulkActionProgress({ current: 0, total: selectedLocales.length })
    setShowBulkActionModal(false)

    const results = { success: 0, failed: 0 }
    const failedIds = []

    for (let i = 0; i < selectedLocales.length; i++) {
      if (!isMountedRef.current) break

      const localeId = selectedLocales[i]
      setBulkActionProgress({ current: i + 1, total: selectedLocales.length })

      try {
        await toggleLocaleStatus(localeId, isActive)
        results.success++
        
        // Optimistic update - does NOT trigger fetch (fetchKey unchanged)
        setLocales(prev => prev.map(locale => 
          locale._id === localeId 
            ? { ...locale, isActive }
            : locale
        ))
      } catch (error) {
        logger.error(`Failed to toggle locale ${localeId}:`, error)
        results.failed++
        failedIds.push(localeId)
      }
    }

    if (!isMountedRef.current) return

    // Update cached data to match server state - does NOT trigger fetch
    if (cachedLocalesRef.current) {
      cachedLocalesRef.current = cachedLocalesRef.current.map(locale => 
        selectedLocales.includes(locale._id) && !failedIds.includes(locale._id)
          ? { ...locale, isActive }
          : locale
      )
    }

    setIsBulkActionInProgress(false)
    setBulkActionProgress({ current: 0, total: 0 })
    setSelectedLocales([])

    if (results.failed > 0) {
      // Rollback failed items - does NOT trigger fetch (fetchKey unchanged)
      const previousState = previousStateRef.current || []
      setLocales(prev => prev.map(locale => {
        if (failedIds.includes(locale._id)) {
          const previous = previousState.find(p => p._id === locale._id)
          return previous || locale
        }
        return locale
      }))
      
      toast.error(`${results.success} updated, ${results.failed} failed`)
    } else {
      toast.success(`${results.success} locale(s) ${isActive ? 'activated' : 'deactivated'} successfully`)
    }

    // DO NOT call loadLocales() - fetchKey hasn't changed, would cause unnecessary fetch
    // The optimistic updates already handle the UI, and cache is synced above
  }, [selectedLocales, locales])

  const handlePreview = async (locale) => {
    // Fetch full locale data to ensure we have all fields (description, spotTypes, travelInfo, updatedAt, city)
    try {
      const fullLocale = await getLocaleById(locale._id)
      setPreviewLocale({
        ...locale,
        ...fullLocale,
        city: fullLocale.city || locale.city || '',
        description: fullLocale.description || locale.description || null,
        spotTypes: Array.isArray(fullLocale.spotTypes) && fullLocale.spotTypes.length > 0 
          ? fullLocale.spotTypes 
          : (Array.isArray(locale.spotTypes) && locale.spotTypes.length > 0 ? locale.spotTypes : []),
        travelInfo: fullLocale.travelInfo || locale.travelInfo || 'Drivable',
        updatedAt: fullLocale.updatedAt || locale.updatedAt || null
      })
    } catch (error) {
      logger.error('Error fetching locale details for preview:', error)
      // Fallback to locale data from list
      setPreviewLocale({
        ...locale,
        city: locale.city || '',
        description: locale.description || null,
        spotTypes: Array.isArray(locale.spotTypes) ? locale.spotTypes : [],
        travelInfo: locale.travelInfo || 'Drivable',
        updatedAt: locale.updatedAt || null
      })
    }
    setShowPreviewModal(true)
  }

  const handleEditClick = async (locale) => {
    setLocaleToEdit(locale)
    
    // Fetch full locale data to ensure we have spotTypes and travelInfo
    try {
      const fullLocale = await getLocaleById(locale._id)
      setEditFormData({
        name: fullLocale.name || locale.name || '',
        country: fullLocale.country || locale.country || '',
        countryCode: fullLocale.countryCode || locale.countryCode || '',
        stateProvince: fullLocale.stateProvince || locale.stateProvince || '',
        city: fullLocale.city || locale.city || '',
        description: fullLocale.description || locale.description || '',
        displayOrder: (fullLocale.displayOrder !== undefined ? fullLocale.displayOrder : locale.displayOrder) ? (fullLocale.displayOrder !== undefined ? fullLocale.displayOrder : locale.displayOrder).toString() : '0',
        spotTypes: Array.isArray(fullLocale.spotTypes) && fullLocale.spotTypes.length > 0 
          ? fullLocale.spotTypes 
          : (Array.isArray(locale.spotTypes) && locale.spotTypes.length > 0 ? locale.spotTypes : []),
        travelInfo: fullLocale.travelInfo || locale.travelInfo || 'Drivable'
      })
    } catch (error) {
      logger.error('Error fetching locale details for edit:', error)
      // Fallback to locale data from list
      setEditFormData({
        name: locale.name || '',
        country: locale.country || '',
        countryCode: locale.countryCode || '',
        stateProvince: locale.stateProvince || '',
        city: locale.city || '',
        description: locale.description || '',
        displayOrder: locale.displayOrder ? locale.displayOrder.toString() : '0',
        spotTypes: Array.isArray(locale.spotTypes) ? locale.spotTypes : [],
        travelInfo: locale.travelInfo || 'Drivable'
      })
    }
    setShowEditModal(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    
    // Validate required fields
    const name = sanitizeText(editFormData.name).trim()
    const country = sanitizeText(editFormData.country).trim()
    const countryCode = sanitizeText(editFormData.countryCode).toUpperCase().trim()

    if (!name || name.length === 0) {
      toast.error('Name is required and must be between 1 and 200 characters')
      return
    }
    if (name.length > 200) {
      toast.error('Name must be less than 200 characters')
      return
    }

    if (!country || country.length === 0) {
      toast.error('Country is required and must be between 1 and 200 characters')
      return
    }
    if (country.length > 200) {
      toast.error('Country must be less than 200 characters')
      return
    }

    if (!countryCode || countryCode.length === 0) {
      toast.error('Country code is required and must be between 1 and 10 characters')
      return
    }
    if (countryCode.length > 10) {
      toast.error('Country code must be less than 10 characters')
      return
    }

    // Validate city (required)
    const city = sanitizeText(editFormData.city).trim()
    if (!city || city.length === 0) {
      toast.error('City is required and must be between 1 and 50 characters')
      return
    }
    if (city.length > 50) {
      toast.error('City must be less than 50 characters')
      return
    }
    
    // Validate optional fields
    const stateProvince = editFormData.stateProvince ? sanitizeText(editFormData.stateProvince).trim() : ''
    const description = editFormData.description ? sanitizeText(editFormData.description).trim() : ''
    
    if (stateProvince && stateProvince.length > 200) {
      toast.error('State/Province must be less than 200 characters')
      return
    }
    if (description && description.length > 1000) {
      toast.error('Description must be less than 1000 characters')
      return
    }

    // Validate displayOrder - ensure it's a valid integer
    const displayOrder = editFormData.displayOrder ? parseInt(editFormData.displayOrder) : 0
    if (isNaN(displayOrder) || displayOrder < 0) {
      toast.error('Display order must be a positive number')
      return
    }

    setEditing(true)
    try {
      const updateData = {
        name,
        country,
        countryCode
      }
      
      if (stateProvince) {
        updateData.stateProvince = stateProvince
      } else {
        updateData.stateProvince = '' // Explicitly set empty string for optional fields
      }
      
      updateData.city = city
      
      if (description) {
        updateData.description = description
      } else {
        updateData.description = '' // Explicitly set empty string for optional fields
      }
      
      // Always send displayOrder as integer
      updateData.displayOrder = displayOrder

      // Add spotTypes and travelInfo if they exist
      if (editFormData.spotTypes && Array.isArray(editFormData.spotTypes) && editFormData.spotTypes.length > 0) {
        updateData.spotTypes = editFormData.spotTypes
      } else {
        updateData.spotTypes = []
      }
      
      if (editFormData.travelInfo) {
        updateData.travelInfo = editFormData.travelInfo
      }
      
      // Add latitude and longitude if available
      if (editFormData.latitude && editFormData.longitude) {
        updateData.latitude = parseFloat(editFormData.latitude)
        updateData.longitude = parseFloat(editFormData.longitude)
      }
      
      const updatedLocale = await updateLocale(localeToEdit._id, updateData)
      toast.success('Locale updated successfully')
      
      // Optimistically update the locale in the list with new data
      if (updatedLocale && updatedLocale.locale) {
        setLocales(prev => prev.map(locale => 
          locale._id === localeToEdit._id 
            ? { 
                ...locale, 
                ...updatedLocale.locale,
                spotTypes: Array.isArray(updatedLocale.locale.spotTypes) ? updatedLocale.locale.spotTypes : [],
                travelInfo: updatedLocale.locale.travelInfo || 'Drivable',
                fullDataLoaded: true
              }
            : locale
        ))
      }
      
      handleModalClose(setShowEditModal, setLocaleToEdit, () => {
        setEditFormData({ 
          name: '', 
          country: '', 
          countryCode: '', 
          stateProvince: '', 
          city: '', 
          description: '', 
          displayOrder: '0',
          spotTypes: [],
          travelInfo: 'Drivable'
        })
      })
      // Force refresh after update - reset page to 1 and clear fetchKey to trigger fetch
      // This is intentional - locale updated, need to refresh list
      setCurrentPage(1)
      currentPageRef.current = 1
      lastFetchKeyRef.current = null
      // Fetch immediately with page 1 override
      await loadLocales(true, 1)
    } catch (error) {
      handleError(error, toast, 'Failed to update locale')
      logger.error('Update error:', error)
    } finally {
      setEditing(false)
    }
  }

  // Get unique country codes for filter
  const countryCodes = useMemo(() => {
    const codes = [...new Set(locales.map(l => l.countryCode).filter(Boolean))]
    return codes.sort()
  }, [locales])

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <SortAsc className="w-4 h-4 ml-1" /> : <SortDesc className="w-4 h-4 ml-1" />
  }

  // Memoized Locale Row Component for performance
  const LocaleRow = memo(({ 
    locale, 
    index, 
    isSelected, 
    onSelect, 
    onToggleStatus, 
    onPreview, 
    onEdit, 
    onDelete,
    onExpand,
    isExpanded,
    duplicateHints,
    hasInvalidCoordinates
  }) => {
    const hasDuplicates = duplicateHints.has(locale._id)
    const duplicates = duplicateHints.get(locale._id) || []
    
    return (
      <>
        <motion.tr
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ delay: index * 0.05 }}
          className={`border-b border-gray-100 transition-colors ${
            locale.isActive 
              ? 'hover:bg-green-50/50 bg-white' 
              : 'hover:bg-gray-50/50 bg-gray-50/30'
          }`}
        >
          <TableCell>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(locale._id, e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
          </TableCell>
          <TableCell>
            <button
              onClick={() => onExpand(locale._id)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              {locale.imageUrl && (
                <img 
                  src={locale.imageUrl} 
                  alt={locale.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              <div className="flex flex-col">
                <span className={`font-medium ${locale.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                  {locale.name}
                </span>
                {hasDuplicates && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                    <span className="text-xs text-orange-600">
                      Possible duplicate ({duplicates.length})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className={locale.isActive ? 'text-gray-700' : 'text-gray-500'}>
            {locale.country}
          </TableCell>
          <TableCell>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
              {locale.countryCode}
            </span>
          </TableCell>
          <TableCell className={locale.isActive ? 'text-gray-700' : 'text-gray-500'}>
            {locale.stateProvince || '-'}
          </TableCell>
          <TableCell className={locale.isActive ? 'text-gray-700' : 'text-gray-500'}>
            {locale.displayOrder || 0}
          </TableCell>
          <TableCell className={`text-sm ${locale.isActive ? 'text-gray-600' : 'text-gray-400'}`}>
            {formatDate(locale.createdAt)}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleStatus(locale._id, locale.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 cursor-pointer ${
                  locale.isActive
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
                title={`Click to ${locale.isActive ? 'deactivate' : 'activate'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                    locale.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                locale.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {locale.isActive ? 'Active' : 'Inactive'}
              </span>
              {hasInvalidCoordinates && (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Invalid coords
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onPreview(locale)}
                className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                title="Preview"
              >
                <Eye className="w-4 h-4 text-green-600" />
              </button>
              <button
                onClick={() => onEdit(locale)}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4 text-blue-600" />
              </button>
              <button
                onClick={() => onDelete(locale)}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </TableCell>
        </motion.tr>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50"
          >
            <TableCell colSpan={10} className="p-4">
              <div className="space-y-3">
                {locale.fullDataLoaded ? (
                  <>
                    {locale.description && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Description:</p>
                        <p className="text-sm text-gray-600">{locale.description}</p>
                      </div>
                    )}
                    {isValidCoordinate(locale.latitude, locale.longitude) ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Coordinates:</p>
                        <p className="text-sm text-gray-600">
                          {locale.latitude.toFixed(6)}, {locale.longitude.toFixed(6)}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-yellow-700">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Coordinates missing or invalid</span>
                      </div>
                    )}
                    {hasDuplicates && (
                      <div>
                        <p className="text-sm font-semibold text-orange-700 mb-1">Possible Duplicates:</p>
                        <ul className="text-sm text-orange-600 space-y-1">
                          {duplicates.map(dup => (
                            <li key={dup.id}>• {dup.name} ({dup.reason})</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading details...</span>
                  </div>
                )}
              </div>
            </TableCell>
          </motion.tr>
        )}
      </>
    )
  })

  LocaleRow.displayName = 'LocaleRow'

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-600 via-teal-600 to-emerald-600 rounded-2xl p-8 shadow-xl border border-green-200"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Locale Management</h1>
              <p className="text-green-100 text-lg">Manage and organize location locales</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                console.debug('[Locales] Refresh button clicked')
                // Clear all fetch tracking
                lastFetchKeyRef.current = null
                hasInitialFetchRef.current = false
                isFetchingRef.current = false
                trackedFetchKeysRef.current.clear()
                
                // Abort any in-flight requests
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort()
                }
                
                // Clear debounce timer
                if (debounceTimeoutRef.current) {
                  clearTimeout(debounceTimeoutRef.current)
                  debounceTimeoutRef.current = null
                }
                
                // Force refresh with current page
                await loadLocales(true, currentPageRef.current)
              }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-6 py-2 bg-white text-green-600 rounded-lg transition-all shadow-lg hover:shadow-xl font-semibold hover:bg-green-50"
            >
              <Upload className="w-5 h-5" />
              Add Locale
            </button>
          </div>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Total Locales</p>
                  <p className="text-3xl font-bold text-green-900">{statistics.total}</p>
                </div>
                <div className="p-3 bg-green-500 rounded-xl">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Active Locales</p>
                  <p className="text-3xl font-bold text-blue-900">{statistics.active}</p>
                </div>
                <div className="p-3 bg-blue-500 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 mb-1">Inactive</p>
                  <p className="text-3xl font-bold text-orange-900">{statistics.inactive}</p>
                </div>
                <div className="p-3 bg-orange-500 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search and Filter Section */}
      <Card className="shadow-lg border-gray-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search locales by name, country, or state..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-12 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none cursor-pointer transition-all"
              >
                <option value="all">All Countries</option>
                {countryCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            {selectedLocales.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedLocales.length} selected
                </span>
                <button
                  onClick={() => {
                    setBulkActionType('enable')
                    setShowBulkActionModal(true)
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isBulkActionInProgress}
                >
                  Enable
                </button>
                <button
                  onClick={() => {
                    setBulkActionType('disable')
                    setShowBulkActionModal(true)
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isBulkActionInProgress}
                >
                  Disable
                </button>
                <button
                  onClick={() => setSelectedLocales([])}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          {isBulkActionInProgress && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Processing {bulkActionProgress.current} of {bulkActionProgress.total} locales...
                  </p>
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkActionProgress.current / bulkActionProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Locales Table */}
      <Card className="shadow-lg border-gray-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900">
              Locales ({locales.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
                <p className="text-gray-500">Loading locales...</p>
              </div>
            </div>
          ) : locales.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <MapPin className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No locales found</h3>
              <p className="text-gray-500 mb-6">Get started by adding your first locale</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                <Upload className="w-5 h-5" />
                Add Locale
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedLocales.length === sortedLocales.length && sortedLocales.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLocales(sortedLocales.map(l => l._id))
                          } else {
                            setSelectedLocales([])
                          }
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Name
                        <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('country')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Country
                        <SortIcon field="country" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">Country Code</TableHead>
                    <TableHead className="font-semibold text-gray-700">State/Province</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('displayOrder')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Order
                        <SortIcon field="displayOrder" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Created
                        <SortIcon field="createdAt" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedLocales.map((locale, index) => {
                      const hasInvalidCoords = !isValidCoordinate(locale.latitude, locale.longitude)
                      return (
                        <LocaleRow
                          key={locale._id}
                          locale={locale}
                          index={index}
                          isSelected={selectedLocales.includes(locale._id)}
                          onSelect={(id, checked) => {
                            if (checked) {
                              setSelectedLocales(prev => [...prev, id])
                            } else {
                              setSelectedLocales(prev => prev.filter(lid => lid !== id))
                            }
                          }}
                          onToggleStatus={handleToggleStatus}
                          onPreview={handlePreview}
                          onEdit={handleEditClick}
                          onDelete={handleDeleteClick}
                          onExpand={handleExpandLocale}
                          isExpanded={expandedLocales.has(locale._id)}
                          duplicateHints={duplicateHints}
                          hasInvalidCoordinates={hasInvalidCoords}
                        />
                      )
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i
                    if (page > totalPages) return null
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-green-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} className="bg-white">
        <ModalHeader onClose={() => setShowUploadModal(false)}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Add New Locale</h2>
          </div>
        </ModalHeader>
        <form onSubmit={handleUpload}>
          <ModalContent className="space-y-5 sm:space-y-6">
            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-gray-800">
                Image <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-dashed border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all cursor-pointer hover:border-gray-400"
                  required
                />
                {formData.file && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <ImageIcon className="w-4 h-4" />
                    <span>{formData.file.name}</span>
                    <span className="text-gray-400">
                      ({(formData.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: JPEG, PNG, WebP, GIF (Max 10MB)
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-800">
                  Name <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenDetectPlace(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
                >
                  <MapPin className="w-4 h-4" />
                  Detect Place
                </button>
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                placeholder="Locale name"
                required
                minLength={1}
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  Country <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                  placeholder="Country name"
                  required
                  minLength={1}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.countryCode}
                  onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                  placeholder="US, GB, IN, etc."
                  minLength={1}
                  maxLength={10}
                  required
                />
              </div>

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  Display Order <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  State/Province <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.stateProvince}
                  onChange={(e) => setFormData({ ...formData, stateProvince: e.target.value })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                  placeholder="State or province"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
                  placeholder="City"
                  maxLength={50}
                  minLength={1}
                  required
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-gray-800">
                Description <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-y shadow-sm min-h-[100px]"
                placeholder="Locale description"
                rows="4"
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Spot Type <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <select
                    value={Array.isArray(formData.spotTypes) && formData.spotTypes.length > 0 ? formData.spotTypes[0] : ''}
                    onChange={(e) => {
                      const selectedType = e.target.value;
                      if (selectedType) {
                        setFormData({ ...formData, spotTypes: [selectedType] });
                      } else {
                        setFormData({ ...formData, spotTypes: [] });
                      }
                    }}
                    className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all appearance-none cursor-pointer shadow-sm hover:border-gray-300 font-medium"
                  >
                    <option value="">Select spot type</option>
                    <option value="Historical spots">🏛️ Historical spots</option>
                    <option value="Cultural spots">🎭 Cultural spots</option>
                    <option value="Natural spots">🌲 Natural spots</option>
                    <option value="Adventure spots">⛰️ Adventure spots</option>
                    <option value="Religious/spiritual spots">🕌 Religious/spiritual spots</option>
                    <option value="Wildlife spots">🦁 Wildlife spots</option>
                    <option value="Beach spots">🏖️ Beach spots</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Category of this location
                </p>
              </div>

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Travel Info <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.travelInfo || 'Drivable'}
                    onChange={(e) => setFormData({ ...formData, travelInfo: e.target.value })}
                    className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all appearance-none cursor-pointer shadow-sm hover:border-gray-300 font-medium"
                  >
                    <option value="Drivable">🚗 Drivable</option>
                    <option value="Walkable">🚶 Walkable</option>
                    <option value="Public Transport">🚌 Public Transport</option>
                    <option value="Flight Required">✈️ Flight Required</option>
                    <option value="Not Accessible">🚫 Not Accessible</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  How users can reach this location
                </p>
              </div>
            </div>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-semibold text-base shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Add Locale
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Detect Place Modal - Higher z-index to appear above Edit Modal */}
      <Modal isOpen={showDetectPlaceModal} onClose={() => {
        setShowDetectPlaceModal(false)
        setDetectPlaceName('')
        setDetectedPlace(null)
      }} className="bg-white max-w-4xl" zIndex={60}>
        <ModalHeader onClose={() => {
          setShowDetectPlaceModal(false)
          setDetectPlaceName('')
          setDetectedPlace(null)
        }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Detect Place</h2>
          </div>
        </ModalHeader>
        <ModalContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Enter Place Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={detectPlaceName}
                  onChange={(e) => setDetectPlaceName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchPlace()
                    }
                  }}
                  className="flex-1 px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="e.g., Museum of Anthropology"
                />
                <button
                  type="button"
                  onClick={handleSearchPlace}
                  disabled={isSearchingPlace || !detectPlaceName.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearchingPlace ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </div>

            {detectedPlace && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-900">Place Found!</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold">Name:</span> {detectedPlace.name}</p>
                    <p><span className="font-semibold">Address:</span> {detectedPlace.formattedAddress}</p>
                    {detectedPlace.city && <p><span className="font-semibold">City:</span> {detectedPlace.city}</p>}
                    {detectedPlace.stateProvince && <p><span className="font-semibold">State/Province:</span> {detectedPlace.stateProvince}</p>}
                    {detectedPlace.country && <p><span className="font-semibold">Country:</span> {detectedPlace.country} {detectedPlace.countryCode ? `(${detectedPlace.countryCode})` : ''}</p>}
                    <p className="text-xs text-gray-500 mt-2">
                      Coordinates: {detectedPlace.lat.toFixed(6)}, {detectedPlace.lng.toFixed(6)}
                    </p>
                  </div>
                </div>

                {/* Google Maps Static Image */}
                <div className="w-full h-96 rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg relative group">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${detectedPlace.lat},${detectedPlace.lng}&zoom=15&size=800x400&markers=color:red%7C${detectedPlace.lat},${detectedPlace.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`}
                    alt={`Map showing ${detectedPlace.name}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="hidden absolute inset-0 bg-gray-100 flex items-center justify-center flex-col gap-2 p-4"
                    style={{ display: 'none' }}
                  >
                    <MapPin className="w-12 h-12 text-gray-400" />
                    <p className="text-sm text-gray-600 text-center">
                      Map preview unavailable
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${detectedPlace.lat},${detectedPlace.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline mt-2"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                  {/* Click overlay to open in Google Maps */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${detectedPlace.lat},${detectedPlace.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-10 transition-all cursor-pointer group-hover:bg-opacity-10"
                    title="Click to open in Google Maps"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">Open in Google Maps</span>
                    </div>
                  </a>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Confirm this is the correct place?</span> Click "Use This Place" to auto-fill all form fields.
                  </p>
                </div>
              </div>
            )}

            {!detectedPlace && !isSearchingPlace && detectPlaceName && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
                <p className="text-sm text-gray-600">Enter a place name and click "Search" to find it on the map</p>
              </div>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              setShowDetectPlaceModal(false)
              setDetectPlaceName('')
              setDetectedPlace(null)
            }}
            className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-semibold text-base shadow-sm"
          >
            Cancel
          </button>
          {detectedPlace && (
            <button
              type="button"
              onClick={handleConfirmDetectedPlace}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-base"
            >
              <CheckCircle className="w-5 h-5" />
              Use This Place
            </button>
          )}
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => handleModalClose(setShowDeleteModal, setLocaleToDelete)} className="bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowDeleteModal, setLocaleToDelete)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Delete Locale</h2>
          </div>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-gray-900 font-medium mb-2">Are you sure you want to delete this locale?</p>
              {localeToDelete && (
                <p className="text-gray-600 text-sm mb-2">
                  <span className="font-semibold">{localeToDelete.name}</span> - {localeToDelete.country}
                </p>
              )}
              <p className="text-gray-500 text-sm">
                This action cannot be undone. The locale image will be permanently removed from storage and the database.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => handleModalClose(setShowDeleteModal, setLocaleToDelete)}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteConfirm}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            Delete Locale
          </button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => handleModalClose(setShowEditModal, setLocaleToEdit, () => {
        setEditFormData({ 
          name: '', 
          country: '', 
          countryCode: '', 
          stateProvince: '', 
          city: '', 
          description: '', 
          displayOrder: '0',
          spotTypes: [],
          travelInfo: 'Drivable'
        })
      })} className="bg-white overflow-hidden">
        <ModalHeader onClose={() => handleModalClose(setShowEditModal, setLocaleToEdit, () => {
          setEditFormData({ 
            name: '', 
            country: '', 
            countryCode: '', 
            stateProvince: '', 
            city: '', 
            description: '', 
            displayOrder: '0' 
          })
        })}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit2 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Edit Locale</h2>
          </div>
        </ModalHeader>
        <form onSubmit={handleUpdate}>
          <ModalContent className="space-y-5 sm:space-y-6">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenDetectPlace(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
                >
                  <MapPin className="w-4 h-4" />
                  Detect Place
                </button>
              </div>
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: sanitizeText(e.target.value) })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Locale name"
                required
                minLength={1}
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Country <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.country}
                  onChange={(e) => setEditFormData({ ...editFormData, country: sanitizeText(e.target.value) })}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Country name"
                  required
                  minLength={1}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.countryCode}
                  onChange={(e) => setEditFormData({ ...editFormData, countryCode: sanitizeText(e.target.value).toUpperCase() })}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="US, GB, IN, etc."
                  minLength={1}
                  maxLength={10}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Display Order <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="number"
                  value={editFormData.displayOrder}
                  onChange={(e) => setEditFormData({ ...editFormData, displayOrder: sanitizeText(e.target.value) })}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  State/Province <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="text"
                  value={editFormData.stateProvince}
                  onChange={(e) => setEditFormData({ ...editFormData, stateProvince: sanitizeText(e.target.value) })}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="State or province"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.city}
                  onChange={(e) => setEditFormData({ ...editFormData, city: sanitizeText(e.target.value) })}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="City"
                  maxLength={50}
                  minLength={1}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Description <span className="text-gray-400 text-xs">Optional</span>
              </label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: sanitizeText(e.target.value) })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-y"
                placeholder="Locale description"
                rows="3"
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Spot Type <span className="text-gray-400 text-xs font-normal">Optional</span>
                </label>
                <div className="relative">
                  <select
                    value={Array.isArray(editFormData.spotTypes) && editFormData.spotTypes.length > 0 ? editFormData.spotTypes[0] : ''}
                    onChange={(e) => {
                      const selectedType = e.target.value;
                      if (selectedType) {
                        setEditFormData({ ...editFormData, spotTypes: [selectedType] });
                      } else {
                        setEditFormData({ ...editFormData, spotTypes: [] });
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer shadow-sm hover:border-gray-300 font-medium"
                  >
                    <option value="">Select spot type</option>
                    <option value="Historical spots">🏛️ Historical spots</option>
                    <option value="Cultural spots">🎭 Cultural spots</option>
                    <option value="Natural spots">🌲 Natural spots</option>
                    <option value="Adventure spots">⛰️ Adventure spots</option>
                    <option value="Religious/spiritual spots">🕌 Religious/spiritual spots</option>
                    <option value="Wildlife spots">🦁 Wildlife spots</option>
                    <option value="Beach spots">🏖️ Beach spots</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Category of this location
                </p>
              </div>

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Travel Info <span className="text-gray-400 text-xs font-normal">Optional</span>
                </label>
                <div className="relative">
                  <select
                    value={editFormData.travelInfo || 'Drivable'}
                    onChange={(e) => setEditFormData({ ...editFormData, travelInfo: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer shadow-sm hover:border-gray-300 font-medium"
                  >
                    <option value="Drivable">🚗 Drivable</option>
                    <option value="Walkable">🚶 Walkable</option>
                    <option value="Public Transport">🚌 Public Transport</option>
                    <option value="Flight Required">✈️ Flight Required</option>
                    <option value="Not Accessible">🚫 Not Accessible</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  How users can reach this location
                </p>
              </div>
            </div>

            {localeToEdit && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Note:</span> You can only edit locale metadata. The image cannot be changed. To replace the image, delete this locale and add a new one.
                </p>
              </div>
            )}
          </ModalContent>
          <ModalFooter className="sticky bottom-0 z-10">
            <button
              type="button"
              onClick={() => {
                handleModalClose(setShowEditModal, setLocaleToEdit, () => {
                  setEditFormData({ 
                    name: '', 
                    country: '', 
                    countryCode: '', 
                    stateProvince: '', 
                    city: '', 
                    description: '', 
                    displayOrder: '0',
                    spotTypes: [],
                    travelInfo: 'Drivable'
                  })
                })
                setLocaleToEdit(null)
                setEditFormData({ 
                  name: '', 
                  country: '', 
                  countryCode: '', 
                  stateProvince: '', 
                  city: '', 
                  description: '', 
                  displayOrder: '0',
                  spotTypes: [],
                  travelInfo: 'Drivable'
                })
              }}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium shadow-sm text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editing}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {editing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  Update Locale
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Bulk Action Modal */}
      <Modal 
        isOpen={showBulkActionModal} 
        onClose={() => {
          if (!isBulkActionInProgress) {
            setShowBulkActionModal(false)
          }
        }} 
        className="bg-white"
      >
        <ModalHeader onClose={() => {
          if (!isBulkActionInProgress) {
            setShowBulkActionModal(false)
          }
        }}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bulkActionType === 'enable' ? 'bg-green-100' : 'bg-red-100'}`}>
              {bulkActionType === 'enable' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Bulk {bulkActionType === 'enable' ? 'Enable' : 'Disable'} Locales
            </h2>
          </div>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className={`p-4 border rounded-xl ${
              bulkActionType === 'enable' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-gray-900 font-medium mb-2">
                Are you sure you want to {bulkActionType === 'enable' ? 'enable' : 'disable'} {selectedLocales.length} locale(s)?
              </p>
              <p className="text-gray-600 text-sm">
                This action will {bulkActionType === 'enable' ? 'activate' : 'deactivate'} all selected locales.
              </p>
            </div>
            {isBulkActionInProgress && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Processing {bulkActionProgress.current} of {bulkActionProgress.total}...
                    </p>
                    <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(bulkActionProgress.current / bulkActionProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
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
              }
            }}
            disabled={isBulkActionInProgress}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleBulkToggleStatus(bulkActionType === 'enable')}
            disabled={isBulkActionInProgress}
            className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base ${
              bulkActionType === 'enable'
                ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white'
                : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
            }`}
          >
            {isBulkActionInProgress ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {bulkActionType === 'enable' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {bulkActionType === 'enable' ? 'Enable' : 'Disable'} {selectedLocales.length} Locale(s)
              </>
            )}
          </button>
        </ModalFooter>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={showPreviewModal} onClose={() => handleModalClose(setShowPreviewModal, setPreviewLocale)} className="bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowPreviewModal, setPreviewLocale)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Locale Preview</h2>
          </div>
        </ModalHeader>
        <ModalContent>
          {previewLocale && (
            <div className="space-y-6">
              {/* Header Section with Image */}
              <div className="text-center p-8 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl">
                {previewLocale.imageUrl && (
                  <img 
                    src={previewLocale.imageUrl} 
                    alt={previewLocale.name}
                    className="w-32 h-32 rounded-xl object-cover mx-auto mb-4 shadow-lg"
                  />
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{previewLocale.name}</h3>
                <p className="text-gray-600 mb-4">{previewLocale.country}</p>
                <div className="flex items-center justify-center gap-3 flex-wrap text-sm">
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-semibold">
                    {previewLocale.countryCode}
                  </span>
                  {previewLocale.stateProvince && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {previewLocale.stateProvince}
                    </span>
                  )}
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {previewLocale.city || 'Not specified'}
                  </span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
                    Order: {previewLocale.displayOrder || 0}
                  </span>
                </div>
              </div>

              {/* Description - Always show */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-semibold text-gray-700 mb-2">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {previewLocale.description || <span className="text-gray-400 italic">No description provided</span>}
                </p>
              </div>

              {/* Additional Details Grid - Always show */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Spot Types */}
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Spot Types</p>
                  {previewLocale.spotTypes && Array.isArray(previewLocale.spotTypes) && previewLocale.spotTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {previewLocale.spotTypes.map((type, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No spot types specified</p>
                  )}
                </div>

                {/* Travel Info */}
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Travel Info</p>
                  {previewLocale.travelInfo ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      {previewLocale.travelInfo === 'Drivable' && '🚗'}
                      {previewLocale.travelInfo === 'Walkable' && '🚶'}
                      {previewLocale.travelInfo === 'Flyable' && '✈️'}
                      {previewLocale.travelInfo}
                    </span>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Not specified</p>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-gray-500 mb-1 font-medium">Created Date</p>
                  <p className="font-semibold text-gray-900">{formatDate(previewLocale.createdAt)}</p>
                </div>
                {previewLocale.updatedAt && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 mb-1 font-medium">Updated Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(previewLocale.updatedAt)}</p>
                  </div>
                )}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-gray-500 mb-1 font-medium">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    previewLocale.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {previewLocale.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => handleModalClose(setShowPreviewModal, setPreviewLocale)}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium text-sm sm:text-base"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Locales

