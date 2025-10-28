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
      bgColor: 'bg-gradient-to-br from-blue-400 to-cyan-500',
      cardBg: 'from-blue-50 to-cyan-50',
      borderColor: 'border-blue-200',
      gradientText: 'from-blue-600 to-cyan-600'
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
      gradientText: 'from-green-600 to-emerald-600'
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
      gradientText: 'from-purple-600 to-violet-600'
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
      gradientText: 'from-orange-600 to-red-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 shadow-lg border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                Live Data
              </span>
            </div>
            <p className="text-gray-600 text-lg">
              Welcome back! Here's what's happening with your platform.
            </p>
            {lastUpdate && (
              <p className="text-sm text-gray-500 mt-2">
                Last updated: {new Date(lastUpdate).toLocaleTimeString()}
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`bg-gradient-to-br ${card.cardBg} rounded-2xl p-6 border ${card.borderColor} shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
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