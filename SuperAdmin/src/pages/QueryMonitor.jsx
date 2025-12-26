import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Activity, 
  Download,
  Filter,
  Search,
  Zap,
  BarChart3,
  PieChart,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getQueryStats, resetQueryStats } from '../services/queryMonitor'
import logger from '../utils/logger'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables'
import { BarChartComponent, PieChartComponent, LineChartComponent } from '../components/Charts'

// Slow query threshold (500ms as specified)
const SLOW_QUERY_THRESHOLD_MS = 500

const QueryMonitor = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false) // Default to false to prevent rate limits
  const [refreshInterval, setRefreshInterval] = useState(null)
  
  // Grouping & expansion state
  const [groupByFingerprint, setGroupByFingerprint] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [copiedQueries, setCopiedQueries] = useState(new Set())
  const [collapsedQueries, setCollapsedQueries] = useState(new Set())
  
  // Trend comparison
  const [previousStats, setPreviousStats] = useState(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModel, setFilterModel] = useState('all')
  const [filterOperation, setFilterOperation] = useState('all')
  const [sortBy, setSortBy] = useState('duration') // 'duration', 'timestamp', 'model'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc', 'desc'

  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const cachedStatsRef = useRef(null)
  const refreshThrottleTimerRef = useRef(null)
  const lastFetchTimeRef = useRef(null)
  const hasInitialFetchRef = useRef(false) // Track if initial fetch has completed

  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      if (refreshThrottleTimerRef.current) {
        clearTimeout(refreshThrottleTimerRef.current)
      }
    }
  }, [])

  // Normalize query to create fingerprint (ignore parameter values)
  const normalizeQuery = useCallback((query) => {
    if (!query) return ''
    try {
      const queryStr = typeof query === 'string' ? query : JSON.stringify(query)
      // Replace parameter values with placeholders
      return queryStr
        .replace(/:\s*["']?[^"',}\]]+["']?/g, ':?') // Replace values after colons
        .replace(/\d+/g, '?') // Replace numbers
        .replace(/["'][^"']*["']/g, '?') // Replace string values
        .trim()
    } catch {
      return String(query)
    }
  }, [])

  // Create query fingerprint
  const createFingerprint = useCallback((query) => {
    const normalized = normalizeQuery(query)
    return `${normalized}`.substring(0, 100) // Limit length for grouping
  }, [normalizeQuery])

  // Group queries by fingerprint
  const groupQueriesByFingerprint = useCallback((queries) => {
    const groups = new Map()
    
    queries.forEach(query => {
      const fingerprint = createFingerprint(query.query)
      if (!groups.has(fingerprint)) {
        groups.set(fingerprint, {
          fingerprint,
          queries: [],
          count: 0,
          avgDuration: 0,
          p95Duration: 0,
          maxDuration: 0,
          minDuration: Infinity,
          model: query.model,
          operation: query.operation
        })
      }
      
      const group = groups.get(fingerprint)
      group.queries.push(query)
      group.count++
    })

    // Calculate stats for each group
    groups.forEach(group => {
      const durations = group.queries.map(q => q.duration).sort((a, b) => a - b)
      group.avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      group.p95Duration = durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1]
      group.maxDuration = Math.max(...durations)
      group.minDuration = Math.min(...durations)
    })

    return Array.from(groups.values())
  }, [createFingerprint])

  // Fetch stats with caching and request deduplication
  const fetchStats = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate concurrent calls
    if (isFetchingRef.current && !forceRefresh) {
      logger.debug('Query stats fetch already in progress, skipping duplicate call')
      return
    }

    // Throttle live updates (min 5 seconds between fetches to avoid rate limits)
    const now = Date.now()
    if (lastFetchTimeRef.current && (now - lastFetchTimeRef.current) < 5000 && !forceRefresh) {
      logger.debug('Throttling query stats fetch')
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true
    lastFetchTimeRef.current = now

    // Show cached data immediately if available
    if (cachedStatsRef.current && isMountedRef.current) {
      setStats(cachedStatsRef.current)
    }

    if (isMountedRef.current) {
      setLoading(true)
    }

    try {
      const data = await getQueryStats()
      
      if (abortControllerRef.current?.signal?.aborted) {
        return
      }

      if (!isMountedRef.current) return

      // Store previous stats for trend comparison (use ref to avoid dependency)
      const currentStats = cachedStatsRef.current
      if (currentStats) {
        setPreviousStats(currentStats)
      }

      setStats(data)
      cachedStatsRef.current = data
    } catch (error) {
      if (abortControllerRef.current?.signal?.aborted || error.name === 'AbortError' || error.name === 'CanceledError') {
        return
      }
      
      if (!isMountedRef.current) return

      // Check if it's a rate limit error
      const errorMessage = error?.message || ''
      const errorCode = error?.code || error?.response?.data?.code || ''
      const isRateLimit = errorCode === 'RATE_5001' || 
                         error?.response?.status === 429 ||
                         errorMessage.toLowerCase().includes('rate limit') ||
                         errorMessage.toLowerCase().includes('too many requests')
      
      if (isRateLimit) {
        logger.warn('Rate limit exceeded for query stats, using cached data')
        // Don't show error toast for rate limits, just use cached data silently
        if (cachedStatsRef.current) {
          setStats(cachedStatsRef.current)
          // Extend throttle time on rate limit to prevent further hits (add 30 seconds penalty)
          lastFetchTimeRef.current = Date.now() + 30000
        }
        // Disable auto-refresh temporarily if it's enabled
        if (isMountedRef.current && autoRefresh) {
          setAutoRefresh(false)
          if (refreshInterval) {
            clearInterval(refreshInterval)
            setRefreshInterval(null)
          }
          toast.warning('Auto-refresh paused due to rate limit. Please refresh manually.', { duration: 5000 })
        }
      } else {
      logger.error('Error fetching query stats:', error)
        
        // Partial failure handling - show cached data if available
        if (cachedStatsRef.current) {
          setStats(cachedStatsRef.current)
          toast.error('Failed to fetch query statistics. Showing cached data.', { duration: 3000 })
        } else {
      toast.error('Failed to fetch query statistics')
        }
      }
    } finally {
      if (isMountedRef.current) {
      setLoading(false)
    }
      isFetchingRef.current = false
  }
  }, []) // Remove stats dependency to prevent infinite loop

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all query statistics? This action cannot be undone.')) {
      return
    }

    try {
      await resetQueryStats()
      toast.success('Query statistics reset successfully')
      await fetchStats()
      setCurrentPage(1) // Reset to first page
    } catch (error) {
      logger.error('Error resetting query stats:', error)
      toast.error('Failed to reset query statistics')
    }
  }

  const handleExport = (format) => {
    if (!stats?.slowQueries || stats.slowQueries.length === 0) {
      toast.error('No data to export')
      return
    }

    const data = filteredSlowQueries
    let content = ''
    let filename = ''
    let mimeType = ''

    if (format === 'csv') {
      const headers = ['Timestamp', 'Model', 'Operation', 'Duration (ms)', 'Query']
      const rows = data.map(q => [
        new Date(q.timestamp).toISOString(),
        q.model,
        q.operation,
        q.duration,
        JSON.stringify(q.query)
      ])
      content = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
      filename = `query-stats-${new Date().toISOString().split('T')[0]}.csv`
      mimeType = 'text/csv'
    } else {
      content = JSON.stringify(data, null, 2)
      filename = `query-stats-${new Date().toISOString().split('T')[0]}.json`
      mimeType = 'application/json'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.length} queries as ${format.toUpperCase()}`)
  }

  // Initial fetch - only run once on mount
  useEffect(() => {
    if (isMountedRef.current && !hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true
      fetchStats(true)
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only fetch once on mount

  // Auto-refresh with throttling (increased interval to avoid rate limits)
  useEffect(() => {
    if (!isMountedRef.current) return

    if (autoRefresh) {
      const interval = setInterval(() => {
        if (isMountedRef.current) {
        fetchStats()
        }
      }, 10000) // 10 seconds interval, throttled to min 5 seconds between actual fetches
      setRefreshInterval(interval)
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [autoRefresh, fetchStats])

  // Filter and sort slow queries (or groups)
  const { filteredSlowQueries, groupedQueries } = useMemo(() => {
    if (!stats?.slowQueries) return { filteredSlowQueries: [], groupedQueries: [] }

    let filtered = [...stats.slowQueries]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(q => 
        q.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(q.query).toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Model filter
    if (filterModel !== 'all') {
      filtered = filtered.filter(q => q.model === filterModel)
    }

    // Operation filter
    if (filterOperation !== 'all') {
      filtered = filtered.filter(q => q.operation === filterOperation)
    }

    // Sort individual queries
    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'duration':
          aVal = a.duration
          bVal = b.duration
          break
        case 'timestamp':
          aVal = new Date(a.timestamp).getTime()
          bVal = new Date(b.timestamp).getTime()
          break
        case 'model':
          aVal = a.model
          bVal = b.model
          break
        default:
          aVal = a.duration
          bVal = b.duration
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    // Group by fingerprint if enabled
    let grouped = []
    if (groupByFingerprint && filtered.length > 0) {
      grouped = groupQueriesByFingerprint(filtered)
      
      // Sort groups
      grouped.sort((a, b) => {
        let aVal, bVal
        switch (sortBy) {
          case 'duration':
            aVal = a.avgDuration
            bVal = b.avgDuration
            break
          case 'timestamp':
            // Use most recent query in group
            aVal = Math.max(...a.queries.map(q => new Date(q.timestamp).getTime()))
            bVal = Math.max(...b.queries.map(q => new Date(q.timestamp).getTime()))
            break
          case 'model':
            aVal = a.model
            bVal = b.model
            break
          default:
            aVal = a.avgDuration
            bVal = b.avgDuration
        }

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        }
      })
    }

    return { filteredSlowQueries: filtered, groupedQueries: grouped }
  }, [stats?.slowQueries, searchTerm, filterModel, filterOperation, sortBy, sortOrder, groupByFingerprint, groupQueriesByFingerprint])

  // Get unique models and operations for filters
  const uniqueModels = useMemo(() => {
    if (!stats?.slowQueries) return []
    return [...new Set(stats.slowQueries.map(q => q.model))].sort()
  }, [stats?.slowQueries])

  const uniqueOperations = useMemo(() => {
    if (!stats?.slowQueries) return []
    return [...new Set(stats.slowQueries.map(q => q.operation))].sort()
  }, [stats?.slowQueries])

  // Memoize previous groups for trend calculation
  const previousGroups = useMemo(() => {
    if (!previousStats?.slowQueries) return []
    return groupQueriesByFingerprint(previousStats.slowQueries)
  }, [previousStats?.slowQueries, groupQueriesByFingerprint])

  // Pagination calculations (use groups if grouping enabled, otherwise individual queries)
  const displayItems = groupByFingerprint ? groupedQueries : filteredSlowQueries
  const totalPages = Math.ceil(displayItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = displayItems.slice(startIndex, endIndex)

  // Chart data
  const modelDistribution = useMemo(() => {
    if (!stats?.slowQueries) return []
    const counts = {}
    stats.slowQueries.forEach(q => {
      counts[q.model] = (counts[q.model] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [stats?.slowQueries])

  const operationDistribution = useMemo(() => {
    if (!stats?.slowQueries) return []
    const counts = {}
    stats.slowQueries.forEach(q => {
      counts[q.operation] = (counts[q.operation] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [stats?.slowQueries])

  const durationTrend = useMemo(() => {
    if (!stats?.slowQueries) return []
    // Group by hour and calculate average duration
    const hourly = {}
    stats.slowQueries.forEach(q => {
      const hour = new Date(q.timestamp).toISOString().slice(0, 13) + ':00'
      if (!hourly[hour]) {
        hourly[hour] = { count: 0, total: 0 }
      }
      hourly[hour].count++
      hourly[hour].total += q.duration
    })
    return Object.entries(hourly)
      .map(([name, data]) => ({
        name: new Date(name).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        count: data.count,
        avgDuration: Math.round(data.total / data.count)
      }))
      .sort((a, b) => new Date(a.name) - new Date(b.name))
      .slice(-10) // Last 10 hours
  }, [stats?.slowQueries])

  const formatDuration = (ms) => {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`
    if (ms < 1000) return `${ms.toFixed(2)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  // Get severity color based on threshold (500ms)
  const getSeverityColor = useCallback((duration) => {
    if (duration > SLOW_QUERY_THRESHOLD_MS * 4) return 'text-red-700 bg-red-100 border-red-300 font-bold'
    if (duration > SLOW_QUERY_THRESHOLD_MS * 2) return 'text-red-600 bg-red-50 border-red-200 font-semibold'
    if (duration > SLOW_QUERY_THRESHOLD_MS) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  }, [])

  // Get severity icon
  const getSeverityIcon = useCallback((duration) => {
    if (duration > SLOW_QUERY_THRESHOLD_MS * 4) return <AlertTriangle className="w-4 h-4 text-red-700" />
    if (duration > SLOW_QUERY_THRESHOLD_MS * 2) return <AlertTriangle className="w-4 h-4 text-red-600" />
    if (duration > SLOW_QUERY_THRESHOLD_MS) return <AlertTriangle className="w-4 h-4 text-orange-600" />
    return null
  }, [])

  // Calculate trend (compare with previous window)
  const getTrend = useCallback((currentAvg, previousAvg) => {
    if (!previousAvg || previousAvg === 0) return null
    const change = ((currentAvg - previousAvg) / previousAvg) * 100
    if (Math.abs(change) < 5) return null // Ignore small changes
    return {
      change: Math.round(change),
      isSlowing: change > 0,
      isSpeeding: change < 0
    }
  }, [])

  // Copy query to clipboard
  const handleCopyQuery = useCallback(async (query, index) => {
    try {
      const queryText = typeof query === 'string' ? query : JSON.stringify(query, null, 2)
      await navigator.clipboard.writeText(queryText)
      setCopiedQueries(prev => new Set([...prev, index]))
      toast.success('Query copied to clipboard')
      setTimeout(() => {
        setCopiedQueries(prev => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
      }, 2000)
    } catch (error) {
      logger.error('Failed to copy query:', error)
      toast.error('Failed to copy query')
    }
  }, [])

  // Toggle query collapse
  const toggleQueryCollapse = useCallback((index) => {
    setCollapsedQueries(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((fingerprint) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(fingerprint)) {
        next.delete(fingerprint)
      } else {
        next.add(fingerprint)
      }
      return next
    })
  }, [])

  const slowQueryRate = stats?.totalQueries 
    ? ((stats.slowQueriesCount / stats.totalQueries) * 100).toFixed(2)
    : 0

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Enhanced Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Query Performance Monitor</h1>
                <p className="text-blue-100 mt-2 text-lg">Real-time database query performance tracking</p>
              </div>
            </div>
            {autoRefresh && (
              <div className="flex items-center space-x-2 mt-4">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">Auto-refreshing every 10 seconds</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 ${
                autoRefresh 
                  ? 'bg-white/20 backdrop-blur-sm text-white border-2 border-white/30' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-2 border-white/20'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>Auto-refresh</span>
            </button>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-4 py-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border-2 border-white/30"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="relative group">
              <button className="px-4 py-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border-2 border-white/30">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-10 border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
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
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-4 py-2.5 bg-red-500/80 hover:bg-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Reset Stats
            </button>
          </div>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Enhanced Key Metrics with Animations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
            <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-l-blue-500">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-lg">
                      <Database className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Queries</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">
                        {stats?.totalQueries?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-l-red-500">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-br from-red-400 to-red-600 rounded-xl shadow-lg">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Slow Queries</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">
                        {stats?.slowQueriesCount?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-red-600 font-semibold mt-1">
                        {slowQueryRate}% of total
                      </p>
                    </div>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400 opacity-50" />
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(slowQueryRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-l-green-500">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-br from-green-400 to-green-600 rounded-xl shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Query Time</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">
                        {stats?.averageQueryTime ? formatDuration(stats.averageQueryTime) : '0ms'}
                      </p>
                      {stats?.averageQueryTime && stats.averageQueryTime < stats?.threshold && (
                        <p className="text-xs text-green-600 font-semibold mt-1 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Below threshold
                        </p>
                      )}
                    </div>
                  </div>
                  <Clock className="w-8 h-8 text-green-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-l-yellow-500">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl shadow-lg">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Max Query Time</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">
                        {stats?.maxQueryTime ? formatDuration(stats.maxQueryTime) : '0ms'}
                      </p>
                      {stats?.maxQueryTime && stats.maxQueryTime > stats?.threshold * 10 && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center">
                          <XCircle className="w-3 h-3 mr-1" />
                          Critical
                        </p>
                      )}
                    </div>
                  </div>
                  <TrendingUp className="w-8 h-8 text-yellow-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          {stats?.slowQueries && stats.slowQueries.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              <Card className="hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <span>Slow Queries by Model</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {modelDistribution.length > 0 ? (
                    <BarChartComponent 
                      data={modelDistribution} 
                      dataKey="value" 
                      name="Slow Queries"
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-8">No data available</p>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="w-5 h-5 text-purple-600" />
                    <span>Operation Distribution</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {operationDistribution.length > 0 ? (
                    <PieChartComponent 
                      data={operationDistribution} 
                      dataKey="value" 
                      nameKey="name"
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-8">No data available</p>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span>Query Duration Trend (Last 10 Hours)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {durationTrend.length > 0 ? (
                    <LineChartComponent 
                      data={durationTrend} 
                      dataKey="avgDuration" 
                      name="Avg Duration (ms)"
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-8">No data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Slow Queries Table with Filters */}
          <Card className="hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-red-600" />
                    <span>Slow Queries</span>
                    <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-semibold">
                      {displayItems.length}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Queries exceeding the {SLOW_QUERY_THRESHOLD_MS}ms threshold
                  </p>
                </div>
              </div>
              
              {/* Grouping Toggle */}
              <div className="mt-4 flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupByFingerprint}
                    onChange={(e) => setGroupByFingerprint(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Group by query fingerprint</span>
                </label>
              </div>
              
              {/* Filters */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search queries..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterModel}
                  onChange={(e) => {
                    setFilterModel(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Models</option>
                  {uniqueModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <select
                  value={filterOperation}
                  onChange={(e) => {
                    setFilterOperation(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Operations</option>
                  {uniqueOperations.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="duration">Sort by Duration</option>
                    <option value="timestamp">Sort by Time</option>
                    <option value="model">Sort by Model</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {paginatedItems.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {groupByFingerprint && <TableHead className="w-8"></TableHead>}
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Operation</TableHead>
                          <TableHead>Duration</TableHead>
                          {groupByFingerprint && (
                            <>
                              <TableHead>Count</TableHead>
                              <TableHead>Avg / P95</TableHead>
                              <TableHead>Trend</TableHead>
                            </>
                          )}
                          <TableHead>Query Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedItems.map((item, index) => {
                          const globalIndex = startIndex + index
                          const isGroup = groupByFingerprint && item.queries
                          const isExpanded = isGroup && expandedGroups.has(item.fingerprint)
                          const isCollapsed = collapsedQueries.has(globalIndex)
                          const wasCopied = copiedQueries.has(globalIndex)

                          // Calculate trend for groups
                          let trend = null
                          if (isGroup && previousGroups.length > 0) {
                            const prevGroup = previousGroups.find(g => g.fingerprint === item.fingerprint)
                            if (prevGroup) {
                              trend = getTrend(item.avgDuration, prevGroup.avgDuration)
                            }
                          }

                          if (isGroup) {
                            // Render grouped query
                            return (
                              <React.Fragment key={item.fingerprint}>
                                <TableRow className={`hover:bg-gray-50 transition-colors ${item.avgDuration > SLOW_QUERY_THRESHOLD_MS ? 'bg-red-50/30' : ''}`}>
                                  <TableCell>
                                    <button
                                      onClick={() => toggleGroupExpansion(item.fingerprint)}
                                      className="p-1 hover:bg-gray-200 rounded"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </button>
                                  </TableCell>
                                  <TableCell className="text-sm font-mono">
                                    {formatDate(item.queries[0]?.timestamp)}
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-semibold text-gray-900">{item.model}</span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                      {item.operation}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {getSeverityIcon(item.avgDuration)}
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(item.avgDuration)}`}>
                                        {formatDuration(item.avgDuration)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                      {item.count}x
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-xs">
                                      <div>Avg: {formatDuration(item.avgDuration)}</div>
                                      <div className="text-gray-500">P95: {formatDuration(item.p95Duration)}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {trend && (
                                      <div className="flex items-center gap-1 text-xs">
                                        {trend.isSlowing ? (
                                          <>
                                            <TrendingUp className="w-4 h-4 text-red-600" />
                                            <span className="text-red-600 font-semibold">+{trend.change}%</span>
                                          </>
                                        ) : trend.isSpeeding ? (
                                          <>
                                            <TrendingDown className="w-4 h-4 text-green-600" />
                                            <span className="text-green-600 font-semibold">{trend.change}%</span>
                                          </>
                                        ) : null}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleCopyQuery(item.queries[0]?.query, globalIndex)}
                                        className="p-1 hover:bg-gray-200 rounded"
                                        title="Copy query"
                                      >
                                        {wasCopied ? (
                                          <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                          <Copy className="w-4 h-4 text-gray-600" />
                                        )}
                                      </button>
                                      <details className="cursor-pointer group">
                                        <summary className="text-sm text-blue-600 hover:text-blue-800 font-medium group-hover:underline">
                                          View Query
                                        </summary>
                                        <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                                          <pre className="text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                            {JSON.stringify(item.queries[0]?.query, null, 2)}
                                          </pre>
                                        </div>
                                      </details>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {/* Expanded group queries */}
                                {isExpanded && item.queries.map((query, qIndex) => {
                                  const queryGlobalIndex = `${globalIndex}-${qIndex}`
                                  const queryIsCollapsed = collapsedQueries.has(queryGlobalIndex)
                                  const queryWasCopied = copiedQueries.has(queryGlobalIndex)
                                  return (
                                    <TableRow key={qIndex} className="bg-gray-50/50 hover:bg-gray-100">
                                      <TableCell></TableCell>
                            <TableCell className="text-sm font-mono">
                              {formatDate(query.timestamp)}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-gray-900">{query.model}</span>
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                {query.operation}
                              </span>
                            </TableCell>
                            <TableCell>
                                        <div className="flex items-center gap-2">
                                          {getSeverityIcon(query.duration)}
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(query.duration)}`}>
                                {formatDuration(query.duration)}
                              </span>
                                        </div>
                            </TableCell>
                                      <TableCell colSpan={3}></TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCopyQuery(query.query, queryGlobalIndex)}
                                    className="p-1 hover:bg-gray-200 rounded"
                                    title="Copy query"
                                  >
                                    {queryWasCopied ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4 text-gray-600" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => toggleQueryCollapse(queryGlobalIndex)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    {queryIsCollapsed ? 'Expand Query' : 'Collapse Query'}
                                  </button>
                                </div>
                                {!queryIsCollapsed && (
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                                    <pre className="text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                    {JSON.stringify(query.query, null, 2)}
                                  </pre>
                                </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                                  )
                                })}
                              </React.Fragment>
                            )
                          } else {
                            // Render individual query
                            return (
                              <TableRow key={index} className={`hover:bg-gray-50 transition-colors ${item.duration > SLOW_QUERY_THRESHOLD_MS ? 'bg-red-50/30' : ''}`}>
                                <TableCell className="text-sm font-mono">
                                  {formatDate(item.timestamp)}
                                </TableCell>
                                <TableCell>
                                  <span className="font-semibold text-gray-900">{item.model}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                    {item.operation}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getSeverityIcon(item.duration)}
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(item.duration)}`}>
                                      {formatDuration(item.duration)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleCopyQuery(item.query, globalIndex)}
                                        className="p-1 hover:bg-gray-200 rounded"
                                        title="Copy query"
                                      >
                                        {wasCopied ? (
                                          <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                          <Copy className="w-4 h-4 text-gray-600" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => toggleQueryCollapse(globalIndex)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        {isCollapsed ? 'Expand Query' : 'Collapse Query'}
                                      </button>
                                    </div>
                                    {!isCollapsed && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                                        <pre className="text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                          {JSON.stringify(item.query, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          }
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Items per page:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value))
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <span className="text-sm text-gray-600">
                        Showing {startIndex + 1} to {Math.min(endIndex, displayItems.length)} of {displayItems.length} {groupByFingerprint ? 'query groups' : 'queries'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-1 rounded-lg transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg font-medium">No slow queries found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {searchTerm || filterModel !== 'all' || filterOperation !== 'all'
                      ? 'Try adjusting your filters'
                      : `All queries are performing within the ${stats?.threshold || 100}ms threshold`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Info */}
          <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                <span>Configuration & Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">Slow Query Threshold</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.threshold || 100}ms
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Queries exceeding this duration are logged as slow queries
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">Monitoring Status</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-lg font-semibold text-green-600">Active</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Query monitoring is enabled and tracking performance
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">Performance Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {slowQueryRate < 5 ? '🟢 Excellent' : slowQueryRate < 10 ? '🟡 Good' : '🔴 Needs Attention'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Based on slow query rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default QueryMonitor
