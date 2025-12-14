import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { 
  Search, Plus, Edit, Trash2, Shield, UserCheck, UserX, RefreshCw, Eye, 
  Filter, MoreVertical, ToggleLeft, ToggleRight, Ban, CheckCircle, XCircle,
  Save, X, Power, Settings2, TrendingUp, Activity, AlertTriangle, Clock, Info
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { sanitizeText } from '../utils/sanitize'

const Moderators = () => {
  const { isConnected, user } = useRealTime()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModerator, setSelectedModerator] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditPermissionsModal, setShowEditPermissionsModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [moderatorsList, setModeratorsList] = useState([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [selectedModerators, setSelectedModerators] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [editingPermissions, setEditingPermissions] = useState(null)
  const [tempPermissions, setTempPermissions] = useState({})
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // { moderatorId, action, previousState }
  const [moreFilters, setMoreFilters] = useState({
    permission: 'all',
    activityRange: 'all', // last 7 days, 30 days, all time
    createdRange: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const updatingModeratorsRef = useRef(new Set()) // Track moderators being updated
  const moderatorStateCacheRef = useRef(new Map()) // Cache previous states for rollback
  const cachedModeratorsRef = useRef(null)
  
  const [newModerator, setNewModerator] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'moderator',
    permissions: {
      canManageUsers: false,
      canManageContent: true,
      canManageReports: true,
      canManageModerators: false,
      canViewLogs: false,
      canManageSettings: false
    }
  })

  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      updatingModeratorsRef.current.clear()
      moderatorStateCacheRef.current.clear()
    }
  }, [])

  // Get permission summary (allowed modules, read-only modules)
  const getPermissionSummary = useCallback((permissions) => {
    if (!permissions) return { allowed: [], readOnly: [] }
    
    const permissionMap = {
      canManageUsers: 'Users',
      canManageContent: 'Content',
      canManageReports: 'Reports',
      canManageModerators: 'Moderators',
      canViewLogs: 'Logs',
      canManageSettings: 'Settings',
      canViewAnalytics: 'Analytics'
    }
    
    const allowed = []
    const readOnly = []
    
    // For now, all permissions are considered "allowed" (read-only logic would need backend support)
    Object.entries(permissions).forEach(([key, enabled]) => {
      if (enabled && permissionMap[key]) {
        allowed.push(permissionMap[key])
      }
    })
    
    return { allowed, readOnly }
  }, [])

  // Fetch moderators data with caching and request deduplication
  const fetchModerators = useCallback(async () => {
    // Prevent duplicate concurrent calls
    if (isFetchingRef.current) {
      logger.debug('Moderators fetch already in progress, skipping duplicate call')
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true

    // Show cached data immediately if available
    if (cachedModeratorsRef.current && isMountedRef.current) {
      setModeratorsList(cachedModeratorsRef.current)
    }

    if (isMountedRef.current) {
      setLoading(true)
    }

    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage
      }
      
      if (searchTerm) {
        params.search = searchTerm
      }
      
      const response = await api.get('/api/superadmin/moderators', { 
        params,
        signal: abortControllerRef.current.signal
      })
      
      if (abortControllerRef.current?.signal?.aborted) {
        return
      }

      if (!isMountedRef.current) return

      if (response.data.success) {
        let filtered = response.data.moderators
        
        // Apply frontend filters
        if (filterRole !== 'all') {
          filtered = filtered.filter(m => m.role === filterRole)
        }
        if (filterStatus !== 'all') {
          filtered = filtered.filter(m => 
            filterStatus === 'active' ? m.isActive : !m.isActive
          )
        }
        
        // Filter by permission
        if (moreFilters.permission !== 'all') {
          filtered = filtered.filter(m => {
            const perms = m.permissions || {}
            return perms[moreFilters.permission] === true
          })
        }
        
        // Filter by last activity
        if (moreFilters.activityRange !== 'all') {
          const now = new Date()
          let cutoffDate
          if (moreFilters.activityRange === '7d') {
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          } else if (moreFilters.activityRange === '30d') {
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
          
          if (cutoffDate) {
            filtered = filtered.filter(m => {
              if (!m.lastLogin) return false
              return new Date(m.lastLogin) >= cutoffDate
            })
          }
        }
        
        // Filter by created date
        if (moreFilters.createdRange !== 'all') {
          const now = new Date()
          let cutoffDate
          if (moreFilters.createdRange === '7d') {
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          } else if (moreFilters.createdRange === '30d') {
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
          
          if (cutoffDate) {
            filtered = filtered.filter(m => {
              if (!m.createdAt) return false
              return new Date(m.createdAt) >= cutoffDate
            })
          }
        }
        
        // Sort
        if (moreFilters.sortBy) {
          filtered.sort((a, b) => {
            let aVal, bVal
            
            switch (moreFilters.sortBy) {
              case 'email':
                aVal = a.email || ''
                bVal = b.email || ''
                break
              case 'role':
                aVal = a.role || ''
                bVal = b.role || ''
                break
              case 'lastLogin':
                aVal = a.lastLogin ? new Date(a.lastLogin) : new Date(0)
                bVal = b.lastLogin ? new Date(b.lastLogin) : new Date(0)
                break
              case 'isActive':
                aVal = a.isActive ? 1 : 0
                bVal = b.isActive ? 1 : 0
                break
              default:
                aVal = a.createdAt ? new Date(a.createdAt) : new Date(0)
                bVal = b.createdAt ? new Date(b.createdAt) : new Date(0)
            }
            
            if (aVal < bVal) return moreFilters.sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return moreFilters.sortOrder === 'asc' ? 1 : -1
            return 0
          })
        }
        
        setModeratorsList(filtered)
        setTotal(filtered.length)
        setTotalPages(Math.ceil(filtered.length / itemsPerPage))
        cachedModeratorsRef.current = filtered
      }
    } catch (error) {
      if (abortControllerRef.current?.signal?.aborted || error.name === 'AbortError' || error.name === 'CanceledError') {
        return
      }
      
      if (!isMountedRef.current) return

      logger.error('Failed to fetch moderators:', error)
      
      // Show cached data if available (partial failure handling)
      if (cachedModeratorsRef.current) {
        setModeratorsList(cachedModeratorsRef.current)
        toast.error('Failed to fetch moderators. Showing cached data.', { duration: 3000 })
      } else {
        handleError(error, toast, 'Failed to fetch moderators')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
      isFetchingRef.current = false
    }
  }, [currentPage, itemsPerPage, searchTerm, filterRole, filterStatus, moreFilters])

  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    if (isMountedRef.current) {
      setCurrentPage(1)
    }
  }, [filterRole, filterStatus, moreFilters])

  // Fetch on mount and when filters change
  useEffect(() => {
    if (isMountedRef.current) {
      fetchModerators()
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchModerators])

  // Search debouncing
  useEffect(() => {
    if (!isMountedRef.current) return
    
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        if (searchTerm !== '') {
          setCurrentPage(1)
        }
        fetchModerators()
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, fetchModerators])

  const handleRefresh = async () => {
    await fetchModerators()
    toast.success('Moderators refreshed successfully')
  }

  const handleModeratorActionClick = useCallback((moderator, action) => {
    if (action === 'remove') {
      setSelectedModerator({ ...moderator, action })
      setShowRemoveConfirm(true)
    } else {
      setSelectedModerator({ ...moderator, action })
      setShowModal(true)
    }
  }, [])

  const handleToggleActive = useCallback(async (moderator, isActive) => {
    // Prevent duplicate toggles
    if (updatingModeratorsRef.current.has(moderator._id)) {
      logger.debug('Moderator toggle already in progress:', moderator._id)
      return
    }

    // Show confirmation for disabling
    if (isActive) {
      const confirmed = window.confirm(
        `⚠️ Disable Moderator\n\n` +
        `You are about to disable "${moderator.email}".\n\n` +
        `This will revoke their access to the admin panel until reactivated.\n\n` +
        `Are you sure you want to proceed?`
      )
      if (!confirmed) {
        return
      }
    }

    // Store previous state for rollback
    const previousState = {
      isActive: moderator.isActive
    }
    moderatorStateCacheRef.current.set(moderator._id, previousState)

    // Optimistic update
    updatingModeratorsRef.current.add(moderator._id)
    setModeratorsList(prev => prev.map(m => 
      m._id === moderator._id 
        ? { ...m, isActive: !isActive }
        : m
    ))

    try {
      const response = await api.patch(`/api/superadmin/moderators/${moderator._id}`, {
        isActive: !isActive
      })
      
      if (!isMountedRef.current) return

      if (response.data.success) {
        // Update with server response to ensure sync
        setModeratorsList(prev => prev.map(m => 
          m._id === moderator._id 
            ? { 
                ...m, 
                isActive: response.data.moderator?.isActive ?? !isActive,
                updatedBy: response.data.moderator?.updatedBy?.email || user?.email || 'Unknown',
                updatedAt: response.data.moderator?.updatedAt || new Date().toISOString()
              }
            : m
        ))
        
        toast.success(`Moderator ${!isActive ? 'activated' : 'deactivated'} successfully`)
        moderatorStateCacheRef.current.delete(moderator._id)
        // Refresh to ensure sync
        await fetchModerators()
      }
    } catch (error) {
      if (!isMountedRef.current) return

      logger.error('Failed to toggle status:', error)
      
      // Rollback on error
      setModeratorsList(prev => prev.map(m => 
        m._id === moderator._id 
          ? { ...m, ...previousState }
          : m
      ))
      
      handleError(error, toast, 'Failed to update status')
      moderatorStateCacheRef.current.delete(moderator._id)
    } finally {
      if (isMountedRef.current) {
        updatingModeratorsRef.current.delete(moderator._id)
      }
    }
  }, [user, fetchModerators])

  const handleModeratorAction = useCallback(async (moderatorId, action) => {
    if (!isMountedRef.current) return

    // Store previous state for rollback
    const moderator = moderatorsList.find(m => m._id === moderatorId)
    if (!moderator) return

    const previousState = { ...moderator }
    moderatorStateCacheRef.current.set(moderatorId, previousState)

    // Optimistic update for edit
    if (action === 'edit') {
      setModeratorsList(prev => prev.map(m => 
        m._id === moderatorId 
          ? { ...m, role: selectedModerator.role, isActive: selectedModerator.isActive }
          : m
      ))
    } else if (action === 'remove') {
      // Optimistic removal
      setModeratorsList(prev => prev.filter(m => m._id !== moderatorId))
    }

    try {
      if (action === 'remove') {
        await api.delete(`/api/superadmin/moderators/${moderatorId}`)
        if (isMountedRef.current) {
          toast.success('Moderator removed successfully')
        }
      } else if (action === 'edit') {
        const response = await api.patch(`/api/superadmin/moderators/${moderatorId}`, {
          role: selectedModerator.role,
          isActive: selectedModerator.isActive
        })
        
        if (!isMountedRef.current) return

        if (response.data.success) {
          // Update with server response
          setModeratorsList(prev => prev.map(m => 
            m._id === moderatorId 
              ? { 
                  ...m, 
                  role: response.data.moderator?.role || selectedModerator.role,
                  isActive: response.data.moderator?.isActive ?? selectedModerator.isActive,
                  updatedBy: response.data.moderator?.updatedBy?.email || user?.email || 'Unknown',
                  updatedAt: response.data.moderator?.updatedAt || new Date().toISOString()
                }
              : m
          ))
        }
        toast.success('Moderator updated successfully')
      }
      
      if (isMountedRef.current) {
        await fetchModerators()
        setShowModal(false)
        setSelectedModerator(null)
        setShowRemoveConfirm(false)
        moderatorStateCacheRef.current.delete(moderatorId)
      }
    } catch (error) {
      if (!isMountedRef.current) return

      logger.error('Failed to perform action:', error)
      
      // Rollback on error
      if (action === 'remove') {
        setModeratorsList(prev => [...prev, previousState])
      } else {
        setModeratorsList(prev => prev.map(m => 
          m._id === moderatorId 
            ? previousState
            : m
        ))
      }
      
      handleError(error, toast, `Failed to ${action} moderator`)
      moderatorStateCacheRef.current.delete(moderatorId)
    }
  }, [moderatorsList, selectedModerator, user, fetchModerators])

  const handleOpenEditPermissions = useCallback((moderator) => {
    if (!isMountedRef.current) return
    setEditingPermissions(moderator)
    setTempPermissions(moderator.permissions || {})
    setShowEditPermissionsModal(true)
  }, [])

  const handleSavePermissions = useCallback(async () => {
    if (!editingPermissions || !isMountedRef.current) return

    // Prevent duplicate updates
    if (updatingModeratorsRef.current.has(editingPermissions._id)) {
      logger.debug('Permissions update already in progress:', editingPermissions._id)
      return
    }

    // Store previous state for rollback
    const previousState = {
      permissions: editingPermissions.permissions
    }
    moderatorStateCacheRef.current.set(editingPermissions._id, previousState)

    // Optimistic update
    updatingModeratorsRef.current.add(editingPermissions._id)
    setModeratorsList(prev => prev.map(m => 
      m._id === editingPermissions._id 
        ? { ...m, permissions: tempPermissions }
        : m
    ))

    try {
      const response = await api.patch(`/api/superadmin/moderators/${editingPermissions._id}`, {
        permissions: tempPermissions
      })
      
      if (!isMountedRef.current) return

      if (response.data.success) {
        // Update with server response
        setModeratorsList(prev => prev.map(m => 
          m._id === editingPermissions._id 
            ? { 
                ...m, 
                permissions: response.data.moderator?.permissions || tempPermissions,
                updatedBy: response.data.moderator?.updatedBy?.email || user?.email || 'Unknown',
                updatedAt: response.data.moderator?.updatedAt || new Date().toISOString()
              }
            : m
        ))
        
        toast.success('Permissions updated successfully')
        setShowEditPermissionsModal(false)
        setEditingPermissions(null)
        moderatorStateCacheRef.current.delete(editingPermissions._id)
        // Refresh to ensure sync
        await fetchModerators()
      }
    } catch (error) {
      if (!isMountedRef.current) return

      logger.error('Failed to update permissions:', error)
      
      // Rollback on error
      setModeratorsList(prev => prev.map(m => 
        m._id === editingPermissions._id 
          ? { ...m, ...previousState }
          : m
      ))
      
      handleError(error, toast, 'Failed to update permissions')
      moderatorStateCacheRef.current.delete(editingPermissions._id)
    } finally {
      if (isMountedRef.current) {
        updatingModeratorsRef.current.delete(editingPermissions._id)
      }
    }
  }, [editingPermissions, tempPermissions, user, fetchModerators])

  const handleBulkAction = useCallback(async (action) => {
    if (!isMountedRef.current) return

    // Show confirmation for destructive actions
    if (action === 'remove' || action === 'deactivate') {
      const actionText = action === 'remove' ? 'remove' : 'deactivate'
      const confirmed = window.confirm(
        `⚠️ Bulk ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}\n\n` +
        `You are about to ${actionText} ${selectedModerators.length} moderator(s).\n\n` +
        `${action === 'remove' 
          ? 'This will revoke all moderator privileges and remove access to the admin panel.'
          : 'This will revoke access to the admin panel until reactivated.'
        }\n\n` +
        `Are you sure you want to proceed?`
      )
      if (!confirmed) {
        return
      }
    }

    // Store previous states for rollback
    const previousStates = new Map()
    selectedModerators.forEach(id => {
      const moderator = moderatorsList.find(m => m._id === id)
      if (moderator) {
        previousStates.set(id, { ...moderator })
      }
    })

    // Optimistic updates
    if (action === 'activate' || action === 'deactivate') {
      const newIsActive = action === 'activate'
      setModeratorsList(prev => prev.map(m => 
        selectedModerators.includes(m._id)
          ? { ...m, isActive: newIsActive }
          : m
      ))
    } else if (action === 'remove') {
      setModeratorsList(prev => prev.filter(m => !selectedModerators.includes(m._id)))
    }

    try {
      const promises = selectedModerators.map(async (moderatorId) => {
        if (action === 'activate') {
          return api.patch(`/api/superadmin/moderators/${moderatorId}`, { isActive: true })
        } else if (action === 'deactivate') {
          return api.patch(`/api/superadmin/moderators/${moderatorId}`, { isActive: false })
        } else if (action === 'remove') {
          return api.delete(`/api/superadmin/moderators/${moderatorId}`)
        }
      })

      await Promise.all(promises)

      if (!isMountedRef.current) return

      toast.success(`Bulk ${action} completed successfully`)
      setSelectedModerators([])
      setShowBulkActions(false)
      await fetchModerators()
    } catch (error) {
      if (!isMountedRef.current) return

      logger.error('Bulk action error:', error)
      
      // Rollback on error
      if (action === 'remove') {
        setModeratorsList(prev => {
          const restored = Array.from(previousStates.values())
          return [...prev, ...restored]
        })
      } else {
        setModeratorsList(prev => prev.map(m => {
          const previous = previousStates.get(m._id)
          return previous ? previous : m
        }))
      }
      
      handleError(error, toast, `Failed to ${action} moderators`)
    }
  }, [selectedModerators, moderatorsList, fetchModerators])

  const handleCreateModerator = async () => {
    try {
      if (!newModerator.email || !newModerator.password) {
        toast.error('Email and password are required')
        return
      }
      
      await api.post('/api/superadmin/moderators', {
        email: newModerator.email,
        password: newModerator.password,
        role: newModerator.role,
        permissions: newModerator.permissions
      })
      
      toast.success('Moderator created successfully')
      setShowCreateModal(false)
      setNewModerator({
        fullName: '',
        email: '',
        password: '',
        role: 'moderator',
        permissions: {
          canManageUsers: false,
          canManageContent: true,
          canViewAnalytics: false,
          canManageModerators: false,
          canViewLogs: false,
          canManageSettings: false
        }
      })
      await fetchModerators()
    } catch (error) {
      logger.error('Failed to create moderator:', error)
      handleError(error, toast, 'Failed to create moderator')
    }
  }

  const handleConfirmAction = useCallback(async () => {
    if (!isMountedRef.current || !selectedModerator) return
    
    if (selectedModerator.action === 'view') {
      setShowModal(false)
      setSelectedModerator(null)
    } else if (selectedModerator.action === 'edit') {
      await handleModeratorAction(selectedModerator._id, selectedModerator.action)
    }
  }, [selectedModerator, handleModeratorAction])

  const handleSelectModerator = useCallback((moderatorId) => {
    if (!isMountedRef.current) return
    setSelectedModerators(prev => 
      prev.includes(moderatorId) 
        ? prev.filter(id => id !== moderatorId)
        : [...prev, moderatorId]
    )
  }, [])

  const getRoleColor = useCallback((role) => {
    switch (role) {
      case 'admin': return 'text-purple-600 bg-purple-100'
      case 'moderator': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }, [])

  const permissions = [
    { id: 'canManageUsers', label: 'Manage Users', icon: UserCheck },
    { id: 'canManageContent', label: 'Manage Content', icon: Shield },
    { id: 'canManageReports', label: 'Manage Reports', icon: Filter },
    { id: 'canManageModerators', label: 'Manage Moderators', icon: Settings2 },
    { id: 'canViewLogs', label: 'View Logs', icon: Activity },
    { id: 'canManageSettings', label: 'Manage Settings', icon: Settings2 },
  ]

  // Pagination - defined before useCallback that depends on it
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentModerators = useMemo(() => moderatorsList.slice(startIndex, endIndex), [moderatorsList, startIndex, endIndex])

  const handleSelectAll = useCallback(() => {
    if (!isMountedRef.current) return
    if (selectedModerators.length === currentModerators.length) {
      setSelectedModerators([])
    } else {
      setSelectedModerators(currentModerators.map(m => m._id))
    }
  }, [selectedModerators.length, currentModerators])

  // Memoized ModeratorRow component for performance
  const ModeratorRow = memo(({ moderator, onToggleActive, onView, onEditPermissions, onRemove, onSelect, isSelected, getPermissionSummary, getRoleColor, permissions, formatDate, user, isUpdating }) => {
    const permSummary = getPermissionSummary(moderator.permissions)
    const hasReadOnlyAccess = permSummary.readOnly.length > 0
    
    return (
      <TableRow key={moderator._id}>
        <TableCell>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(moderator._id)}
            className="rounded border-gray-300"
            disabled={isUpdating}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">
                {(moderator.profile?.firstName?.[0] || moderator.email?.[0] || 'M').toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {moderator.profile?.firstName && moderator.profile?.lastName
                  ? `${moderator.profile.firstName} ${moderator.profile.lastName}`
                  : moderator.email
                }
              </div>
              <div className="text-sm text-gray-500">{moderator.email}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(moderator.role)}`}>
            {moderator.role.charAt(0).toUpperCase() + moderator.role.slice(1)}
          </span>
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            {/* Permission summary */}
            <div className="flex flex-wrap gap-1">
              {permSummary.allowed.slice(0, 2).map((module, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {module}
                </span>
              ))}
              {permSummary.allowed.length > 2 && (
                <span className="text-xs text-gray-500">
                  +{permSummary.allowed.length - 2}
                </span>
              )}
            </div>
            {/* Read-only indicator */}
            {hasReadOnlyAccess && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Info className="w-3 h-3" />
                <span>Read-only: {permSummary.readOnly.join(', ')}</span>
              </div>
            )}
            {/* Action attribution */}
            {moderator.updatedBy && moderator.updatedAt && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Clock className="w-3 h-3" />
                <span>Last: {formatDate(moderator.updatedAt)} by {moderator.updatedBy}</span>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <button
            onClick={() => onToggleActive(moderator, moderator.isActive)}
            disabled={isUpdating}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              isUpdating
                ? 'opacity-50 cursor-not-allowed'
                : moderator.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isUpdating ? 'Updating...' : moderator.isActive ? 'Click to deactivate' : 'Click to activate'}
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-2 h-2 mr-2 animate-spin" />
                Updating...
              </>
            ) : moderator.isActive ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Active
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                Inactive
              </>
            )}
          </button>
        </TableCell>
        <TableCell>
          <span className="text-sm text-gray-600">
            {moderator.lastLogin ? formatDate(moderator.lastLogin) : 'Never'}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onView(moderator)}
              disabled={isUpdating}
              className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEditPermissions(moderator)}
              disabled={isUpdating}
              className="p-2 text-gray-400 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={hasReadOnlyAccess ? 'Read-only access: Some permissions cannot be modified' : 'Edit Permissions'}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onRemove(moderator)}
              disabled={isUpdating}
              className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isUpdating ? 'Updating...' : 'Remove Moderator'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </TableCell>
      </TableRow>
    )
  })

  ModeratorRow.displayName = 'ModeratorRow'

  const activeCount = useMemo(() => moderatorsList.filter(m => m.isActive).length, [moderatorsList])
  const inactiveCount = useMemo(() => moderatorsList.filter(m => !m.isActive).length, [moderatorsList])
  const adminCount = useMemo(() => moderatorsList.filter(m => m.role === 'admin').length, [moderatorsList])
  const moderatorCount = useMemo(() => moderatorsList.filter(m => m.role === 'moderator').length, [moderatorsList])

  return (
    <SafeComponent>
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-violet-50 rounded-2xl p-8 shadow-lg border border-purple-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Moderators
              </h1>
              {isConnected && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                  Live Data
                </span>
              )}
            </div>
            <p className="text-gray-600 text-lg">Manage team permissions and access control</p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Moderator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Moderators</p>
                  <p className="text-2xl font-bold text-gray-900">{total}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">Active</span>
                <p className="text-lg font-semibold text-green-600">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                </div>
              </div>
              <div className="text-2xl">✓</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Settings2 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Admins</p>
                  <p className="text-2xl font-bold text-gray-900">{adminCount}</p>
                </div>
              </div>
              <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                {moderatorCount} Moderators
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <UserX className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
                </div>
              </div>
              <Ban className="w-6 h-6 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                className="input pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <select
                className="input"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="founder">Founder</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
              </select>
              <select
                className="input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className="btn btn-secondary"
              >
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>

          {/* More Filters Panel */}
          {showMoreFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Has Permission
                  </label>
                  <select
                    className="input w-full text-sm"
                    value={moreFilters.permission}
                    onChange={(e) => setMoreFilters({ ...moreFilters, permission: e.target.value })}
                  >
                    <option value="all">All Permissions</option>
                    <option value="canManageUsers">Manage Users</option>
                    <option value="canManageContent">Manage Content</option>
                    <option value="canManageReports">Manage Reports</option>
                    <option value="canManageModerators">Manage Moderators</option>
                    <option value="canViewLogs">View Logs</option>
                    <option value="canManageSettings">Manage Settings</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Last Activity
                  </label>
                  <select
                    className="input w-full text-sm"
                    value={moreFilters.activityRange}
                    onChange={(e) => setMoreFilters({ ...moreFilters, activityRange: e.target.value })}
                  >
                    <option value="all">All Time</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Created
                  </label>
                  <select
                    className="input w-full text-sm"
                    value={moreFilters.createdRange}
                    onChange={(e) => setMoreFilters({ ...moreFilters, createdRange: e.target.value })}
                  >
                    <option value="all">All Time</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    className="input w-full text-sm"
                    value={moreFilters.sortBy}
                    onChange={(e) => setMoreFilters({ ...moreFilters, sortBy: e.target.value })}
                  >
                    <option value="createdAt">Created Date</option>
                    <option value="lastLogin">Last Activity</option>
                    <option value="email">Email</option>
                    <option value="role">Role</option>
                    <option value="isActive">Status</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Order
                  </label>
                  <select
                    className="input w-full text-sm"
                    value={moreFilters.sortOrder}
                    onChange={(e) => setMoreFilters({ ...moreFilters, sortOrder: e.target.value })}
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setMoreFilters({
                      permission: 'all',
                      activityRange: 'all',
                      createdRange: 'all',
                      sortBy: 'createdAt',
                      sortOrder: 'desc'
                    })
                  }}
                  className="btn btn-sm btn-secondary"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedModerators.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {selectedModerators.length} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAction('activate')}
                    className="btn btn-sm btn-success"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    className="btn btn-sm btn-warning"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction('remove')}
                    className="btn btn-sm btn-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </button>
                  <button
                    onClick={() => setSelectedModerators([])}
                    className="btn btn-sm btn-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Moderators Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Moderators ({total})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading moderators...</p>
              </div>
            </div>
          ) : currentModerators.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">No Moderators Found</p>
                <p className="text-gray-600 mt-2">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'No moderators have been added yet'
                  }
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedModerators.length === currentModerators.length && currentModerators.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Moderator</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentModerators.map((moderator) => (
                  <ModeratorRow
                    key={moderator._id}
                    moderator={moderator}
                    onToggleActive={handleToggleActive}
                    onView={(m) => handleModeratorActionClick(m, 'view')}
                    onEditPermissions={handleOpenEditPermissions}
                    onRemove={(m) => handleModeratorActionClick(m, 'remove')}
                    onSelect={handleSelectModerator}
                    isSelected={selectedModerators.includes(moderator._id)}
                    getPermissionSummary={getPermissionSummary}
                    getRoleColor={getRoleColor}
                    permissions={permissions}
                    formatDate={formatDate}
                    user={user}
                    isUpdating={updatingModeratorsRef.current.has(moderator._id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {moderatorsList.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, total)} of {total} moderators
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={20}>20</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={75}>75</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="btn btn-sm btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`btn btn-sm ${
                            currentPage === pageNum ? 'btn-primary' : 'btn-secondary'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="btn btn-sm btn-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Permissions Modal */}
      <Modal isOpen={showEditPermissionsModal} onClose={() => setShowEditPermissionsModal(false)}>
        <ModalHeader onClose={() => setShowEditPermissionsModal(false)}>
          Edit Permissions - {editingPermissions?.email}
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Select which permissions this moderator should have access to:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {permissions.map((permission) => {
                const Icon = permission.icon
                return (
                  <label 
                    key={permission.id} 
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={tempPermissions[permission.id] || false}
                      onChange={(e) => {
                        setTempPermissions({
                          ...tempPermissions,
                          [permission.id]: e.target.checked
                        })
                      }}
                      className="rounded border-gray-300"
                    />
                    <Icon className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">{permission.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => {
              setShowEditPermissionsModal(false)
              setEditingPermissions(null)
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSavePermissions}
            className="btn btn-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Permissions
          </button>
        </ModalFooter>
      </Modal>

      {/* Create Moderator Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader onClose={() => setShowCreateModal(false)}>
          Add New Moderator
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                className="input w-full"
                value={newModerator.fullName}
                onChange={(e) => setNewModerator({ ...newModerator, fullName: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                className="input w-full"
                value={newModerator.email}
                onChange={(e) => setNewModerator({ ...newModerator, email: sanitizeText(e.target.value) })}
                placeholder="Enter email address"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                className="input w-full"
                value={newModerator.password}
                onChange={(e) => setNewModerator({ ...newModerator, password: e.target.value })}
                placeholder="Enter password (min 8 characters)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                className="input w-full"
                value={newModerator.role}
                onChange={(e) => setNewModerator({ ...newModerator, role: e.target.value })}
              >
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permissions
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-3">
                {permissions.map((permission) => {
                  const Icon = permission.icon
                  return (
                    <label key={permission.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newModerator.permissions[permission.id] || false}
                        onChange={(e) => {
                          setNewModerator({
                            ...newModerator,
                            permissions: {
                              ...newModerator.permissions,
                              [permission.id]: e.target.checked
                            }
                          })
                        }}
                        className="rounded border-gray-300"
                      />
                      <Icon className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-700">{permission.label}</span>
                    </label>
                  )
                })}
              </div>
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
            onClick={handleCreateModerator}
            className="btn btn-primary"
          >
            Add Moderator
          </button>
        </ModalFooter>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal isOpen={showRemoveConfirm} onClose={() => {
        setShowRemoveConfirm(false)
        setSelectedModerator(null)
      }}>
        <ModalHeader onClose={() => {
          setShowRemoveConfirm(false)
          setSelectedModerator(null)
        }}>
          Remove Moderator
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-yellow-600">
              <AlertTriangle className="w-6 h-6" />
              <p className="font-semibold">Warning: This action cannot be undone</p>
            </div>
            <p className="text-gray-700">
              You are about to remove <strong>{selectedModerator?.email}</strong> from the moderator team.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-800 font-medium mb-2">Impact:</p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                <li>All moderator privileges will be revoked immediately</li>
                <li>Access to the admin panel will be removed</li>
                <li>This moderator will no longer be able to perform any admin actions</li>
                <li>Their account will remain but without admin access</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to proceed?
            </p>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => {
              setShowRemoveConfirm(false)
              setSelectedModerator(null)
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (selectedModerator) {
                await handleModeratorAction(selectedModerator._id, 'remove')
              }
            }}
            className="btn btn-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove Moderator
          </button>
        </ModalFooter>
      </Modal>

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedModerator?.action === 'view' && 'Moderator Details'}
          {selectedModerator?.action === 'edit' && 'Edit Moderator'}
        </ModalHeader>
        <ModalContent>
          {selectedModerator?.action === 'view' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">
                    {(selectedModerator.profile?.firstName?.[0] || selectedModerator.email?.[0] || 'M').toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedModerator.profile?.firstName && selectedModerator.profile?.lastName
                      ? `${selectedModerator.profile.firstName} ${selectedModerator.profile.lastName}`
                      : selectedModerator.email
                    }
                  </h3>
                  <p className="text-gray-600">{selectedModerator.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</label>
                  <p className="text-sm font-semibold text-gray-900 capitalize mt-1">{selectedModerator.role}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                  <p className="text-sm font-semibold text-gray-900 capitalize mt-1">{selectedModerator.isActive ? 'Active' : 'Inactive'}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Active</label>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{selectedModerator.lastLogin ? formatDate(selectedModerator.lastLogin) : 'Never'}</p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</label>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(selectedModerator.createdAt)}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedModerator.permissions || {}).map(([key, enabled]) => (
                    <div key={key} className={`flex items-center space-x-2 p-2 rounded ${enabled ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                      {enabled ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span className="text-xs font-medium">
                        {permissions.find(p => p.id === key)?.label || key}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Permission summary */}
                {(() => {
                  const summary = getPermissionSummary(selectedModerator.permissions)
                  return (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-gray-600 space-y-1">
                        {summary.allowed.length > 0 && (
                          <div>
                            <span className="font-medium">Allowed modules:</span> {summary.allowed.join(', ')}
                          </div>
                        )}
                        {summary.readOnly.length > 0 && (
                          <div>
                            <span className="font-medium">Read-only modules:</span> {summary.readOnly.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
                {/* Action attribution */}
                {selectedModerator.updatedBy && selectedModerator.updatedAt && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Last updated: {formatDate(selectedModerator.updatedAt)} by {selectedModerator.updatedBy}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {selectedModerator?.action === 'edit' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  className="input w-full"
                  value={selectedModerator.role}
                  onChange={(e) => setSelectedModerator({ ...selectedModerator, role: e.target.value })}
                >
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  This will allow you to modify the moderator's role and permissions.
                </p>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowModal(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAction}
            className="btn btn-primary"
          >
            {selectedModerator?.action === 'view' && 'Close'}
            {selectedModerator?.action === 'edit' && 'Save Changes'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
    </SafeComponent>
  )
}

export default Moderators
