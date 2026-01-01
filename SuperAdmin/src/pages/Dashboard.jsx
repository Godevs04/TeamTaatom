import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRealTime } from '../context/RealTimeContext'
import AIInsights from '../components/AIInsights'
import RealTimeAnalytics from '../components/RealTimeAnalytics'
import { Users, MessageSquare, TrendingUp, Activity, Globe, Shield, AlertTriangle, ArrowUp, ArrowDown, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'

const Dashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { 
    dashboardData, 
    fetchDashboardData, 
    lastUpdate,
    cachedDashboardData,
    dashboardDataErrors,
    previousDashboardData,
    reports,
    setAutoRefreshEnabled
  } = useRealTime()
  const [activeTab, setActiveTab] = useState('overview')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const isMountedRef = useRef(true)
  
  // Load auto-refresh preference from localStorage (default: false/off)
  const [autoRefreshEnabled, setAutoRefreshEnabledLocal] = useState(() => {
    const saved = localStorage.getItem('dashboard_auto_refresh')
    return saved === 'true'
  })
  
  // Check if we're on the dashboard route
  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname === '/'
  
  // Handle auto-refresh toggle
  const handleToggleAutoRefresh = useCallback(() => {
    const newValue = !autoRefreshEnabled
    setAutoRefreshEnabledLocal(newValue)
    localStorage.setItem('dashboard_auto_refresh', String(newValue))
    if (setAutoRefreshEnabled) {
      setAutoRefreshEnabled(newValue)
    }
  }, [autoRefreshEnabled, setAutoRefreshEnabled])
  
  // Handle manual refresh
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return
    
    setIsRefreshing(true)
    const abortController = new AbortController()
    
    try {
      await fetchDashboardData(abortController.signal)
    } catch (error) {
      // Error already logged in context
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchDashboardData, isRefreshing])
  
  // Calculate data freshness with auto-updating indicator
  const [dataFreshness, setDataFreshness] = useState(null)
  
  useEffect(() => {
    if (!lastUpdate) {
      setDataFreshness(null)
      return
    }
    
    const updateFreshness = () => {
      const now = new Date()
      const lastUpdateTime = new Date(lastUpdate)
      const secondsAgo = Math.floor((now - lastUpdateTime) / 1000)
      setDataFreshness(secondsAgo)
    }
    
    // Update immediately
    updateFreshness()
    
    // Update every second to show live indicator
    const interval = setInterval(updateFreshness, 1000)
    
    return () => clearInterval(interval)
  }, [lastUpdate])
  
  // Determine if data is "Live" (< 30s) or show time ago
  const freshnessIndicator = useMemo(() => {
    if (dataFreshness === null) return null
    if (dataFreshness < 30) {
      return { text: 'Live', isLive: true }
    }
    return { text: `Last updated ${dataFreshness}s ago`, isLive: false }
  }, [dataFreshness])
  
  // Use cached data if available, even if current fetch failed
  // MUST be declared before any useMemo hooks that depend on it
  const displayData = dashboardData || cachedDashboardData
  
  // Calculate spike/anomaly indicators for KPIs - Stable function reference
  const calculateSpike = useCallback((currentValue, previousValue) => {
    if (!previousValue || previousValue === 0) return null
    const delta = ((currentValue - previousValue) / previousValue) * 100
    if (Math.abs(delta) >= 20) {
      return {
        delta: Math.round(delta),
        direction: delta > 0 ? 'up' : 'down',
        significant: true
      }
    }
    return null
  }, [])
  
  // Extract stable metric values to prevent unnecessary re-renders
  const stableMetrics = useMemo(() => {
    if (!displayData?.metrics) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalPosts: 0,
        totalShorts: 0,
        userGrowth: 0,
        activeUserGrowth: 12.5,
        contentGrowth: 0,
        shortsGrowth: 8.2
      }
    }
    
    const { metrics } = displayData
    return {
      totalUsers: Number(metrics.totalUsers) || 0,
      activeUsers: Number(metrics.activeUsers) || 0,
      totalPosts: Number(metrics.totalPosts) || 0,
      totalShorts: Number(metrics.totalShorts) || 0,
      userGrowth: Number(metrics.userGrowth?.weeklyGrowth) || 0,
      activeUserGrowth: Number(metrics.activeUserGrowth?.weeklyGrowth) || 12.5,
      contentGrowth: Number(metrics.contentGrowth?.weeklyGrowth) || 0,
      shortsGrowth: Number(metrics.shortsGrowth?.weeklyGrowth) || 8.2
    }
  }, [
    displayData?.metrics?.totalUsers,
    displayData?.metrics?.activeUsers,
    displayData?.metrics?.totalPosts,
    displayData?.metrics?.totalShorts,
    displayData?.metrics?.userGrowth?.weeklyGrowth,
    displayData?.metrics?.activeUserGrowth?.weeklyGrowth,
    displayData?.metrics?.contentGrowth?.weeklyGrowth,
    displayData?.metrics?.shortsGrowth?.weeklyGrowth
  ])
  
  // Extract stable previous metrics
  const stablePreviousMetrics = useMemo(() => {
    if (!previousDashboardData?.metrics) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalPosts: 0,
        totalShorts: 0
      }
    }
    
    const { metrics } = previousDashboardData
    return {
      totalUsers: Number(metrics.totalUsers) || 0,
      activeUsers: Number(metrics.activeUsers) || 0,
      totalPosts: Number(metrics.totalPosts) || 0,
      totalShorts: Number(metrics.totalShorts) || 0
    }
  }, [
    previousDashboardData?.metrics?.totalUsers,
    previousDashboardData?.metrics?.activeUsers,
    previousDashboardData?.metrics?.totalPosts,
    previousDashboardData?.metrics?.totalShorts
  ])
  
  // Set dashboard as active for auto-refresh when on dashboard route and auto-refresh is enabled
  useEffect(() => {
    if (window.__setDashboardActive && isDashboardRoute) {
      window.__setDashboardActive(autoRefreshEnabled)
    }
    return () => {
      if (window.__setDashboardActive) {
        window.__setDashboardActive(false)
      }
    }
  }, [isDashboardRoute, autoRefreshEnabled])
  
  // Sync auto-refresh preference with context on mount
  useEffect(() => {
    if (setAutoRefreshEnabled) {
      setAutoRefreshEnabled(autoRefreshEnabled)
    }
  }, [autoRefreshEnabled, setAutoRefreshEnabled])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])
  
  // Set timeout for loading state (show error after 10 seconds, set empty data after 5 seconds)
  useEffect(() => {
    const currentData = dashboardData || cachedDashboardData
    if (!currentData) {
      // After 5 seconds, trigger a refresh attempt
      const emptyDataTimeout = setTimeout(() => {
        if (isMountedRef.current && !dashboardData && !cachedDashboardData) {
          console.warn('Dashboard data not loaded after 5s, attempting refresh...')
          // Trigger a manual refresh attempt
          handleManualRefresh()
        }
      }, 5000) // 5 seconds - try to refresh
      
      // After 10 seconds, show error state
      const errorTimeout = setTimeout(() => {
        if (isMountedRef.current && !dashboardData && !cachedDashboardData) {
          setLoadingTimeout(true)
        }
      }, 10000) // 10 seconds - show error
      
      return () => {
        clearTimeout(emptyDataTimeout)
        clearTimeout(errorTimeout)
      }
    } else if (currentData && loadingTimeout) {
      // Reset timeout flag when data loads
      setLoadingTimeout(false)
    }
  }, [dashboardData, cachedDashboardData, loadingTimeout, handleManualRefresh])
  
  // Get attention signals from existing data (MUST be before early return)
  const attentionSignals = useMemo(() => {
    const highPriorityReports = reports?.filter(r => r.priority === 'high' && r.status === 'pending') || []
    const pendingModeration = reports?.filter(r => r.status === 'pending')?.length || 0
    
    return {
      highPriorityReports: highPriorityReports.length,
      pendingModeration,
      hasAttention: highPriorityReports.length > 0 || pendingModeration > 0
    }
  }, [reports])
  
  // Navigation handlers for actionable KPIs (MUST be before early return)
  // Stable callback reference to prevent re-renders
  const handleKPIClick = useCallback((kpiType) => {
    switch (kpiType) {
      case 'users':
        navigate('/users')
        break
      case 'activeUsers':
        navigate('/users?filter=active')
        break
      case 'posts':
        navigate('/travel-content?type=post')
        break
      case 'shorts':
        navigate('/travel-content?type=short')
        break
      default:
        break
    }
  }, [navigate])
  
  // Stable error flag to prevent re-renders
  const hasErrorStable = useMemo(() => {
    return !!dashboardDataErrors.fetchError
  }, [dashboardDataErrors.fetchError])

  // Memoize stat cards with spike detection (MUST be before early return)
  // Use safe defaults if displayData is not available yet
  // Stable value references to prevent blinking
  const statCards = useMemo(() => {
    // Use pre-extracted stable values
    const totalUsers = stableMetrics.totalUsers
    const activeUsers = stableMetrics.activeUsers
    const totalPosts = stableMetrics.totalPosts
    const totalShorts = stableMetrics.totalShorts
    
    const userGrowth = stableMetrics.userGrowth
    const activeUserGrowth = stableMetrics.activeUserGrowth
    const contentGrowth = stableMetrics.contentGrowth
    const shortsGrowth = stableMetrics.shortsGrowth
    
    // Pre-calculate spikes with stable references
    const userSpike = calculateSpike(totalUsers, stablePreviousMetrics.totalUsers)
    const activeUserSpike = calculateSpike(activeUsers, stablePreviousMetrics.activeUsers)
    const postSpike = calculateSpike(totalPosts, stablePreviousMetrics.totalPosts)
    const shortsSpike = calculateSpike(totalShorts, stablePreviousMetrics.totalShorts)
    
    const cards = [
      {
        title: 'Total Users',
        value: totalUsers,
        valueString: String(totalUsers.toLocaleString()),
        change: `+${userGrowth}%`,
        trend: 'up',
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-gradient-to-br from-blue-400 to-cyan-500',
        cardBg: 'from-blue-50 to-cyan-50',
        borderColor: 'border-blue-200',
        gradientText: 'from-blue-600 to-cyan-600',
        kpiType: 'users',
        spike: userSpike,
        spikeKey: userSpike ? `${userSpike.direction}-${userSpike.delta}` : null
      },
      {
        title: 'Active Users',
        value: activeUsers,
        valueString: String(activeUsers.toLocaleString()),
        change: `+${activeUserGrowth}%`,
        trend: 'up',
        icon: Activity,
        color: 'text-green-600',
        bgColor: 'bg-gradient-to-br from-green-400 to-emerald-500',
        cardBg: 'from-green-50 to-emerald-50',
        borderColor: 'border-green-200',
        gradientText: 'from-green-600 to-emerald-600',
        kpiType: 'activeUsers',
        spike: activeUserSpike,
        spikeKey: activeUserSpike ? `${activeUserSpike.direction}-${activeUserSpike.delta}` : null
      },
      {
        title: 'Total Posts',
        value: totalPosts,
        valueString: String(totalPosts.toLocaleString()),
        change: `+${contentGrowth}%`,
        trend: 'up',
        icon: MessageSquare,
        color: 'text-purple-600',
        bgColor: 'bg-gradient-to-br from-purple-400 to-violet-500',
        cardBg: 'from-purple-50 to-violet-50',
        borderColor: 'border-purple-200',
        gradientText: 'from-purple-600 to-violet-600',
        kpiType: 'posts',
        spike: postSpike,
        spikeKey: postSpike ? `${postSpike.direction}-${postSpike.delta}` : null
      },
      {
        title: 'Total Shorts',
        value: totalShorts,
        valueString: String(totalShorts.toLocaleString()),
        change: `+${shortsGrowth}%`,
        trend: 'up',
        icon: MessageSquare,
        color: 'text-orange-600',
        bgColor: 'bg-gradient-to-br from-orange-400 to-red-500',
        cardBg: 'from-orange-50 to-red-50',
        borderColor: 'border-orange-200',
        gradientText: 'from-orange-600 to-red-600',
        kpiType: 'shorts',
        spike: shortsSpike,
        spikeKey: shortsSpike ? `${shortsSpike.direction}-${shortsSpike.delta}` : null
      }
    ]
    
    return cards
  }, [
    stableMetrics.totalUsers,
    stableMetrics.activeUsers,
    stableMetrics.totalPosts,
    stableMetrics.totalShorts,
    stableMetrics.userGrowth,
    stableMetrics.activeUserGrowth,
    stableMetrics.contentGrowth,
    stableMetrics.shortsGrowth,
    stablePreviousMetrics.totalUsers,
    stablePreviousMetrics.activeUsers,
    stablePreviousMetrics.totalPosts,
    stablePreviousMetrics.totalShorts,
    calculateSpike
  ])
  
  // Memoized KPI card component (MUST be before early return)
  // Enhanced with stable value rendering to prevent blinking
  const KPICard = React.memo(({ card, index, onCardClick, hasError }) => {
    // Use stable value string - already pre-computed in statCards
    // No need to recalculate - valueString is already stable
    const displayValue = card.valueString || String(card.value.toLocaleString())
    
    return (
      <div
        className={`bg-gradient-to-br ${card.cardBg} rounded-2xl p-6 border-2 ${card.borderColor} shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 ${onCardClick ? 'cursor-pointer' : ''} relative overflow-hidden group`}
        onClick={() => onCardClick && onCardClick(card.kpiType)}
      >
        {/* Animated background gradient on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br ${card.cardBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
        
        <div className="relative flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-gray-700">{card.title}</p>
              {hasError && (
                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" title="Data may be stale" />
              )}
              {card.spike && (
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    card.spike.direction === 'up' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
                  }`}
                >
                  {card.spike.direction === 'up' ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                  {Math.abs(card.spike.delta)}%
                </div>
              )}
            </div>
            <p className={`text-4xl font-extrabold bg-gradient-to-r ${card.gradientText} bg-clip-text text-transparent select-none`}>
              {displayValue}
            </p>
          </div>
          <div
            className={`p-4 rounded-xl shadow-lg ${card.bgColor} relative overflow-hidden transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            <card.icon className="w-7 h-7 text-white relative z-10" />
          </div>
        </div>
        <div className="mt-5 flex items-center pt-4 border-t border-gray-200">
          <span
            className={`text-sm font-semibold flex items-center gap-1 ${
              card.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {card.trend === 'up' ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
            {card.change}
          </span>
          <span className="text-sm text-gray-500 ml-2">from last week</span>
        </div>
      </div>
    )
  }, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    // Compare all relevant properties including spike
    const prevCard = prevProps.card
    const nextCard = nextProps.card
    
    // Deep comparison of spike objects if they exist
    const spikeEqual = 
      (!prevCard.spike && !nextCard.spike) ||
      (prevCard.spike && nextCard.spike &&
       prevCard.spike.delta === nextCard.spike.delta &&
       prevCard.spike.direction === nextCard.spike.direction)
    
    return (
      prevCard.value === nextCard.value &&
      prevCard.valueString === nextCard.valueString &&
      prevCard.change === nextCard.change &&
      prevCard.kpiType === nextCard.kpiType &&
      prevCard.spikeKey === nextCard.spikeKey &&
      spikeEqual &&
      prevProps.hasError === nextProps.hasError &&
      prevProps.index === nextProps.index &&
      prevProps.onCardClick === nextProps.onCardClick
    )
  })

  // Early return AFTER all hooks (for loading state)
  // Since dashboardData is now initialized with empty data, we should always have data
  // But check if metrics exists to be safe
  const hasData = displayData?.metrics && typeof displayData.metrics === 'object'
  
  // Only show loading if we truly have no data (shouldn't happen with new initialization)
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        {!loadingTimeout ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
            <p className="text-xs text-gray-400">If this takes too long, try refreshing the page</p>
          </>
        ) : (
          <>
            <AlertTriangle className="w-16 h-16 text-amber-500" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">Loading took too long</h3>
              <p className="text-gray-600">The dashboard data is taking longer than expected to load.</p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Retrying...' : 'Retry'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const { metrics, recentActivity, aiInsights } = displayData

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'insights', label: 'AI Insights', icon: Globe }
  ]

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 sm:p-8 shadow-xl border border-blue-100/50 backdrop-blur-sm relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-200/20 to-blue-200/20 rounded-full blur-2xl -ml-24 -mb-24"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
            {/* Left Section: Title and Status */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-3 sm:p-3.5 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:scale-105">
                    <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                      Dashboard
                    </h1>
                    {freshnessIndicator && (
                      <span className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full shadow-md transition-all duration-300 ${
                        freshnessIndicator.isLive 
                          ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white animate-pulse hover:shadow-lg' 
                          : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                      }`}>
                        {freshnessIndicator.isLive && (
                          <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                        )}
                        <span>{freshnessIndicator.text}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Welcome Message */}
              <div className="space-y-2">
                <p className="text-base sm:text-lg text-gray-700 font-medium">
                  Welcome back! Here's what's happening with your platform.
                </p>
                {dashboardDataErrors.fetchError && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Showing cached data - some metrics may be outdated</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Section: Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Auto-Refresh Toggle */}
              <button
                onClick={handleToggleAutoRefresh}
                className={`group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 ${
                  autoRefreshEnabled
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 border border-green-400'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
                title={autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
              >
                {autoRefreshEnabled ? (
                  <ToggleRight className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <ToggleLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span className="hidden sm:inline">Auto Refresh</span>
                <span className="sm:hidden">Auto</span>
              </button>
              
              {/* Manual Refresh Button */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-xs sm:text-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
                title="Refresh dashboard data"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Ref</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <nav className="-mb-px flex space-x-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Attention Signals */}
            {attentionSignals.hasAttention && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                      <h3 className="font-semibold text-amber-900">Needs Attention</h3>
                      <p className="text-sm text-amber-700">
                        {attentionSignals.highPriorityReports > 0 && (
                          <span>{attentionSignals.highPriorityReports} high-priority report{attentionSignals.highPriorityReports !== 1 ? 's' : ''} pending</span>
                        )}
                        {attentionSignals.highPriorityReports > 0 && attentionSignals.pendingModeration > 0 && ' • '}
                        {attentionSignals.pendingModeration > 0 && (
                          <span>{attentionSignals.pendingModeration} item{attentionSignals.pendingModeration !== 1 ? 's' : ''} awaiting moderation</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/reports?priority=high&status=pending')}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                  >
                    Review
                  </button>
                </div>
              </motion.div>
            )}

            {/* Stats Cards - Enhanced Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {statCards.map((card, index) => (
                <KPICard
                  key={`${card.kpiType}-${card.value}-${card.spikeKey || 'no-spike'}`}
                  card={card}
                  index={index}
                  onCardClick={handleKPIClick}
                  hasError={hasErrorStable}
                />
              ))}
            </div>

            {/* Recent Activity - Enhanced */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Recent Users */}
              <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Recent Users
                  </h3>
                  <button
                    onClick={() => navigate('/users')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-3">
                  {recentActivity.users?.slice(0, 5).map((user, index) => (
                    <motion.div
                      key={user._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center space-x-3 p-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 rounded-lg transition-all duration-200 cursor-pointer border border-transparent hover:border-blue-200"
                      onClick={() => navigate(`/users?search=${user.email}`)}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-base font-bold text-white">
                          {user.fullName?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{user.fullName || 'Unknown'}</p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {(!recentActivity.users || recentActivity.users.length === 0) && (
                    <p className="text-center text-gray-400 py-8">No recent users</p>
                  )}
                </div>
              </div>

              {/* Recent Posts */}
              <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                    Recent Posts
                  </h3>
                  <button
                    onClick={() => navigate('/travel-content')}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-3">
                  {recentActivity.posts?.slice(0, 5).map((post, index) => (
                    <motion.div
                      key={post._id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-lg transition-all duration-200 cursor-pointer border border-transparent hover:border-purple-200"
                      onClick={() => navigate(`/travel-content?id=${post._id}`)}
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{post.content || post.caption || 'No content'}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">by {post.user?.fullName || 'Unknown'}</span>
                        <span className="text-gray-400">
                          {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {(!recentActivity.posts || recentActivity.posts.length === 0) && (
                    <p className="text-center text-gray-400 py-8">No recent posts</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions - Enhanced */}
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/users')}
                  className="flex items-center p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl hover:from-blue-100 hover:to-cyan-100 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg mr-4 shadow-md">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-blue-900">Manage Users</p>
                    <p className="text-sm text-blue-600">View and manage user accounts</p>
                  </div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/travel-content')}
                  className="flex items-center p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg mr-4 shadow-md">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-green-900">Content Moderation</p>
                    <p className="text-sm text-green-600">Review and moderate content</p>
                  </div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/logs')}
                  className="flex items-center p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg mr-4 shadow-md">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-purple-900">Security Logs</p>
                    <p className="text-sm text-purple-600">View security events</p>
                  </div>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <RealTimeAnalytics />
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AIInsights insights={aiInsights} />
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default Dashboard