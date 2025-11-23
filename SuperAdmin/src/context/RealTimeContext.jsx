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
  const [dashboardData, setDashboardData] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [reports, setReports] = useState([])
  const [featureFlags, setFeatureFlags] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  
  // Store socket handlers for cleanup
  const socketHandlersRef = useRef({})

  // Real-time data refresh interval
  const REFRESH_INTERVAL = 30000 // 30 seconds

  // Fetch dashboard overview data
  const fetchDashboardData = useCallback(async (signal) => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping dashboard data fetch')
        return
      }
      
      const response = await api.get('/api/superadmin/dashboard/overview', {
        signal
      })
      if (!signal?.aborted) {
        setDashboardData(response.data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        logger.error('Failed to fetch dashboard data:', error)
      }
    }
  }, [])

  // Fetch real-time analytics
  const fetchAnalyticsData = useCallback(async (period = '24h', signal) => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        logger.debug('No auth token found, skipping analytics data fetch')
        return
      }
      
      const response = await api.get(`/api/superadmin/analytics/realtime?period=${period}`, {
        signal
      })
      if (!signal?.aborted) {
        setAnalyticsData(response.data)
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        logger.error('Failed to fetch analytics data:', error)
      }
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
      const url = `/api/superadmin/users?${queryParams}`
      
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
      const url = `/api/superadmin/travel-content?${queryParams}`
      
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
      const url = `/api/superadmin/reports?${queryParams}`
      
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
      
      const response = await api.get('/api/superadmin/feature-flags')
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
      const response = await api.get(`/api/superadmin/audit-logs?${queryParams}`)
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
      
      const response = await api.get(`/api/superadmin/search?q=${encodeURIComponent(query)}&type=${type}`)
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
      
      const response = await api.post('/api/superadmin/users/bulk-action', {
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
      const response = await api.patch(`/api/superadmin/feature-flags/${id}`, updates)
      
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
      const response = await api.get(`/api/superadmin/audit-logs?${queryParams}`, {
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
      socketService.disconnect()
    }
  }, [])

  // Auto-refresh data - only refresh dashboard and analytics, not user data
  useEffect(() => {
    let isMounted = true
    let abortController = null
    
    const refreshData = () => {
      // Cancel previous request if still pending
      if (abortController) {
        abortController.abort()
      }
      
      // Create new abort controller for this refresh
      abortController = new AbortController()
      
      if (isMounted) {
        fetchDashboardData(abortController.signal)
        fetchAnalyticsData('24h', abortController.signal)
        // Don't auto-refresh user data to prevent flickering
      }
    }
    
    const interval = setInterval(refreshData, REFRESH_INTERVAL)
    
    // Initial refresh
    refreshData()

    return () => {
      isMounted = false
      clearInterval(interval)
      if (abortController) {
        abortController.abort()
      }
    }
  }, [fetchDashboardData, fetchAnalyticsData])

  // Initial data fetch - run only once
  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()
    
    const fetchInitialData = async () => {
      if (isMounted) {
        await Promise.all([
          fetchDashboardData(abortController.signal),
          fetchAnalyticsData('24h', abortController.signal),
          fetchFeatureFlags(),
          fetchUsers({}, abortController.signal),
          fetchPosts({}, abortController.signal),
          fetchReports({}, abortController.signal)
        ])
      }
    }
    
    fetchInitialData()
    
    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [fetchDashboardData, fetchAnalyticsData, fetchFeatureFlags, fetchUsers, fetchPosts, fetchReports])

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
