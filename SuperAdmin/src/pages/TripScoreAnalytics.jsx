import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { LineChartComponent, BarChartComponent, PieChartComponent, AreaChartComponent } from '../components/Charts/index.jsx'
import { 
  Globe, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw, 
  Download,
  Shield,
  Camera,
  Image as ImageIcon,
  MapPin,
  CheckCircle,
  XCircle,
  Award,
  Activity,
  Zap,
  Clock,
  BarChart3,
  Filter,
  Calendar,
  Eye,
  Target,
  Percent,
  ChevronRight,
  Home,
  AlertCircle,
  Edit,
  X,
  Save,
  MessageSquare
} from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  getTripScoreStats,
  getTopUsersByTripScore,
  getSuspiciousVisits,
  getTrustTimeline,
  getContinentBreakdown,
  getDetailedLocations,
  getPendingReviews,
  approveTripVisit,
  rejectTripVisit,
  updateTripVisit
} from '../services/tripScoreAnalytics'
import logger from '../utils/logger'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { handleError } from '../utils/errorCodes'

// Memoized chart components for performance
const MemoizedPieChart = memo(PieChartComponent)
const MemoizedLineChart = memo(LineChartComponent)
const MemoizedBarChart = memo(BarChartComponent)

MemoizedPieChart.displayName = 'MemoizedPieChart'
MemoizedLineChart.displayName = 'MemoizedLineChart'
MemoizedBarChart.displayName = 'MemoizedBarChart'

