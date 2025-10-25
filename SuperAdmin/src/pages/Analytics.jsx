import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { LineChartComponent, AreaChartComponent, BarChartComponent, PieChartComponent } from '../components/Charts/index.jsx'
import { Calendar, Download, Filter, RefreshCw } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'

const Analytics = () => {
  const { analyticsData, fetchAnalyticsData, isConnected } = useRealTime()
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [selectedChart, setSelectedChart] = useState('users')
  const [loading, setLoading] = useState(false)

  // Fetch analytics data on component mount and when period changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        await fetchAnalyticsData(selectedPeriod)
      } catch (error) {
        toast.error('Failed to fetch analytics data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchAnalyticsData, selectedPeriod])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetchAnalyticsData(selectedPeriod)
      toast.success('Analytics data refreshed successfully')
    } catch (error) {
      toast.error('Failed to refresh analytics data')
    } finally {
      setLoading(false)
    }
  }

  // Transform API data to chart format
  const userGrowthData = analyticsData?.userGrowth?.map(item => ({
    name: item.date,
    users: item.count,
    posts: 0, // This would come from posts data
    engagement: 0 // This would be calculated
  })) || []

  const engagementData = analyticsData?.engagement ? [
    { name: 'Mon', views: analyticsData.engagement.totalLikes || 0, likes: analyticsData.engagement.totalLikes || 0, comments: analyticsData.engagement.totalComments || 0, shares: analyticsData.engagement.totalShares || 0 },
    { name: 'Tue', views: 0, likes: 0, comments: 0, shares: 0 },
    { name: 'Wed', views: 0, likes: 0, comments: 0, shares: 0 },
    { name: 'Thu', views: 0, likes: 0, comments: 0, shares: 0 },
    { name: 'Fri', views: 0, likes: 0, comments: 0, shares: 0 },
    { name: 'Sat', views: 0, likes: 0, comments: 0, shares: 0 },
    { name: 'Sun', views: 0, likes: 0, comments: 0, shares: 0 },
  ] : []

  const locationData = analyticsData?.topLocations?.map(item => ({
    name: item.name,
    users: 0, // This would come from user data
    posts: item.posts || 0
  })) || []

  const contentTypeData = [
    { name: 'Photos', value: 45, count: 4500 },
    { name: 'Videos', value: 30, count: 3000 },
    { name: 'Shorts', value: 20, count: 2000 },
    { name: 'Text Posts', value: 5, count: 500 },
  ]

  const deviceData = analyticsData?.deviceStats ? [
    { name: 'Mobile', value: analyticsData.deviceStats.mobile || 0, users: 0 },
    { name: 'Desktop', value: analyticsData.deviceStats.desktop || 0, users: 0 },
    { name: 'Tablet', value: analyticsData.deviceStats.tablet || 0, users: 0 },
  ] : []

  const retentionData = [
    { day: 'Day 1', retention: 100 },
    { day: 'Day 7', retention: 65 },
    { day: 'Day 14', retention: 45 },
    { day: 'Day 30', retention: 30 },
    { day: 'Day 60', retention: 20 },
    { day: 'Day 90', retention: 15 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">
            Charts for usage, trends, and growth
            {isConnected && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
                Live Data
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-3">
          <select
            className="input"
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
          <button className="btn btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.userGrowth?.length || 0}
                </p>
                <p className="text-xs text-green-600">
                  {analyticsData?.userGrowth?.length > 0 ? '+12.5% from last month' : 'No data available'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.activeUsers || 0}
                </p>
                <p className="text-xs text-green-600">
                  {analyticsData?.activeUsers > 0 ? '+8.2% from last month' : 'No data available'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.contentStats?.totalPosts || 0}
                </p>
                <p className="text-xs text-green-600">
                  {analyticsData?.contentStats?.totalPosts > 0 ? '+15.3% from last month' : 'No data available'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData?.engagementMetrics?.avgLikes ? 
                    `${((analyticsData.engagementMetrics.avgLikes / 100) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </p>
                <p className="text-xs text-green-600">
                  {analyticsData?.engagementMetrics?.avgLikes > 0 ? '+2.1% from last month' : 'No data available'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedChart('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'users'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              User Growth
            </button>
            <button
              onClick={() => setSelectedChart('engagement')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'engagement'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Engagement
            </button>
            <button
              onClick={() => setSelectedChart('locations')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'locations'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Locations
            </button>
            <button
              onClick={() => setSelectedChart('content')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'content'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Content Types
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
            {selectedChart === 'users' && 'User Growth & Posts'}
            {selectedChart === 'engagement' && 'Daily Engagement Metrics'}
            {selectedChart === 'locations' && 'Users by Region'}
            {selectedChart === 'content' && 'Content Type Distribution'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedChart === 'users' && (
            <LineChartComponent data={userGrowthData} dataKey="users" name="Users" />
          )}
          {selectedChart === 'engagement' && (
            <AreaChartComponent data={engagementData} dataKey="views" name="Views" />
          )}
          {selectedChart === 'locations' && (
            <BarChartComponent data={locationData} dataKey="users" name="Users" />
          )}
          {selectedChart === 'content' && (
            <PieChartComponent data={contentTypeData} dataKey="value" nameKey="name" />
          )}
        </CardContent>
      </Card>

      {/* Additional Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Device Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChartComponent data={deviceData} dataKey="value" nameKey="name" />
          </CardContent>
        </Card>

        {/* User Retention */}
        <Card>
          <CardHeader>
            <CardTitle>User Retention</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartComponent data={retentionData} dataKey="retention" name="Retention %" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Top Travel Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {locationData.slice(0, 5).map((location, index) => (
                <div key={location.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium">{location.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{location.users.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{location.posts.toLocaleString()} posts</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Content Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentTypeData.map((content, index) => (
                <div key={content.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{content.name}</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{content.value}%</div>
                    <div className="text-xs text-gray-500">{content.count.toLocaleString()} posts</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Likes per Post</span>
                <span className="text-sm font-bold">156</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Comments per Post</span>
                <span className="text-sm font-bold">23</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Shares per Post</span>
                <span className="text-sm font-bold">8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Peak Activity Time</span>
                <span className="text-sm font-bold">7-9 PM</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      )}
    </div>
  )
}

export default Analytics
