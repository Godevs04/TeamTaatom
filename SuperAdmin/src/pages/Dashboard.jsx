import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRealTime } from '../context/RealTimeContext'
import AIInsights from '../components/AIInsights'
import RealTimeAnalytics from '../components/RealTimeAnalytics'
import { Users, MessageSquare, TrendingUp, Activity, Globe, Shield } from 'lucide-react'

const Dashboard = () => {
  const { dashboardData, fetchDashboardData, lastUpdate } = useRealTime()
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const { metrics, recentActivity, aiInsights } = dashboardData

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'insights', label: 'AI Insights', icon: Globe }
  ]

  const statCards = [
    {
      title: 'Total Users',
      value: metrics.totalUsers,
      change: `+${metrics.userGrowth.weeklyGrowth}%`,
      trend: 'up',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Active Users',
      value: metrics.activeUsers,
      change: '+12.5%',
      trend: 'up',
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Total Posts',
      value: metrics.totalPosts,
      change: `+${metrics.contentGrowth.weeklyGrowth}%`,
      trend: 'up',
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Total Shorts',
      value: metrics.totalShorts,
      change: '+8.2%',
      trend: 'up',
      icon: MessageSquare,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back! Here's what's happening with your platform.
          </p>
          {lastUpdate && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date(lastUpdate).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1 bg-green-100 rounded-full">
            <span className="text-sm font-semibold text-green-600">Live Data</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-lg border border-gray-200 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                    </div>
                    <div className={`p-3 rounded-full ${card.bgColor}`}>
                      <card.icon className={`w-6 h-6 ${card.color}`} />
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