const TripScoreAnalytics = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [topUsers, setTopUsers] = useState([])
  const [suspiciousVisits, setSuspiciousVisits] = useState([])
  const [trustTimeline, setTrustTimeline] = useState([])
  const [continentBreakdown, setContinentBreakdown] = useState([])
  const [detailedLocations, setDetailedLocations] = useState([])
  const [locationsPagination, setLocationsPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [locationsGroupBy, setLocationsGroupBy] = useState('location') // location, user, country, state
  
  // Pending verification state
  const [pendingReviews, setPendingReviews] = useState([])
  const [pendingReviewsPagination, setPendingReviewsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [reviewActionLoading, setReviewActionLoading] = useState(null)
  const [selectedReview, setSelectedReview] = useState(null) // For view modal
  const [failedImages, setFailedImages] = useState(new Set()) // Track failed image URLs
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState({
    country: '',
    continent: '',
    address: '',
    city: '',
    verificationReason: '',
    lat: '',
    lng: ''
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [loading, setLoading] = useState(false)
  const [suspiciousPage, setSuspiciousPage] = useState(1)
  const [selectedView, setSelectedView] = useState('overview') // overview, users, fraud, geography, locations, verification
  const [previousStats, setPreviousStats] = useState(null) // For comparison
  
  // Enhanced filtering options
  const [showTotalsSeparately, setShowTotalsSeparately] = useState(true) // Show all vs trusted separately
  const [trustLevelFilters, setTrustLevelFilters] = useState({
    high: true,
    medium: true,
    low: true,
    unverified: true,
    suspicious: true
  })
  const [sourceFilters, setSourceFilters] = useState({
    taatom_camera_live: true,
    gallery_exif: true,
    gallery_no_exif: true,
    manual_only: true
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  // Trust health & navigation state
  const [trustHealth, setTrustHealth] = useState(null) // 'healthy' | 'warning' | 'risk'
  const [breadcrumbs, setBreadcrumbs] = useState([{ label: 'Overview', view: 'overview' }])
  const [loadedSections, setLoadedSections] = useState(new Set(['overview'])) // Track lazy-loaded sections
  const [dataErrors, setDataErrors] = useState({}) // Track errors per section
  const [isExporting, setIsExporting] = useState(false)
  const [exportSection, setExportSection] = useState(null)
  
  // Lifecycle & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const analyticsCacheRef = useRef(new Map()) // Cache per period
  const previousPeriodDataRef = useRef(null) // For trend comparison
  const chartMemoCacheRef = useRef(new Map()) // Cache chart data transformations
  
  // Calculate date range from period
  const getDateRange = (period) => {
    const end = new Date()
    let start
    
    switch (period) {
      case '7d':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
    
    return { start: start.toISOString(), end: end.toISOString() }
  }

  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  // Calculate trust health from existing stats
  const calculateTrustHealth = useCallback((currentStats) => {
    if (!currentStats || !currentStats.totalVisits) return null
    
    const trustScore = ((currentStats.trustedVisits / currentStats.totalVisits) * 100)
    const fraudRate = ((currentStats.suspiciousVisits / currentStats.totalVisits) * 100)
    
    // Health logic: Healthy if trust > 70% and fraud < 5%, Warning if trust 50-70% or fraud 5-10%, Risk otherwise
    if (trustScore >= 70 && fraudRate < 5) {
      return 'healthy'
    } else if (trustScore >= 50 && fraudRate < 10) {
      return 'warning'
    } else {
      return 'risk'
    }
  }, [])
  
  // Fetch all TripScore analytics data with partial failure handling
  const fetchAllData = useCallback(async (signal) => {
    if (isFetchingRef.current) {
      logger.debug('TripScore analytics fetch already in progress, skipping duplicate call')
      return
    }
    
    isFetchingRef.current = true
    
    // Check cache first
    const cacheKey = `${selectedPeriod}-${suspiciousPage}-${locationsGroupBy}-${locationsPagination.page}`
    const cachedData = analyticsCacheRef.current.get(cacheKey)
    
    if (cachedData && isMountedRef.current) {
      // Show cached data immediately
      setStats(cachedData.stats)
      setTopUsers(cachedData.topUsers || [])
      setSuspiciousVisits(cachedData.suspiciousVisits || [])
      setTrustTimeline(cachedData.trustTimeline || [])
      setContinentBreakdown(cachedData.continentBreakdown || [])
      setDetailedLocations(cachedData.detailedLocations || [])
      setLocationsPagination(cachedData.locationsPagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
      setTrustHealth(calculateTrustHealth(cachedData.stats))
      // Continue to fetch fresh data in background
    }
    
    if (isMountedRef.current) {
      setLoading(true)
      setDataErrors({}) // Clear previous errors
    }
    
    try {
      const { start, end } = getDateRange(selectedPeriod)
      
      // Store previous stats for comparison
      if (stats && isMountedRef.current) {
        setPreviousStats(stats)
        previousPeriodDataRef.current = stats
      }
      
      // Fetch with individual error handling for partial failure
      const fetchWithErrorHandling = async (fetchFn, sectionName) => {
        try {
          return await fetchFn()
        } catch (error) {
          if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
            throw error // Re-throw abort errors
          }
          logger.error(`Failed to fetch ${sectionName}:`, error)
          if (isMountedRef.current) {
            setDataErrors(prev => ({ ...prev, [sectionName]: error.message || 'Failed to load' }))
          }
          return null
        }
      }
      
      const [
        statsData,
        topUsersData,
        suspiciousData,
        timelineData,
        continentsData,
        locationsData
      ] = await Promise.allSettled([
        fetchWithErrorHandling(() => getTripScoreStats(start, end), 'stats'),
        fetchWithErrorHandling(() => getTopUsersByTripScore({ limit: 20, startDate: start, endDate: end }), 'topUsers'),
        fetchWithErrorHandling(() => getSuspiciousVisits({ page: suspiciousPage, limit: 20, startDate: start, endDate: end }), 'suspiciousVisits'),
        fetchWithErrorHandling(() => getTrustTimeline({ startDate: start, endDate: end, groupBy: 'day' }), 'trustTimeline'),
        fetchWithErrorHandling(() => getContinentBreakdown(start, end), 'continentBreakdown'),
        fetchWithErrorHandling(() => getDetailedLocations({ startDate: start, endDate: end, groupBy: locationsGroupBy, limit: locationsPagination.limit, page: locationsPagination.page }), 'detailedLocations')
      ])
      
      if (!isMountedRef.current) return
      
      // Update state only for successful fetches
      if (statsData.status === 'fulfilled' && statsData.value) {
        setStats(statsData.value.stats)
        setTrustHealth(calculateTrustHealth(statsData.value.stats))
      }
      if (topUsersData.status === 'fulfilled' && topUsersData.value) {
        setTopUsers(topUsersData.value.topUsers || [])
      }
      if (suspiciousData.status === 'fulfilled' && suspiciousData.value) {
        setSuspiciousVisits(suspiciousData.value.suspiciousVisits || [])
      }
      if (timelineData.status === 'fulfilled' && timelineData.value) {
        setTrustTimeline(timelineData.value.timeline || [])
      }
      if (continentsData.status === 'fulfilled' && continentsData.value) {
        setContinentBreakdown(continentsData.value.continents || [])
      }
      if (locationsData.status === 'fulfilled' && locationsData.value) {
        setDetailedLocations(locationsData.value.locations || [])
        setLocationsPagination(locationsData.value.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
      }
      
      // Cache successful data
      if (statsData.status === 'fulfilled' && statsData.value && isMountedRef.current) {
        analyticsCacheRef.current.set(cacheKey, {
          stats: statsData.value.stats,
          topUsers: topUsersData.status === 'fulfilled' && topUsersData.value ? topUsersData.value.topUsers : [],
          suspiciousVisits: suspiciousData.status === 'fulfilled' && suspiciousData.value ? suspiciousData.value.suspiciousVisits : [],
          trustTimeline: timelineData.status === 'fulfilled' && timelineData.value ? timelineData.value.timeline : [],
          continentBreakdown: continentsData.status === 'fulfilled' && continentsData.value ? continentsData.value.continents : [],
          detailedLocations: locationsData.status === 'fulfilled' && locationsData.value ? locationsData.value.locations : [],
          locationsPagination: locationsData.status === 'fulfilled' && locationsData.value ? locationsData.value.pagination : { page: 1, limit: 50, total: 0, totalPages: 0 }
        })
      }
      
      // Show error toast only if all sections failed
      const allFailed = Object.keys(dataErrors).length > 0 && !statsData.value && !topUsersData.value && !suspiciousData.value
      if (allFailed && isMountedRef.current) {
        toast.error('Failed to fetch TripScore analytics data')
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
        return
      }
      logger.error('Failed to fetch TripScore analytics data:', error)
      if (isMountedRef.current) {
        toast.error('Failed to fetch TripScore analytics data')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
      isFetchingRef.current = false
    }
  }, [selectedPeriod, suspiciousPage, locationsGroupBy, locationsPagination.page, calculateTrustHealth])

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    
    fetchAllData(abortControllerRef.current.signal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, suspiciousPage, locationsGroupBy, locationsPagination.page])
  
  // Fetch pending reviews (separate from main data fetch)
  const fetchPendingReviews = useCallback(async () => {
    if (!isMountedRef.current) return
    
    try {
      setLoading(true)
      const response = await getPendingReviews({ 
        page: pendingReviewsPagination.page, 
        limit: pendingReviewsPagination.limit 
      })
      
      if (isMountedRef.current && response) {
        // Response is already unwrapped by service (response.data from axios)
        setPendingReviews(response.reviews || [])
        setPendingReviewsPagination(response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
      }
    } catch (error) {
      logger.error('Failed to fetch pending reviews:', error)
      if (isMountedRef.current) {
        setDataErrors(prev => ({ ...prev, pendingReviews: error.message || 'Failed to load' }))
        toast.error('Failed to fetch pending reviews')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [pendingReviewsPagination.page, pendingReviewsPagination.limit])

  // Lazy load sections when view changes
  useEffect(() => {
    if (!isMountedRef.current) return
    
    if (!loadedSections.has(selectedView)) {
      setLoadedSections(prev => new Set([...prev, selectedView]))
      // Trigger fetch if needed (some views need specific data)
      if (selectedView === 'locations' && detailedLocations.length === 0) {
        fetchAllData(abortControllerRef.current?.signal)
      } else if (selectedView === 'verification' && pendingReviews.length === 0) {
        fetchPendingReviews()
      } else if (selectedView === 'overview' || selectedView === 'users' || selectedView === 'fraud' || selectedView === 'geography') {
        // Refresh main analytics when switching to these tabs
        fetchAllData(abortControllerRef.current?.signal)
      }
    }
  }, [selectedView, loadedSections, detailedLocations.length, pendingReviews.length, fetchAllData, fetchPendingReviews])
  
  // Fetch pending reviews when pagination changes
  useEffect(() => {
    if (selectedView === 'verification' && loadedSections.has('verification')) {
      fetchPendingReviews()
    }
  }, [pendingReviewsPagination.page, selectedView, loadedSections, fetchPendingReviews])
  
  // Sync all tabs when data changes (e.g., after approve/reject)
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // If we're on overview and pending reviews change, refresh overview stats
    if (selectedView === 'overview' && pendingReviewsPagination.total > 0) {
      // Stats will be updated when fetchAllData is called
    }
  }, [pendingReviewsPagination.total, selectedView])

  const handleRefresh = useCallback(async () => {
    if (!isMountedRef.current || isFetchingRef.current) return
    
    // Clear cache for current period to force fresh fetch
    const cacheKey = `${selectedPeriod}-${suspiciousPage}-${locationsGroupBy}-${locationsPagination.page}`
    analyticsCacheRef.current.delete(cacheKey)
    
    // Refresh data based on current view
    if (selectedView === 'verification') {
      await fetchPendingReviews()
      if (isMountedRef.current) {
        toast.success('Pending reviews refreshed successfully')
      }
    } else {
      await fetchAllData(abortControllerRef.current?.signal)
      if (isMountedRef.current) {
        toast.success('TripScore analytics data refreshed successfully')
      }
    }
  }, [selectedPeriod, suspiciousPage, locationsGroupBy, locationsPagination.page, selectedView, fetchAllData, fetchPendingReviews])
  
  // Export handler with safety checks
  const handleExport = useCallback((section = null) => {
    // For verification section, check pendingReviews instead of stats
    if (section === 'verification') {
      if (!pendingReviews || pendingReviews.length === 0 || isExporting) {
        if (!isExporting && isMountedRef.current) {
          toast.error('No pending reviews to export')
        }
        return
      }
    } else {
      if (!stats || isExporting) return
    }
    
    setIsExporting(true)
    setExportSection(section)
    
    try {
      let csvData = []
      
      if (section === 'overview' || !section) {
        csvData = [
          ['Metric', 'Value'],
          ['Total Visits', stats?.totalVisits || 0],
          ['Unique Places', stats?.uniquePlaces || 0],
          ['Trusted Visits', stats?.trustedVisits || 0],
          ['Suspicious Visits', stats?.suspiciousVisits || 0],
          ['Unique Users', stats?.uniqueUsers || 0],
          ['High Trust', stats?.trustBreakdown?.high || 0],
          ['Medium Trust', stats?.trustBreakdown?.medium || 0],
          ['Low Trust', stats?.trustBreakdown?.low || 0],
          ['Unverified', stats?.trustBreakdown?.unverified || 0],
          ['Suspicious', stats?.trustBreakdown?.suspicious || 0],
        ]
      } else if (section === 'users' && topUsers.length > 0) {
        csvData = [
          ['Rank', 'User', 'Email', 'TripScore', 'Unique Places'],
          ...topUsers.map((user, index) => [
            index + 1,
            user.fullName || user.username || 'Unknown',
            user.email || '',
            user.tripScore || 0,
            user.uniquePlaces || 0
          ])
        ]
      } else if (section === 'fraud' && suspiciousVisits.length > 0) {
        csvData = [
          ['User', 'Location', 'Source', 'Date', 'Reason'],
          ...suspiciousVisits.map(visit => [
            visit.user?.fullName || visit.user?.username || 'Unknown',
            visit.address || 'Unknown',
            visit.source || 'Unknown',
            new Date(visit.createdAt).toLocaleDateString(),
            visit.metadata?.flaggedReason || 'Impossible travel pattern'
          ])
        ]
      } else if (section === 'geography' && continentBreakdown.length > 0) {
        csvData = [
          ['Continent', 'Unique Places', 'Total Visits'],
          ...continentBreakdown.map(item => [
            item._id || 'Unknown',
            item.uniquePlaces || 0,
            item.totalVisits || 0
          ])
        ]
      } else if (section === 'locations' && detailedLocations.length > 0) {
        // Export based on groupBy
        if (locationsGroupBy === 'location') {
          csvData = [
            ['Location', 'Coordinates', 'Country', 'Continent', 'Visit Count', 'Unique Users'],
            ...detailedLocations.map(item => [
              item.address || 'Unknown',
              `${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}`,
              item.country || 'Unknown',
              item.continent || 'Unknown',
              item.visitCount || 0,
              item.uniqueUsers || 0
            ])
          ]
        } else if (locationsGroupBy === 'user') {
          csvData = [
            ['User', 'Unique Places', 'Total Visits'],
            ...detailedLocations.map(item => [
              item.fullName || item.username || 'Unknown',
              item.uniquePlaces || 0,
              item.totalVisits || 0
            ])
          ]
        } else if (locationsGroupBy === 'country') {
          csvData = [
            ['Country', 'Continent', 'Unique Places', 'Total Visits', 'Unique Users'],
            ...detailedLocations.map(item => [
              item.country || 'Unknown',
              item.continent || 'Unknown',
              item.uniquePlaces || 0,
              item.totalVisits || 0,
              item.uniqueUsers || 0
            ])
          ]
        }
      } else if (section === 'verification' && pendingReviews.length > 0) {
        csvData = [
          ['User', 'Email', 'Location', 'City', 'Country', 'Continent', 'Source', 'Reason', 'Uploaded At', 'Created At'],
          ...pendingReviews.map(review => [
            review.user?.fullName || review.user?.username || 'Unknown',
            review.user?.email || 'N/A',
            review.location?.address || 'Unknown',
            review.location?.city || 'Unknown',
            review.location?.country || 'Unknown',
            review.location?.continent || 'Unknown',
            review.source?.replace(/_/g, ' ') || 'Unknown',
            review.verificationReason === 'no_exif' ? 'No EXIF GPS data' :
            review.verificationReason === 'manual_location' ? 'Manual location only' :
            review.verificationReason === 'suspicious_pattern' ? 'Suspicious travel pattern' :
            'Requires review',
            new Date(review.uploadedAt).toLocaleString(),
            new Date(review.createdAt).toLocaleString()
          ])
        ]
      }
      
      if (csvData.length === 0) {
        if (isMountedRef.current) {
          toast.error('No data available to export')
        }
        setIsExporting(false)
        setExportSection(null)
        return
      }
      
      const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const sectionSuffix = section ? `-${section}` : ''
      a.download = `tripscore-analytics${sectionSuffix}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      
      if (isMountedRef.current) {
        toast.success(`Data exported successfully${section ? ` (${section})` : ''}`)
      }
    } catch (error) {
      logger.error('Export error:', error)
      if (isMountedRef.current) {
        toast.error('Failed to export data')
      }
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false)
        setExportSection(null)
      }
    }
  }, [stats, topUsers, suspiciousVisits, continentBreakdown, detailedLocations, locationsGroupBy, pendingReviews, isExporting])
  
  // Navigate with breadcrumb tracking
  const handleViewChange = useCallback((viewId, viewLabel) => {
    if (!isMountedRef.current) return
    
    setSelectedView(viewId)
    
    // Update breadcrumbs
    if (viewId === 'overview') {
      setBreadcrumbs([{ label: 'Overview', view: 'overview' }])
    } else {
      const newBreadcrumbs = [
        { label: 'Overview', view: 'overview' },
        { label: viewLabel || viewId, view: viewId }
      ]
      setBreadcrumbs(newBreadcrumbs)
    }
  }, [])
  
  // Navigate via breadcrumb
  const handleBreadcrumbClick = useCallback((view) => {
    if (!isMountedRef.current) return
    
    setSelectedView(view)
    if (view === 'overview') {
      setBreadcrumbs([{ label: 'Overview', view: 'overview' }])
    } else {
      const breadcrumbIndex = breadcrumbs.findIndex(b => b.view === view)
      if (breadcrumbIndex >= 0) {
        setBreadcrumbs(breadcrumbs.slice(0, breadcrumbIndex + 1))
      }
    }
  }, [breadcrumbs])
  
  // Handle approve TripVisit
  const handleApprove = useCallback(async (tripVisitId) => {
    if (reviewActionLoading) return
    
    try {
      setReviewActionLoading(tripVisitId)
      await approveTripVisit(tripVisitId)
      
      // Optimistically update UI
      setPendingReviews(prev => prev.filter(r => r._id !== tripVisitId))
      setPendingReviewsPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      
      toast.success('TripVisit approved successfully')
      
      // Refresh all data to sync all tabs
      setTimeout(() => {
        fetchPendingReviews().catch(err => logger.error('Failed to refresh pending reviews:', err))
        // Also refresh main analytics if on overview
        if (selectedView === 'overview') {
          fetchAllData(abortControllerRef.current?.signal).catch(err => logger.error('Failed to refresh analytics:', err))
        }
      }, 500)
    } catch (error) {
      logger.error('Failed to approve TripVisit:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to approve TripVisit'
      toast.error(errorMessage)
      
      // Refresh list on error to sync state
      fetchPendingReviews().catch(err => logger.error('Failed to refresh pending reviews:', err))
    } finally {
      setReviewActionLoading(null)
    }
  }, [reviewActionLoading, fetchPendingReviews, selectedView, fetchAllData])
  
  // Handle reject TripVisit
  const handleReject = useCallback(async (tripVisitId) => {
    if (reviewActionLoading) return
    
    try {
      setReviewActionLoading(tripVisitId)
      await rejectTripVisit(tripVisitId)
      
      // Optimistically update UI
      setPendingReviews(prev => prev.filter(r => r._id !== tripVisitId))
      setPendingReviewsPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      
      toast.success('TripVisit rejected successfully')
      
      // Refresh all data to sync all tabs
      setTimeout(() => {
        fetchPendingReviews().catch(err => logger.error('Failed to refresh pending reviews:', err))
        // Also refresh main analytics if on overview
        if (selectedView === 'overview') {
          fetchAllData(abortControllerRef.current?.signal).catch(err => logger.error('Failed to refresh analytics:', err))
        }
      }, 500)
    } catch (error) {
      logger.error('Failed to reject TripVisit:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reject TripVisit'
      toast.error(errorMessage)
      
      // Refresh list on error to sync state
      fetchPendingReviews().catch(err => logger.error('Failed to refresh pending reviews:', err))
    } finally {
      setReviewActionLoading(null)
    }
  }, [reviewActionLoading, fetchPendingReviews, selectedView, fetchAllData])

  // Handle open chat for TripVisit
  const handleOpenChat = useCallback(async (tripVisitId) => {
    try {
      const response = await api.get(`/api/v1/superadmin/tripscore/review/${tripVisitId}/support-chat`)
      
      if (response.data?.success && response.data?.conversationId) {
        // Navigate to Support Inbox and open the conversation
        navigate(`/support-inbox?conversationId=${response.data.conversationId}`)
        toast.success('Opening support chat...')
      } else {
        toast.error('Failed to open support chat')
      }
    } catch (error) {
      logger.error('Error opening support chat:', error)
      const parsedError = handleError(error)
      const errorMessage = parsedError?.adminMessage || parsedError?.message || 'Failed to open support chat'
      toast.error(errorMessage)
    }
  }, [navigate])
  
  // Handle view review details
  const handleViewReview = useCallback((review) => {
    setSelectedReview(review)
    setIsEditMode(false)
    setFailedImages(new Set()) // Clear failed images when opening a new review
    setEditFormData({
      country: review.location?.country || '',
      continent: review.location?.continent || '',
      address: review.location?.address || '',
      city: review.location?.city || '',
      verificationReason: review.verificationReason || '',
      lat: review.location?.coordinates?.latitude?.toString() || '',
      lng: review.location?.coordinates?.longitude?.toString() || ''
    })
    setIsViewModalOpen(true)
  }, [])
  
  // Close view modal
  const handleCloseViewModal = useCallback(() => {
    setIsViewModalOpen(false)
    setSelectedReview(null)
    setIsEditMode(false)
    setFailedImages(new Set()) // Clear failed images when closing modal
    setEditFormData({
      country: '',
      continent: '',
      address: '',
      city: '',
      verificationReason: '',
      lat: '',
      lng: ''
    })
  }, [])

  // Handle edit mode toggle
  const handleToggleEdit = useCallback(() => {
    setIsEditMode(prev => !prev)
  }, [])

  // Handle save edit
  const handleSaveEdit = useCallback(async () => {
    if (!selectedReview || reviewActionLoading) return
    
    try {
      setReviewActionLoading(selectedReview._id)
      
      const updates = {}
      if (editFormData.country !== selectedReview.location?.country) updates.country = editFormData.country
      if (editFormData.continent !== selectedReview.location?.continent) updates.continent = editFormData.continent
      if (editFormData.address !== selectedReview.location?.address) updates.address = editFormData.address
      if (editFormData.city !== selectedReview.location?.city) updates.city = editFormData.city
      if (editFormData.verificationReason !== selectedReview.verificationReason) updates.verificationReason = editFormData.verificationReason
      if (editFormData.lat !== selectedReview.location?.coordinates?.latitude?.toString()) updates.lat = parseFloat(editFormData.lat)
      if (editFormData.lng !== selectedReview.location?.coordinates?.longitude?.toString()) updates.lng = parseFloat(editFormData.lng)
      
      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save')
        setIsEditMode(false)
        return
      }
      
      await updateTripVisit(selectedReview._id, updates)
      
      // Update local state
      const updatedReview = {
        ...selectedReview,
        location: {
          ...selectedReview.location,
          country: updates.country !== undefined ? updates.country : selectedReview.location?.country,
          continent: updates.continent !== undefined ? updates.continent : selectedReview.location?.continent,
          address: updates.address !== undefined ? updates.address : selectedReview.location?.address,
          city: updates.city !== undefined ? updates.city : selectedReview.location?.city,
          coordinates: {
            latitude: updates.lat !== undefined ? updates.lat : selectedReview.location?.coordinates?.latitude,
            longitude: updates.lng !== undefined ? updates.lng : selectedReview.location?.coordinates?.longitude
          }
        },
        verificationReason: updates.verificationReason !== undefined ? updates.verificationReason : selectedReview.verificationReason
      }
      
      setSelectedReview(updatedReview)
      setPendingReviews(prev => prev.map(r => r._id === selectedReview._id ? updatedReview : r))
      setIsEditMode(false)
      
      toast.success('TripVisit updated successfully')
    } catch (error) {
      logger.error('Failed to update TripVisit:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update TripVisit'
      toast.error(errorMessage)
    } finally {
      setReviewActionLoading(null)
    }
  }, [selectedReview, editFormData, reviewActionLoading])
  
  // Handle approve/reject from modal
  const handleApproveFromModal = useCallback(async () => {
    if (!selectedReview) return
    await handleApprove(selectedReview._id)
    handleCloseViewModal()
  }, [selectedReview, handleApprove, handleCloseViewModal])
  
  const handleRejectFromModal = useCallback(async () => {
    if (!selectedReview) return
    await handleReject(selectedReview._id)
    handleCloseViewModal()
  }, [selectedReview, handleReject, handleCloseViewModal])
  
  // Calculate trend indicators (spikes/drops)
  const calculateTrends = useMemo(() => {
    if (!stats || !previousStats) return {}
    
    const trends = {}
    
    // Average TripScore trend
    const currentAvgScore = stats.totalVisits > 0 ? (stats.trustedVisits / stats.totalVisits) * 100 : 0
    const previousAvgScore = previousStats.totalVisits > 0 ? (previousStats.trustedVisits / previousStats.totalVisits) * 100 : 0
    const scoreDelta = currentAvgScore - previousAvgScore
    trends.avgTripScore = {
      value: Math.abs(scoreDelta).toFixed(1),
      direction: scoreDelta >= 0 ? 'up' : 'down',
      isAnomaly: Math.abs(scoreDelta) >= 20 // 20% change is significant
    }
    
    // Flagged trips trend
    const currentFlagged = stats.suspiciousVisits || 0
    const previousFlagged = previousStats.suspiciousVisits || 0
    const flaggedDelta = previousFlagged > 0 ? ((currentFlagged - previousFlagged) / previousFlagged) * 100 : 0
    trends.flaggedTrips = {
      value: Math.abs(flaggedDelta).toFixed(1),
      direction: flaggedDelta >= 0 ? 'up' : 'down',
      isAnomaly: Math.abs(flaggedDelta) >= 20 // 20% change is significant
    }
    
    return trends
  }, [stats, previousStats])
  

  // Calculate percentage changes
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return null
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.abs(change).toFixed(1),
      trend: change >= 0 ? 'up' : 'down',
      isPositive: change >= 0
    }
  }

  // Calculate trust score percentage
  const trustScorePercentage = useMemo(() => {
    if (!stats || !stats.totalVisits) return 0
    return ((stats.trustedVisits / stats.totalVisits) * 100).toFixed(1)
  }, [stats])

  // Calculate fraud rate
  const fraudRate = useMemo(() => {
    if (!stats || !stats.totalVisits) return 0
    return ((stats.suspiciousVisits / stats.totalVisits) * 100).toFixed(2)
  }, [stats])

  // Memoized chart data transformations (cached for performance)
  const trustTimelineChartData = useMemo(() => {
    const cacheKey = `timeline-${trustTimeline.length}-${JSON.stringify(trustTimeline.slice(0, 3))}`
    if (chartMemoCacheRef.current.has(cacheKey)) {
      return chartMemoCacheRef.current.get(cacheKey)
    }
    
    const data = trustTimeline.map(item => ({
      name: item.date,
      High: item.high || 0,
      Medium: item.medium || 0,
      Low: item.low || 0,
      Unverified: item.unverified || 0,
      Suspicious: item.suspicious || 0
    }))
    
    chartMemoCacheRef.current.set(cacheKey, data)
    return data
  }, [trustTimeline])

  // Memoized trust breakdown chart data
  const trustBreakdownChartData = useMemo(() => {
    if (!stats) return []
    
    const cacheKey = `trustBreakdown-${stats.trustBreakdown?.high}-${stats.trustBreakdown?.medium}`
    if (chartMemoCacheRef.current.has(cacheKey)) {
      return chartMemoCacheRef.current.get(cacheKey)
    }
    
    const data = [
      { name: 'High', value: stats.trustBreakdown?.high || 0, color: '#10B981' },
      { name: 'Medium', value: stats.trustBreakdown?.medium || 0, color: '#3B82F6' },
      { name: 'Low', value: stats.trustBreakdown?.low || 0, color: '#F59E0B' },
      { name: 'Unverified', value: stats.trustBreakdown?.unverified || 0, color: '#6B7280' },
      { name: 'Suspicious', value: stats.trustBreakdown?.suspicious || 0, color: '#EF4444' }
    ].filter(item => item.value > 0)
    
    chartMemoCacheRef.current.set(cacheKey, data)
    return data
  }, [stats])

  // Memoized source breakdown chart data
  const sourceBreakdownChartData = useMemo(() => {
    if (!stats) return []
    
    const cacheKey = `sourceBreakdown-${stats.sourceBreakdown?.taatom_camera_live}-${stats.sourceBreakdown?.gallery_exif}`
    if (chartMemoCacheRef.current.has(cacheKey)) {
      return chartMemoCacheRef.current.get(cacheKey)
    }
    
    const data = [
      { name: 'Taatom Camera', value: stats.sourceBreakdown?.taatom_camera_live || 0, color: '#10B981' },
      { name: 'Gallery (EXIF)', value: stats.sourceBreakdown?.gallery_exif || 0, color: '#3B82F6' },
      { name: 'Gallery (No EXIF)', value: stats.sourceBreakdown?.gallery_no_exif || 0, color: '#F59E0B' },
      { name: 'Manual Only', value: stats.sourceBreakdown?.manual_only || 0, color: '#6B7280' }
    ].filter(item => item.value > 0)
    
    chartMemoCacheRef.current.set(cacheKey, data)
    return data
  }, [stats])

  // Memoized continent chart data
  const continentChartData = useMemo(() => {
    const cacheKey = `continent-${continentBreakdown.length}-${JSON.stringify(continentBreakdown.slice(0, 2))}`
    if (chartMemoCacheRef.current.has(cacheKey)) {
      return chartMemoCacheRef.current.get(cacheKey)
    }
    
    const data = continentBreakdown.map(item => ({
      name: item._id || 'Unknown',
      places: item.uniquePlaces || 0,
      visits: item.totalVisits || 0
    }))
    
    chartMemoCacheRef.current.set(cacheKey, data)
    return data
  }, [continentBreakdown])

  // Calculate filtered totals based on active filters
  const filteredTotalVisits = useMemo(() => {
    if (!stats) return 0
    let total = 0
    Object.keys(trustLevelFilters).forEach(level => {
      if (trustLevelFilters[level]) {
        total += stats.trustBreakdown?.[level] || 0
      }
    })
    return total
  }, [stats, trustLevelFilters])

  const filteredSourceTotal = useMemo(() => {
    if (!stats) return 0
    let total = 0
    Object.keys(sourceFilters).forEach(source => {
      if (sourceFilters[source]) {
        total += stats.sourceBreakdown?.[source] || 0
      }
    })
    return total
  }, [stats, sourceFilters])

  // Enhanced KPI cards with animations and filtering - Memoized to prevent blinking
  const kpiCards = useMemo(() => {
    if (!stats) return []
    
    // Pre-calculate stable numeric values
    const totalVisits = Number(stats.totalVisits) || 0
    const trustedVisits = Number(stats.trustedVisits) || 0
    const uniquePlaces = Number(stats.uniquePlaces) || 0
    const suspiciousVisits = Number(stats.suspiciousVisits) || 0
    const uniqueUsers = Number(stats.uniqueUsers) || 0
    
    // Pre-calculate stable strings
    const totalVisitsStr = totalVisits.toLocaleString()
    const trustedVisitsStr = trustedVisits.toLocaleString()
    const uniquePlacesStr = uniquePlaces.toLocaleString()
    const suspiciousVisitsStr = suspiciousVisits.toLocaleString()
    const uniqueUsersStr = uniqueUsers.toLocaleString()
    const filteredTotalVisitsStr = filteredTotalVisits.toLocaleString()
    
    // Pre-calculate changes with stable references
    const totalVisitsChange = calculateChange(totalVisits, previousStats?.totalVisits)
    const uniquePlacesChange = calculateChange(uniquePlaces, previousStats?.uniquePlaces)
    const trustedVisitsChange = calculateChange(trustedVisits, previousStats?.trustedVisits)
    const suspiciousVisitsChange = calculateChange(suspiciousVisits, previousStats?.suspiciousVisits)
    const uniqueUsersChange = calculateChange(uniqueUsers, previousStats?.uniqueUsers)
    
    return [
      {
        title: 'Total Visits',
        value: showTotalsSeparately 
          ? `${totalVisitsStr} (All)`
          : totalVisitsStr,
        valueNum: totalVisits,
        icon: Globe,
        color: 'blue',
        bgGradient: 'from-blue-500 to-blue-600',
        change: totalVisitsChange,
        changeKey: totalVisitsChange ? `${totalVisitsChange.trend}-${totalVisitsChange.value}` : null,
        subtitle: showTotalsSeparately 
          ? `${trustedVisitsStr} trusted`
          : 'All recorded visits',
        showSeparate: showTotalsSeparately,
        detail: showTotalsSeparately ? `Filtered: ${filteredTotalVisitsStr}` : null
      },
      {
        title: 'Unique Places',
        value: uniquePlacesStr,
        valueNum: uniquePlaces,
        icon: MapPin,
        color: 'green',
        bgGradient: 'from-green-500 to-emerald-600',
        change: uniquePlacesChange,
        changeKey: uniquePlacesChange ? `${uniquePlacesChange.trend}-${uniquePlacesChange.value}` : null,
        subtitle: 'Distinct locations',
        detail: showTotalsSeparately ? `From ${trustedVisitsStr} trusted visits` : null
      },
      {
        title: 'Trusted Visits',
        value: trustedVisitsStr,
        valueNum: trustedVisits,
        icon: Shield,
        color: 'purple',
        bgGradient: 'from-purple-500 to-purple-600',
        change: trustedVisitsChange,
        changeKey: trustedVisitsChange ? `${trustedVisitsChange.trend}-${trustedVisitsChange.value}` : null,
        subtitle: `${trustScorePercentage}% trust score`,
        percentage: trustScorePercentage,
        detail: showTotalsSeparately ? `High: ${stats?.trustBreakdown?.high || 0} | Medium: ${stats?.trustBreakdown?.medium || 0}` : null
      },
      {
        title: 'Suspicious Visits',
        value: suspiciousVisitsStr,
        valueNum: suspiciousVisits,
        icon: AlertTriangle,
        color: 'red',
        bgGradient: 'from-red-500 to-red-600',
        change: suspiciousVisitsChange,
        changeKey: suspiciousVisitsChange ? `${suspiciousVisitsChange.trend}-${suspiciousVisitsChange.value}` : null,
        subtitle: `${fraudRate}% fraud rate`,
        detail: showTotalsSeparately ? `Out of ${totalVisitsStr} total` : null
      },
      {
        title: 'Active Users',
        value: uniqueUsersStr,
        valueNum: uniqueUsers,
        icon: Users,
        color: 'indigo',
        bgGradient: 'from-indigo-500 to-indigo-600',
        change: uniqueUsersChange,
        changeKey: uniqueUsersChange ? `${uniqueUsersChange.trend}-${uniqueUsersChange.value}` : null,
        subtitle: 'Users with visits',
        detail: showTotalsSeparately && uniqueUsers > 0 
          ? `Avg ${Math.round(trustedVisits / uniqueUsers)} trusted visits/user` 
          : null
      },
      {
        title: 'Trust Score',
        value: `${trustScorePercentage}%`,
        valueNum: trustScorePercentage,
        icon: Award,
        color: 'amber',
        bgGradient: 'from-amber-500 to-amber-600',
        subtitle: 'High + Medium trust',
        isPercentage: true,
        detail: showTotalsSeparately 
          ? `High: ${stats?.trustBreakdown?.high || 0} + Medium: ${stats?.trustBreakdown?.medium || 0}` 
          : null
      }
    ]
  }, [
    stats?.totalVisits,
    stats?.trustedVisits,
    stats?.uniquePlaces,
    stats?.suspiciousVisits,
    stats?.uniqueUsers,
    stats?.trustBreakdown?.high,
    stats?.trustBreakdown?.medium,
    previousStats?.totalVisits,
    previousStats?.trustedVisits,
    previousStats?.uniquePlaces,
    previousStats?.suspiciousVisits,
    previousStats?.uniqueUsers,
    showTotalsSeparately,
    filteredTotalVisits,
    trustScorePercentage,
    fraudRate
  ])

  // Additional detailed breakdown cards
  const breakdownCards = [
    {
      title: 'High Trust',
      value: stats?.trustBreakdown?.high?.toLocaleString() || 0,
      icon: CheckCircle,
      color: 'green',
      percentage: stats?.totalVisits ? ((stats.trustBreakdown?.high || 0) / stats.totalVisits * 100).toFixed(1) : 0,
      description: 'Taatom camera with live GPS',
      bgGradient: 'from-green-400 to-emerald-500'
    },
    {
      title: 'Medium Trust',
      value: stats?.trustBreakdown?.medium?.toLocaleString() || 0,
      icon: Shield,
      color: 'blue',
      percentage: stats?.totalVisits ? ((stats.trustBreakdown?.medium || 0) / stats.totalVisits * 100).toFixed(1) : 0,
      description: 'Gallery with EXIF GPS',
      bgGradient: 'from-blue-400 to-indigo-500'
    },
    {
      title: 'Low Trust',
      value: stats?.trustBreakdown?.low?.toLocaleString() || 0,
      icon: ImageIcon,
      color: 'yellow',
      percentage: stats?.totalVisits ? ((stats.trustBreakdown?.low || 0) / stats.totalVisits * 100).toFixed(1) : 0,
      description: 'Gallery without EXIF',
      bgGradient: 'from-yellow-400 to-amber-500'
    },
    {
      title: 'Unverified',
      value: stats?.trustBreakdown?.unverified?.toLocaleString() || 0,
      icon: XCircle,
      color: 'gray',
      percentage: stats?.totalVisits ? ((stats.trustBreakdown?.unverified || 0) / stats.totalVisits * 100).toFixed(1) : 0,
      description: 'Manual location only',
      bgGradient: 'from-gray-400 to-slate-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      {breadcrumbs.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.view}>
              {index > 0 && <ChevronRight className="w-4 h-4" />}
              <button
                onClick={() => handleBreadcrumbClick(crumb.view)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  index === breadcrumbs.length - 1
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {index === 0 ? <Home className="w-4 h-4 inline mr-1" /> : null}
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
      
      {/* Enhanced Header with Gradient */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 text-white shadow-xl"
      >
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Globe className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-bold">TripScore Analytics</h1>
                    {/* Trust Health Indicator */}
                    {trustHealth && (
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        trustHealth === 'healthy' 
                          ? 'bg-green-500/20 text-green-100 border border-green-300/30'
                          : trustHealth === 'warning'
                          ? 'bg-yellow-500/20 text-yellow-100 border border-yellow-300/30'
                          : 'bg-red-500/20 text-red-100 border border-red-300/30'
                      }`}>
                        {trustHealth === 'healthy' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : trustHealth === 'warning' ? (
                          <AlertCircle className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {trustHealth === 'healthy' ? 'Healthy' : trustHealth === 'warning' ? 'Warning' : 'Risk'}
                      </span>
                    )}
                  </div>
                  <p className="text-blue-100 text-lg">
                    Verified travel-based scoring system insights and fraud monitoring
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/70" />
                <select
                  className="pl-10 pr-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer appearance-none"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="7d" className="text-gray-900">Last 7 days</option>
                  <option value="30d" className="text-gray-900">Last 30 days</option>
                  <option value="90d" className="text-gray-900">Last 90 days</option>
                  <option value="1y" className="text-gray-900">Last year</option>
                </select>
              </div>
              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white font-medium hover:bg-white/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="relative">
                <button 
                  onClick={() => handleExport(selectedView === 'overview' ? null : selectedView)}
                  disabled={
                    (selectedView === 'verification' 
                      ? (!pendingReviews || pendingReviews.length === 0)
                      : !stats) || loading || isExporting
                  }
                  className="px-4 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
                  {isExporting ? 'Exporting...' : `Export${selectedView !== 'overview' ? ` ${selectedView === 'verification' ? ' verification' : ` ${selectedView}`}` : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-4"
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-700">Quick Filters:</span>
          </div>
          
          {/* Show Totals Separately Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showTotalsSeparately}
              onChange={(e) => setShowTotalsSeparately(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show totals separately</span>
          </label>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200 space-y-4"
          >
            {/* Trust Level Filters */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Trust Levels:</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(trustLevelFilters).map((level) => (
                  <label key={level} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={trustLevelFilters[level]}
                      onChange={(e) => setTrustLevelFilters(prev => ({ ...prev, [level]: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{level}</span>
                    {stats && (
                      <span className="text-xs text-gray-500">
                        ({stats.trustBreakdown?.[level]?.toLocaleString() || 0})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Source Type Filters */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Source Types:</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'taatom_camera_live', label: 'Taatom Camera' },
                  { key: 'gallery_exif', label: 'Gallery (EXIF)' },
                  { key: 'gallery_no_exif', label: 'Gallery (No EXIF)' },
                  { key: 'manual_only', label: 'Manual Only' }
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={sourceFilters[key]}
                      onChange={(e) => setSourceFilters(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                    {stats && (
                      <span className="text-xs text-gray-500">
                        ({stats.sourceBreakdown?.[key]?.toLocaleString() || 0})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* View Tabs with Error Indicators */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'users', label: 'Top Users', icon: Award },
          { id: 'fraud', label: 'Fraud Monitor', icon: AlertTriangle },
          { id: 'geography', label: 'Geography', icon: Globe },
          { id: 'locations', label: 'Detailed Locations', icon: MapPin },
          { id: 'verification', label: 'Pending Verification', icon: Clock }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleViewChange(tab.id, tab.label)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedView === tab.id
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {dataErrors[tab.id === 'overview' ? 'stats' : tab.id === 'users' ? 'topUsers' : tab.id === 'fraud' ? 'suspiciousVisits' : tab.id === 'geography' ? 'continentBreakdown' : tab.id === 'locations' ? 'detailedLocations' : 'pendingReviews'] && (
              <AlertCircle className="w-3 h-3 text-red-500 absolute -top-1 -right-1" />
            )}
          </button>
        ))}
      </div>
      
      {/* Trend & Anomaly Indicators */}
      {calculateTrends.avgTripScore && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-md border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-700">Trend Indicators</span>
            </div>
            <div className="flex gap-4 flex-wrap">
              {calculateTrends.avgTripScore && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                  calculateTrends.avgTripScore.isAnomaly 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  {calculateTrends.avgTripScore.direction === 'up' ? (
                    <TrendingUp className={`w-4 h-4 ${calculateTrends.avgTripScore.isAnomaly ? 'text-red-600' : 'text-blue-600'}`} />
                  ) : (
                    <TrendingDown className={`w-4 h-4 ${calculateTrends.avgTripScore.isAnomaly ? 'text-red-600' : 'text-blue-600'}`} />
                  )}
                  <span className={`text-sm font-medium ${calculateTrends.avgTripScore.isAnomaly ? 'text-red-700' : 'text-blue-700'}`}>
                    Avg TripScore: {calculateTrends.avgTripScore.value}% {calculateTrends.avgTripScore.direction === 'up' ? '↑' : '↓'}
                    {calculateTrends.avgTripScore.isAnomaly && <span className="ml-1 text-xs">⚠️ Anomaly</span>}
                  </span>
                </div>
              )}
              {calculateTrends.flaggedTrips && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                  calculateTrends.flaggedTrips.isAnomaly 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  {calculateTrends.flaggedTrips.direction === 'up' ? (
                    <TrendingUp className={`w-4 h-4 ${calculateTrends.flaggedTrips.isAnomaly ? 'text-red-600' : 'text-yellow-600'}`} />
                  ) : (
                    <TrendingDown className={`w-4 h-4 ${calculateTrends.flaggedTrips.isAnomaly ? 'text-red-600' : 'text-yellow-600'}`} />
                  )}
                  <span className={`text-sm font-medium ${calculateTrends.flaggedTrips.isAnomaly ? 'text-red-700' : 'text-yellow-700'}`}>
                    Flagged Trips: {calculateTrends.flaggedTrips.value}% {calculateTrends.flaggedTrips.direction === 'up' ? '↑' : '↓'}
                    {calculateTrends.flaggedTrips.isAnomaly && <span className="ml-1 text-xs">⚠️ Anomaly</span>}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Enhanced KPI Cards Grid */}
      {selectedView === 'overview' && loadedSections.has('overview') && (
        <>
          {/* Error indicator for overview */}
          {dataErrors.stats && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Stats data unavailable</p>
                <p className="text-xs text-yellow-700">{dataErrors.stats}</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {kpiCards.map((card, index) => (
              <motion.div
                key={`${card.title}-${card.valueNum || card.value}-${card.changeKey || 'no-change'}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:scale-[1.02]">
                  <div className={`bg-gradient-to-br ${card.bgGradient} p-6 text-white relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-white/80 text-sm font-medium mb-1">{card.title}</p>
                          <p className="text-3xl font-bold mb-2">{card.value}</p>
                          <p className="text-white/70 text-xs mb-1">{card.subtitle}</p>
                          {card.detail && (
                            <p className="text-white/60 text-xs mt-1 italic">{card.detail}</p>
                          )}
                          {card.change && (
                            <div className="flex items-center gap-1 mt-2">
                              {card.change.trend === 'up' ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              <span className="text-xs font-semibold">
                                {card.change.value}% {card.change.trend === 'up' ? '↑' : '↓'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                          <card.icon className="w-6 h-6" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Trust Score Progress Bar - Enhanced */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Trust Score Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Trust Score</span>
                    <span className="text-sm font-bold text-purple-600">{trustScorePercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${trustScorePercentage}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                      className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 rounded-full shadow-lg"
                    />
                  </div>
                  {showTotalsSeparately && (
                    <div className="mt-2 text-xs text-gray-500">
                      Based on {stats?.trustedVisits || 0} trusted visits out of {stats?.totalVisits || 0} total
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t">
                  {trustBreakdownChartData.map((item) => {
                    const percentage = stats?.totalVisits ? ((item.value / stats.totalVisits) * 100).toFixed(1) : 0
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="text-2xl font-bold" style={{ color: item.color }}>
                          {percentage}%
                        </div>
                        <div className="text-xs text-gray-600 mt-1 font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.value.toLocaleString()} visits</div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Trust Level Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {breakdownCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className={`bg-gradient-to-br ${card.bgGradient} p-5 text-white`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                        <card.icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                        {card.percentage}%
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">{card.value}</h3>
                    <p className="text-white/90 text-sm font-medium mb-1">{card.title}</p>
                    <p className="text-white/70 text-xs">{card.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Source Type Breakdown Cards */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-green-600" />
                Source Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {sourceBreakdownChartData.map((item, index) => {
                  const percentage = stats?.totalVisits ? ((item.value / stats.totalVisits) * 100).toFixed(1) : 0
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-xs font-semibold text-gray-600">{percentage}%</span>
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">{item.value.toLocaleString()}</h4>
                      <p className="text-sm text-gray-600">{item.name}</p>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
            {/* Trust Level Breakdown */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  Trust Level Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {trustBreakdownChartData.length > 0 ? (
                  <MemoizedPieChart 
                    data={trustBreakdownChartData}
                    dataKey="value"
                    nameKey="name"
                    height={350}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-gray-500">
                    <div className="text-center">
                      <Shield className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Source Type Breakdown */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-green-600" />
                  Source Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {sourceBreakdownChartData.length > 0 ? (
                  <MemoizedPieChart 
                    data={sourceBreakdownChartData}
                    dataKey="value"
                    nameKey="name"
                    height={350}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-gray-500">
                    <div className="text-center">
                      <Camera className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trust Timeline Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Trust Level Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {trustTimelineChartData.length > 0 ? (
                <MemoizedLineChart
                  data={trustTimelineChartData}
                  dataKeys={['High', 'Medium', 'Low', 'Unverified', 'Suspicious']}
                  xAxisKey="name"
                  height={450}
                />
              ) : (
                <div className="flex items-center justify-center h-[450px] text-gray-500">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Top Users View */}
      {selectedView === 'users' && loadedSections.has('users') && (
        <>
          {dataErrors.topUsers && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Top users data unavailable</p>
                <p className="text-xs text-yellow-700">{dataErrors.topUsers}</p>
              </div>
            </div>
          )}
          <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Top Travelers Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        TripScore
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Unique Places
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topUsers.map((user, index) => (
                      <motion.tr
                        key={user.userId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {index < 3 ? (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                                index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                                index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                                'bg-gradient-to-br from-amber-600 to-amber-800'
                              }`}>
                                {index + 1}
                              </div>
                            ) : (
                              <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {user.profilePic ? (
                              <img
                                className="h-12 w-12 rounded-full ring-2 ring-gray-200"
                                src={user.profilePic}
                                alt={user.fullName}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ring-2 ring-gray-200">
                                <Users className="w-6 h-6 text-white" />
                              </div>
                            )}
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">
                                {user.fullName || user.username || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {user.tripScore?.toLocaleString() || 0}
                            </span>
                            <Award className="w-4 h-4 text-amber-500" />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-gray-900">
                              {user.uniquePlaces?.toLocaleString() || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No users found</p>
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {/* Fraud Monitor View */}
      {selectedView === 'fraud' && loadedSections.has('fraud') && (
        <>
          {dataErrors.suspiciousVisits && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Suspicious visits data unavailable</p>
                <p className="text-xs text-yellow-700">{dataErrors.suspiciousVisits}</p>
              </div>
            </div>
          )}
          <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Suspicious Visits Monitor
              {stats?.suspiciousVisits > 0 && (
                <span className="ml-auto px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                  {stats.suspiciousVisits} Flagged
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suspiciousVisits.length > 0 ? (
              <>
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-900">Fraud Detection Active</p>
                      <p className="text-sm text-red-700 mt-1">
                        {fraudRate}% of visits flagged as suspicious. Review these cases for potential fraud patterns.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {suspiciousVisits.map((visit) => (
                        <tr key={visit._id} className="hover:bg-red-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {visit.user?.profilePic ? (
                                <img
                                  className="h-10 w-10 rounded-full ring-2 ring-red-200"
                                  src={visit.user.profilePic}
                                  alt={visit.user.fullName}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center ring-2 ring-red-200">
                                  <Users className="w-5 h-5 text-red-600" />
                                </div>
                              )}
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {visit.user?.fullName || visit.user?.username || 'Unknown'}
                                </div>
                                <div className="text-sm text-gray-500">{visit.user?.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{visit.address || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">
                              {visit.country}, {visit.continent}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              {visit.source?.replace(/_/g, ' ') || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(visit.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              {visit.metadata?.flaggedReason || 'Impossible travel pattern'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-blue-600 hover:text-blue-800 font-medium">
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <button
                    onClick={() => setSuspiciousPage(prev => Math.max(1, prev - 1))}
                    disabled={suspiciousPage === 1}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {suspiciousPage}
                  </span>
                  <button
                    onClick={() => setSuspiciousPage(prev => prev + 1)}
                    disabled={suspiciousVisits.length < 20}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-300" />
                <p className="text-lg font-medium text-green-600">No suspicious visits found</p>
                <p className="text-sm text-gray-500 mt-2">All visits appear legitimate</p>
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {/* Geography View */}
      {selectedView === 'geography' && loadedSections.has('geography') && (
        <>
          {dataErrors.continentBreakdown && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Geography data unavailable</p>
                <p className="text-xs text-yellow-700">{dataErrors.continentBreakdown}</p>
              </div>
            </div>
          )}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-600" />
                Continent Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {continentChartData.length > 0 ? (
                <MemoizedBarChart
                  data={continentChartData}
                  dataKeys={['places', 'visits']}
                  xAxisKey="name"
                  height={450}
                />
              ) : (
                <div className="flex items-center justify-center h-[450px] text-gray-500">
                  <div className="text-center">
                    <Globe className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Continent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {continentChartData.slice(0, 8).map((continent, index) => (
              <motion.div
                key={continent.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-0 shadow-md hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg">
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{continent.name}</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Places:</span>
                        <span className="font-semibold text-gray-900">{continent.places.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Visits:</span>
                        <span className="font-semibold text-gray-900">{continent.visits.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Detailed Locations View */}
      {selectedView === 'locations' && loadedSections.has('locations') && (
        <>
          {dataErrors.detailedLocations && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Detailed locations data unavailable</p>
                <p className="text-xs text-yellow-700">{dataErrors.detailedLocations}</p>
              </div>
            </div>
          )}
          {/* Group By Selector */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  Detailed Locations View
                </CardTitle>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Group By:</label>
                  <select
                    value={locationsGroupBy}
                    onChange={(e) => {
                      setLocationsGroupBy(e.target.value)
                      setLocationsPagination(prev => ({ ...prev, page: 1 }))
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="location">Location</option>
                    <option value="user">User</option>
                    <option value="country">Country</option>
                    <option value="state">State/Province</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {detailedLocations.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {locationsGroupBy === 'location' && (
                            <>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Coordinates</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Continent/Country</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Visit Count</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unique Users</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">First Visit</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Visit</th>
                            </>
                          )}
                          {locationsGroupBy === 'user' && (
                            <>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unique Places</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Visits</th>
                            </>
                          )}
                          {locationsGroupBy === 'country' && (
                            <>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Country</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Continent</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unique Places</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Visits</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unique Users</th>
                            </>
                          )}
                          {locationsGroupBy === 'state' && (
                            <>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">State/Province</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Country</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Continent</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unique Places</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Visits</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unique Users</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {detailedLocations.map((item, index) => (
                          <motion.tr
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            {locationsGroupBy === 'location' && (
                              <>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-900">{item.address || 'Unknown Location'}</div>
                                  {item.city && <div className="text-sm text-gray-500">{item.city}</div>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-900">{item.country || 'Unknown'}</div>
                                  <div className="text-sm text-gray-500">{item.continent || 'Unknown'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {item.visitCount || 0}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.uniqueUsers || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {item.firstVisit ? new Date(item.firstVisit).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {item.lastVisit ? new Date(item.lastVisit).toLocaleDateString() : 'N/A'}
                                </td>
                              </>
                            )}
                            {locationsGroupBy === 'user' && (
                              <>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {item.profilePic ? (
                                      <img
                                        className="h-10 w-10 rounded-full ring-2 ring-gray-200"
                                        src={item.profilePic}
                                        alt={item.fullName}
                                      />
                                    ) : (
                                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ring-2 ring-gray-200">
                                        <Users className="w-5 h-5 text-white" />
                                      </div>
                                    )}
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">
                                        {item.fullName || item.username || 'Unknown'}
                                      </div>
                                      <div className="text-sm text-gray-500">{item.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    {item.uniquePlaces || 0}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.totalVisits || 0}
                                </td>
                              </>
                            )}
                            {locationsGroupBy === 'country' && (
                              <>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-900">{item.country || 'Unknown'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-500">{item.continent || 'Unknown'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    {item.uniquePlaces || 0}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.totalVisits || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.uniqueUsers || 0}
                                </td>
                              </>
                            )}
                            {locationsGroupBy === 'state' && (
                              <>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-900">{item.state || 'Unknown'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-700">{item.country || 'Unknown'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-500">{item.continent || 'Unknown'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    {item.uniquePlaces || 0}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.totalVisits || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.uniqueUsers || 0}
                                </td>
                              </>
                            )}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      Showing {((locationsPagination.page - 1) * locationsPagination.limit) + 1} to {Math.min(locationsPagination.page * locationsPagination.limit, locationsPagination.total)} of {locationsPagination.total} results
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLocationsPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={locationsPagination.page === 1}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-2 text-sm text-gray-700">
                        Page {locationsPagination.page} of {locationsPagination.totalPages || 1}
                      </span>
                      <button
                        onClick={() => setLocationsPagination(prev => ({ ...prev, page: Math.min(prev.totalPages || 1, prev.page + 1) }))}
                        disabled={locationsPagination.page >= (locationsPagination.totalPages || 1)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No locations found</p>
                  <p className="text-sm text-gray-400 mt-2">Try adjusting your filters or date range</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Pending Verification View */}
      {selectedView === 'verification' && loadedSections.has('verification') && (
        <>
          {dataErrors.pendingReviews && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Pending reviews data unavailable</p>
                <p className="text-xs text-yellow-700">{dataErrors.pendingReviews}</p>
              </div>
            </div>
          )}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Pending Verification
                {pendingReviewsPagination.total > 0 && (
                  <span className="ml-auto px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                    {pendingReviewsPagination.total} Pending
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingReviews.length > 0 ? (
                <>
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Review Required</p>
                        <p className="text-sm text-blue-700 mt-1">
                          These posts require manual verification. Approve if location is valid, reject if not.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Location
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Source
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Reason
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Uploaded At
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingReviews.map((review) => (
                          <motion.tr
                            key={review._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="hover:bg-amber-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {review.user?.profilePic ? (
                                  <img
                                    className="h-10 w-10 rounded-full ring-2 ring-amber-200"
                                    src={review.user.profilePic}
                                    alt={review.user.fullName}
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center ring-2 ring-amber-200">
                                    <Users className="w-5 h-5 text-amber-600" />
                                  </div>
                                )}
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">
                                    {review.user?.fullName || review.user?.username || 'Unknown'}
                                  </div>
                                  <div className="text-sm text-gray-500">{review.user?.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{review.location?.address || 'Unknown'}</div>
                              <div className="text-sm text-gray-500">
                                {review.location?.city && `${review.location.city}, `}
                                {review.location?.country}, {review.location?.continent}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                {review.source?.replace(/_/g, ' ') || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                {review.verificationReason === 'no_exif' && 'No EXIF GPS data'}
                                {review.verificationReason === 'manual_location' && 'Manual location only'}
                                {review.verificationReason === 'suspicious_pattern' && 'Suspicious travel pattern'}
                                {!review.verificationReason && 'Requires review'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(review.uploadedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleViewReview(review)}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </button>
                                <button
                                  onClick={() => handleOpenChat(review._id)}
                                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                                  title="Open Support Chat"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Chat
                                </button>
                                <button
                                  onClick={() => handleApprove(review._id)}
                                  disabled={reviewActionLoading === review._id}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                  {reviewActionLoading === review._id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(review._id)}
                                  disabled={reviewActionLoading === review._id}
                                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                  {reviewActionLoading === review._id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                  Reject
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      Showing {((pendingReviewsPagination.page - 1) * pendingReviewsPagination.limit) + 1} to {Math.min(pendingReviewsPagination.page * pendingReviewsPagination.limit, pendingReviewsPagination.total)} of {pendingReviewsPagination.total} results
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingReviewsPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pendingReviewsPagination.page === 1}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-2 text-sm text-gray-700">
                        Page {pendingReviewsPagination.page} of {pendingReviewsPagination.totalPages || 1}
                      </span>
                      <button
                        onClick={() => setPendingReviewsPagination(prev => ({ ...prev, page: Math.min(prev.totalPages || 1, prev.page + 1) }))}
                        disabled={pendingReviewsPagination.page >= (pendingReviewsPagination.totalPages || 1)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-300" />
                  <p className="text-lg font-medium text-green-600">No pending reviews</p>
                  <p className="text-sm text-gray-400 mt-2">All posts are verified or auto-verified</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Loading placeholder for lazy-loaded sections */}
      {!loadedSections.has(selectedView) && (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl shadow-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading {selectedView} data...</p>
          </div>
        </div>
      )}
      
      {/* View Review Modal */}
      {isViewModalOpen && selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-600" />
                <h2 className="text-xl font-bold text-gray-900">Review Details</h2>
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                  {selectedReview.verificationReason === 'no_exif' && 'No EXIF GPS'}
                  {selectedReview.verificationReason === 'manual_location' && 'Manual Location'}
                  {selectedReview.verificationReason === 'suspicious_pattern' && 'Suspicious Pattern'}
                </span>
              </div>
              <button
                onClick={handleCloseViewModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
              {/* User Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  User Information
                </h3>
                <div className="flex items-center gap-4">
                  {selectedReview.user?.profilePic ? (
                    <img
                      className="h-16 w-16 rounded-full ring-2 ring-amber-200"
                      src={selectedReview.user.profilePic}
                      alt={selectedReview.user.fullName}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center ring-2 ring-amber-200">
                      <Users className="w-8 h-8 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedReview.user?.fullName || selectedReview.user?.username || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-600">{selectedReview.user?.email || 'No email'}</p>
                    <p className="text-xs text-gray-500 mt-1">User ID: {selectedReview.user?._id || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              {/* Post Images */}
              {selectedReview.post && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Post Content
                  </h3>
                  <div className="space-y-3">
                    {selectedReview.post.caption && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Caption</p>
                        <p className="text-sm text-gray-900 bg-white p-3 rounded border">{selectedReview.post.caption}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedReview.post.images && selectedReview.post.images.length > 0 ? (
                        selectedReview.post.images.map((imageUrl, idx) => {
                          const imageKey = `image-${idx}-${imageUrl}`
                          const hasError = failedImages.has(imageKey)
                          return (
                            <div key={idx} className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100">
                              {hasError ? (
                                <div className="w-full h-48 flex flex-col items-center justify-center text-gray-400">
                                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                  <p className="text-xs">Image not available</p>
                                </div>
                              ) : (
                                <img
                                  src={imageUrl}
                                  alt={`Post image ${idx + 1}`}
                                  className="w-full h-48 object-cover"
                                  onError={() => {
                                    setFailedImages(prev => new Set([...prev, imageKey]))
                                  }}
                                />
                              )}
                            </div>
                          )
                        })
                      ) : selectedReview.post.type === 'short' && selectedReview.post.thumbnailUrl ? (
                        (() => {
                          const imageKey = `short-thumbnail-${selectedReview.post.thumbnailUrl}`
                          const hasError = failedImages.has(imageKey)
                          return (
                            <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100">
                              {hasError ? (
                                <div className="w-full h-48 flex flex-col items-center justify-center text-gray-400">
                                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                  <p className="text-xs">Thumbnail not available</p>
                                </div>
                              ) : (
                                <img
                                  src={selectedReview.post.thumbnailUrl}
                                  alt="Short thumbnail"
                                  className="w-full h-48 object-cover"
                                  onError={() => {
                                    setFailedImages(prev => new Set([...prev, imageKey]))
                                  }}
                                />
                              )}
                            </div>
                          )
                        })()
                      ) : selectedReview.post.imageUrl ? (
                        (() => {
                          const imageKey = `single-image-${selectedReview.post.imageUrl}`
                          const hasError = failedImages.has(imageKey)
                          return (
                            <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100">
                              {hasError ? (
                                <div className="w-full h-48 flex flex-col items-center justify-center text-gray-400">
                                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                  <p className="text-xs">Image not available</p>
                                </div>
                              ) : (
                                <img
                                  src={selectedReview.post.imageUrl}
                                  alt="Post image"
                                  className="w-full h-48 object-cover"
                                  onError={() => {
                                    setFailedImages(prev => new Set([...prev, imageKey]))
                                  }}
                                />
                              )}
                            </div>
                          )
                        })()
                      ) : (
                        <div className="col-span-2 text-center py-8 text-gray-400">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No image available</p>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Posted: {new Date(selectedReview.post.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Location Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location Details
                  </h3>
                  {!isEditMode && (
                    <button
                      onClick={handleToggleEdit}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>
                {isEditMode ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Address</label>
                      <input
                        type="text"
                        value={editFormData.address}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">City</label>
                      <input
                        type="text"
                        value={editFormData.city}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Country</label>
                      <input
                        type="text"
                        value={editFormData.country}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, country: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Continent</label>
                      <select
                        value={editFormData.continent}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, continent: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Continent</option>
                        <option value="ASIA">ASIA</option>
                        <option value="AFRICA">AFRICA</option>
                        <option value="NORTH AMERICA">NORTH AMERICA</option>
                        <option value="SOUTH AMERICA">SOUTH AMERICA</option>
                        <option value="AUSTRALIA">AUSTRALIA</option>
                        <option value="EUROPE">EUROPE</option>
                        <option value="ANTARCTICA">ANTARCTICA</option>
                        <option value="Unknown">Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={editFormData.lat}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, lat: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={editFormData.lng}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, lng: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Address</p>
                      <p className="text-sm font-medium text-gray-900">{selectedReview.location?.address || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">City</p>
                      <p className="text-sm font-medium text-gray-900">{selectedReview.location?.city || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Country</p>
                      <p className="text-sm font-medium text-gray-900">{selectedReview.location?.country || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Continent</p>
                      <p className="text-sm font-medium text-gray-900">{selectedReview.location?.continent || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Coordinates</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedReview.location?.coordinates?.latitude !== 0 && selectedReview.location?.coordinates?.longitude !== 0
                          ? `${selectedReview.location.coordinates.latitude.toFixed(6)}, ${selectedReview.location.coordinates.longitude.toFixed(6)}`
                          : 'Manual Location (0, 0)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Uploaded At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selectedReview.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Verification Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Verification Information
                </h3>
                {isEditMode ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Source</label>
                      <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        {selectedReview.source?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Reason for Review</label>
                      <select
                        value={editFormData.verificationReason}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, verificationReason: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Reason</option>
                        <option value="no_exif">No EXIF GPS data</option>
                        <option value="manual_location">Manual location only</option>
                        <option value="suspicious_pattern">Suspicious travel pattern</option>
                        <option value="photo_requires_review">Photo requires review</option>
                        <option value="gallery_exif_requires_review">Gallery EXIF requires review</option>
                        <option value="photo_from_camera_requires_review">Photo from camera requires review</option>
                        <option value="requires_admin_review">Requires admin review</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Created At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selectedReview.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Review ID</p>
                      <p className="text-sm font-mono text-gray-600 text-xs break-all">{selectedReview._id}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Source</p>
                      <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        {selectedReview.source?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reason for Review</p>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {selectedReview.verificationReason === 'no_exif' && 'No EXIF GPS data'}
                          {selectedReview.verificationReason === 'manual_location' && 'Manual location only'}
                          {selectedReview.verificationReason === 'suspicious_pattern' && 'Suspicious travel pattern'}
                          {selectedReview.verificationReason === 'photo_requires_review' && 'Photo requires review'}
                          {selectedReview.verificationReason === 'gallery_exif_requires_review' && 'Gallery EXIF requires review'}
                          {selectedReview.verificationReason === 'photo_from_camera_requires_review' && 'Photo from camera requires review'}
                          {selectedReview.verificationReason === 'requires_admin_review' && 'Requires admin review'}
                          {!selectedReview.verificationReason && 'Requires review'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Created At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selectedReview.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Review ID</p>
                      <p className="text-sm font-mono text-gray-600 text-xs break-all">{selectedReview._id}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                {isEditMode ? (
                  <>
                    <button
                      onClick={handleToggleEdit}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={reviewActionLoading === selectedReview._id}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {reviewActionLoading === selectedReview._id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCloseViewModal}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleRejectFromModal}
                      disabled={reviewActionLoading === selectedReview._id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {reviewActionLoading === selectedReview._id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Reject
                    </button>
                    <button
                      onClick={handleApproveFromModal}
                      disabled={reviewActionLoading === selectedReview._id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {reviewActionLoading === selectedReview._id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default TripScoreAnalytics
