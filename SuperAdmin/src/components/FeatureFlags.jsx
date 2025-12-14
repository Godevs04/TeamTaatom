import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Cards/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from './Modals/index.jsx'
import { 
  ToggleLeft, ToggleRight, Settings, Users, Zap, AlertCircle, CheckCircle, 
  Clock, Plus, Filter, Search, TrendingUp, Shield, Trash2, Edit,
  PlayCircle, PauseCircle, Target, MessageSquare, BarChart3, Bell, X, Calendar, Info
} from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import SafeComponent from './SafeComponent'
import logger from '../utils/logger'

// Memoized Feature Flag Card Component for performance
const FeatureFlagCard = memo(({
  flag,
  isUpdating,
  isCritical,
  onToggle,
  onDelete,
  onEdit,
  onViewDetails,
  editingFlag,
  rolloutValue,
  targetUsers,
  onRolloutChange,
  onTargetUsersChange,
  onUpdateRollout,
  isLoading,
  getAffectsDescription,
  getCategoryIcon,
  getCategoryColor,
  getPriorityColor,
  getStatusColor,
  getStatusText,
  targetOptions,
  originalRolloutValue,
  originalTargetUsers
}) => {
  const CategoryIcon = getCategoryIcon(flag.category)
  
  return (
    <div 
      className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300"
      style={{
        background: flag.enabled 
          ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)'
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <div className={`p-1.5 rounded-lg ${getCategoryColor(flag.category)}`}>
              <CategoryIcon className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{flag.name}</h3>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(flag.priority)}`}>
              {flag.priority}
            </span>
            {isCritical && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-300" title="Critical flag - requires confirmation">
                <Shield className="w-3 h-3 inline" />
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm mb-3">{flag.description}</p>
          
          {/* Affects Description */}
          <div className="flex items-start gap-2 mb-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-900 mb-0.5">Affects:</p>
              <p className="text-xs text-blue-700">{getAffectsDescription(flag)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 mb-3">
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(flag)}`}>
              {getStatusText(flag)}
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(flag.category)}`}>
              {flag.category}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onToggle(flag)}
            disabled={isLoading || isUpdating}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              flag.enabled ? 'bg-blue-600' : 'bg-gray-200'
            } ${isLoading || isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isUpdating ? 'Updating...' : isCritical ? 'Critical flag - confirmation required' : ''}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                flag.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <button
            onClick={() => onDelete(flag.id)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rollout Configuration */}
      {flag.enabled && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Rollout Percentage</span>
            <span className="text-sm font-bold text-gray-900">{flag.rolloutPercentage}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${flag.rolloutPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 capitalize">
                {targetOptions.find(t => t.value === flag.targetUsers)?.label || flag.targetUsers}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500 text-xs">
                {new Date(flag.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

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
                  onChange={(e) => onRolloutChange(parseInt(e.target.value))}
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
                  onChange={(e) => onTargetUsersChange(e.target.value)}
                  className="input w-full"
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
                  onClick={() => onUpdateRollout(flag)}
                  disabled={isLoading}
                  className="flex-1 btn btn-primary"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    // Reset to original values before canceling
                    if (originalRolloutValue !== undefined) {
                      onRolloutChange(originalRolloutValue)
                    }
                    if (originalTargetUsers !== undefined) {
                      onTargetUsersChange(originalTargetUsers)
                    }
                    onEdit(null)
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={() => onEdit(flag)}
                className="flex-1 btn btn-sm btn-secondary"
              >
                Configure Rollout
              </button>
              <button
                onClick={() => onViewDetails(flag)}
                className="btn btn-sm btn-secondary"
                title="View Details"
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="space-y-2">
          {/* Last Changed Info */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1 text-gray-600">
              <Clock className="w-3 h-3" />
              <span>Last changed:</span>
              <span className="font-medium text-gray-900">
                {new Date(flag.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1 text-gray-500">
              <Users className="w-3 h-3" />
              <span>by {flag.updatedBy || flag.createdBy}</span>
            </div>
            <span className="text-gray-400">{flag.changelog?.length || 0} changes</span>
          </div>
        </div>
      </div>
    </div>
  )
})

FeatureFlagCard.displayName = 'FeatureFlagCard'

const FeatureFlags = () => {
  const { isConnected } = useRealTime()
  const [featureFlags, setFeatureFlags] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingFlag, setEditingFlag] = useState(null)
  const [rolloutValue, setRolloutValue] = useState(0)
  const [targetUsers, setTargetUsers] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterEnabled, setFilterEnabled] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFlag, setSelectedFlag] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showDowntimeModal, setShowDowntimeModal] = useState(false)
  const [downtimeSchedule, setDowntimeSchedule] = useState({
    reason: '',
    scheduledDate: '',
    scheduledTime: '',
    duration: 30
  })
  
  const [newFlag, setNewFlag] = useState({
    name: '',
    description: '',
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: 'all',
    category: 'other',
    priority: 'medium',
    impact: 'medium'
  })
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const updatingFlagsRef = useRef(new Set()) // Track flags being updated
  const flagStateCacheRef = useRef(new Map()) // Cache previous states for rollback
  const pendingConfirmationsRef = useRef(new Map()) // Track pending confirmations

  // Get "Affects:" description based on category and impact
  const getAffectsDescription = useCallback((flag) => {
    const categoryMap = {
      ui: 'User interface elements and styling',
      ai: 'AI-powered features and recommendations',
      analytics: 'Analytics tracking and reporting',
      social: 'Social features, sharing, and interactions',
      security: 'Security features and authentication',
      other: 'General application features'
    }
    
    const impactMap = {
      high: 'All users',
      medium: 'Targeted user segments',
      low: 'Limited user groups'
    }
    
    const categoryDesc = categoryMap[flag.category] || 'Application features'
    const impactDesc = impactMap[flag.impact] || 'User segments'
    
    return `${categoryDesc} - ${impactDesc}`
  }, [])
  
  // Check if flag is critical (high priority or high impact)
  const isCriticalFlag = useCallback((flag) => {
    return flag.priority === 'high' || flag.impact === 'high'
  }, [])
  
  // Fetch feature flags from API
  const fetchFeatureFlags = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    
    if (isMountedRef.current) {
      setIsLoading(true)
    }
    
    try {
      const params = {}
      
      if (filterCategory !== 'all') {
        params.category = filterCategory
      }
      if (filterEnabled !== 'all') {
        params.enabled = filterEnabled
      }
      if (searchTerm) {
        params.search = searchTerm
      }
      
      const response = await api.get('/api/superadmin/feature-flags', { 
        params,
        signal: abortControllerRef.current.signal
      })
      
      if (!abortControllerRef.current.signal.aborted && isMountedRef.current && response.data.success) {
        // Transform data to match component expectations
        const transformed = response.data.featureFlags.map(flag => ({
          id: flag._id,
          name: flag.name,
          description: flag.description,
          enabled: flag.enabled,
          rolloutPercentage: flag.rolloutPercentage,
          targetUsers: flag.targetUsers,
          category: flag.category,
          priority: flag.priority,
          impact: flag.impact,
          createdBy: flag.createdBy?.email || 'Unknown',
          updatedBy: flag.updatedBy?.email || 'Unknown',
          createdAt: flag.createdAt,
          updatedAt: flag.updatedAt,
          changelog: flag.changelog || []
        }))
        setFeatureFlags(transformed)
      }
    } catch (error) {
      if (!abortControllerRef.current?.signal?.aborted && error.name !== 'AbortError' && error.name !== 'CanceledError') {
        logger.error('Failed to fetch feature flags:', error)
        if (isMountedRef.current) {
          toast.error('Failed to fetch feature flags')
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [filterCategory, filterEnabled, searchTerm])

  // Initial fetch on mount
  useEffect(() => {
    if (isMountedRef.current) {
      fetchFeatureFlags()
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, []) // Only run once on mount
  
  // Fetch when filters change
  useEffect(() => {
    if (!isMountedRef.current) return
    
    fetchFeatureFlags()
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [filterCategory, filterEnabled, searchTerm, fetchFeatureFlags])
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      updatingFlagsRef.current.clear()
      flagStateCacheRef.current.clear()
      pendingConfirmationsRef.current.clear()
    }
  }, [])

  const handleToggleFlag = useCallback(async (flag) => {
    // Prevent duplicate toggles
    if (updatingFlagsRef.current.has(flag.id)) {
      logger.debug('Flag toggle already in progress:', flag.id)
      return
    }
    
    // Check if critical flag requires confirmation
    const isCritical = isCriticalFlag(flag)
    if (isCritical && !pendingConfirmationsRef.current.has(flag.id)) {
      const confirmed = window.confirm(
        `⚠️ Critical Feature Flag\n\n` +
        `You are about to ${flag.enabled ? 'disable' : 'enable'} "${flag.name}".\n\n` +
        `This flag has ${flag.priority === 'high' ? 'high priority' : ''}${flag.priority === 'high' && flag.impact === 'high' ? ' and ' : ''}${flag.impact === 'high' ? 'high impact' : ''}.\n\n` +
        `Are you sure you want to proceed?`
      )
      
      if (!confirmed) {
        return
      }
      
      pendingConfirmationsRef.current.set(flag.id, true)
      // Clear confirmation after 5 seconds to allow re-confirmation if needed
      setTimeout(() => {
        pendingConfirmationsRef.current.delete(flag.id)
      }, 5000)
    }
    
    // Store previous state for rollback
    const previousState = {
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage
    }
    flagStateCacheRef.current.set(flag.id, previousState)
    
    // Optimistic update
    updatingFlagsRef.current.add(flag.id)
    setFeatureFlags(prev => prev.map(f => 
      f.id === flag.id 
        ? { ...f, enabled: !f.enabled, rolloutPercentage: !f.enabled ? (f.rolloutPercentage || 100) : 0 }
        : f
    ))
    
    try {
      const response = await api.patch(`/api/superadmin/feature-flags/${flag.id}`, {
        enabled: !flag.enabled,
        rolloutPercentage: flag.enabled ? 0 : flag.rolloutPercentage || 100
      })
      
      if (!isMountedRef.current) return
      
      if (response.data.success) {
        // Update with server response to ensure sync
        setFeatureFlags(prev => prev.map(f => 
          f.id === flag.id 
            ? { 
                ...f, 
                enabled: response.data.featureFlag.enabled,
                rolloutPercentage: response.data.featureFlag.rolloutPercentage,
                updatedBy: response.data.featureFlag.updatedBy?.email || f.updatedBy,
                updatedAt: response.data.featureFlag.updatedAt || f.updatedAt
              }
            : f
        ))
        
        toast.success(`Feature ${!flag.enabled ? 'enabled' : 'disabled'} successfully`)
        flagStateCacheRef.current.delete(flag.id)
      }
    } catch (error) {
      if (!isMountedRef.current) return
      
      logger.error('Failed to toggle feature flag:', error)
      
      // Rollback to previous state
      setFeatureFlags(prev => prev.map(f => 
        f.id === flag.id 
          ? { ...f, ...previousState }
          : f
      ))
      
      toast.error('Failed to toggle feature flag')
      flagStateCacheRef.current.delete(flag.id)
    } finally {
      if (isMountedRef.current) {
        updatingFlagsRef.current.delete(flag.id)
      }
    }
  }, [isCriticalFlag])

  const handleUpdateRollout = useCallback(async (flag) => {
    if (updatingFlagsRef.current.has(flag.id)) {
      logger.debug('Rollout update already in progress:', flag.id)
      return
    }
    
    // Store previous state for rollback
    const previousState = {
      rolloutPercentage: flag.rolloutPercentage,
      targetUsers: flag.targetUsers
    }
    flagStateCacheRef.current.set(flag.id, previousState)
    
    updatingFlagsRef.current.add(flag.id)
    
    if (isMountedRef.current) {
      setIsLoading(true)
    }
    
    // Optimistic update
    setFeatureFlags(prev => prev.map(f => 
      f.id === flag.id 
        ? { ...f, rolloutPercentage: rolloutValue, targetUsers }
        : f
    ))
    
    try {
      const response = await api.patch(`/api/superadmin/feature-flags/${flag.id}`, {
        rolloutPercentage: rolloutValue,
        targetUsers
      })
      
      if (!isMountedRef.current) return
      
      if (response.data.success) {
        // Update with server response
        setFeatureFlags(prev => prev.map(f => 
          f.id === flag.id 
            ? { 
                ...f, 
                rolloutPercentage: response.data.featureFlag.rolloutPercentage,
                targetUsers: response.data.featureFlag.targetUsers,
                updatedBy: response.data.featureFlag.updatedBy?.email || f.updatedBy,
                updatedAt: response.data.featureFlag.updatedAt || f.updatedAt
              }
            : f
        ))
        
        toast.success('Feature flag updated successfully')
        setEditingFlag(null)
        flagStateCacheRef.current.delete(flag.id)
      }
    } catch (error) {
      if (!isMountedRef.current) return
      
      logger.error('Failed to update rollout:', error)
      
      // Rollback to previous state
      setFeatureFlags(prev => prev.map(f => 
        f.id === flag.id 
          ? { ...f, ...previousState }
          : f
      ))
      
      toast.error('Failed to update feature flag')
      flagStateCacheRef.current.delete(flag.id)
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
        updatingFlagsRef.current.delete(flag.id)
      }
    }
  }, [rolloutValue, targetUsers])

  const handleCreateFlag = async () => {
    if (!newFlag.name || !newFlag.description) {
      toast.error('Name and description are required')
      return
    }
    
    setIsLoading(true)
    try {
      await api.post('/api/superadmin/feature-flags', newFlag)
      toast.success('Feature flag created successfully')
      setShowCreateModal(false)
      setNewFlag({
        name: '',
        description: '',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: 'all',
        category: 'other',
        priority: 'medium',
        impact: 'medium'
      })
      await fetchFeatureFlags()
    } catch (error) {
      logger.error('Failed to create feature flag:', error)
      toast.error(error.response?.data?.message || 'Failed to create feature flag')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFlag = async (flagId) => {
    if (!window.confirm('Are you sure you want to delete this feature flag?')) {
      return
    }
    
    setIsLoading(true)
    try {
      await api.delete(`/api/superadmin/feature-flags/${flagId}`)
      toast.success('Feature flag deleted successfully')
      await fetchFeatureFlags()
    } catch (error) {
      logger.error('Failed to delete feature flag:', error)
      toast.error('Failed to delete feature flag')
    } finally {
      setIsLoading(false)
    }
  }

  const handleScheduleDowntime = async () => {
    if (!downtimeSchedule.reason || !downtimeSchedule.scheduledDate || !downtimeSchedule.scheduledTime || !downtimeSchedule.duration) {
      toast.error('Please fill all fields')
      return
    }
    
    setIsLoading(true)
    try {
      await api.post('/api/superadmin/schedule-downtime', downtimeSchedule)
      toast.success('Downtime scheduled and notifications sent to all users')
      setShowDowntimeModal(false)
      setDowntimeSchedule({ reason: '', scheduledDate: '', scheduledTime: '', duration: 30 })
      await fetchFeatureFlags()
    } catch (error) {
      logger.error('Failed to schedule downtime:', error)
      toast.error(error.response?.data?.message || 'Failed to schedule downtime')
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = useCallback((flag) => {
    if (!isMountedRef.current) return
    
    if (flag === null) {
      setEditingFlag(null)
    } else {
      setEditingFlag(flag.id)
      setRolloutValue(flag.rolloutPercentage)
      setTargetUsers(flag.targetUsers)
    }
  }, [])

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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'ui': return MessageSquare
      case 'ai': return Zap
      case 'analytics': return BarChart3
      case 'social': return Users
      case 'security': return Shield
      default: return Settings
    }
  }

  const getCategoryColor = (category) => {
    switch (category) {
      case 'ui': return 'text-blue-600 bg-blue-100'
      case 'ai': return 'text-purple-600 bg-purple-100'
      case 'analytics': return 'text-indigo-600 bg-indigo-100'
      case 'social': return 'text-green-600 bg-green-100'
      case 'security': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const categories = [
    { value: 'ui', label: 'UI', icon: MessageSquare, color: 'text-blue-600 bg-blue-100' },
    { value: 'ai', label: 'AI', icon: Zap, color: 'text-purple-600 bg-purple-100' },
    { value: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-indigo-600 bg-indigo-100' },
    { value: 'social', label: 'Social', icon: Users, color: 'text-green-600 bg-green-100' },
    { value: 'security', label: 'Security', icon: Shield, color: 'text-red-600 bg-red-100' },
    { value: 'other', label: 'Other', icon: Settings, color: 'text-gray-600 bg-gray-100' }
  ]

  const targetOptions = [
    { value: 'all', label: 'All Users', icon: Users },
    { value: 'beta', label: 'Beta Users', icon: TrendingUp },
    { value: 'premium', label: 'Premium Users', icon: CheckCircle },
    { value: 'new', label: 'New Users', icon: Bell }
  ]

  const priorityOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ]

  const impactOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ]

  const enabledCount = featureFlags.filter(f => f.enabled).length
  const disabledCount = featureFlags.filter(f => !f.enabled).length

  return (
    <SafeComponent>
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-8 mb-6 shadow-lg border border-blue-100">
      <div className="flex items-center justify-between">
        <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Settings className="w-6 h-6 text-white" />
        </div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Feature Flags
              </h2>
              {isConnected && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                  Live Data
            </span>
              )}
            </div>
            <p className="text-gray-600 text-lg">Manage app features dynamically without redeploying</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowDowntimeModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule Downtime</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Feature</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl shadow-md">
                <PlayCircle className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Flags</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{enabledCount}</p>
              </div>
            </div>
            <div className="text-3xl animate-pulse">✓</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 border border-red-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-red-400 to-pink-500 rounded-xl shadow-md">
                <PauseCircle className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive Flags</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">{disabledCount}</p>
              </div>
            </div>
            <div className="text-3xl text-red-500">○</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl shadow-md">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Flags</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{featureFlags.length}</p>
              </div>
            </div>
            <div className="text-3xl animate-bounce">📊</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-6 border border-purple-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-purple-400 to-violet-500 rounded-xl shadow-md">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Rollout</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                  {featureFlags.length > 0 
                    ? Math.round(featureFlags.reduce((sum, f) => sum + f.rolloutPercentage, 0) / featureFlags.length)
                    : 0}%
                </p>
              </div>
            </div>
            <div className="text-3xl animate-pulse">🎯</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search feature flags..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                className="input"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <select
                className="input"
                value={filterEnabled}
                onChange={(e) => setFilterEnabled(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : featureFlags.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-semibold text-gray-900">No Feature Flags Found</p>
            <p className="text-sm text-gray-600 mt-2">Create your first feature flag to get started</p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {featureFlags.map((flag) => {
            return (
              <FeatureFlagCard
                key={flag.id}
                flag={flag}
                isUpdating={updatingFlagsRef.current.has(flag.id)}
                isCritical={isCriticalFlag(flag)}
                onToggle={handleToggleFlag}
                onDelete={handleDeleteFlag}
                onEdit={startEditing}
                onViewDetails={(flag) => {
                  setSelectedFlag(flag)
                  setShowDetailsModal(true)
                }}
                editingFlag={editingFlag}
                rolloutValue={rolloutValue}
                targetUsers={targetUsers}
                onRolloutChange={setRolloutValue}
                onTargetUsersChange={setTargetUsers}
                onUpdateRollout={handleUpdateRollout}
                isLoading={isLoading}
                getAffectsDescription={getAffectsDescription}
                getCategoryIcon={getCategoryIcon}
                getCategoryColor={getCategoryColor}
                getPriorityColor={getPriorityColor}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                targetOptions={targetOptions}
                originalRolloutValue={flag.rolloutPercentage}
                originalTargetUsers={flag.targetUsers}
              />
            )
          })}
        </div>
      )}

      {/* Create Feature Flag Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader onClose={() => setShowCreateModal(false)}>
          Create New Feature Flag
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feature Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g., dark_mode"
                value={newFlag.name}
                onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full"
                rows="3"
                placeholder="Describe what this feature does..."
                value={newFlag.description}
                onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  className="input w-full"
                  value={newFlag.category}
                  onChange={(e) => setNewFlag({ ...newFlag, category: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  className="input w-full"
                  value={newFlag.priority}
                  onChange={(e) => setNewFlag({ ...newFlag, priority: e.target.value })}
                >
                  {priorityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Impact</label>
                <select
                  className="input w-full"
                  value={newFlag.impact}
                  onChange={(e) => setNewFlag({ ...newFlag, impact: e.target.value })}
                >
                  {impactOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Users</label>
                <select
                  className="input w-full"
                  value={newFlag.targetUsers}
                  onChange={(e) => setNewFlag({ ...newFlag, targetUsers: e.target.value })}
                >
                  {targetOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={newFlag.enabled}
                onChange={(e) => setNewFlag({ ...newFlag, enabled: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label className="text-sm text-gray-700">Enable immediately</label>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowCreateModal(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateFlag}
            className="btn btn-primary"
          >
            Create Feature Flag
          </button>
        </ModalFooter>
      </Modal>

      {/* Downtime Scheduling Modal */}
      <Modal isOpen={showDowntimeModal} onClose={() => setShowDowntimeModal(false)}>
        <ModalHeader onClose={() => setShowDowntimeModal(false)}>
          Schedule System Downtime
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-orange-600 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-900">Important Notice</h4>
                  <p className="text-sm text-orange-700">
                    Emails will be sent to ALL users automatically once scheduled. Please ensure all details are correct.
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Maintenance <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full"
                rows="3"
                placeholder="Enter the reason for scheduled maintenance (e.g., System upgrade, Security patch, etc.)"
                value={downtimeSchedule.reason}
                onChange={(e) => setDowntimeSchedule({ ...downtimeSchedule, reason: e.target.value })}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {downtimeSchedule.reason.length}/500 characters
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scheduled Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="input w-full"
                value={downtimeSchedule.scheduledDate}
                onChange={(e) => setDowntimeSchedule({ ...downtimeSchedule, scheduledDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scheduled Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                className="input w-full"
                value={downtimeSchedule.scheduledTime}
                onChange={(e) => setDowntimeSchedule({ ...downtimeSchedule, scheduledTime: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="input w-full"
                min="1"
                max="1440"
                value={downtimeSchedule.duration}
                onChange={(e) => setDowntimeSchedule({ ...downtimeSchedule, duration: parseInt(e.target.value) })}
                placeholder="e.g., 30"
              />
              <p className="text-xs text-gray-500 mt-1">Duration in minutes (1-1440)</p>
      </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Preview:</strong> {downtimeSchedule.reason && `"${downtimeSchedule.reason}"`}<br/>
                {downtimeSchedule.scheduledDate && `Scheduled for ${new Date(downtimeSchedule.scheduledDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}`}
                {downtimeSchedule.scheduledTime && ` at ${downtimeSchedule.scheduledTime}`}
                {downtimeSchedule.duration && ` for ${downtimeSchedule.duration} minutes`}
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => {
              setShowDowntimeModal(false)
              setDowntimeSchedule({ reason: '', scheduledDate: '', scheduledTime: '', duration: 30 })
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleScheduleDowntime}
            disabled={isLoading}
            className="btn btn-primary"
          >
            Schedule & Send Notifications
          </button>
        </ModalFooter>
      </Modal>

      {/* Details Modal */}
      {showDetailsModal && selectedFlag && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false)
              setSelectedFlag(null)
            }
          }}
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedFlag.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedFlag.description}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false)
                    setSelectedFlag(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedFlag)}`}>
                      {getStatusText(selectedFlag)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(selectedFlag.category)}`}>
                      {selectedFlag.category}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Priority</label>
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedFlag.priority)}`}>
                      {selectedFlag.priority}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Impact</label>
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedFlag.impact)}`}>
                      {selectedFlag.impact}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Rollout</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedFlag.rolloutPercentage}%</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Target Users</label>
                  <p className="text-sm text-gray-900 mt-1 capitalize">{selectedFlag.targetUsers}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-sm text-gray-900 mt-1">{new Date(selectedFlag.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm text-gray-900 mt-1">{new Date(selectedFlag.updatedAt).toLocaleString()}</p>
                </div>
              </div>
              
              {selectedFlag.changelog && selectedFlag.changelog.length > 0 && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Change History</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedFlag.changelog.slice().reverse().map((change, idx) => (
                      <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                        <div className="font-medium text-gray-900">{change.action}</div>
                        <div className="text-gray-600">{new Date(change.timestamp).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedFlag(null)
                }}
                className="btn btn-primary"
              >
                Close
          </button>
        </div>
      </div>
    </div>
      )}
    </div>
    </SafeComponent>
  )
}

export default FeatureFlags
