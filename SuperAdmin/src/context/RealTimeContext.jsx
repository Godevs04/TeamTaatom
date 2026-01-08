import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/api'
import { socketService } from '../services/socketService'
import toast from 'react-hot-toast'
import logger from '../utils/logger'

const RealTimeContext = createContext()

export const useRealTime = () => {
  const context = useContext(RealTimeContext)
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider')
  }
  return context
}

export const RealTimeProvider = ({ children }) => {
  // Initialize empty data structure
  const initialEmptyData = {
    metrics: {
      totalUsers: 0,
      activeUsers: 0,
      totalPosts: 0,
      totalShorts: 0,
      userGrowth: { weeklyGrowth: 0 },
      contentGrowth: { weeklyGrowth: 0 }
    },
    recentActivity: { users: [], posts: [] },
    aiInsights: []
  }
  
  // Cache for dashboard data to show on partial failures
  // Initialize with empty data to prevent infinite loading
  const cachedDashboardDataRef = useRef(initialEmptyData)
  
  // Initialize with empty data to prevent infinite loading
  // This will be replaced with real data once fetch completes
  const [dashboardData, setDashboardData] = useState(initialEmptyData)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [reports, setReports] = useState([])
  const [featureFlags, setFeatureFlags] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  
  // Auto-refresh enabled state (default: false, loaded from localStorage)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('dashboard_auto_refresh')
    return saved === 'true'
  })
  const dashboardDataErrorsRef = useRef({})
  
  // Previous dashboard data for spike detection
  const previousDashboardDataRef = useRef(null)
  
  // Store socket handlers for cleanup
  const socketHandlersRef = useRef({})
  
  // Request deduplication refs to prevent concurrent calls
  const fetchingDashboardRef = useRef(false)
  const fetchingAnalyticsRef = useRef(false)
  
  // Update localStorage when auto-refresh preference changes
  useEffect(() => {
    localStorage.setItem('dashboard_auto_refresh', String(autoRefreshEnabled))
  }, [autoRefreshEnabled])

  // Real-time data refresh interval
  const REFRESH_INTERVAL = 30000 // 30 seconds

  // Fetch dashboard overview data with partial failure handling and deduplication
  const fetchDashboardData = useCallback(async (signal) => {
    // Prevent duplicate concurrent calls
    if (fetchingDashboardRef.current) {
      logger.debug('Dashboard data fetch already in progress, skipping duplicate call')
      return
    }
    
    try {
      fetchingDashboardRef.current = true
      logger.info('📊 Fetching dashboard data...')
      
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        // Log as debug instead of warn - this is expected when user is not logged in
        // Other functions in this file also use debug for missing auth tokens
        logger.debug('No auth token found, setting empty dashboard data')
        // Set empty data structure to prevent infinite loading
        if (!dashboardData && !cachedDashboardDataRef.current) {
          const emptyData = {
            metrics: {
              totalUsers: 0,
              activeUsers: 0,
              totalPosts: 0,
              totalShorts: 0,
              userGrowth: { weeklyGrowth: 0 },
              contentGrowth: { weeklyGrowth: 0 }
            },
            recentActivity: { users: [], posts: [] },
            aiInsights: []
          }
          setDashboardData(emptyData)
          cachedDashboardDataRef.current = emptyData
        }
        return
      }
      
      logger.debug('Making API call to /api/v1/superadmin/dashboard/overview')
      const response = await api.get('/api/v1/superadmin/dashboard/overview', {
        signal
      })
      
      logger.debug('Dashboard API response received:', { 
        status: response.status, 
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : null
      })
      
      if (!signal?.aborted) {
        // Store previous data for spike detection before updating
        previousDashboardDataRef.current = dashboardData || cachedDashboardDataRef.current
        
        // Extract data from response - sendSuccess spreads data directly into response
        const responseData = response.data || {}
        const newData = {
          metrics: responseData.metrics || {
            totalUsers: 0,
            activeUsers: 0,
            totalPosts: 0,
            totalShorts: 0,
            userGrowth: { weeklyGrowth: 0 },
            contentGrowth: { weeklyGrowth: 0 }
          },
          recentActivity: responseData.recentActivity || { users: [], posts: [] },
          aiInsights: responseData.aiInsights || []
        }
        
        logger.info('✅ Dashboard data updated successfully', { 
          hasMetrics: !!newData.metrics,
          hasRecentActivity: !!newData.recentActivity,
          hasAiInsights: !!newData.aiInsights,
          metricsKeys: newData.metrics ? Object.keys(newData.metrics) : []
        })
        
        // Force state update - set both state and cache
        cachedDashboardDataRef.current = newData
        setDashboardData(newData)
        setLastUpdate(new Date())
        
        // Clear any previous errors on successful fetch
        dashboardDataErrorsRef.current = {}
        
        logger.debug('State update completed, new data:', {
          totalUsers: newData.metrics?.totalUsers,
          totalPosts: newData.metrics?.totalPosts
        })
      } else {
        logger.debug('Dashboard fetch was aborted')
      }
    } catch (error) {
      // Skip logging for canceled requests
      const isCanceled = error.name === 'CanceledError' || 
                        error.name === 'AbortError' ||
                        error.code === 'ERR_CANCELED' ||
                        error.message === 'canceled' ||
                        error.parsedError?.code === 'CANCELED'
      if (!isCanceled) {
        logger.error('Failed to fetch dashboard data:', error)
        
        // Mark error but keep cached data visible
        dashboardDataErrorsRef.current.fetchError = true
        
        // If we have cached data, keep showing it
        if (cachedDashboardDataRef.current && !dashboardData) {
          setDashboardData(cachedDashboardDataRef.current)
        } else if (!dashboardData && !cachedDashboardDataRef.current) {
          // Set empty data structure to prevent infinite loading
          const emptyData = {
            metrics: {
              totalUsers: 0,
              activeUsers: 0,
              totalPosts: 0,
              totalShorts: 0,
              userGrowth: { weeklyGrowth: 0 },
              contentGrowth: { weeklyGrowth: 0 }
            },
            recentActivity: { users: [], posts: [] },
            aiInsights: []
          }
          setDashboardData(emptyData)
          cachedDashboardDataRef.current = emptyData
        }
      }
    } finally {
      fetchingDashboardRef.current = false
    }
  }, [dashboardData])

  // Fetch real-time analytics with deduplication
  const fetchAnalyticsData = useCallback(async (period = '24h', signal) => {
    // Prevent duplicate concurrent calls
    if (fetchingAnalyticsRef.current) {
      logger.debug('Analytics data fetch already in progress, skipping duplicate call')
      return
    }
    
    try {
      fetchingAnalyticsRef.current = true
      
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping analytics data fetch')
        return
      }
      
      const response = await api.get(`/api/v1/superadmin/analytics/realtime?period=${period}`, {
        signal
      })
      if (!signal?.aborted) {
        setAnalyticsData(response.data)
      }
    } catch (error) {
      // Skip logging for canceled requests
      const isCanceled = error.name === 'CanceledError' || 
                        error.name === 'AbortError' ||
                        error.code === 'ERR_CANCELED' ||
                        error.message === 'canceled' ||
                        error.parsedError?.code === 'CANCELED'
      if (!isCanceled) {
        logger.error('Failed to fetch analytics data:', error)
      }
    } finally {
      fetchingAnalyticsRef.current = false
    }
  }, [])

  // Fetch users data
  const fetchUsers = useCallback(async (params = {}, signal) => {
    try {
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping users fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const url = `/api/v1/superadmin/users?${queryParams}`
      
      const response = await api.get(url, { signal })
      
      if (!signal?.aborted) {
        // Handle both array and object responses
        const usersData = Array.isArray(response.data) ? response.data : (response.data?.users || [])
        setUsers(usersData)
        setLastUpdate(new Date())
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        logger.error('❌ Failed to fetch users:', error)
        // Don't clear users on error, keep existing data
      }
    }
  }, [])

  // Fetch posts data
  const fetchPosts = useCallback(async (params = {}, signal) => {
    try {
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping posts fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const url = `/api/v1/superadmin/travel-content?${queryParams}`
      
      const response = await api.get(url, { signal })
      
      if (!signal?.aborted) {
        // Handle both array and object responses
        const postsData = Array.isArray(response.data) ? response.data : (response.data?.posts || [])
        setPosts(postsData)
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        logger.error('❌ Failed to fetch posts:', error)
        // Don't clear posts on error, keep existing data
      }
    }
  }, [])

  // Fetch reports data
  const fetchReports = useCallback(async (params = {}, signal) => {
    try {
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping reports fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const url = `/api/v1/superadmin/reports?${queryParams}`
      
      const response = await api.get(url, { signal })
      
      if (!signal?.aborted) {
        // Handle both array and object responses
        const reportsData = Array.isArray(response.data) ? response.data : (response.data?.reports || [])
        setReports(reportsData)
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        logger.error('❌ Failed to fetch reports:', error)
        // Don't clear reports on error, keep existing data
      }
    }
  }, [])

  // Fetch feature flags
  const fetchFeatureFlags = useCallback(async () => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping feature flags fetch')
        return
      }
      
      const response = await api.get('/api/v1/superadmin/feature-flags')
      setFeatureFlags(response.data.featureFlags)
    } catch (error) {
      logger.error('Failed to fetch feature flags:', error)
    }
  }, [])

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async (params = {}) => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping audit logs fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const response = await api.get(`/api/v1/superadmin/audit-logs?${queryParams}`)
      setAuditLogs(response.data)
    } catch (error) {
      logger.error('Failed to fetch audit logs:', error)
    }
  }, [])

  // Global search
  const globalSearch = useCallback(async (query, type = 'all') => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping global search')
        return
      }
      
      const response = await api.get(`/api/v1/superadmin/search?q=${encodeURIComponent(query)}&type=${type}`)
      return response.data
    } catch (error) {
      logger.error('Search failed:', error)
      return { users: [], posts: [], total: 0 }
    }
  }, [])

  // Bulk actions
  const performBulkAction = useCallback(async (action, items, reason = '') => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping bulk action')
        return
      }
      
      const response = await api.post('/api/v1/superadmin/users/bulk-action', {
        action,
        userIds: items,
        reason
      })
      
      toast.success(response.data.message)
      
      // Refresh data after bulk action
      await fetchUsers()
      await fetchDashboardData()
      
      return { success: true, data: response.data }
    } catch (error) {
      logger.error('Bulk action failed:', error)
      toast.error(error.response?.data?.message || 'Bulk action failed')
      return { success: false, error: error.response?.data?.message }
    }
  }, [fetchUsers, fetchDashboardData])

  // Update feature flag
  const updateFeatureFlag = useCallback(async (id, updates) => {
    try {
      const response = await api.patch(`/api/v1/superadmin/feature-flags/${id}`, updates)
      
      // Update local state
      setFeatureFlags(prev => 
        prev.map(flag => 
          flag.id === id ? { ...flag, ...updates, updatedAt: new Date() } : flag
        )
      )
      
      toast.success('Feature flag updated successfully')
      return { success: true, data: response.data }
    } catch (error) {
      logger.error('Feature flag update failed:', error)
      toast.error(error.response?.data?.message || 'Failed to update feature flag')
      return { success: false, error: error.response?.data?.message }
    }
  }, [])

  // Export audit logs
  const exportAuditLogs = useCallback(async (format = 'csv', params = {}) => {
    try {
      const queryParams = new URLSearchParams({ ...params, export: format }).toString()
      const response = await api.get(`/api/v1/superadmin/audit-logs?${queryParams}`, {
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `audit-logs.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success(`Audit logs exported as ${format.toUpperCase()}`)
      return { success: true }
    } catch (error) {
      logger.error('Export failed:', error)
      toast.error('Failed to export audit logs')
      return { success: false, error: error.response?.data?.message }
    }
  }, [])

  // Initialize real-time connection
  useEffect(() => {
    let isMounted = true
    
    const initializeRealTime = async () => {
      try {
        await socketService.connect()
        if (!isMounted) return
        setIsConnected(true)
        
        // Define event handlers
        const handleDashboardUpdate = (data) => {
          if (isMounted) {
            setDashboardData(data)
            setLastUpdate(new Date())
          }
        }
        
        const handleAnalyticsUpdate = (data) => {
          if (isMounted) {
            setAnalyticsData(data)
          }
        }
        
        const handleUserUpdate = (data) => {
          if (isMounted) {
            setUsers(prev => 
              prev.map(user => 
                user._id === data._id ? { ...user, ...data } : user
              )
            )
          }
        }
        
        const handlePostUpdate = (data) => {
          if (isMounted) {
            setPosts(prev => 
              prev.map(post => 
                post._id === data._id ? { ...post, ...data } : post
              )
            )
          }
        }
        
        const handleReportUpdate = (data) => {
          if (isMounted) {
            setReports(prev => 
              prev.map(report => 
                report.id === data.id ? { ...report, ...data } : report
              )
            )
          }
        }
        
        const handleFeatureFlagUpdate = (data) => {
          if (isMounted) {
            setFeatureFlags(prev => 
              prev.map(flag => 
                flag.id === data.id ? { ...flag, ...data } : flag
              )
            )
          }
        }
        
        const handleAuditLogNew = (data) => {
          if (isMounted) {
            setAuditLogs(prev => [data, ...prev])
          }
        }
        
        const handleConnect = () => {
          if (isMounted) {
            setIsConnected(true)
            toast.success('Real-time connection established')
          }
        }
        
        const handleDisconnect = () => {
          if (isMounted) {
            setIsConnected(false)
            toast.error('Real-time connection lost')
          }
        }
        
        // Store handlers in ref for cleanup
        socketHandlersRef.current = {
          dashboard_update: handleDashboardUpdate,
          analytics_update: handleAnalyticsUpdate,
          user_update: handleUserUpdate,
          post_update: handlePostUpdate,
          report_update: handleReportUpdate,
          feature_flag_update: handleFeatureFlagUpdate,
          audit_log_new: handleAuditLogNew,
          connect: handleConnect,
          disconnect: handleDisconnect
        }
        
        // Listen for real-time updates
        socketService.on('dashboard_update', handleDashboardUpdate)
        socketService.on('analytics_update', handleAnalyticsUpdate)
        socketService.on('user_update', handleUserUpdate)
        socketService.on('post_update', handlePostUpdate)
        socketService.on('report_update', handleReportUpdate)
        socketService.on('feature_flag_update', handleFeatureFlagUpdate)
        socketService.on('audit_log_new', handleAuditLogNew)
        socketService.on('connect', handleConnect)
        socketService.on('disconnect', handleDisconnect)
        
      } catch (error) {
        if (isMounted) {
          logger.error('Failed to initialize real-time connection:', error)
          setIsConnected(false)
        }
      }
    }

    initializeRealTime()

    return () => {
      isMounted = false
      // Remove all event listeners using stored handlers
      const handlers = socketHandlersRef.current
      if (handlers) {
        Object.keys(handlers).forEach(event => {
          socketService.off(event, handlers[event])
        })
        socketHandlersRef.current = {}
      }
      // Don't disconnect socket here - let it stay connected for other components
      // The socket service will handle cleanup when user logs out
    }
  }, [])

  // Auto-refresh data - only refresh when enabled, tab is visible, and route is active
  useEffect(() => {
    // Clear any existing interval when auto-refresh is disabled or component unmounts
    const cleanup = () => {
      if (window.__dashboardRefreshInterval) {
        clearInterval(window.__dashboardRefreshInterval)
        window.__dashboardRefreshInterval = null
      }
    }
    
    // Only set up auto-refresh if it's enabled
    if (!autoRefreshEnabled) {
      cleanup()
      return cleanup
    }
    
    let isMounted = true
    let abortController = null
    let interval = null
    
    // Track if dashboard route is active (will be set by Dashboard component)
    let isDashboardActive = false
    const setDashboardActive = (active) => {
      isDashboardActive = active
    }
    
    // Expose setDashboardActive to Dashboard component via context
    window.__setDashboardActive = setDashboardActive
    
    // Track last refresh time to prevent rapid successive calls
    let lastRefreshTime = 0
    const MIN_REFRESH_INTERVAL = 5000 // Minimum 5 seconds between refreshes
    
    const refreshData = () => {
      // Only refresh if:
      // 1. Auto-refresh is enabled
      // 2. Component is mounted
      // 3. Browser tab is visible
      // 4. Dashboard route is active
      // 5. Enough time has passed since last refresh
      const now = Date.now()
      if (!autoRefreshEnabled || !isMounted || document.hidden || !isDashboardActive || (now - lastRefreshTime < MIN_REFRESH_INTERVAL)) {
        return
      }
      
      lastRefreshTime = now
      
      // Cancel previous request if still pending
      if (abortController) {
        abortController.abort()
      }
      
      // Create new abort controller for this refresh
      abortController = new AbortController()
      
      if (isMounted && !document.hidden && isDashboardActive && autoRefreshEnabled) {
        // Add small delay between dashboard and analytics to avoid rate limits
        fetchDashboardData(abortController.signal).then(() => {
          // Small delay before analytics fetch
          setTimeout(() => {
            if (isMounted && !abortController?.signal?.aborted && autoRefreshEnabled) {
              fetchAnalyticsData('24h', abortController.signal)
            }
          }, 200)
        }).catch(() => {
          // If dashboard fails, still try analytics after delay
          setTimeout(() => {
            if (isMounted && !abortController?.signal?.aborted && autoRefreshEnabled) {
              fetchAnalyticsData('24h', abortController.signal)
            }
          }, 200)
        })
        // Don't auto-refresh user data to prevent flickering
      }
    }
    
    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden && isDashboardActive && isMounted && autoRefreshEnabled) {
        // Resume refresh when tab becomes visible (with delay to avoid immediate call)
        setTimeout(() => {
          if (isMounted && !document.hidden && isDashboardActive && autoRefreshEnabled) {
            refreshData()
          }
        }, 1000)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Set up interval only when tab is visible and auto-refresh is enabled
    // Add initial delay to let initial fetch complete first
    const startInterval = () => {
      if (interval) clearInterval(interval)
      if (!document.hidden && isDashboardActive && autoRefreshEnabled) {
        // Wait at least 10 seconds after mount before starting auto-refresh
        // This gives initial fetch time to complete
        setTimeout(() => {
          if (isMounted && !document.hidden && isDashboardActive && autoRefreshEnabled) {
            interval = setInterval(refreshData, REFRESH_INTERVAL)
            window.__dashboardRefreshInterval = interval
          }
        }, 10000)
      }
    }
    
    startInterval()
    
    // Don't do initial refresh here - let the initial fetch handle it

    return () => {
      isMounted = false
      cleanup() // Clear interval
      if (interval) {
        clearInterval(interval)
        window.__dashboardRefreshInterval = null
      }
      if (abortController) {
        abortController.abort()
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      delete window.__setDashboardActive
    }
  }, [fetchDashboardData, fetchAnalyticsData, autoRefreshEnabled])

  // Initial data fetch - run only once on mount
  // Use a ref to ensure this only runs once, even if dependencies change
  const hasInitialFetchRef = useRef(false)
  
  useEffect(() => {
    // Only fetch once on initial mount
    if (hasInitialFetchRef.current) {
      return
    }
    
    hasInitialFetchRef.current = true
    let isMounted = true
    const abortController = new AbortController()
    
    const fetchInitialData = async () => {
      logger.info('🚀 Starting initial dashboard data fetch...')
      
      // Fetch dashboard data first (most critical)
      try {
        logger.debug('Calling fetchDashboardData...')
        await fetchDashboardData(abortController.signal)
        logger.info('✅ Initial dashboard fetch completed')
      } catch (error) {
        logger.error('❌ Initial dashboard fetch failed:', error)
        // Data already set to empty above, so dashboard will render
      }
      
      // Small delay between requests to avoid rate limits
      if (isMounted) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // Fetch analytics (non-critical, can fail silently)
      if (isMounted) {
        try {
          await fetchAnalyticsData('24h', abortController.signal)
        } catch (error) {
          logger.error('Initial analytics fetch failed:', error)
        }
      }
      
      // Fetch other data in parallel (less critical, can fail silently)
      if (isMounted) {
        try {
          await Promise.allSettled([
            fetchFeatureFlags(),
            fetchUsers({}, abortController.signal),
            fetchPosts({}, abortController.signal),
            fetchReports({}, abortController.signal)
          ])
        } catch (error) {
          logger.error('Initial data fetch failed:', error)
        }
      }
    }
    
    // Start fetch immediately - don't wait
    fetchInitialData().catch(error => {
      logger.error('Fatal error in initial fetch:', error)
      // Data already set to empty above, so dashboard will render
    })
    
    return () => {
      isMounted = false
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once on mount

  // Manual trigger function for debugging
  const manualTrigger = () => {
    fetchUsers()
    fetchPosts()
    fetchReports()
    fetchDashboardData()
    fetchAnalyticsData()
  }

  // Expose to window for debugging (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.triggerDataFetch = manualTrigger
      window.fetchUsers = fetchUsers
      window.fetchPosts = fetchPosts
      window.fetchReports = fetchReports
    }
    
    return () => {
      if (process.env.NODE_ENV === 'development') {
        delete window.triggerDataFetch
        delete window.fetchUsers
        delete window.fetchPosts
        delete window.fetchReports
      }
    }
  }, [fetchUsers, fetchPosts, fetchReports, manualTrigger])

  const value = {
    // Data
    dashboardData,
    analyticsData,
    users,
    posts,
    reports,
    featureFlags,
    auditLogs,
    isConnected,
    lastUpdate,
    
    // Cached data and errors for partial failure handling
    cachedDashboardData: cachedDashboardDataRef.current,
    dashboardDataErrors: dashboardDataErrorsRef.current,
    previousDashboardData: previousDashboardDataRef.current,
    
    // Auto-refresh control
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    
    // Fetch functions
    fetchDashboardData,
    fetchAnalyticsData,
    fetchUsers,
    fetchPosts,
    fetchReports,
    fetchFeatureFlags,
    fetchAuditLogs,
    
    // Actions
    globalSearch,
    performBulkAction,
    updateFeatureFlag,
    exportAuditLogs
  }

  return (
    <RealTimeContext.Provider value={value}>
      {children}
    </RealTimeContext.Provider>
  )
}
