import React, { useState, useEffect } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, Users, MessageSquare, Heart, Share2, Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRealTime } from '../context/RealTimeContext'

const RealTimeAnalytics = () => {
  const { analyticsData, fetchAnalyticsData, lastUpdate } = useRealTime()
  const [selectedPeriod, setSelectedPeriod] = useState('24h')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const periods = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ]

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAnalyticsData(selectedPeriod)
    setIsRefreshing(false)
  }

  useEffect(() => {
    fetchAnalyticsData(selectedPeriod)
  }, [selectedPeriod, fetchAnalyticsData])

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const { userRegistrations, postCreations, activeUsers, engagement } = analyticsData

  // Calculate growth metrics
  const userGrowth = userRegistrations.length > 1 ? 
    ((userRegistrations[userRegistrations.length - 1]?.count || 0) - (userRegistrations[0]?.count || 0)) : 0
  
  const postGrowth = postCreations.length > 1 ? 
    ((postCreations[postCreations.length - 1]?.count || 0) - (postCreations[0]?.count || 0)) : 0

  const metrics = [
    {
      title: 'Active Users',
      value: activeUsers,
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'New Posts',
      value: postCreations.reduce((sum, item) => sum + item.count, 0),
      change: postGrowth > 0 ? `+${postGrowth}` : `${postGrowth}`,
      trend: postGrowth > 0 ? 'up' : 'down',
      icon: MessageSquare,
      color: 'text-green-600'
    },
    {
      title: 'Total Likes',
      value: engagement.totalLikes,
      change: '+8.2%',
      trend: 'up',
      icon: Heart,
      color: 'text-red-600'
    },
    {
      title: 'Total Shares',
      value: engagement.totalShares,
      change: '+15.3%',
      trend: 'up',
      icon: Share2,
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Real-Time Analytics</h2>
          <p className="text-gray-600">
            Last updated: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Never'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {periods.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-full ${metric.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {metric.trend === 'up' ? (
                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
              )}
              <span className={`text-sm font-medium ${
                metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.change}
              </span>
              <span className="text-sm text-gray-500 ml-1">from last period</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Registrations Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Registrations</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userRegistrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Post Creations Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Post Creations</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={postCreations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Heart className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{engagement.totalLikes}</p>
            <p className="text-sm text-gray-600">Total Likes</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{engagement.totalComments}</p>
            <p className="text-sm text-gray-600">Total Comments</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Share2 className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{engagement.totalShares}</p>
            <p className="text-sm text-gray-600">Total Shares</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RealTimeAnalytics
