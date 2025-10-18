import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { socketService } from '../services/socketService'
import toast from 'react-hot-toast'

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

  // Real-time data refresh interval
  const REFRESH_INTERVAL = 30000 // 30 seconds

  // Fetch dashboard overview data
  const fetchDashboardData = useCallback(async () => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping dashboard data fetch')
        return
      }
      
      const response = await api.get('/api/superadmin/dashboard/overview')
      setDashboardData(response.data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }, [])

  // Fetch real-time analytics
  const fetchAnalyticsData = useCallback(async (period = '24h') => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping analytics data fetch')
        return
      }
      
      const response = await api.get(`/api/superadmin/analytics/realtime?period=${period}`)
      setAnalyticsData(response.data)
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    }
  }, [])

  // Fetch users data
  const fetchUsers = useCallback(async (params = {}) => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping users data fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const response = await api.get(`/api/superadmin/users?${queryParams}`)
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }, [])

  // Fetch posts data
  const fetchPosts = useCallback(async (params = {}) => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping posts data fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const response = await api.get(`/api/superadmin/travel-content?${queryParams}`)
      setPosts(response.data)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    }
  }, [])

  // Fetch reports data
  const fetchReports = useCallback(async (params = {}) => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping reports data fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const response = await api.get(`/api/superadmin/reports?${queryParams}`)
      setReports(response.data)
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    }
  }, [])

  // Fetch feature flags
  const fetchFeatureFlags = useCallback(async () => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping feature flags fetch')
        return
      }
      
      const response = await api.get('/api/superadmin/feature-flags')
      setFeatureFlags(response.data.featureFlags)
    } catch (error) {
      console.error('Failed to fetch feature flags:', error)
    }
  }, [])

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async (params = {}) => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping audit logs fetch')
        return
      }
      
      const queryParams = new URLSearchParams(params).toString()
      const response = await api.get(`/api/superadmin/audit-logs?${queryParams}`)
      setAuditLogs(response.data)
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    }
  }, [])

  // Global search
  const globalSearch = useCallback(async (query, type = 'all') => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping global search')
        return
      }
      
      const response = await api.get(`/api/superadmin/search?q=${encodeURIComponent(query)}&type=${type}`)
      return response.data
    } catch (error) {
      console.error('Search failed:', error)
      return { users: [], posts: [], total: 0 }
    }
  }, [])

  // Bulk actions
  const performBulkAction = useCallback(async (action, items, reason = '') => {
    try {
      // Check if user is authenticated before making API calls
      const token = localStorage.getItem('founder_token')
      if (!token) {
        console.log('No auth token found, skipping bulk action')
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
      console.error('Bulk action failed:', error)
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
      console.error('Feature flag update failed:', error)
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
      console.error('Export failed:', error)
      toast.error('Failed to export audit logs')
      return { success: false, error: error.response?.data?.message }
    }
  }, [])

  // Initialize real-time connection
  useEffect(() => {
    const initializeRealTime = async () => {
      try {
        await socketService.connect()
        setIsConnected(true)
        
        // Listen for real-time updates
        socketService.on('dashboard_update', (data) => {
          setDashboardData(data)
          setLastUpdate(new Date())
        })
        
        socketService.on('analytics_update', (data) => {
          setAnalyticsData(data)
        })
        
        socketService.on('user_update', (data) => {
          setUsers(prev => 
            prev.map(user => 
              user._id === data._id ? { ...user, ...data } : user
            )
          )
        })
        
        socketService.on('post_update', (data) => {
          setPosts(prev => 
            prev.map(post => 
              post._id === data._id ? { ...post, ...data } : post
            )
          )
        })
        
        socketService.on('report_update', (data) => {
          setReports(prev => 
            prev.map(report => 
              report.id === data.id ? { ...report, ...data } : report
            )
          )
        })
        
        socketService.on('feature_flag_update', (data) => {
          setFeatureFlags(prev => 
            prev.map(flag => 
              flag.id === data.id ? { ...flag, ...data } : flag
            )
          )
        })
        
        socketService.on('audit_log_new', (data) => {
          setAuditLogs(prev => [data, ...prev])
        })
        
        socketService.on('connect', () => {
          setIsConnected(true)
          toast.success('Real-time connection established')
        })
        
        socketService.on('disconnect', () => {
          setIsConnected(false)
          toast.error('Real-time connection lost')
        })
        
      } catch (error) {
        console.error('Failed to initialize real-time connection:', error)
        setIsConnected(false)
      }
    }

    initializeRealTime()

    return () => {
      socketService.disconnect()
    }
  }, [])

  // Auto-refresh data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData()
      fetchAnalyticsData()
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchDashboardData, fetchAnalyticsData])

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData()
    fetchAnalyticsData()
    fetchFeatureFlags()
  }, [fetchDashboardData, fetchAnalyticsData, fetchFeatureFlags])

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
