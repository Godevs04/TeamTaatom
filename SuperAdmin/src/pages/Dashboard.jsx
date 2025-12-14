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
  
  // Calculate spike/anomaly indicators for KPIs
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

  // Use cached data if available, even if current fetch failed
  const displayData = dashboardData || cachedDashboardData
  
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

  // Memoize stat cards with spike detection (MUST be before early return)
  // Use safe defaults if displayData is not available yet
  const statCards = useMemo(() => {
    if (!displayData) {
      return []
    }
    
    const { metrics } = displayData
    const previousMetrics = previousDashboardData?.metrics || {}
    
    const cards = [
      {
        title: 'Total Users',
        value: metrics.totalUsers,
        change: `+${metrics.userGrowth.weeklyGrowth}%`,
        trend: 'up',
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-gradient-to-br from-blue-400 to-cyan-500',
        cardBg: 'from-blue-50 to-cyan-50',
        borderColor: 'border-blue-200',
        gradientText: 'from-blue-600 to-cyan-600',
        kpiType: 'users',
        spike: calculateSpike(metrics.totalUsers, previousMetrics.totalUsers)
      },
      {
        title: 'Active Users',
        value: metrics.activeUsers,
        change: '+12.5%',
        trend: 'up',
        icon: Activity,
        color: 'text-green-600',
        bgColor: 'bg-gradient-to-br from-green-400 to-emerald-500',
        cardBg: 'from-green-50 to-emerald-50',
        borderColor: 'border-green-200',
        gradientText: 'from-green-600 to-emerald-600',
        kpiType: 'activeUsers',
        spike: calculateSpike(metrics.activeUsers, previousMetrics.activeUsers)
      },
      {
        title: 'Total Posts',
        value: metrics.totalPosts,
        change: `+${metrics.contentGrowth.weeklyGrowth}%`,
        trend: 'up',
        icon: MessageSquare,
        color: 'text-purple-600',
        bgColor: 'bg-gradient-to-br from-purple-400 to-violet-500',
        cardBg: 'from-purple-50 to-violet-50',
        borderColor: 'border-purple-200',
        gradientText: 'from-purple-600 to-violet-600',
        kpiType: 'posts',
        spike: calculateSpike(metrics.totalPosts, previousMetrics.totalPosts)
      },
      {
        title: 'Total Shorts',
        value: metrics.totalShorts,
        change: '+8.2%',
        trend: 'up',
        icon: MessageSquare,
        color: 'text-orange-600',
        bgColor: 'bg-gradient-to-br from-orange-400 to-red-500',
        cardBg: 'from-orange-50 to-red-50',
        borderColor: 'border-orange-200',
        gradientText: 'from-orange-600 to-red-600',
        kpiType: 'shorts',
        spike: calculateSpike(metrics.totalShorts, previousMetrics.totalShorts)
      }
    ]
    
    return cards
  }, [displayData, previousDashboardData, calculateSpike])
  
  // Memoized KPI card component (MUST be before early return)
  const KPICard = React.memo(({ card, index, onCardClick, hasError }) => (
    <motion.div
      key={card.title}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-gradient-to-br ${card.cardBg} rounded-2xl p-6 border ${card.borderColor} shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 ${onCardClick ? 'cursor-pointer' : ''}`}
      onClick={() => onCardClick && onCardClick(card.kpiType)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-600">{card.title}</p>
            {hasError && (
              <AlertTriangle className="w-4 h-4 text-amber-500" title="Data may be stale" />
            )}
            {card.spike && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                card.spike.direction === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {card.spike.direction === 'up' ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                {Math.abs(card.spike.delta)}%
              </div>
            )}
          </div>
          <p className={`text-3xl font-bold bg-gradient-to-r ${card.gradientText} bg-clip-text text-transparent`}>
            {card.value.toLocaleString()}
          </p>
        </div>
        <div className={`p-3 rounded-xl shadow-md ${card.bgColor}`}>
          <card.icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="mt-4 flex items-center">
        <span className={`text-sm font-medium ${
          card.trend === 'up' ? 'text-green-600' : 'text-red-600'
        }`}>
          {card.change}
        </span>
        <span className="text-sm text-gray-500 ml-1">from last week</span>
      </div>
    </motion.div>
  ))

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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 shadow-lg border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                {freshnessIndicator && (
                  <span className={`px-3 py-1.5 text-white text-xs font-semibold rounded-full shadow-md ${
                    freshnessIndicator.isLive 
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse' 
                      : 'bg-gradient-to-r from-gray-400 to-gray-500'
                  }`}>
                    {freshnessIndicator.isLive && (
                      <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                    )}
                    {freshnessIndicator.text}
                  </span>
                )}
              </div>
              
              {/* Refresh Controls */}
              <div className="flex items-center gap-3">
                {/* Auto-Refresh Toggle */}
                <button
                  onClick={handleToggleAutoRefresh}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    autoRefreshEnabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                  title={autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
                >
                  {autoRefreshEnabled ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  <span>Auto Refresh</span>
                </button>
                
                {/* Manual Refresh Button */}
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh dashboard data"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            <p className="text-gray-600 text-lg">
              Welcome back! Here's what's happening with your platform.
            </p>
            {dashboardDataErrors.fetchError && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Showing cached data - some metrics may be outdated
              </p>
            )}
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((card, index) => (
                <KPICard
                  key={card.title}
                  card={card}
                  index={index}
                  onCardClick={handleKPIClick}
                  hasError={dashboardDataErrors.fetchError}
                />
              ))}
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Users</h3>
                <div className="space-y-3">
                  {recentActivity.users?.map((user, index) => (
                    <motion.div
                      key={user._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {user.fullName?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{user.fullName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Recent Posts */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Posts</h3>
                <div className="space-y-3">
                  {recentActivity.posts?.map((post, index) => (
                    <motion.div
                      key={post._id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <p className="text-sm text-gray-900 line-clamp-2 mb-2">{post.content}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>by {post.user?.fullName || 'Unknown'}</span>
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  <Users className="w-5 h-5 text-blue-600 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-blue-900">Manage Users</p>
                    <p className="text-sm text-blue-600">View and manage user accounts</p>
                  </div>
                </button>
                
                <button className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                  <MessageSquare className="w-5 h-5 text-green-600 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-green-900">Content Moderation</p>
                    <p className="text-sm text-green-600">Review and moderate content</p>
                  </div>
                </button>
                
                <button className="flex items-center p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                  <Shield className="w-5 h-5 text-purple-600 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-purple-900">Security Logs</p>
                    <p className="text-sm text-purple-600">View security events</p>
                  </div>
                </button>
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