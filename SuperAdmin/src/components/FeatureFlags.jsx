import React, { useState, useEffect } from 'react'
import { ToggleLeft, ToggleRight, Settings, Users, Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'

const FeatureFlags = () => {
  const { featureFlags, fetchFeatureFlags, updateFeatureFlag } = useRealTime()
  const [isLoading, setIsLoading] = useState(false)
  const [editingFlag, setEditingFlag] = useState(null)
  const [rolloutValue, setRolloutValue] = useState(0)
  const [targetUsers, setTargetUsers] = useState('all')

  useEffect(() => {
    fetchFeatureFlags()
  }, [fetchFeatureFlags])

  const handleToggleFlag = async (flag) => {
    setIsLoading(true)
    try {
      await updateFeatureFlag(flag.id, {
        enabled: !flag.enabled,
        rolloutPercentage: flag.enabled ? 0 : flag.rolloutPercentage || 100
      })
    } catch (error) {
      console.error('Failed to toggle feature flag:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateRollout = async (flag) => {
    setIsLoading(true)
    try {
      await updateFeatureFlag(flag.id, {
        rolloutPercentage: rolloutValue,
        targetUsers
      })
      setEditingFlag(null)
      toast.success('Feature flag updated successfully')
    } catch (error) {
      console.error('Failed to update rollout:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (flag) => {
    setEditingFlag(flag.id)
    setRolloutValue(flag.rolloutPercentage)
    setTargetUsers(flag.targetUsers)
  }

  const getStatusColor = (flag) => {
    if (!flag.enabled) return 'text-gray-500 bg-gray-100'
    if (flag.rolloutPercentage === 100) return 'text-green-600 bg-green-100'
    if (flag.rolloutPercentage > 0) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-500 bg-gray-100'
  }

  const getStatusText = (flag) => {
    if (!flag.enabled) return 'Disabled'
    if (flag.rolloutPercentage === 100) return 'Fully Rolled Out'
    if (flag.rolloutPercentage > 0) return `${flag.rolloutPercentage}% Rollout`
    return 'Disabled'
  }

  const getTargetIcon = (target) => {
    switch (target) {
      case 'all': return Users
      case 'beta': return Zap
      case 'premium': return CheckCircle
      default: return Users
    }
  }

  const targetOptions = [
    { value: 'all', label: 'All Users', icon: Users },
    { value: 'beta', label: 'Beta Users', icon: Zap },
    { value: 'premium', label: 'Premium Users', icon: CheckCircle }
  ]

  if (!featureFlags) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Feature Flags</h2>
          <p className="text-gray-600">Manage app features dynamically without redeploying</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1 bg-blue-100 rounded-full">
            <span className="text-sm font-semibold text-blue-600">
              {featureFlags.filter(f => f.enabled).length} Active
            </span>
          </div>
          <div className="px-3 py-1 bg-gray-100 rounded-full">
            <span className="text-sm font-semibold text-gray-600">
              {featureFlags.length} Total
            </span>
          </div>
        </div>
      </div>

      {/* Feature Flags Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {featureFlags.map((flag, index) => (
          <motion.div
            key={flag.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Settings className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900">{flag.name}</h3>
                </div>
                <p className="text-gray-600 text-sm mb-3">{flag.description}</p>
                
                {/* Status Badge */}
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(flag)}`}>
                  {getStatusText(flag)}
                </div>
              </div>
              
              {/* Toggle Switch */}
              <button
                onClick={() => handleToggleFlag(flag)}
                disabled={isLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  flag.enabled ? 'bg-blue-600' : 'bg-gray-200'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    flag.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Rollout Configuration */}
            {flag.enabled && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Rollout Percentage</span>
                  <span className="text-sm text-gray-500">{flag.rolloutPercentage}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${flag.rolloutPercentage}%` }}
                  />
                </div>

                {/* Target Users */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Target:</span>
                  <div className="flex items-center space-x-1">
                    {(() => {
                      const TargetIcon = getTargetIcon(flag.targetUsers)
                      return <TargetIcon className="w-4 h-4 text-gray-500" />
                    })()}
                    <span className="text-sm text-gray-600 capitalize">{flag.targetUsers}</span>
                  </div>
                </div>

                {/* Edit Controls */}
                {editingFlag === flag.id ? (
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rollout Percentage
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={rolloutValue}
                        onChange={(e) => setRolloutValue(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0%</span>
                        <span className="font-semibold">{rolloutValue}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Users
                      </label>
                      <select
                        value={targetUsers}
                        onChange={(e) => setTargetUsers(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {targetOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateRollout(flag)}
                        disabled={isLoading}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingFlag(null)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing(flag)}
                    className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Configure Rollout
                  </button>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Updated {new Date(flag.updatedAt).toLocaleDateString()}</span>
                </div>
                <span>ID: {flag.id}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-green-900">Enable All Features</p>
              <p className="text-sm text-green-600">Turn on all feature flags</p>
            </div>
          </button>
          
          <button className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-red-900">Disable All Features</p>
              <p className="text-sm text-red-600">Turn off all feature flags</p>
            </div>
          </button>
          
          <button className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <Settings className="w-5 h-5 text-blue-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-blue-900">Bulk Configure</p>
              <p className="text-sm text-blue-600">Update multiple flags</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default FeatureFlags
