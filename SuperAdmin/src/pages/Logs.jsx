import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { formatDate } from '../utils/formatDate'
import { Search, Filter, Download, RefreshCw, AlertTriangle, Info, CheckCircle, XCircle, Calendar, Eye, Clock, List, ChevronDown, ChevronUp, Shield, Ban, Copy, Check } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import SafeComponent from '../components/SafeComponent'
import logger from '../utils/logger'

const Logs = () => {
  const { isConnected } = useRealTime()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  // Time range presets
  const [timeRangePreset, setTimeRangePreset] = useState(() => {
    const saved = localStorage.getItem('logs_time_range_preset')
    return saved || 'all'
  })
  const [dateRange, setDateRange] = useState(() => {
    const saved = localStorage.getItem('logs_date_range')
    return saved || 'all'
  })
  const [selectedLog, setSelectedLog] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  
  // Quick filters for failed/blocked attempts
  const [showFailedOnly, setShowFailedOnly] = useState(() => {
    const saved = localStorage.getItem('logs_show_failed_only')
    return saved === 'true'
  })
  const [showBlockedOnly, setShowBlockedOnly] = useState(() => {
    const saved = localStorage.getItem('logs_show_blocked_only')
    return saved === 'true'
  })
  
  // Log grouping state
  const [groupedLogs, setGroupedLogs] = useState([])
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  
  // Stack trace expansion state
  const [expandedStackTraces, setExpandedStackTraces] = useState(new Set())
  const [copiedStackTraces, setCopiedStackTraces] = useState(new Set())
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const cachedLogsRef = useRef(null)
  const cacheKeyRef = useRef('')
  const fetchTimeoutRef = useRef(null)

  // Calculate time range from preset (defined before fetchLogs to avoid initialization error)
  const getTimeRangeFromPreset = useCallback((preset) => {
    const now = new Date()
    switch (preset) {
      case '15m':
        return {
          start: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
          end: now.toISOString()
        }
      case '1h':
        return {
          start: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        }
      case '24h':
        return {
          start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        }
      case '7d':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        }
      default:
        return null
    }
  }, [])

  // Fetch logs from API with caching and request deduplication
  const fetchLogs = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate concurrent calls
    if (isFetchingRef.current && !forceRefresh) {
      logger.debug('Logs fetch already in progress, skipping duplicate call')
      return
    }
    
    // Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }
    
    // Check cache first (show immediately on re-entry)
    const cacheKey = `${currentPage}-${itemsPerPage}-${filterLevel}-${filterType}-${searchTerm}-${showFailedOnly}-${showBlockedOnly}-${timeRangePreset}`
    
    if (cachedLogsRef.current && cacheKeyRef.current === cacheKey && !forceRefresh) {
      logger.debug('Using cached logs')
      if (isMountedRef.current) {
        setLogs(cachedLogsRef.current.logs)
        setTotalLogs(cachedLogsRef.current.total)
        setTotalPages(cachedLogsRef.current.totalPages)
      }
      // Revalidate in background
      fetchTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          fetchLogs(true)
        }
      }, 100)
      return
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true
    
    // Show cached data immediately if available (for better UX)
    if (cachedLogsRef.current && isMountedRef.current) {
      setLogs(cachedLogsRef.current.logs)
      setTotalLogs(cachedLogsRef.current.total)
      setTotalPages(cachedLogsRef.current.totalPages)
    }
    
    if (isMountedRef.current) {
      setIsLoading(true)
    }
    
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage
      }
      
      if (searchTerm) {
        params.search = searchTerm
      }
      if (filterLevel !== 'all') {
        params.level = filterLevel
      }
      if (filterType !== 'all') {
        params.type = filterType
      }
      
      // Add time range from preset
      if (timeRangePreset !== 'all') {
        const timeRange = getTimeRangeFromPreset(timeRangePreset)
        if (timeRange) {
          params.startDate = timeRange.start
          params.endDate = timeRange.end
        }
      }
      
      const response = await api.get('/api/v1/superadmin/logs', { 
        params,
        signal: abortControllerRef.current.signal
      })
      
      if (!abortControllerRef.current.signal.aborted && isMountedRef.current && response.data.success) {
        const fetchedLogs = response.data.logs || []
        
        // Apply quick filters client-side (if needed)
        let filteredLogs = fetchedLogs
        if (showFailedOnly) {
          filteredLogs = filteredLogs.filter(log => log.success === false || log.level === 'error')
        }
        if (showBlockedOnly) {
          filteredLogs = filteredLogs.filter(log => 
            log.details?.toLowerCase().includes('blocked') || 
            log.details?.toLowerCase().includes('ban') ||
            log.action?.toLowerCase().includes('block')
          )
        }
        
        setLogs(filteredLogs)
        setTotalLogs(response.data.total)
        setTotalPages(response.data.totalPages)
        
        // Cache the results
        cachedLogsRef.current = {
          logs: filteredLogs,
          total: response.data.total,
          totalPages: response.data.totalPages
        }
        cacheKeyRef.current = cacheKey
      }
    } catch (error) {
      if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
        logger.error('Failed to fetch logs:', error)
        if (isMountedRef.current) {
          // Show cached data if available (partial failure handling)
          if (cachedLogsRef.current) {
            setLogs(cachedLogsRef.current.logs)
            setTotalLogs(cachedLogsRef.current.total)
            setTotalPages(cachedLogsRef.current.totalPages)
            toast.error('Failed to fetch logs. Showing cached data.', { duration: 3000 })
          } else {
            // Only show error if no cached data
            toast.error('Failed to fetch logs')
          }
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [currentPage, itemsPerPage, filterLevel, filterType, searchTerm, showFailedOnly, showBlockedOnly, timeRangePreset, getTimeRangeFromPreset])

  // Save filter preferences to localStorage (sticky filters)
  useEffect(() => {
    localStorage.setItem('logs_show_failed_only', showFailedOnly.toString())
  }, [showFailedOnly])
  
  useEffect(() => {
    localStorage.setItem('logs_show_blocked_only', showBlockedOnly.toString())
  }, [showBlockedOnly])
  
  useEffect(() => {
    localStorage.setItem('logs_time_range_preset', timeRangePreset)
  }, [timeRangePreset])
  
  useEffect(() => {
    localStorage.setItem('logs_date_range', dateRange)
  }, [dateRange])
  
  useEffect(() => {
    localStorage.setItem('logs_filter_level', filterLevel)
  }, [filterLevel])
  
  useEffect(() => {
    localStorage.setItem('logs_filter_type', filterType)
  }, [filterType])
  
  // Restore filters from localStorage on mount
  useEffect(() => {
    const savedFilterLevel = localStorage.getItem('logs_filter_level')
    const savedFilterType = localStorage.getItem('logs_filter_type')
    
    if (savedFilterLevel && isMountedRef.current) {
      setFilterLevel(savedFilterLevel)
    }
    if (savedFilterType && isMountedRef.current) {
      setFilterType(savedFilterType)
    }
  }, [])
  
  
  // Reset to page 1 when filters change
  useEffect(() => {
    if (isMountedRef.current) {
      setCurrentPage(1)
    }
  }, [filterLevel, filterType, dateRange, showFailedOnly, showBlockedOnly, timeRangePreset])

  // Initial fetch on mount
  useEffect(() => {
    if (isMountedRef.current) {
      fetchLogs()
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount
  
  // Fetch logs when dependencies change (with debounce for search and time range)
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // Debounce search and time range changes to prevent duplicate fetches
    const debounceDelay = searchTerm || timeRangePreset !== 'all' ? 400 : 0
    
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !isFetchingRef.current) {
        fetchLogs()
      }
    }, debounceDelay)
    
    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [currentPage, itemsPerPage, filterLevel, filterType, showFailedOnly, showBlockedOnly, fetchLogs, searchTerm, timeRangePreset])

  // Auto-refresh functionality
  useEffect(() => {
    if (!isMountedRef.current) return
    
    let intervalId
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (isMountedRef.current && !isFetchingRef.current) {
          fetchLogs(true) // Force refresh
        }
      }, 10000) // Refresh every 10 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [autoRefresh, fetchLogs])
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (isFetchingRef.current) {
        isFetchingRef.current = false
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
        fetchTimeoutRef.current = null
      }
    }
  }, [])
  
  // Copy stack trace to clipboard
  const handleCopyStackTrace = useCallback(async (logId, stackTrace) => {
    try {
      await navigator.clipboard.writeText(stackTrace)
      setCopiedStackTraces(prev => new Set(prev).add(logId))
      setTimeout(() => {
        setCopiedStackTraces(prev => {
          const next = new Set(prev)
          next.delete(logId)
          return next
        })
      }, 2000)
      toast.success('Stack trace copied to clipboard')
    } catch (error) {
      logger.error('Failed to copy stack trace:', error)
      toast.error('Failed to copy stack trace')
    }
  }, [])
  
  // Toggle stack trace expansion
  const toggleStackTrace = useCallback((logId) => {
    setExpandedStackTraces(prev => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }, [])

  const handleRefresh = useCallback(async () => {
    if (isFetchingRef.current) return
    
    await fetchLogs(true) // Force refresh
    if (isMountedRef.current) {
      toast.success('Logs refreshed successfully')
    }
  }, [fetchLogs])

  const handleExport = async (format) => {
    try {
      const params = {}
      
      if (searchTerm) params.search = searchTerm
      if (filterLevel !== 'all') params.level = filterLevel
      if (filterType !== 'all') params.type = filterType
      
      const response = await api.get('/api/v1/superadmin/logs', { 
        params: { ...params, limit: 1000 } // Get more for export
      })
      
      if (format === 'csv') {
        let csv = 'Timestamp,Level,Type,Action,Details,IP Address,User\n'
        response.data.logs.forEach(log => {
          csv += `${new Date(log.timestamp).toISOString()},${log.level || 'info'},${log.type || 'system'},${log.action || ''},"${(log.details || '').replace(/"/g, '""')}",${log.ipAddress || ''},${log.userId || ''}\n`
        })
        
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs_export_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        toast.success('Logs exported as CSV')
      } else if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data.logs, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs_export_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        toast.success('Logs exported as JSON')
      }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      logger.error('Failed to export logs:', error)
      toast.error('Failed to export logs')
    }
  }

  const handleViewLog = (log) => {
    setSelectedLog(log)
    setShowLogModal(true)
  }

  // Enhanced severity-based visual hierarchy
  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-700 bg-red-50 border border-red-200'
      case 'warning': case 'warn': return 'text-yellow-700 bg-yellow-50 border border-yellow-200'
      case 'info': return 'text-blue-700 bg-blue-50 border border-blue-200'
      case 'success': return 'text-green-700 bg-green-50 border border-green-200'
      default: return 'text-gray-700 bg-gray-50 border border-gray-200'
    }
  }
  
  const getLevelRowBg = (level) => {
    switch (level) {
      case 'error': return 'bg-red-50/30 hover:bg-red-50/50'
      case 'warning': case 'warn': return 'bg-yellow-50/20 hover:bg-yellow-50/40'
      case 'info': return 'bg-blue-50/10 hover:bg-blue-50/20'
      default: return 'hover:bg-gray-50'
    }
  }

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4" />
      case 'warning': return <AlertTriangle className="w-4 h-4" />
      case 'info': return <Info className="w-4 h-4" />
      case 'success': return <CheckCircle className="w-4 h-4" />
      default: return <Info className="w-4 h-4" />
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'user_action': return 'text-blue-600 bg-blue-100'
      case 'security': return 'text-red-600 bg-red-100'
      case 'system': return 'text-purple-600 bg-purple-100'
      case 'moderation': return 'text-green-600 bg-green-100'
      case 'api': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  // Format timestamp with relative time
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return 'N/A'
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    let relative = ''
    if (diffMins < 1) {
      relative = 'Just now'
    } else if (diffMins < 60) {
      relative = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      relative = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      relative = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else {
      relative = formatDate(timestamp)
    }
    
    return {
      relative,
      absolute: formatDate(timestamp),
      full: date.toISOString()
    }
  }, [])
  
  // Intelligent log grouping: group by IP, user, and time window (5 minutes)
  const groupLogs = useCallback((logList) => {
    const groups = []
    const groupMap = new Map()
    const TIME_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
    
    logList.forEach((log, index) => {
      const logTime = new Date(log.timestamp).getTime()
      const ip = log.ipAddress || 'unknown'
      const userId = log.userId || 'anonymous'
      const action = log.action || 'unknown'
      
      // Create group key: IP + user + action
      const groupKey = `${ip}-${userId}-${action}`
      
      // Find existing group within time window
      let foundGroup = null
      for (const [key, group] of groupMap.entries()) {
        if (key.startsWith(`${ip}-${userId}-${action}`)) {
          const lastLogTime = new Date(group.logs[group.logs.length - 1].timestamp).getTime()
          if (Math.abs(logTime - lastLogTime) <= TIME_WINDOW_MS) {
            foundGroup = group
            break
          }
        }
      }
      
      if (foundGroup) {
        // Add to existing group
        foundGroup.logs.push(log)
        foundGroup.count++
        foundGroup.lastTimestamp = log.timestamp
      } else {
        // Create new group
        const newGroup = {
          id: `group-${index}`,
          key: groupKey,
          ip,
          userId,
          action,
          logs: [log],
          count: 1,
          firstTimestamp: log.timestamp,
          lastTimestamp: log.timestamp,
          isSuspicious: false
        }
        groupMap.set(groupKey, newGroup)
        groups.push(newGroup)
      }
    })
    
    // Mark suspicious groups (multiple failed attempts)
    groups.forEach(group => {
      const failedCount = group.logs.filter(l => l.success === false || l.level === 'error').length
      if (failedCount >= 3 || group.count >= 5) {
        group.isSuspicious = true
      }
    })
    
    return groups
  }, [])
  
  // Detect suspicious behavior for individual logs
  const getSuspiciousIndicators = useCallback((log, allLogs) => {
    const indicators = []
    
    // Check for multiple failed attempts from same IP
    const sameIpFailed = allLogs.filter(l => 
      l.ipAddress === log.ipAddress && 
      (l.success === false || l.level === 'error') &&
      Math.abs(new Date(l.timestamp) - new Date(log.timestamp)) < 15 * 60 * 1000 // 15 minutes
    ).length
    
    if (sameIpFailed >= 3) {
      indicators.push({ type: 'multiple_failed', count: sameIpFailed })
    }
    
    // Check for blocked attempts
    if (log.details?.toLowerCase().includes('blocked') || 
        log.details?.toLowerCase().includes('ban') ||
        log.action?.toLowerCase().includes('block')) {
      indicators.push({ type: 'blocked' })
    }
    
    return indicators
  }, [])
  
  // Memoized grouped logs
  const processedLogs = useMemo(() => {
    if (logs.length === 0) return []
    
    const grouped = groupLogs(logs)
    
    // Flatten groups (show grouped or individual)
    const flattened = []
    grouped.forEach(group => {
      if (group.count > 1 && !expandedGroups.has(group.id)) {
        // Show as grouped entry
        const firstLog = group.logs[0]
        flattened.push({
          ...firstLog,
          _isGroup: true,
          _groupData: group,
          _suspiciousIndicators: group.isSuspicious ? [{ type: 'multiple_failed', count: group.count }] : []
        })
      } else {
        // Show individual logs
        group.logs.forEach(log => {
          flattened.push({
            ...log,
            _isGroup: false,
            _suspiciousIndicators: getSuspiciousIndicators(log, logs)
          })
        })
      }
    })
    
    return flattened
  }, [logs, groupLogs, expandedGroups, getSuspiciousIndicators])
  
  const errorCount = useMemo(() => logs.filter(l => l.level === 'error').length, [logs])
  const warningCount = useMemo(() => logs.filter(l => l.level === 'warning').length, [logs])
  const infoCount = useMemo(() => logs.filter(l => l.level === 'info').length, [logs])
  const successCount = useMemo(() => logs.filter(l => l.level === 'success').length, [logs])
  
  const toggleGroupExpansion = useCallback((groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  return (
    <SafeComponent>
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 via-slate-50 to-zinc-50 rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-gray-500 to-slate-600 rounded-xl shadow-lg">
                <List className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-700 to-slate-700 bg-clip-text text-transparent">
                System Logs
              </h1>
              {isConnected && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                  Live Data
                </span>
              )}
              {autoRefresh && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-blue-400 to-indigo-500 text-white text-xs font-semibold rounded-full shadow-md">
                  Auto-refresh ON
                </span>
              )}
            </div>
            <p className="text-gray-600 text-lg">Monitor system and app events in real-time</p>
          </div>
          <div className="flex space-x-3">
            <button 
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2.5 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 ${
                autoRefresh ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>Auto-refresh</span>
            </button>
            <div className="relative group">
              <button className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Export Logs</span>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b"
                >
                  Export as JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Errors</p>
                  <p className="text-2xl font-bold text-gray-900">{errorCount}</p>
                </div>
              </div>
              <div className="text-red-600 text-xl">!</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Warnings</p>
                  <p className="text-2xl font-bold text-gray-900">{warningCount}</p>
                </div>
              </div>
              <div className="text-yellow-600 text-xl">⚠</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Info</p>
                  <p className="text-2xl font-bold text-gray-900">{infoCount}</p>
                </div>
              </div>
              <div className="text-blue-600 text-xl">ℹ</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Success</p>
                  <p className="text-2xl font-bold text-gray-900">{successCount}</p>
                </div>
              </div>
              <div className="text-green-600 text-xl">✓</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalLogs}</p>
                </div>
              </div>
              <div className="text-purple-600 text-xl">📊</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search Bar */}
            <div className="flex-1 w-full lg:w-auto min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by action, details, IP address..."
                  className="input pl-10 w-full h-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:flex-shrink-0">
              {/* Time Range Presets */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setTimeRangePreset('15m')}
                  className={`px-3 py-2 h-10 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    timeRangePreset === '15m'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  title="Last 15 minutes"
                >
                  15m
                </button>
                <button
                  onClick={() => setTimeRangePreset('1h')}
                  className={`px-3 py-2 h-10 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    timeRangePreset === '1h'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  title="Last 1 hour"
                >
                  1h
                </button>
                <button
                  onClick={() => setTimeRangePreset('24h')}
                  className={`px-3 py-2 h-10 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    timeRangePreset === '24h'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  title="Last 24 hours"
                >
                  24h
                </button>
                <button
                  onClick={() => setTimeRangePreset('7d')}
                  className={`px-3 py-2 h-10 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    timeRangePreset === '7d'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  title="Last 7 days"
                >
                  7d
                </button>
                <button
                  onClick={() => setTimeRangePreset('all')}
                  className={`px-3 py-2 h-10 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    timeRangePreset === 'all'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  title="All time"
                >
                  All
                </button>
              </div>
              
              {/* Quick Filter Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowFailedOnly(!showFailedOnly)}
                  className={`px-3 py-2 h-10 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    showFailedOnly
                      ? 'bg-red-100 text-red-700 border-2 border-red-300 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  title="Show only failed attempts"
                >
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Failed Only</span>
                </button>
                <button
                  onClick={() => setShowBlockedOnly(!showBlockedOnly)}
                  className={`px-3 py-2 h-10 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    showBlockedOnly
                      ? 'bg-orange-100 text-orange-700 border-2 border-orange-300 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  title="Show only blocked attempts"
                >
                  <Ban className="w-4 h-4 flex-shrink-0" />
                  <span>Blocked Only</span>
                </button>
              </div>
              
              {/* Dropdown Filters */}
              <div className="flex gap-2 flex-1 sm:flex-initial">
                <select
                  className="input h-10 min-w-[140px]"
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                >
                  <option value="all">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                </select>
                <select
                  className="input h-10 min-w-[140px]"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="user_action">User Action</option>
                  <option value="security">Security</option>
                  <option value="system">System</option>
                  <option value="moderation">Moderation</option>
                  <option value="api">API</option>
                </select>
              </div>
              
              {/* More Filters Button */}
              <button 
                className="btn btn-secondary h-10 whitespace-nowrap flex-shrink-0"
                onClick={() => setShowMoreFilters(!showMoreFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>

          {/* More Filters */}
          {showMoreFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select
                    className="input w-full text-sm"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilterLevel('all')
                      setFilterType('all')
                      setSearchTerm('')
                      setDateRange('all')
                    }}
                    className="btn btn-sm btn-secondary w-full"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Logs ({totalLogs})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        Loading logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-semibold">No logs found</p>
                      <p className="text-sm text-gray-600 mt-2">Try adjusting your filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  processedLogs.map((log, index) => {
                    const timestamp = formatTimestamp(log.timestamp)
                    const isGroup = log._isGroup
                    const groupData = log._groupData
                    const suspiciousIndicators = log._suspiciousIndicators || []
                    const isFailed = log.success === false || log.level === 'error'
                    const isExpanded = expandedGroups.has(groupData?.id)
                    
                    const logId = log._id || `log_${index}_${log.timestamp}_${log.action || 'unknown'}`
                    const hasStackTrace = log.stackTrace || log.stack || log.error?.stack
                    const isStackTraceExpanded = expandedStackTraces.has(logId)
                    const isCopied = copiedStackTraces.has(logId)
                    const rowBgClass = getLevelRowBg(log.level)
                    
                    return (
                      <React.Fragment key={logId}>
                        <TableRow className={`${rowBgClass} ${isFailed ? 'bg-red-50/30' : ''} ${isGroup ? 'font-semibold' : ''}`}>
                          <TableCell className="font-mono text-sm align-middle">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-600" title={timestamp.absolute}>
                                {timestamp.relative}
                              </span>
                              {isGroup && (
                                <span className="text-xs text-gray-400 mt-1">
                                  {formatTimestamp(groupData.firstTimestamp).relative} - {formatTimestamp(groupData.lastTimestamp).relative}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle">
                            <div className="flex items-center space-x-2 flex-wrap">
                              {getLevelIcon(log.level)}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                                {log.level}
                              </span>
                              {suspiciousIndicators.length > 0 && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {suspiciousIndicators.map((indicator, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-300 inline-flex items-center"
                                      title={
                                        indicator.type === 'multiple_failed'
                                          ? `${indicator.count} failed attempts from this IP`
                                          : 'Blocked attempt'
                                      }
                                    >
                                      {indicator.type === 'multiple_failed' ? (
                                        <Shield className="w-3 h-3" />
                                      ) : (
                                        <Ban className="w-3 h-3" />
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(log.type)}`}>
                              {log.type?.replace('_', ' ') || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs align-middle">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm" title={log.action}>
                                {log.action}
                              </div>
                              {isGroup && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap flex-shrink-0">
                                  {groupData.count} attempts
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs align-middle">
                            <div className="space-y-1">
                              <div className="truncate text-sm" title={log.message || log.details}>
                                {log.message || log.details || '-'}
                              </div>
                              {hasStackTrace && (
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={() => toggleStackTrace(logId)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    {isStackTraceExpanded ? (
                                      <>
                                        <ChevronUp className="w-3 h-3" />
                                        <span>Hide stack trace</span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3" />
                                        <span>Show stack trace</span>
                                      </>
                                    )}
                                  </button>
                                  {isStackTraceExpanded && (
                                    <button
                                      onClick={() => handleCopyStackTrace(logId, hasStackTrace)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                      title="Copy stack trace"
                                    >
                                      {isCopied ? (
                                        <>
                                          <Check className="w-3 h-3" />
                                          <span>Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm align-middle">
                            {log.ipAddress || 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm align-middle">
                            {log.userId || 'N/A'}
                          </TableCell>
                          <TableCell className="align-middle">
                            <div className="flex items-center justify-center gap-2">
                              {isGroup && (
                                <button
                                  onClick={() => toggleGroupExpansion(groupData.id)}
                                  className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0"
                                  title={isExpanded ? 'Collapse group' : 'Expand group'}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              )}
                              <button 
                                onClick={() => handleViewLog(log)}
                                className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex-shrink-0"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* Expanded stack trace */}
                        {hasStackTrace && isStackTraceExpanded && (
                          <TableRow className={`${rowBgClass} bg-gray-50/50`}>
                            <TableCell colSpan={8} className="p-4">
                              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                                <pre className="whitespace-pre-wrap break-words">
                                  {log.stackTrace || log.stack || log.error?.stack || 'No stack trace available'}
                                </pre>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {/* Expanded group logs */}
                        {isGroup && isExpanded && groupData.logs.slice(1).map((groupLog, groupIndex) => {
                          const groupTimestamp = formatTimestamp(groupLog.timestamp)
                          const groupIsFailed = groupLog.success === false || groupLog.level === 'error'
                          // For grouped logs, check if this specific log has suspicious indicators
                          const groupSuspiciousIndicators = (() => {
                            const indicators = []
                            if (groupLog.success === false || groupLog.level === 'error') {
                              const sameIpFailed = logs.filter(l => 
                                l.ipAddress === groupLog.ipAddress && 
                                (l.success === false || l.level === 'error') &&
                                Math.abs(new Date(l.timestamp) - new Date(groupLog.timestamp)) < 15 * 60 * 1000
                              ).length
                              if (sameIpFailed >= 3) {
                                indicators.push({ type: 'multiple_failed', count: sameIpFailed })
                              }
                            }
                            if (groupLog.details?.toLowerCase().includes('blocked') || 
                                groupLog.details?.toLowerCase().includes('ban') ||
                                groupLog.action?.toLowerCase().includes('block')) {
                              indicators.push({ type: 'blocked' })
                            }
                            return indicators
                          })()
                          
                          const groupLogId = `${groupData.id}-${groupIndex}`
                          const groupHasStackTrace = groupLog.stackTrace || groupLog.stack || groupLog.error?.stack
                          const groupIsStackTraceExpanded = expandedStackTraces.has(groupLogId)
                          const groupIsCopied = copiedStackTraces.has(groupLogId)
                          
                          return (
                            <React.Fragment key={groupLogId}>
                              <TableRow className={`hover:bg-gray-50 bg-gray-50/50 ${groupIsFailed ? 'bg-red-50/20' : ''}`}>
                                <TableCell className="font-mono text-sm pl-8 align-middle">
                                  <span className="text-xs text-gray-600" title={groupTimestamp.absolute}>
                                    {groupTimestamp.relative}
                                  </span>
                                </TableCell>
                                <TableCell className="align-middle">
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    {getLevelIcon(groupLog.level)}
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(groupLog.level)}`}>
                                      {groupLog.level}
                                    </span>
                                    {groupSuspiciousIndicators.length > 0 && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {groupSuspiciousIndicators.map((indicator, idx) => (
                                          <span
                                            key={idx}
                                            className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-300 inline-flex items-center"
                                            title={
                                              indicator.type === 'multiple_failed'
                                                ? `${indicator.count} failed attempts from this IP`
                                                : 'Blocked attempt'
                                            }
                                          >
                                            {indicator.type === 'multiple_failed' ? (
                                              <Shield className="w-3 h-3" />
                                            ) : (
                                              <Ban className="w-3 h-3" />
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="align-middle">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(groupLog.type)}`}>
                                    {groupLog.type?.replace('_', ' ') || 'N/A'}
                                  </span>
                                </TableCell>
                                <TableCell className="max-w-xs align-middle">
                                  <div className="truncate text-sm" title={groupLog.action}>
                                    {groupLog.action}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-xs align-middle">
                                  <div className="space-y-1">
                                    <div className="truncate text-sm" title={groupLog.message || groupLog.details}>
                                      {groupLog.message || groupLog.details || '-'}
                                    </div>
                                    {groupHasStackTrace && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <button
                                          onClick={() => toggleStackTrace(groupLogId)}
                                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                        >
                                          {groupIsStackTraceExpanded ? (
                                            <>
                                              <ChevronUp className="w-3 h-3" />
                                              <span>Hide stack trace</span>
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="w-3 h-3" />
                                              <span>Show stack trace</span>
                                            </>
                                          )}
                                        </button>
                                        {groupIsStackTraceExpanded && (
                                          <button
                                            onClick={() => handleCopyStackTrace(groupLogId, groupLog.stackTrace || groupLog.stack || groupLog.error?.stack)}
                                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                            title="Copy stack trace"
                                          >
                                            {groupIsCopied ? (
                                              <>
                                                <Check className="w-3 h-3" />
                                                <span>Copied!</span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy className="w-3 h-3" />
                                                <span>Copy</span>
                                              </>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm align-middle">
                                  {groupLog.ipAddress || 'N/A'}
                                </TableCell>
                                <TableCell className="text-sm align-middle">
                                  {groupLog.userId || 'N/A'}
                                </TableCell>
                                <TableCell className="align-middle">
                                  <div className="flex items-center justify-center">
                                    <button 
                                      onClick={() => handleViewLog(groupLog)}
                                      className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex-shrink-0"
                                      title="View Details"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {/* Expanded stack trace for grouped logs */}
                              {groupHasStackTrace && groupIsStackTraceExpanded && (
                                <TableRow className="bg-gray-50/30">
                                  <TableCell colSpan={8} className="p-4 pl-12">
                                    <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                                      <pre className="whitespace-pre-wrap break-words">
                                        {groupLog.stackTrace || groupLog.stack || groupLog.error?.stack || 'No stack trace available'}
                                      </pre>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {logs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalLogs)} of {totalLogs} logs
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
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || isLoading}
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
                    disabled={currentPage === totalPages || isLoading}
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

      {/* Log Details Modal */}
      {showLogModal && selectedLog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogModal(false)
              setSelectedLog(null)
            }
          }}
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Log Details</h3>
                <button
                  onClick={() => {
                    setShowLogModal(false)
                    setSelectedLog(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <div className="mt-1">
                    <p className="text-sm text-gray-900 font-mono" title={formatTimestamp(selectedLog.timestamp).absolute}>
                      {formatTimestamp(selectedLog.timestamp).relative}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatTimestamp(selectedLog.timestamp).absolute}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Level</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(selectedLog.level)}`}>
                      {selectedLog.level}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(selectedLog.type)}`}>
                      {selectedLog.type?.replace('_', ' ') || 'N/A'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedLog.success ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                      {selectedLog.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Action</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.action || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Details</label>
                  <p className="text-sm text-gray-900 mt-1 break-words">{selectedLog.details || selectedLog.message || '-'}</p>
                </div>
                {(selectedLog.stackTrace || selectedLog.stack || selectedLog.error?.stack) && (
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-500">Stack Trace</label>
                      <button
                        onClick={() => handleCopyStackTrace('modal', selectedLog.stackTrace || selectedLog.stack || selectedLog.error?.stack)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                        title="Copy stack trace"
                      >
                        {copiedStackTraces.has('modal') ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap break-words">
                        {selectedLog.stackTrace || selectedLog.stack || selectedLog.error?.stack || 'No stack trace available'}
                      </pre>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">IP Address</label>
                  <p className="text-sm text-gray-900 font-mono mt-1">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">User</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.userId || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">User Agent</label>
                  <p className="text-sm text-gray-900 break-all mt-1">{selectedLog.userAgent || '-'}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowLogModal(false)
                  setSelectedLog(null)
                }}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SafeComponent>
  )
}

export default Logs
