import React, { useState, useEffect, useMemo } from 'react'
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
  Percent
} from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  getTripScoreStats,
  getTopUsersByTripScore,
  getSuspiciousVisits,
  getTrustTimeline,
  getContinentBreakdown,
  getDetailedLocations
} from '../services/tripScoreAnalytics'
import logger from '../utils/logger'

const TripScoreAnalytics = () => {
  const [stats, setStats] = useState(null)
  const [topUsers, setTopUsers] = useState([])
  const [suspiciousVisits, setSuspiciousVisits] = useState([])
  const [trustTimeline, setTrustTimeline] = useState([])
  const [continentBreakdown, setContinentBreakdown] = useState([])
  const [detailedLocations, setDetailedLocations] = useState([])
  const [locationsPagination, setLocationsPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [locationsGroupBy, setLocationsGroupBy] = useState('location') // location, user, country, state
  
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [loading, setLoading] = useState(false)
  const [suspiciousPage, setSuspiciousPage] = useState(1)
  const [selectedView, setSelectedView] = useState('overview') // overview, users, fraud, geography, locations
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

  // Fetch all TripScore analytics data
  const fetchAllData = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange(selectedPeriod)
      
      // Store previous stats for comparison
      if (stats) {
        setPreviousStats(stats)
      }
      
      const [
        statsData,
        topUsersData,
        suspiciousData,
        timelineData,
        continentsData,
        locationsData
      ] = await Promise.all([
        getTripScoreStats(start, end),
        getTopUsersByTripScore({ limit: 20, startDate: start, endDate: end }),
        getSuspiciousVisits({ page: suspiciousPage, limit: 20, startDate: start, endDate: end }),
        getTrustTimeline({ startDate: start, endDate: end, groupBy: 'day' }),
        getContinentBreakdown(start, end),
        getDetailedLocations({ startDate: start, endDate: end, groupBy: locationsGroupBy, limit: locationsPagination.limit, page: locationsPagination.page })
      ])
      
      setStats(statsData.stats)
      setTopUsers(topUsersData.topUsers || [])
      setSuspiciousVisits(suspiciousData.suspiciousVisits || [])
      setTrustTimeline(timelineData.timeline || [])
      setContinentBreakdown(continentsData.continents || [])
      setDetailedLocations(locationsData.locations || [])
      setLocationsPagination(locationsData.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (error) {
      logger.error('Failed to fetch TripScore analytics data:', error)
      toast.error('Failed to fetch TripScore analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [selectedPeriod, suspiciousPage, locationsGroupBy, locationsPagination.page])

  const handleRefresh = async () => {
    await fetchAllData()
    toast.success('TripScore analytics data refreshed successfully')
  }

  const handleExport = () => {
    // Create CSV export
    const csvData = [
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
    
    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tripscore-analytics-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success('Data exported successfully')
  }

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

  // Transform trust timeline for chart
  const trustTimelineChartData = trustTimeline.map(item => ({
    name: item.date,
    High: item.high || 0,
    Medium: item.medium || 0,
    Low: item.low || 0,
    Unverified: item.unverified || 0,
    Suspicious: item.suspicious || 0
  }))

  // Transform trust breakdown for pie chart
  const trustBreakdownChartData = stats ? [
    { name: 'High', value: stats.trustBreakdown.high || 0, color: '#10B981' },
    { name: 'Medium', value: stats.trustBreakdown.medium || 0, color: '#3B82F6' },
    { name: 'Low', value: stats.trustBreakdown.low || 0, color: '#F59E0B' },
    { name: 'Unverified', value: stats.trustBreakdown.unverified || 0, color: '#6B7280' },
    { name: 'Suspicious', value: stats.trustBreakdown.suspicious || 0, color: '#EF4444' }
  ].filter(item => item.value > 0) : []

  // Transform source breakdown for pie chart
  const sourceBreakdownChartData = stats ? [
    { name: 'Taatom Camera', value: stats.sourceBreakdown.taatom_camera_live || 0, color: '#10B981' },
    { name: 'Gallery (EXIF)', value: stats.sourceBreakdown.gallery_exif || 0, color: '#3B82F6' },
    { name: 'Gallery (No EXIF)', value: stats.sourceBreakdown.gallery_no_exif || 0, color: '#F59E0B' },
    { name: 'Manual Only', value: stats.sourceBreakdown.manual_only || 0, color: '#6B7280' }
  ].filter(item => item.value > 0) : []

  // Transform continent breakdown for bar chart
  const continentChartData = continentBreakdown.map(item => ({
    name: item._id || 'Unknown',
    places: item.uniquePlaces || 0,
    visits: item.totalVisits || 0
  }))

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

  // Enhanced KPI cards with animations and filtering
  const kpiCards = [
    {
      title: 'Total Visits',
      value: showTotalsSeparately 
        ? `${stats?.totalVisits?.toLocaleString() || 0} (All)`
        : stats?.totalVisits?.toLocaleString() || 0,
      icon: Globe,
      color: 'blue',
      bgGradient: 'from-blue-500 to-blue-600',
      change: calculateChange(stats?.totalVisits, previousStats?.totalVisits),
      subtitle: showTotalsSeparately 
        ? `${stats?.trustedVisits?.toLocaleString() || 0} trusted`
        : 'All recorded visits',
      showSeparate: showTotalsSeparately,
      detail: showTotalsSeparately ? `Filtered: ${filteredTotalVisits.toLocaleString()}` : null
    },
    {
      title: 'Unique Places',
      value: stats?.uniquePlaces?.toLocaleString() || 0,
      icon: MapPin,
      color: 'green',
      bgGradient: 'from-green-500 to-emerald-600',
      change: calculateChange(stats?.uniquePlaces, previousStats?.uniquePlaces),
      subtitle: 'Distinct locations',
      detail: showTotalsSeparately ? `From ${stats?.trustedVisits || 0} trusted visits` : null
    },
    {
      title: 'Trusted Visits',
      value: stats?.trustedVisits?.toLocaleString() || 0,
      icon: Shield,
      color: 'purple',
      bgGradient: 'from-purple-500 to-purple-600',
      change: calculateChange(stats?.trustedVisits, previousStats?.trustedVisits),
      subtitle: `${trustScorePercentage}% trust score`,
      percentage: trustScorePercentage,
      detail: showTotalsSeparately ? `High: ${stats?.trustBreakdown?.high || 0} | Medium: ${stats?.trustBreakdown?.medium || 0}` : null
    },
    {
      title: 'Suspicious Visits',
      value: stats?.suspiciousVisits?.toLocaleString() || 0,
      icon: AlertTriangle,
      color: 'red',
      bgGradient: 'from-red-500 to-red-600',
      change: calculateChange(stats?.suspiciousVisits, previousStats?.suspiciousVisits),
      subtitle: `${fraudRate}% fraud rate`,
      detail: showTotalsSeparately ? `Out of ${stats?.totalVisits || 0} total` : null
    },
    {
      title: 'Active Users',
      value: stats?.uniqueUsers?.toLocaleString() || 0,
      icon: Users,
      color: 'indigo',
      bgGradient: 'from-indigo-500 to-indigo-600',
      change: calculateChange(stats?.uniqueUsers, previousStats?.uniqueUsers),
      subtitle: 'Users with visits',
      detail: showTotalsSeparately && stats?.uniqueUsers > 0 
        ? `Avg ${Math.round((stats?.trustedVisits || 0) / stats.uniqueUsers)} trusted visits/user` 
        : null
    },
    {
      title: 'Trust Score',
      value: `${trustScorePercentage}%`,
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
      {/* Enhanced Header with Gradient */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl"
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
                  <h1 className="text-4xl font-bold">TripScore Analytics</h1>
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
              <button 
                onClick={handleExport}
                className="px-4 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
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

      {/* View Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'users', label: 'Top Users', icon: Award },
          { id: 'fraud', label: 'Fraud Monitor', icon: AlertTriangle },
          { id: 'geography', label: 'Geography', icon: Globe },
          { id: 'locations', label: 'Detailed Locations', icon: MapPin }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedView(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedView === tab.id
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Enhanced KPI Cards Grid */}
      {selectedView === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {kpiCards.map((card, index) => (
              <motion.div
                key={card.title}
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <PieChartComponent 
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
                  <PieChartComponent 
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
                <LineChartComponent
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
      {selectedView === 'users' && (
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
      )}

      {/* Fraud Monitor View */}
      {selectedView === 'fraud' && (
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
      )}

      {/* Geography View */}
      {selectedView === 'geography' && (
        <>
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-600" />
                Continent Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {continentChartData.length > 0 ? (
                <BarChartComponent
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
      {selectedView === 'locations' && (
        <>
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
    </div>
  )
}

export default TripScoreAnalytics
