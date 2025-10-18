import React from 'react'
import { TrendingUp, TrendingDown, Users, MapPin, AlertTriangle, Star, Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'

const AIInsights = ({ insights }) => {
  if (!insights) return null

  const { topPerformingRegions, inactiveUsers, vipUsers, recommendations } = insights

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Performing Regions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-blue-600" />
            Top Performing Regions
          </h3>
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <div className="space-y-3">
          {topPerformingRegions?.slice(0, 5).map((region, index) => (
            <motion.div
              key={region._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{region._id}</p>
                  <p className="text-sm text-gray-500">{region.count} posts</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">{region.totalLikes} likes</p>
                <p className="text-xs text-gray-500">High engagement</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* VIP Users */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Star className="w-5 h-5 mr-2 text-yellow-600" />
            VIP Users
          </h3>
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <div className="space-y-3">
          {vipUsers?.slice(0, 5).map((user, index) => (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center mr-3">
                  <span className="text-sm font-semibold text-white">
                    {user.fullName?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.fullName}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-yellow-600">{user.totalLikes} likes</p>
                <p className="text-xs text-gray-500">{user.totalPosts} posts</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Inactive Users Alert */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
            Inactive Users
          </h3>
          <TrendingDown className="w-5 h-5 text-orange-600" />
        </div>
        <div className="space-y-3">
          {inactiveUsers?.slice(0, 5).map((user, index) => (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-sm font-semibold text-orange-600">
                    {user.fullName?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.fullName}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-orange-600">
                  {user.lastActive ? 
                    `${Math.floor((Date.now() - new Date(user.lastActive)) / (1000 * 60 * 60 * 24))} days ago` : 
                    'Never active'
                  }
                </p>
                <p className="text-xs text-gray-500">Needs re-engagement</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-purple-600" />
            AI Recommendations
          </h3>
          <div className="px-2 py-1 bg-purple-100 rounded-full">
            <span className="text-xs font-semibold text-purple-600">AI Powered</span>
          </div>
        </div>
        <div className="space-y-4">
          {recommendations?.map((rec, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{rec.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                  <div className="flex items-center space-x-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getPriorityColor(rec.priority)}`}>
                      {rec.priority} priority
                    </span>
                    <span className={`text-xs font-semibold ${getImpactColor(rec.impact)}`}>
                      {rec.impact} impact
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  {rec.type === 'engagement' && <TrendingUp className="w-5 h-5 text-green-600" />}
                  {rec.type === 'retention' && <Users className="w-5 h-5 text-blue-600" />}
                  {rec.type === 'content' && <MapPin className="w-5 h-5 text-purple-600" />}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AIInsights
