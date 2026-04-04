import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { 
  Activity, 
  Database, 
  Server, 
  HardDrive, 
  Cpu, 
  MemoryStick, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp,
  Clock,
  Settings,
  Trash2,
  BarChart3,
  FileText,
  Zap,
  Users
} from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import logger from '../utils/logger'
import { motion } from 'framer-motion'
import SafeComponent from '../components/SafeComponent'

const System = () => {
  const [activeTab, setActiveTab] = useState('health')
  const [healthData, setHealthData] = useState(null)
  const [statisticsData, setStatisticsData] = useState(null)
  const [performanceData, setPerformanceData] = useState(null)
  const [activityLogs, setActivityLogs] = useState([])
  const [collectionDetails, setCollectionDetails] = useState([])
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [cacheStats, setCacheStats] = useState(null)
  const [loading, setLoading] = useState({})
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 })
  
  // Lifecycle refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef({})
  
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  // Fetch system health
  const fetchSystemHealth = useCallback(async () => {
    if (isFetchingRef.current.health) return
    
    isFetchingRef.current.health = true
    if (isMountedRef.current) {
      setLoading(prev => ({ ...prev, health: true }))
    }
    
    try {
      const response = await api.get('/api/v1/superadmin/system/health')
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setHealthData(data)
      } else if (isMountedRef.current) {
        setHealthData(null)
      }
    } catch (error) {
      if (error.name === 'AbortError' || !isMountedRef.current) return
      
      // Handle 503 (Service Unavailable) gracefully - don't show error toast
      const isServiceUnavailable = error.response?.status === 503
      
      if (isServiceUnavailable) {
        // Log as debug instead of error for 503
        logger.debug('System health endpoint unavailable (503):', error.response?.status)
        // Don't show toast for 503 - it's expected when backend is down
      } else {
        // Log other errors normally
        logger.error('Failed to fetch system health:', error)
        if (isMountedRef.current) {
          toast.error('Failed to fetch system health')
        }
      }
      
      // Set healthData to null so empty state is shown
      if (isMountedRef.current) {
        setHealthData(null)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(prev => ({ ...prev, health: false }))
      }
      isFetchingRef.current.health = false
    }
  }, [])
  
  // Fetch system statistics
  const fetchSystemStatistics = useCallback(async () => {
    if (isFetchingRef.current.statistics) return
    
    isFetchingRef.current.statistics = true
    if (isMountedRef.current) {
      setLoading(prev => ({ ...prev, statistics: true }))
    }
    
    try {
      const response = await api.get('/api/v1/superadmin/system/statistics')
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setStatisticsData(data)
      } else if (isMountedRef.current) {
        setStatisticsData(null)
      }
    } catch (error) {
      if (error.name === 'AbortError' || !isMountedRef.current) return
      
      // Handle 503 (Service Unavailable) gracefully
      const isServiceUnavailable = error.response?.status === 503
      
      if (isServiceUnavailable) {
        logger.debug('System statistics endpoint unavailable (503):', error.response?.status)
      } else {
        logger.error('Failed to fetch system statistics:', error)
        if (isMountedRef.current) {
          toast.error('Failed to fetch system statistics')
        }
      }
      
      if (isMountedRef.current) {
        setStatisticsData(null)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(prev => ({ ...prev, statistics: false }))
      }
      isFetchingRef.current.statistics = false
    }
  }, [])
  
  // Fetch performance metrics
  const fetchPerformance = useCallback(async () => {
    if (isFetchingRef.current.performance) return
    
    isFetchingRef.current.performance = true
    if (isMountedRef.current) {
      setLoading(prev => ({ ...prev, performance: true }))
    }
    
    try {
      const response = await api.get('/api/v1/superadmin/system/performance')
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setPerformanceData(data)
      } else if (isMountedRef.current) {
        setPerformanceData(null)
      }
    } catch (error) {
      if (error.name === 'AbortError' || !isMountedRef.current) return
      
      // Handle 503 (Service Unavailable) gracefully
      const isServiceUnavailable = error.response?.status === 503
      
      if (isServiceUnavailable) {
        logger.debug('Performance metrics endpoint unavailable (503):', error.response?.status)
      } else {
        logger.error('Failed to fetch performance metrics:', error)
        if (isMountedRef.current) {
          toast.error('Failed to fetch performance metrics')
        }
      }
      
      if (isMountedRef.current) {
        setPerformanceData(null)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(prev => ({ ...prev, performance: false }))
      }
      isFetchingRef.current.performance = false
    }
  }, [])
  
  // Fetch activity logs
  const fetchActivityLogs = useCallback(async (page = 1) => {
    if (isFetchingRef.current.activityLogs) return
    
    isFetchingRef.current.activityLogs = true
    if (isMountedRef.current) {
      setLoading(prev => ({ ...prev, activityLogs: true }))
    }
    
    try {
      const response = await api.get('/api/v1/superadmin/system/activity-logs', {
        params: { page, limit: pagination.limit }
      })
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setActivityLogs(data.logs || [])
        setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 0 })
      } else if (isMountedRef.current) {
        setActivityLogs([])
        setPagination({ page: 1, limit: 50, total: 0, pages: 0 })
      }
    } catch (error) {
      if (error.name === 'AbortError' || !isMountedRef.current) return
      logger.error('Failed to fetch activity logs:', error)
      if (isMountedRef.current) {
        setActivityLogs([])
        setPagination({ page: 1, limit: 50, total: 0, pages: 0 })
        // Don't show toast for 304 (Not Modified) responses
        if (error.response?.status !== 304) {
          toast.error('Failed to fetch activity logs')
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(prev => ({ ...prev, activityLogs: false }))
      }
      isFetchingRef.current.activityLogs = false
    }
  }, [pagination.limit])
  
  // Fetch collection details
  const fetchCollectionDetails = useCallback(async () => {
    if (isFetchingRef.current.collections) return
    
    isFetchingRef.current.collections = true
    if (isMountedRef.current) {
      setLoading(prev => ({ ...prev, collections: true }))
    }
    
    try {
      const response = await api.get('/api/v1/superadmin/system/database/collections')
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setCollectionDetails(data.collections || [])
      } else if (isMountedRef.current) {
        setCollectionDetails([])
      }
    } catch (error) {
      if (error.name === 'AbortError' || !isMountedRef.current) return
      logger.error('Failed to fetch collection details:', error)
      if (isMountedRef.current) {
        setCollectionDetails([])
        // Don't show toast for 304 (Not Modified) responses
        if (error.response?.status !== 304) {
          toast.error('Failed to fetch collection details')
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(prev => ({ ...prev, collections: false }))
      }
      isFetchingRef.current.collections = false
    }
  }, [])
  
  // Fetch maintenance mode
  const fetchMaintenanceMode = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/superadmin/system/maintenance')
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setMaintenanceMode(data.maintenanceMode || false)
        setMaintenanceMessage(data.maintenanceMessage || '')
      } else if (isMountedRef.current) {
        setMaintenanceMode(false)
        setMaintenanceMessage('')
      }
    } catch (error) {
      if (error.name === 'AbortError' || !isMountedRef.current) return
      logger.error('Failed to fetch maintenance mode:', error)
      if (isMountedRef.current) {
        setMaintenanceMode(false)
        setMaintenanceMessage('')
      }
    }
  }, [])
  
  // Fetch cache stats
  const fetchCacheStats = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/superadmin/system/cache')
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setCacheStats(data)
      } else if (isMountedRef.current) {
        setCacheStats(null)
      }
    } catch (error) {
      if (error.name === 'AbortError' || !isMountedRef.current) return
      logger.error('Failed to fetch cache stats:', error)
    }
  }, [])
  
  // Load data based on active tab
  useEffect(() => {
    if (!isMountedRef.current) return
    
    switch (activeTab) {
      case 'health':
        fetchSystemHealth()
        break
      case 'statistics':
        fetchSystemStatistics()
        break
      case 'performance':
        fetchPerformance()
        break
      case 'activity':
        fetchActivityLogs(pagination.page)
        break
      case 'database':
        fetchCollectionDetails()
        break
      case 'maintenance':
        fetchMaintenanceMode()
        break
      case 'cache':
        fetchCacheStats()
        break
    }
  }, [activeTab, pagination.page, fetchSystemHealth, fetchSystemStatistics, fetchPerformance, fetchActivityLogs, fetchCollectionDetails, fetchMaintenanceMode, fetchCacheStats])
  
  // Toggle maintenance mode
  const handleToggleMaintenance = useCallback(async () => {
    if (!isMountedRef.current) return
    
    const confirmed = window.confirm(
      `Are you sure you want to ${maintenanceMode ? 'disable' : 'enable'} maintenance mode?\n\n` +
      `This will ${maintenanceMode ? 'restore' : 'restrict'} access to the platform.`
    )
    if (!confirmed) return
    
    try {
      const response = await api.patch('/api/v1/superadmin/system/maintenance', {
        maintenanceMode: !maintenanceMode,
        maintenanceMessage: maintenanceMessage || 'System is under maintenance. Please check back later.'
      })
      if (isMountedRef.current && response.data && response.data.success !== false) {
        const data = response.data.data || response.data
        setMaintenanceMode(data.maintenanceMode || !maintenanceMode)
        setMaintenanceMessage(data.maintenanceMessage || maintenanceMessage || '')
        toast.success(`Maintenance mode ${!maintenanceMode ? 'enabled' : 'disabled'} successfully`)
      } else if (isMountedRef.current) {
        // Optimistic update
        setMaintenanceMode(!maintenanceMode)
        toast.success(`Maintenance mode ${!maintenanceMode ? 'enabled' : 'disabled'} successfully`)
      }
    } catch (error) {
      if (isMountedRef.current) {
        logger.error('Failed to toggle maintenance mode:', error)
        toast.error(error.response?.data?.message || 'Failed to toggle maintenance mode')
      }
    }
  }, [maintenanceMode, maintenanceMessage])
  
  // Clear cache
  const handleClearCache = useCallback(async (pattern = null) => {
    if (!isMountedRef.current) return
    
    const confirmed = window.confirm(
      pattern 
        ? `Are you sure you want to clear cache with pattern: ${pattern}?`
        : 'Are you sure you want to clear all cache?'
    )
    if (!confirmed) return
    
    try {
      const params = pattern ? { pattern } : {}
      await api.delete('/api/v1/superadmin/system/cache', { params })
      if (isMountedRef.current) {
        toast.success(pattern ? `Cache cleared for pattern: ${pattern}` : 'Cache cleared successfully')
        fetchCacheStats()
      }
    } catch (error) {
      if (isMountedRef.current) {
        logger.error('Failed to clear cache:', error)
        toast.error('Failed to clear cache')
      }
    }
  }, [fetchCacheStats])
  
  // Format bytes
  const formatBytes = useCallback((bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }, [])
  
  // Format uptime
  const formatUptime = useCallback((seconds) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }, [])
  
  const tabs = [
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'activity', label: 'Activity Logs', icon: FileText },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'maintenance', label: 'Maintenance', icon: Settings },
    { id: 'cache', label: 'Cache', icon: Zap }
  ]
  
  return (
    <SafeComponent>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Server className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">System Management</h1>
                <p className="text-blue-100 text-lg mt-1">Monitor and manage system health, performance, and maintenance</p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchSystemHealth()
                fetchSystemStatistics()
                fetchPerformance()
              }}
              className="px-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white font-medium hover:bg-white/30 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh All
            </button>
          </div>
        </motion.div>
        
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
        
        {/* System Health Tab */}
        {activeTab === 'health' && (
          <>
            {loading.health && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            {!loading.health && !healthData && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Service Unavailable</h3>
                  <p className="text-gray-600 mb-6">
                    The system health endpoint is currently unavailable. This may be due to:
                  </p>
                  <ul className="text-sm text-gray-600 mb-6 space-y-1 text-left max-w-md mx-auto">
                    <li>• Backend server is temporarily down</li>
                    <li>• Service is under maintenance</li>
                    <li>• Network connectivity issues</li>
                  </ul>
                  <button
                    onClick={fetchSystemHealth}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </CardContent>
              </Card>
            )}
            {healthData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-600" />
                      Database Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          healthData.database?.healthy
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {healthData.database?.status || 'Unknown'}
                        </span>
                      </div>
                      {healthData.database?.responseTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Response Time</span>
                          <span className="text-sm font-semibold text-gray-900">{healthData.database.responseTime}ms</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Connection State</span>
                        <span className="text-sm font-semibold text-gray-900">{healthData.database?.connectionState || 'Unknown'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardTitle className="flex items-center gap-2">
                      <MemoryStick className="w-5 h-5 text-purple-600" />
                      Memory Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Heap Used</span>
                        <span className="text-sm font-semibold text-gray-900">{healthData.system?.memory?.used || 0} MB</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Heap Total</span>
                        <span className="text-sm font-semibold text-gray-900">{healthData.system?.memory?.total || 0} MB</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">RSS</span>
                        <span className="text-sm font-semibold text-gray-900">{healthData.system?.memory?.rss || 0} MB</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-green-600" />
                      System Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Platform</span>
                        <span className="text-sm font-semibold text-gray-900">{healthData.system?.platform?.type || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">CPU Cores</span>
                        <span className="text-sm font-semibold text-gray-900">{healthData.system?.cpu?.cpus || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Node Version</span>
                        <span className="text-sm font-semibold text-gray-900">{healthData.system?.nodeVersion || 'Unknown'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg md:col-span-2 lg:col-span-3">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600" />
                      Uptime
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900 mb-2">
                        {formatUptime(healthData.system?.uptime || 0)}
                      </div>
                      <p className="text-sm text-gray-600">System uptime</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
        
        {/* Statistics Tab */}
        {activeTab === 'statistics' && (
          <>
            {loading.statistics && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            {!loading.statistics && !statisticsData && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Service Unavailable</h3>
                  <p className="text-gray-600 mb-6">
                    The system statistics endpoint is currently unavailable.
                  </p>
                  <button
                    onClick={fetchSystemStatistics}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </CardContent>
              </Card>
            )}
            {statisticsData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Users className="w-8 h-8 text-blue-600" />
                        <span className="text-2xl font-bold text-gray-900">{statisticsData.modelCounts?.users || 0}</span>
                      </div>
                      <p className="text-sm text-gray-600">Total Users</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <FileText className="w-8 h-8 text-green-600" />
                        <span className="text-2xl font-bold text-gray-900">{statisticsData.modelCounts?.posts || 0}</span>
                      </div>
                      <p className="text-sm text-gray-600">Total Posts</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Database className="w-8 h-8 text-purple-600" />
                        <span className="text-2xl font-bold text-gray-900">{statisticsData.database?.collections || 0}</span>
                      </div>
                      <p className="text-sm text-gray-600">Collections</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <HardDrive className="w-8 h-8 text-orange-600" />
                        <span className="text-sm font-bold text-gray-900">{formatBytes(statisticsData.database?.totalSize || 0)}</span>
                      </div>
                      <p className="text-sm text-gray-600">Database Size</p>
                    </CardContent>
                  </Card>
                </div>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Collection Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Collection</TableHead>
                            <TableHead>Count</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Storage</TableHead>
                            <TableHead>Indexes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statisticsData.collections?.slice(0, 20).map((collection, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{collection.name}</TableCell>
                              <TableCell>{collection.count.toLocaleString()}</TableCell>
                              <TableCell>{formatBytes(collection.size)}</TableCell>
                              <TableCell>{formatBytes(collection.storageSize)}</TableCell>
                              <TableCell>{collection.indexes}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
        
        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <>
            {loading.performance && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            {!loading.performance && !performanceData && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Service Unavailable</h3>
                  <p className="text-gray-600 mb-6">
                    The performance metrics endpoint is currently unavailable.
                  </p>
                  <button
                    onClick={fetchPerformance}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </CardContent>
              </Card>
            )}
            {performanceData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-600" />
                      Database Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Avg Query Time</span>
                        <span className="text-lg font-bold text-gray-900">{performanceData.database?.avgQueryTime || 0}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Queries</span>
                        <span className="text-lg font-bold text-gray-900">{performanceData.database?.totalQueries || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Slow Queries</span>
                        <span className={`text-lg font-bold ${
                          (performanceData.database?.slowQueries || 0) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {performanceData.database?.slowQueries || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Slow Query Rate</span>
                        <span className="text-lg font-bold text-gray-900">{performanceData.database?.slowQueryRate || '0.00'}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardTitle className="flex items-center gap-2">
                      <MemoryStick className="w-5 h-5 text-purple-600" />
                      Memory Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Heap Used</span>
                        <span className="text-lg font-bold text-gray-900">{performanceData.memory?.heapUsed || 0} MB</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Heap Total</span>
                        <span className="text-lg font-bold text-gray-900">{performanceData.memory?.heapTotal || 0} MB</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Heap Usage</span>
                        <span className="text-lg font-bold text-gray-900">{performanceData.memory?.heapUsagePercent || '0.00'}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">RSS</span>
                        <span className="text-lg font-bold text-gray-900">{performanceData.memory?.rss || 0} MB</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-lg md:col-span-2">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-green-600" />
                      System Uptime
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900 mb-2">
                        {performanceData.uptime?.formatted || '0s'}
                      </div>
                      <p className="text-sm text-gray-600">({performanceData.uptime?.seconds || 0} seconds)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
        
        {/* Activity Logs Tab */}
        {activeTab === 'activity' && (
          <>
            {loading.activityLogs && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            {activityLogs.length > 0 ? (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Activity Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Admin</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityLogs.map((log, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{log.adminEmail || 'Unknown'}</div>
                                <div className="text-xs text-gray-500">{log.adminRole || 'N/A'}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                {log.action || 'N/A'}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{log.details || '—'}</TableCell>
                            <TableCell>
                              {log.success !== false ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-red-600" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {pagination.pages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        onClick={() => fetchActivityLogs(Math.max(1, pagination.page - 1))}
                        disabled={pagination.page === 1}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <button
                        onClick={() => fetchActivityLogs(Math.min(pagination.pages, pagination.page + 1))}
                        disabled={pagination.page >= pagination.pages}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : !loading.activityLogs && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600">No activity logs found</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
        
        {/* Database Tab */}
        {activeTab === 'database' && (
          <>
            {loading.collections && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            {collectionDetails.length > 0 ? (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Database Collections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Collection</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>Data Size</TableHead>
                          <TableHead>Storage Size</TableHead>
                          <TableHead>Index Size</TableHead>
                          <TableHead>Total Size</TableHead>
                          <TableHead>Indexes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collectionDetails.map((collection, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{collection.name}</TableCell>
                            <TableCell>{collection.count.toLocaleString()}</TableCell>
                            <TableCell>{formatBytes(collection.size.data)}</TableCell>
                            <TableCell>{formatBytes(collection.size.storage)}</TableCell>
                            <TableCell>{formatBytes(collection.size.indexes)}</TableCell>
                            <TableCell className="font-semibold">{formatBytes(collection.size.total)}</TableCell>
                            <TableCell>{collection.indexes.length}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : !loading.collections && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600">No collection data available</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
        
        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-600" />
                Maintenance Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Current Status</p>
                    <p className={`text-lg font-bold mt-1 ${
                      maintenanceMode ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {maintenanceMode ? 'Maintenance Mode Enabled' : 'System Operational'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleMaintenance}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                      maintenanceMode
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
                  </button>
                </div>
                
                {maintenanceMode && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-900 mb-2">Maintenance Message:</p>
                    <p className="text-sm text-red-800">{maintenanceMessage || 'System is under maintenance. Please check back later.'}</p>
                  </div>
                )}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Impact:</p>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                    <li>When enabled, users will see the maintenance message</li>
                    <li>API requests may be restricted or delayed</li>
                    <li>This is useful for system updates or emergency maintenance</li>
                    <li>You can disable maintenance mode at any time</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Cache Tab */}
        {activeTab === 'cache' && (
          <div className="space-y-6">
            {cacheStats && (
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    Cache Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Cache Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        cacheStats.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {cacheStats.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Default TTL</span>
                      <span className="text-sm font-semibold text-gray-900">{cacheStats.defaultTTL || 3600} seconds</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Available Keys</span>
                      <span className="text-sm font-semibold text-gray-900">{cacheStats.availableKeys?.length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Cache Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Clear All Cache</p>
                      <p className="text-xs text-gray-600 mt-1">Removes all cached data</p>
                    </div>
                    <button
                      onClick={() => handleClearCache()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    <button
                      onClick={() => handleClearCache('user:*')}
                      className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all text-left"
                    >
                      <p className="text-sm font-semibold text-blue-900">Clear User Cache</p>
                      <p className="text-xs text-blue-700 mt-1">Pattern: user:*</p>
                    </button>
                    <button
                      onClick={() => handleClearCache('post:*')}
                      className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-all text-left"
                    >
                      <p className="text-sm font-semibold text-green-900">Clear Post Cache</p>
                      <p className="text-xs text-green-700 mt-1">Pattern: post:*</p>
                    </button>
                    <button
                      onClick={() => handleClearCache('search:*')}
                      className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-all text-left"
                    >
                      <p className="text-sm font-semibold text-purple-900">Clear Search Cache</p>
                      <p className="text-xs text-purple-700 mt-1">Pattern: search:*</p>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </SafeComponent>
  )
}

export default System

