import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { LineChartComponent, AreaChartComponent, BarChartComponent, PieChartComponent } from '../components/Charts/index.jsx'
import { Calendar, Download, Filter, RefreshCw, TrendingUp, TrendingDown, Users, Eye, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAnalyticsSummary,
  getTimeSeriesData,
  getEventBreakdown,
  getTopFeatures,
  getDropOffPoints,
  getRecentEvents,
  getUserRetention
} from '../services/analytics'
import logger from '../utils/logger'

const Analytics = () => {
  // Data state
  const [summary, setSummary] = useState(null)
  const [timeSeries, setTimeSeries] = useState([])
  const [eventBreakdown, setEventBreakdown] = useState([])
  const [topFeatures, setTopFeatures] = useState([])
  const [dropOffs, setDropOffs] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [retention, setRetention] = useState([])
  
  // UI state
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [selectedChart, setSelectedChart] = useState('timeseries')
  const [selectedEventType, setSelectedEventType] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [loading, setLoading] = useState(false)
  const [eventsPage, setEventsPage] = useState(1)
  const [eventsSearch, setEventsSearch] = useState('')
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const periodDebounceTimerRef = useRef(null)
  
  // Period-aware cache: store data per period
  const cacheRef = useRef(new Map())
  
  // Previous period data for comparison
  const previousPeriodDataRef = useRef(null)
  
  // Error state per data type (for partial failure handling)
  const dataErrorsRef = useRef({
    summary: false,
    timeSeries: false,
    eventBreakdown: false,
    topFeatures: false,
    dropOffs: false,
    recentEvents: false,
    retention: false
  })
  
  // Export state
  const [isExportReady, setIsExportReady] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Calculate date range from period
  const getDateRange = useCallback((period) => {
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
  }, [])
  
  // Get previous period for comparison
  const getPreviousPeriodRange = useCallback((period) => {
    const { start, end } = getDateRange(period)
    const periodDuration = new Date(end).getTime() - new Date(start).getTime()
    const prevEnd = new Date(start)
    const prevStart = new Date(prevEnd.getTime() - periodDuration)
    
    return { start: prevStart.toISOString(), end: prevEnd.toISOString() }
  }, [getDateRange])
  
  // Calculate delta percentage for comparison
  const calculateDelta = useCallback((current, previous) => {
    if (!previous || previous === 0) return null
    const delta = ((current - previous) / previous) * 100
    return {
      value: Math.abs(delta).toFixed(1),
      direction: delta >= 0 ? 'up' : 'down',
      significant: Math.abs(delta) >= 5 // Show badge if change >= 5%
    }
  }, [])

  // Fetch all analytics data with caching and partial failure handling
  const fetchAllData = useCallback(async (period = selectedPeriod, forceRefresh = false) => {
    // Prevent duplicate concurrent calls
    if (isFetchingRef.current && !forceRefresh) {
      logger.debug('Analytics fetch already in progress, skipping duplicate call')
      return
    }
    
    // Check cache first (if not forcing refresh)
    const cacheKey = `${period}-${selectedEventType}-${selectedPlatform}`
    const cachedData = cacheRef.current.get(cacheKey)
    
    if (cachedData && !forceRefresh) {
      logger.debug('Using cached analytics data for period:', period)
      // Show cached data immediately
      if (isMountedRef.current) {
        setSummary(cachedData.summary)
        setTimeSeries(cachedData.timeSeries || [])
        setEventBreakdown(cachedData.eventBreakdown || [])
        setTopFeatures(cachedData.topFeatures || [])
        setDropOffs(cachedData.dropOffs || [])
        setRecentEvents(cachedData.recentEvents || [])
        setRetention(cachedData.retention || [])
        setIsExportReady(true)
        // Clear errors when showing cached data
        dataErrorsRef.current = {
          summary: false,
          timeSeries: false,
          eventBreakdown: false,
          topFeatures: false,
          dropOffs: false,
          recentEvents: false,
          retention: false
        }
      }
      
      // Revalidate in background (don't block UI)
      setTimeout(() => {
        if (isMountedRef.current) {
          fetchAllData(period, true) // Force refresh
        }
      }, 100)
      return
    }
    
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true
    
    if (isMountedRef.current) {
      setLoading(true)
    }
    
    // Store previous period data for comparison
    if (summary) {
      previousPeriodDataRef.current = {
        summary,
        period: selectedPeriod
      }
    }
    
    try {
      const { start, end } = getDateRange(period)
      
      // Fetch all data with individual error handling for partial failures
      const fetchPromises = [
        getAnalyticsSummary(start, end).then(
          (data) => {
            if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
              setSummary(data.summary)
              dataErrorsRef.current.summary = false
            }
            return { type: 'summary', data: data.summary }
          },
          (error) => {
            if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
              logger.error('Failed to fetch summary:', error)
              dataErrorsRef.current.summary = true
            }
            return { type: 'summary', data: null, error: true }
          }
        ),
        getTimeSeriesData({ 
          startDate: start, 
          endDate: end, 
          eventType: selectedEventType || undefined, 
          platform: selectedPlatform || undefined 
        }).then(
          (data) => {
            if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
              setTimeSeries(data.timeSeries || [])
              dataErrorsRef.current.timeSeries = false
            }
            return { type: 'timeSeries', data: data.timeSeries || [] }
          },
          (error) => {
            if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
              logger.error('Failed to fetch time series:', error)
              dataErrorsRef.current.timeSeries = true
            }
            return { type: 'timeSeries', data: [], error: true }
          }
        ),
        getEventBreakdown({ startDate: start, endDate: end }).then(
          (data) => {
            if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
              setEventBreakdown(data.breakdown || [])
              dataErrorsRef.current.eventBreakdown = false
            }
            return { type: 'eventBreakdown', data: data.breakdown || [] }
          },
          (error) => {
            if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
              logger.error('Failed to fetch event breakdown:', error)
              dataErrorsRef.current.eventBreakdown = true
            }
            return { type: 'eventBreakdown', data: [], error: true }
          }
        ),
        getTopFeatures({ startDate: start, endDate: end }).then(
          (data) => {
            if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
              setTopFeatures(data.features || [])
              dataErrorsRef.current.topFeatures = false
            }
            return { type: 'topFeatures', data: data.features || [] }
          },
          (error) => {
            if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
              logger.error('Failed to fetch top features:', error)
              dataErrorsRef.current.topFeatures = true
            }
            return { type: 'topFeatures', data: [], error: true }
          }
        ),
        getDropOffPoints({ startDate: start, endDate: end }).then(
          (data) => {
            if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
              setDropOffs(data.dropOffs || [])
              dataErrorsRef.current.dropOffs = false
            }
            return { type: 'dropOffs', data: data.dropOffs || [] }
          },
          (error) => {
            if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
              logger.error('Failed to fetch drop-offs:', error)
              dataErrorsRef.current.dropOffs = true
            }
            return { type: 'dropOffs', data: [], error: true }
          }
        ),
        getRecentEvents({ 
          page: eventsPage, 
          limit: 50, 
          eventType: selectedEventType || undefined, 
          platform: selectedPlatform || undefined, 
          startDate: start, 
          endDate: end, 
          search: eventsSearch || undefined 
        }).then(
          (data) => {
            if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
              setRecentEvents(data.events || [])
              dataErrorsRef.current.recentEvents = false
            }
            return { type: 'recentEvents', data: data.events || [] }
          },
          (error) => {
            if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
              logger.error('Failed to fetch recent events:', error)
              dataErrorsRef.current.recentEvents = true
            }
            return { type: 'recentEvents', data: [], error: true }
          }
        ),
        getUserRetention(start, end).then(
          (data) => {
            if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
              setRetention(data.retention || [])
              dataErrorsRef.current.retention = false
            }
            return { type: 'retention', data: data.retention || [] }
          },
          (error) => {
            if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
              logger.error('Failed to fetch retention:', error)
              dataErrorsRef.current.retention = true
            }
            return { type: 'retention', data: [], error: true }
          }
        )
      ]
      
      const results = await Promise.allSettled(fetchPromises)
      
      // Cache successful data
      if (!abortControllerRef.current?.signal?.aborted && isMountedRef.current) {
        // Extract data from results
        const getResultData = (type) => {
          const result = results.find(r => r.status === 'fulfilled' && r.value?.type === type)
          return result?.value?.data || null
        }
        
        const cacheData = {
          summary: getResultData('summary') || summary,
          timeSeries: getResultData('timeSeries') || timeSeries,
          eventBreakdown: getResultData('eventBreakdown') || eventBreakdown,
          topFeatures: getResultData('topFeatures') || topFeatures,
          dropOffs: getResultData('dropOffs') || dropOffs,
          recentEvents: getResultData('recentEvents') || recentEvents,
          retention: getResultData('retention') || retention,
          timestamp: Date.now()
        }
        
        cacheRef.current.set(cacheKey, cacheData)
        
        // Mark export as ready if we have at least summary data
        setIsExportReady(!!cacheData.summary)
      }
      
    } catch (error) {
      if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
        logger.error('Failed to fetch analytics data:', error)
        if (isMountedRef.current) {
          toast.error('Failed to fetch some analytics data. Some charts may be unavailable.')
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [selectedPeriod, selectedEventType, selectedPlatform, eventsPage, eventsSearch, getDateRange])

  // Debounced period change handler
  const handlePeriodChange = useCallback((newPeriod) => {
    // Clear existing debounce timer
    if (periodDebounceTimerRef.current) {
      clearTimeout(periodDebounceTimerRef.current)
    }
    
    // Cancel in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Debounce period change (350ms)
    periodDebounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setSelectedPeriod(newPeriod)
      }
    }, 350)
  }, [])
  
  // Initial fetch on mount
  useEffect(() => {
    if (!isMountedRef.current) return
    
    fetchAllData(selectedPeriod, false)
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount
  
  // Fetch data when period changes (after debounce)
  useEffect(() => {
    if (!isMountedRef.current) return
    
    fetchAllData(selectedPeriod, false)
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod])
  
  // Fetch data when filters/search change (immediate, no debounce)
  useEffect(() => {
    if (!isMountedRef.current) return
    
    fetchAllData(selectedPeriod, false)
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventType, selectedPlatform, eventsPage, eventsSearch])
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (periodDebounceTimerRef.current) {
        clearTimeout(periodDebounceTimerRef.current)
      }
      isFetchingRef.current = false
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    if (isFetchingRef.current) return
    
    await fetchAllData(selectedPeriod, true) // Force refresh
    if (isMountedRef.current) {
      toast.success('Analytics data refreshed successfully')
    }
  }, [selectedPeriod, fetchAllData])
  
  const handleExport = useCallback(() => {
    if (!isExportReady || isExporting) {
      toast('Please wait for data to load', { icon: 'ℹ️' })
      return
    }
    
    setIsExporting(true)
    
    try {
      // Prepare export data
      const exportData = {
        period: selectedPeriod,
        summary,
        timeSeries,
        eventBreakdown,
        topFeatures,
        dropOffs,
        recentEvents,
        retention,
        exportedAt: new Date().toISOString()
      }
      
      // Convert to CSV format (simple implementation)
      const csvRows = []
      csvRows.push('Metric,Value')
      csvRows.push(`Period,${selectedPeriod}`)
      csvRows.push(`DAU,${summary?.dau || 0}`)
      csvRows.push(`MAU,${summary?.mau || 0}`)
      csvRows.push(`Post Views,${summary?.postViews || 0}`)
      csvRows.push(`Total Events,${summary?.totalEvents || 0}`)
      csvRows.push(`Engagement Rate,${summary?.engagementRate?.toFixed(2) || 0}%`)
      csvRows.push(`Total Posts,${summary?.totalPosts || 0}`)
      csvRows.push(`Crashes,${summary?.crashCount || 0}`)
      
      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('Analytics data exported successfully')
    } catch (error) {
      logger.error('Export failed:', error)
      toast.error('Failed to export analytics data')
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false)
      }
    }
  }, [isExportReady, isExporting, selectedPeriod, summary, timeSeries, eventBreakdown, topFeatures, dropOffs, recentEvents, retention])

  // Memoized chart data transformations
  const timeSeriesChartData = useMemo(() => {
    return timeSeries.map(item => ({
      name: item.date,
      events: item.totalEvents,
      users: item.uniqueUsers
    }))
  }, [timeSeries])

  const breakdownChartData = useMemo(() => {
    return eventBreakdown.slice(0, 10).map(item => ({
      name: item.name,
      value: item.count,
      users: item.uniqueUsers
    }))
  }, [eventBreakdown])

  const featuresChartData = useMemo(() => {
    return topFeatures.map(item => ({
      name: item.featureName,
      usage: item.usageCount,
      users: item.uniqueUsers
    }))
  }, [topFeatures])

  const dropOffsChartData = useMemo(() => {
    return dropOffs.map(item => ({
      name: item.step,
      count: item.dropOffCount,
      users: item.affectedUsers
    }))
  }, [dropOffs])

  const retentionChartData = useMemo(() => {
    return retention.map(item => ({
      day: item.cohortDate,
      day1: parseFloat(item.day1Retention),
      day7: parseFloat(item.day7Retention),
      day14: parseFloat(item.day14Retention),
      day30: parseFloat(item.day30Retention)
    }))
  }, [retention])
  
  // Calculate comparison deltas for KPIs
  const comparisonDeltas = useMemo(() => {
    if (!summary || !previousPeriodDataRef.current?.summary) {
      return {
        dau: null,
        mau: null,
        postViews: null,
        totalEvents: null,
        engagementRate: null,
        totalPosts: null,
        crashCount: null
      }
    }
    
    const prev = previousPeriodDataRef.current.summary
    
    return {
      dau: calculateDelta(summary.dau || 0, prev.dau || 0),
      mau: calculateDelta(summary.mau || 0, prev.mau || 0),
      postViews: calculateDelta(summary.postViews || 0, prev.postViews || 0),
      totalEvents: calculateDelta(summary.totalEvents || 0, prev.totalEvents || 0),
      engagementRate: calculateDelta(summary.engagementRate || 0, prev.engagementRate || 0),
      totalPosts: calculateDelta(summary.totalPosts || 0, prev.totalPosts || 0),
      crashCount: calculateDelta(summary.crashCount || 0, prev.crashCount || 0)
    }
  }, [summary, calculateDelta])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Comprehensive analytics and insights
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <select
            className="input min-w-[160px]"
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button 
            onClick={handleRefresh}
            disabled={loading || isFetchingRef.current}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={handleExport}
            disabled={!isExportReady || isExporting}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isExportReady ? 'Preparing data...' : isExporting ? 'Exporting...' : 'Export analytics data'}
          >
            <Download className={`w-4 h-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-600">Daily Active Users</p>
                    {dataErrorsRef.current.summary && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" title="Data may be unavailable" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary?.dau || 0}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      Monthly: {summary?.mau || 0}
                    </p>
                    {comparisonDeltas.dau?.significant && (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        comparisonDeltas.dau.direction === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {comparisonDeltas.dau.direction === 'up' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        {comparisonDeltas.dau.value}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Eye className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-600">Post Views</p>
                    {dataErrorsRef.current.summary && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" title="Data may be unavailable" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary?.postViews?.toLocaleString() || 0}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      Total Events: {summary?.totalEvents?.toLocaleString() || 0}
                    </p>
                    {comparisonDeltas.postViews?.significant && (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        comparisonDeltas.postViews.direction === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {comparisonDeltas.postViews.direction === 'up' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        {comparisonDeltas.postViews.value}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                    {dataErrorsRef.current.summary && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" title="Data may be unavailable" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary?.engagementRate?.toFixed(1) || 0}%
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      Total Posts: {summary?.totalPosts?.toLocaleString() || 0}
                    </p>
                    {comparisonDeltas.engagementRate?.significant && (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        comparisonDeltas.engagementRate.direction === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {comparisonDeltas.engagementRate.direction === 'up' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        {comparisonDeltas.engagementRate.value}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-600">Crashes</p>
                    {dataErrorsRef.current.summary && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" title="Data may be unavailable" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary?.crashCount || 0}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      Unresolved errors
                    </p>
                    {comparisonDeltas.crashCount?.significant && (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        comparisonDeltas.crashCount.direction === 'up' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {comparisonDeltas.crashCount.direction === 'up' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        {comparisonDeltas.crashCount.value}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4 items-start lg:items-center">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <select
              className="input w-full sm:w-auto"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
            >
              <option value="">All Event Types</option>
              <option value="post_view">Post Views</option>
              <option value="post_liked">Likes</option>
              <option value="comment_added">Comments</option>
              <option value="feature_usage">Feature Usage</option>
              <option value="drop_off">Drop-offs</option>
            </select>
            <select
              className="input w-full sm:w-auto"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
            >
              <option value="">All Platforms</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
              <option value="web">Web</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Chart Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedChart('timeseries')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'timeseries'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Time Series
            </button>
            <button
              onClick={() => setSelectedChart('breakdown')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'breakdown'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Event Breakdown
            </button>
            <button
              onClick={() => setSelectedChart('features')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'features'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Top Features
            </button>
            <button
              onClick={() => setSelectedChart('dropoffs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'dropoffs'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Drop-offs
            </button>
            <button
              onClick={() => setSelectedChart('retention')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'retention'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              User Retention
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedChart === 'timeseries' && 'Event Time Series'}
                {selectedChart === 'breakdown' && 'Event Breakdown by Type'}
                {selectedChart === 'features' && 'Top Features Usage'}
                {selectedChart === 'dropoffs' && 'Drop-off Points'}
                {selectedChart === 'retention' && 'User Retention'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Lazy-load charts only when selected */}
              {selectedChart === 'timeseries' && (
                <div className="relative">
                  {dataErrorsRef.current.timeSeries && (
                    <div className="absolute top-2 right-2 z-10">
                      <AlertTriangle className="w-5 h-5 text-amber-500" title="Time series data unavailable" />
                    </div>
                  )}
                  {timeSeriesChartData.length > 0 ? (
                    <LineChartComponent data={timeSeriesChartData} dataKey="events" name="Events" />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      {loading ? 'Loading time series data...' : 'No time series data available'}
                    </div>
                  )}
                </div>
              )}
              
              {selectedChart === 'breakdown' && (
                <div className="relative">
                  {dataErrorsRef.current.eventBreakdown && (
                    <div className="absolute top-2 right-2 z-10">
                      <AlertTriangle className="w-5 h-5 text-amber-500" title="Event breakdown data unavailable" />
                    </div>
                  )}
                  {breakdownChartData.length > 0 ? (
                    <PieChartComponent data={breakdownChartData} dataKey="value" nameKey="name" />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      {loading ? 'Loading breakdown data...' : 'No breakdown data available'}
                    </div>
                  )}
                </div>
              )}
              
              {selectedChart === 'features' && (
                <div className="relative">
                  {dataErrorsRef.current.topFeatures && (
                    <div className="absolute top-2 right-2 z-10">
                      <AlertTriangle className="w-5 h-5 text-amber-500" title="Top features data unavailable" />
                    </div>
                  )}
                  {featuresChartData.length > 0 ? (
                    <BarChartComponent data={featuresChartData} dataKey="usage" name="Usage Count" />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      {loading ? 'Loading features data...' : 'No features data available'}
                    </div>
                  )}
                </div>
              )}
              
              {selectedChart === 'dropoffs' && (
                <div className="relative">
                  {dataErrorsRef.current.dropOffs && (
                    <div className="absolute top-2 right-2 z-10">
                      <AlertTriangle className="w-5 h-5 text-amber-500" title="Drop-off data unavailable" />
                    </div>
                  )}
                  {dropOffsChartData.length > 0 ? (
                    <BarChartComponent data={dropOffsChartData} dataKey="count" name="Drop-off Count" />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      {loading ? 'Loading drop-off data...' : 'No drop-off data available'}
                    </div>
                  )}
                </div>
              )}
              
              {selectedChart === 'retention' && (
                <div className="relative">
                  {dataErrorsRef.current.retention && (
                    <div className="absolute top-2 right-2 z-10">
                      <AlertTriangle className="w-5 h-5 text-amber-500" title="Retention data unavailable" />
                    </div>
                  )}
                  {retentionChartData.length > 0 ? (
                    <LineChartComponent data={retentionChartData} dataKey="day30" name="30-Day Retention %" />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      {loading ? 'Loading retention data...' : 'No retention data available'}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Features */}
            {topFeatures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topFeatures.slice(0, 5).map((feature, index) => (
                      <div key={feature.featureName} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium">{feature.featureName}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{feature.usageCount.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{feature.uniqueUsers} users</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Drop-off Points */}
            {dropOffs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Drop-off Points</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dropOffs.slice(0, 5).map((dropOff, index) => (
                      <div key={dropOff.step} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium">{dropOff.step}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{dropOff.dropOffCount.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{dropOff.affectedUsers} users</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Events Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle>Recent Events</CardTitle>
                <div className="flex w-full lg:w-auto">
                  <input
                    type="text"
                    placeholder="Search events..."
                    className="input w-full"
                    value={eventsSearch}
                    onChange={(e) => {
                      setEventsSearch(e.target.value)
                      setEventsPage(1)
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentEvents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Platform
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentEvents.map((event) => (
                        <tr key={event._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {event.event}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {event.userId?.fullName || event.userId?.username || 'Anonymous'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {event.platform || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(event.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
                    <button
                      onClick={() => setEventsPage(prev => Math.max(1, prev - 1))}
                      disabled={eventsPage === 1}
                      className="btn btn-secondary"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 text-center">Page {eventsPage}</span>
                    <button
                      onClick={() => setEventsPage(prev => prev + 1)}
                      disabled={recentEvents.length < 50}
                      className="btn btn-secondary"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent events found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Analytics
