import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { LineChartComponent, AreaChartComponent, BarChartComponent, PieChartComponent } from '../components/Charts/index.jsx'
import { Calendar, Download, Filter, RefreshCw, TrendingUp, Users, Eye, AlertTriangle, Activity } from 'lucide-react'
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
import { api } from '../services/api'
import logger from '../utils/logger'

const Analytics = () => {
  const [summary, setSummary] = useState(null)
  const [timeSeries, setTimeSeries] = useState([])
  const [eventBreakdown, setEventBreakdown] = useState([])
  const [topFeatures, setTopFeatures] = useState([])
  const [dropOffs, setDropOffs] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [retention, setRetention] = useState([])
  const [engagementMetrics, setEngagementMetrics] = useState(null)
  
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [selectedChart, setSelectedChart] = useState('timeseries')
  const [selectedEventType, setSelectedEventType] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [loading, setLoading] = useState(false)
  const [eventsPage, setEventsPage] = useState(1)
  const [eventsSearch, setEventsSearch] = useState('')

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

  // Fetch engagement metrics
  const fetchEngagementMetrics = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/superadmin/analytics/engagement', {
        params: { period: selectedPeriod }
      })
      if (response.data && response.data.data) {
        setEngagementMetrics(response.data.data)
      }
    } catch (error) {
      logger.error('Failed to fetch engagement metrics:', error)
      // Don't show toast for engagement metrics failure, it's optional
    }
  }, [selectedPeriod])
  
  // Fetch all analytics data
  const fetchAllData = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange(selectedPeriod)
      
      const [
        summaryData,
        timeSeriesData,
        breakdownData,
        featuresData,
        dropOffsData,
        eventsData,
        retentionData
      ] = await Promise.all([
        getAnalyticsSummary(start, end),
        getTimeSeriesData({ startDate: start, endDate: end, eventType: selectedEventType || undefined, platform: selectedPlatform || undefined }),
        getEventBreakdown({ startDate: start, endDate: end }),
        getTopFeatures({ startDate: start, endDate: end }),
        getDropOffPoints({ startDate: start, endDate: end }),
        getRecentEvents({ page: eventsPage, limit: 50, eventType: selectedEventType || undefined, platform: selectedPlatform || undefined, startDate: start, endDate: end, search: eventsSearch || undefined }),
        getUserRetention(start, end)
      ])
      
      setSummary(summaryData.summary)
      setTimeSeries(timeSeriesData.timeSeries || [])
      setEventBreakdown(breakdownData.breakdown || [])
      setTopFeatures(featuresData.features || [])
      setDropOffs(dropOffsData.dropOffs || [])
      setRecentEvents(eventsData.events || [])
      setRetention(retentionData.retention || [])
      
      // Fetch engagement metrics separately
      fetchEngagementMetrics()
    } catch (error) {
      logger.error('Failed to fetch analytics data:', error)
      toast.error('Failed to fetch analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [selectedPeriod, selectedEventType, selectedPlatform, eventsPage, eventsSearch])

  const handleRefresh = async () => {
    await fetchAllData()
    toast.success('Analytics data refreshed successfully')
  }

  const handleExport = () => {
    // Export functionality can be added later
    toast('Export functionality coming soon', { icon: 'ℹ️' })
  }

  // Transform time series data for charts
  const timeSeriesChartData = timeSeries.map(item => ({
    name: item.date,
    events: item.totalEvents,
    users: item.uniqueUsers
  }))

  // Transform event breakdown for pie chart
  const breakdownChartData = eventBreakdown.slice(0, 10).map(item => ({
    name: item.name,
    value: item.count,
    users: item.uniqueUsers
  }))

  // Transform top features for bar chart
  const featuresChartData = topFeatures.map(item => ({
    name: item.featureName,
    usage: item.usageCount,
    users: item.uniqueUsers
  }))

  // Transform drop-offs for bar chart
  const dropOffsChartData = dropOffs.map(item => ({
    name: item.step,
    count: item.dropOffCount,
    users: item.affectedUsers
  }))

  // Transform retention data
  const retentionChartData = retention.map(item => ({
    day: item.cohortDate,
    day1: parseFloat(item.day1Retention),
    day7: parseFloat(item.day7Retention),
    day14: parseFloat(item.day14Retention),
    day30: parseFloat(item.day30Retention)
  }))

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
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={handleExport}
            className="btn btn-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Daily Active Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.dau || 0}
                </p>
                <p className="text-xs text-gray-500">
                  Monthly: {summary?.mau || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Post Views</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.postViews?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500">
                  Total Events: {summary?.totalEvents?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.engagementRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-gray-500">
                  Total Posts: {summary?.totalPosts?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Crashes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.crashCount || 0}
                </p>
                <p className="text-xs text-gray-500">
                  Unresolved errors
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Metrics */}
      {engagementMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              User Engagement Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{engagementMetrics.metrics?.totalUsers?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{engagementMetrics.metrics?.activeUsers?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {engagementMetrics.metrics?.engagementRate || 0}% engagement rate
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Posts Created</p>
                <p className="text-2xl font-bold text-gray-900">{engagementMetrics.metrics?.postsCreated?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {engagementMetrics.metrics?.postsPerActiveUser || 0} per active user
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Posts/User</p>
                <p className="text-2xl font-bold text-gray-900">{engagementMetrics.metrics?.avgPostsPerUser || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Total: {engagementMetrics.metrics?.totalPosts?.toLocaleString() || 0} posts
                </p>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Period: {engagementMetrics.period} | 
              Date Range: {new Date(engagementMetrics.dateRange?.start).toLocaleDateString()} - {new Date(engagementMetrics.dateRange?.end).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      )}

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
              {selectedChart === 'timeseries' && timeSeriesChartData.length > 0 && (
                <LineChartComponent data={timeSeriesChartData} dataKey="events" name="Events" />
              )}
              {selectedChart === 'breakdown' && breakdownChartData.length > 0 && (
                <PieChartComponent data={breakdownChartData} dataKey="value" nameKey="name" />
              )}
              {selectedChart === 'features' && featuresChartData.length > 0 && (
                <BarChartComponent data={featuresChartData} dataKey="usage" name="Usage Count" />
              )}
              {selectedChart === 'dropoffs' && dropOffsChartData.length > 0 && (
                <BarChartComponent data={dropOffsChartData} dataKey="count" name="Drop-off Count" />
              )}
              {selectedChart === 'retention' && retentionChartData.length > 0 && (
                <LineChartComponent data={retentionChartData} dataKey="day30" name="30-Day Retention %" />
              )}
              {(!timeSeriesChartData.length && !breakdownChartData.length && !featuresChartData.length && !dropOffsChartData.length && !retentionChartData.length) && (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  No data available for the selected period
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
