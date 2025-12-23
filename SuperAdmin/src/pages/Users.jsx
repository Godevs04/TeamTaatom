import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, Ban, CheckCircle, Eye, Edit, RefreshCw, UserX, Shield, Mail, Trash2, Users as UsersIcon, TrendingUp, AlertTriangle, Award, Clock, AlertCircle, XCircle } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { handleModalClose } from '../utils/modalUtils'
import { sanitizeText } from '../utils/sanitize'

// Risk level helper
const getRiskBadge = (riskLevel, tripScore, reportCount) => {
  switch (riskLevel) {
    case 'high':
      return { color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle, text: `High Risk${reportCount > 0 ? ` (${reportCount} reports)` : ''}` }
    case 'medium':
      return { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: AlertCircle, text: `Medium Risk${tripScore === 0 ? ' (No TripScore)' : ''}` }
    default:
      return { color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle, text: 'Low Risk' }
  }
}

// Memoized User Row Component
const UserRow = memo(({
  user,
  index,
  selectedUsers,
  onSelect,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
  formatDate,
  getRiskBadge,
  expandedRows,
  onToggleExpand
}) => {
  const riskBadge = getRiskBadge(user.metrics?.riskLevel || 'low', user.metrics?.tripScore || 0, user.metrics?.reportCount || 0)
  const RiskIcon = riskBadge.icon
  const isExpanded = expandedRows.has(user._id)
  
  return (
    <TableRow key={user._id} className="hover:bg-gray-50">
      <TableCell>
        <input
          type="checkbox"
          checked={selectedUsers.includes(user._id)}
          onChange={() => onSelect(user._id)}
          className="rounded"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-3">
          {user.profilePic ? (
            <img 
              src={user.profilePic} 
              alt={user.fullName || 'User'} 
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
          ) : null}
          <div className={`w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center ${user.profilePic ? 'hidden' : 'flex'}`}>
            <span className="text-white font-bold text-sm">
              {user.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-900 flex items-center gap-2">
              {user.fullName || 'Unknown'}
              {/* Risk Badge */}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border ${riskBadge.color}`}>
                <RiskIcon className="w-3 h-3" />
                {riskBadge.text}
              </span>
            </div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          user.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {user.isVerified ? 'Active' : 'Inactive'}
        </span>
      </TableCell>
      <TableCell>
        <button
          onClick={() => onToggleExpand(user._id)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          {user.metrics?.totalPosts || 0}
          {isExpanded && ' (click to collapse)'}
        </button>
      </TableCell>
      <TableCell>{user.metrics?.totalFollowers || 0}</TableCell>
      <TableCell>{user.location || 'Not specified'}</TableCell>
      <TableCell>{formatDate(user.metrics?.lastActive || user.createdAt)}</TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onView(user)}
            className="p-1 text-blue-400 hover:text-blue-600 transition-colors relative group"
            title="View user details and activity"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(user)}
            className="p-1 text-green-400 hover:text-green-600 transition-colors relative group"
            title="Edit user information"
          >
            <Edit className="w-4 h-4" />
          </button>
          {user.isVerified ? (
            <button
              onClick={() => onToggleStatus(user)}
              className="p-1 text-orange-400 hover:text-orange-600 transition-colors relative group"
              title="Deactivate user"
            >
              <Ban className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onToggleStatus(user)}
              className="p-1 text-green-400 hover:text-green-600 transition-colors relative group"
              title="Activate user"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(user)}
            className="p-1 text-red-400 hover:text-red-600 transition-colors relative group"
            title="Delete user"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </TableCell>
      {/* Expanded Activity Snapshot */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-gray-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-gray-600">Posts</span>
                </div>
                <div className="text-lg font-bold text-gray-900">{user.metrics?.totalPosts || 0}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-semibold text-gray-600">Reports</span>
                </div>
                <div className="text-lg font-bold text-gray-900">{user.metrics?.reportCount || 0}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-gray-600">TripScore</span>
                </div>
                <div className="text-lg font-bold text-gray-900">{user.metrics?.tripScore || 0}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <UsersIcon className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-semibold text-gray-600">Followers</span>
                </div>
                <div className="text-lg font-bold text-gray-900">{user.metrics?.totalFollowers || 0}</div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </TableRow>
  )
})

UserRow.displayName = 'UserRow'

const Users = () => {
  const { users, fetchUsers, performBulkAction, isConnected } = useRealTime()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [editFormData, setEditFormData] = useState({})
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState(null) // 'ban' | 'suspend' | 'delete' | 'activate' | 'deactivate'
  const [bulkActionPreview, setBulkActionPreview] = useState(null) // { count, action, affectedUsers }
  const [lastAction, setLastAction] = useState(null) // { userId, action, timestamp, adminEmail }
  const [actionCooldown, setActionCooldown] = useState(new Map()) // Track cooldown per user
  
  // Lifecycle & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const searchDebounceTimerRef = useRef(null)
  const cachedUsersRef = useRef(null)
  const cacheKeyRef = useRef(null)
  const actionStateCacheRef = useRef(new Map()) // Store previous state for rollback
  const beforeUnloadHandlerRef = useRef(null)
  
  const [moreFilters, setMoreFilters] = useState({
    dateRange: '',
    sortField: 'createdAt',
    role: 'all'
  })

  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    
    // Prevent navigation during bulk actions
    beforeUnloadHandlerRef.current = (e) => {
      if (showBulkActionModal) {
        e.preventDefault()
        e.returnValue = 'Bulk action in progress. Please wait...'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', beforeUnloadHandlerRef.current)
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
      }
      if (beforeUnloadHandlerRef.current) {
        window.removeEventListener('beforeunload', beforeUnloadHandlerRef.current)
      }
    }
  }, [showBulkActionModal])
  
  // Debounced search (400ms)
  useEffect(() => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    
    searchDebounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setDebouncedSearchTerm(searchTerm)
        setCurrentPage(1) // Reset to first page when searching
      }
    }, 400)
    
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
      }
    }
  }, [searchTerm])
  
  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    if (isMountedRef.current) {
      setCurrentPage(1)
    }
  }, [filterStatus, sortBy, sortOrder, debouncedSearchTerm])
  
  // Fetch users data with caching and deduplication
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      logger.debug('Users fetch already in progress, skipping duplicate call')
      return
    }
    
    const fetchData = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      isFetchingRef.current = true
      
      // Generate cache key
      const cacheKey = `${debouncedSearchTerm}-${filterStatus}-${currentPage}-${sortBy}-${sortOrder}`
      
      // Show cached data immediately if available
      if (cachedUsersRef.current && cacheKeyRef.current === cacheKey && isMountedRef.current) {
        // Data will be updated when fetch completes
      }
      
      if (isMountedRef.current) {
        setLoading(true)
      }
      
      try {
        await fetchUsers({
          page: currentPage,
          search: debouncedSearchTerm,
          status: filterStatus === 'all' ? undefined : filterStatus,
          sortBy,
          sortOrder
        })
        
        // Cache the result
        if (isMountedRef.current) {
          cachedUsersRef.current = users
          cacheKeyRef.current = cacheKey
        }
      } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
          return
        }
        
        // Fallback to cached data on error
        if (cachedUsersRef.current && isMountedRef.current) {
          toast.error('Failed to fetch users. Showing cached data.', { duration: 3000 })
        } else {
          handleError(error, toast, 'Failed to fetch users')
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
        isFetchingRef.current = false
      }
    }

    fetchData()
  }, [fetchUsers, currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder])

  // Toggle expand for activity snapshot
  const handleToggleExpand = useCallback((userId) => {
    if (!isMountedRef.current) return
    
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }, [])
  
  // Bulk action dry-run preview
  const handleBulkActionPreview = useCallback((action) => {
    if (selectedUsers.length === 0 || !isMountedRef.current) {
      if (isMountedRef.current) {
        toast.error('Please select users first')
      }
      return
    }
    
    const usersArray = Array.isArray(users) ? users : (users?.users || [])
    const affectedUsers = usersArray.filter(u => selectedUsers.includes(u._id))
    
    // Preview what will happen
    setBulkActionPreview({
      count: selectedUsers.length,
      action,
      affectedUsers: affectedUsers.map(u => ({
        name: u.fullName || u.email,
        email: u.email,
        currentStatus: u.isVerified ? 'Active' : 'Inactive'
      }))
    })
    setBulkActionType(action)
    setShowBulkActionModal(true)
  }, [selectedUsers, users])
  
  // Execute bulk action after confirmation
  const handleBulkActionConfirm = useCallback(async () => {
    if (!bulkActionType || selectedUsers.length === 0 || !isMountedRef.current) return
    
    try {
      const reason = prompt(`Reason for ${bulkActionType}:`)
      if (!reason || !isMountedRef.current) return
      
      // Store previous state for rollback
      const usersArray = Array.isArray(users) ? users : (users?.users || [])
      selectedUsers.forEach(userId => {
        const user = usersArray.find(u => u._id === userId)
        if (user) {
          actionStateCacheRef.current.set(userId, {
            isVerified: user.isVerified,
            deletedAt: user.deletedAt
          })
        }
      })
      
      const result = await performBulkAction(bulkActionType, selectedUsers, reason)
      
      if (result.success && isMountedRef.current) {
        // Track last action
        const adminEmail = localStorage.getItem('founder_email') || 'Unknown Admin'
        setLastAction({
          userIds: selectedUsers,
          action: bulkActionType,
          timestamp: new Date(),
          adminEmail
        })
        
        // Set cooldown (5 seconds per user)
        selectedUsers.forEach(userId => {
          actionCooldown.set(userId, Date.now() + 5000)
        })
        setActionCooldown(new Map(actionCooldown))
        
        setSelectedUsers([])
        setShowBulkActions(false)
        setShowBulkActionModal(false)
        setBulkActionType(null)
        setBulkActionPreview(null)
        toast.success(`Successfully ${bulkActionType}d ${selectedUsers.length} users`)
        
        // Refresh users
        await fetchUsers({
          page: currentPage,
          search: debouncedSearchTerm,
          status: filterStatus === 'all' ? undefined : filterStatus,
          sortBy,
          sortOrder
        })
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
        return
      }
      
      // Rollback on failure
      if (isMountedRef.current) {
        logger.warn('Rolling back bulk action state')
        handleError(error, toast, `Failed to ${bulkActionType} users`)
      }
    } finally {
      actionStateCacheRef.current.clear()
    }
  }, [bulkActionType, selectedUsers, users, currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder, fetchUsers, performBulkAction, actionCooldown])
  
  // Handle bulk actions (legacy - now uses preview flow)
  const handleBulkAction = useCallback((action) => {
    handleBulkActionPreview(action)
  }, [handleBulkActionPreview])

  // Handle individual user actions with cooldown and confirmation
  const handleUserActionClick = useCallback(async (userId, action, previousState = null) => {
    if (!isMountedRef.current) return
    
    // Check cooldown
    const cooldownEnd = actionCooldown.get(userId)
    if (cooldownEnd && Date.now() < cooldownEnd) {
      const remainingSeconds = Math.ceil((cooldownEnd - Date.now()) / 1000)
      toast.error(`Please wait ${remainingSeconds} seconds before performing another action on this user`)
      return
    }
    
    // Store previous state for rollback
    if (previousState) {
      actionStateCacheRef.current.set(userId, previousState)
    }
    
    try {
      await performBulkAction(action, [userId], `Individual ${action}`)
      
      if (isMountedRef.current) {
        // Track last action
        const adminEmail = localStorage.getItem('founder_email') || 'Unknown Admin'
        setLastAction({
          userId,
          action,
          timestamp: new Date(),
          adminEmail
        })
        
        // Set cooldown (5 seconds)
        actionCooldown.set(userId, Date.now() + 5000)
        setActionCooldown(new Map(actionCooldown))
        
        toast.success(`User ${action}d successfully`)
        
        // Refresh users after action
        await fetchUsers({
          page: currentPage,
          search: debouncedSearchTerm,
          status: filterStatus === 'all' ? undefined : filterStatus,
          sortBy,
          sortOrder
        })
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
        return
      }
      
      // Rollback on failure
      const cachedState = actionStateCacheRef.current.get(userId)
      if (cachedState && isMountedRef.current) {
        logger.warn(`Rolling back state for user ${userId}`, cachedState)
      }
      
      if (isMountedRef.current) {
        handleError(error, toast, `Failed to ${action} user`)
      }
    } finally {
      actionStateCacheRef.current.delete(userId)
    }
  }, [actionCooldown, currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder, fetchUsers, performBulkAction])


  // Get filtered users based on search and status (memoized)
  const usersArray = useMemo(() => {
    return Array.isArray(users) ? users : (users?.users || [])
  }, [users])
  
  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!isMountedRef.current) return
    
    if (selectedUsers.length === usersArray.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(usersArray.map(user => user._id))
    }
  }, [selectedUsers.length, usersArray])
  
  // Memoized filtered users
  const filteredUsers = useMemo(() => {
    if (!usersArray || usersArray.length === 0) return []
    
    return usersArray.filter(user => {
      const matchesSearch = !debouncedSearchTerm || 
        user.fullName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && user.isVerified) ||
        (filterStatus === 'inactive' && !user.isVerified) ||
        (filterStatus === 'pending' && (!user.isVerified || user.isVerified === false)) ||
        (filterStatus === 'banned' && user.deletedAt)
      
      return matchesSearch && matchesStatus
    })
  }, [usersArray, debouncedSearchTerm, filterStatus])

  // Memoized pagination
  const currentUsers = useMemo(() => {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, itemsPerPage])
  
  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / itemsPerPage)
  }, [filteredUsers.length, itemsPerPage])

  const handleUserAction = useCallback((user, action) => {
    if (!isMountedRef.current) return
    
    setSelectedUser({ ...user, action })
    if (action === 'edit') {
      setEditFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        bio: user.bio || '',
        isVerified: user.isVerified || false
      })
    }
    setShowModal(true)
  }, [])
  
  const handleView = useCallback((user) => {
    handleUserAction(user, 'view')
  }, [handleUserAction])
  
  const handleEdit = useCallback((user) => {
    handleUserAction(user, 'edit')
  }, [handleUserAction])
  
  const handleToggleStatus = useCallback((user) => {
    const action = user.isVerified ? 'deactivate' : 'activate'
    const previousState = { isVerified: user.isVerified, deletedAt: user.deletedAt }
    handleUserActionClick(user._id, action, previousState)
  }, [handleUserActionClick])
  
  const handleDelete = useCallback((user) => {
    handleUserAction(user, 'delete')
  }, [handleUserAction])

  const handleConfirmAction = useCallback(async () => {
    if (!selectedUser || !isMountedRef.current) return
    
    try {
      const previousState = {
        isVerified: selectedUser.isVerified,
        deletedAt: selectedUser.deletedAt
      }
      
      if (selectedUser.action === 'edit') {
        // Handle edit action separately
        try {
          await api.patch(`/api/v1/superadmin/users/${selectedUser._id}`, editFormData)
          if (isMountedRef.current) {
            toast.success('User updated successfully')
            handleModalClose(setShowModal, setSelectedUser, () => setEditFormData({}))
            // Refresh users
            await fetchUsers({
              page: currentPage,
              search: debouncedSearchTerm,
              status: filterStatus === 'all' ? undefined : filterStatus,
              sortBy,
              sortOrder
            })
          }
        } catch (error) {
          if (isMountedRef.current) {
            handleError(error, toast, 'Failed to update user')
            logger.error('Update error:', error)
          }
        }
      } else if (selectedUser.action === 'delete') {
        // Handle delete action with confirmation
        const confirmed = window.confirm(
          `Are you sure you want to permanently delete ${selectedUser.fullName || selectedUser.email}?\n\n` +
          `This will:\n` +
          `- Permanently remove the user account\n` +
          `- Delete all associated posts and content\n` +
          `- Remove all followers and following relationships\n\n` +
          `This action CANNOT be undone.`
        )
        if (!confirmed || !isMountedRef.current) return
        
        try {
          await api.delete(`/api/v1/superadmin/users/${selectedUser._id}`)
          if (isMountedRef.current) {
            // Track last action
            const adminEmail = localStorage.getItem('founder_email') || 'Unknown Admin'
            setLastAction({
              userId: selectedUser._id,
              action: 'delete',
              timestamp: new Date(),
              adminEmail
            })
            
            toast.success('User deleted successfully')
            handleModalClose(setShowModal, setSelectedUser)
            // Refresh users
            await fetchUsers({
              page: currentPage,
              search: debouncedSearchTerm,
              status: filterStatus === 'all' ? undefined : filterStatus,
              sortBy,
              sortOrder
            })
          }
        } catch (error) {
          if (isMountedRef.current) {
            handleError(error, toast, 'Failed to delete user')
            logger.error('Delete error:', error)
          }
        }
      } else if (selectedUser.action === 'ban' || selectedUser.action === 'suspend') {
        // Handle ban/suspend with confirmation
        const actionLabel = selectedUser.action === 'ban' ? 'ban' : 'suspend'
        const confirmed = window.confirm(
          `Are you sure you want to ${actionLabel} ${selectedUser.fullName || selectedUser.email}?\n\n` +
          `This will:\n` +
          `- ${selectedUser.action === 'ban' ? 'Permanently ban' : 'Temporarily suspend'} the user\n` +
          `- Restrict access to the platform\n` +
          `- Hide their content from other users\n\n` +
          `You can reverse this action later.`
        )
        if (!confirmed || !isMountedRef.current) return
        
        await handleUserActionClick(selectedUser._id, selectedUser.action, previousState)
        if (isMountedRef.current) {
          handleModalClose(setShowModal, setSelectedUser)
        }
      } else {
        await handleUserActionClick(selectedUser._id, selectedUser.action, previousState)
        if (isMountedRef.current) {
          handleModalClose(setShowModal, setSelectedUser)
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, toast, `Failed to ${selectedUser.action} user`)
      }
    }
  }, [selectedUser, editFormData, currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder, fetchUsers, handleUserActionClick])
  
  const handleCloseModal = () => {
    handleModalClose(setShowModal, setSelectedUser, () => setEditFormData({}))
  }
  
  // Handle bulk delete/ban
  const handleBulkDelete = useCallback(() => {
    handleBulkActionPreview('delete')
  }, [handleBulkActionPreview])

  const handleRefresh = useCallback(async () => {
    if (!isMountedRef.current || isFetchingRef.current) return
    
    // Clear cache to force fresh fetch
    const cacheKey = `${debouncedSearchTerm}-${filterStatus}-${currentPage}-${sortBy}-${sortOrder}`
    cachedUsersRef.current = null
    cacheKeyRef.current = null
    
    if (isMountedRef.current) {
      setLoading(true)
    }
    
    try {
      await fetchUsers({
        page: currentPage,
        search: debouncedSearchTerm,
        status: filterStatus === 'all' ? undefined : filterStatus,
        sortBy,
        sortOrder
      })
      if (isMountedRef.current) {
        toast.success('Users refreshed successfully')
      }
    } catch (error) {
      if (isMountedRef.current) {
        toast.error('Failed to refresh users')
        logger.error('Refresh error:', error)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder, fetchUsers])
  
  const handleUserSelect = useCallback((userId) => {
    if (!isMountedRef.current) return
    
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }, [])
  
  const handleExportUsers = () => {
    setShowExportModal(true)
  }
  
  const performExport = (exportType) => {
    try {
      let usersToExport = []
      
      if (exportType === 'selected' && selectedUsers.length > 0) {
        // Export selected users only
        const usersArray = Array.isArray(users) ? users : (users?.users || [])
        usersToExport = usersArray.filter(user => selectedUsers.includes(user._id))
        if (usersToExport.length === 0) {
          toast.error('No users to export')
          return
        }
      } else if (exportType === 'selected') {
        // No users selected
        toast.error('Please select at least one user to export')
        setShowExportModal(false)
        return
      } else {
        // Export all users
        usersToExport = Array.isArray(users) ? users : (users?.users || [])
      }
      
      const csvContent = [
        ['Name', 'Email', 'Status', 'Posts', 'Likes', 'Followers', 'Created At', 'Last Active'].join(','),
        ...usersToExport.map(user => [
          `"${user.fullName || 'Unknown'}"`,
          `"${user.email}"`,
          `"${user.isVerified ? 'Active' : 'Inactive'}"`,
          user.metrics?.totalPosts || 0,
          user.metrics?.totalLikes || 0,
          user.metrics?.totalFollowers || 0,
          `"${formatDate(user.createdAt)}"`,
          `"${formatDate(user.metrics?.lastActive || user.createdAt)}"`
        ].join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileName = exportType === 'selected' 
        ? `users_export_selected_${selectedUsers.length}_${new Date().toISOString().split('T')[0]}.csv`
        : `users_export_all_${new Date().toISOString().split('T')[0]}.csv`
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success(`Successfully exported ${usersToExport.length} user(s)`)
      setShowExportModal(false)
    } catch (error) {
      handleError(error, toast, 'Failed to export users')
      logger.error('Export error:', error)
    }
  }

  return (
    <SafeComponent>
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 shadow-lg border border-blue-100">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <UsersIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Users Management
              </h1>
              {isConnected && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                  Live Data
                </span>
              )}
            </div>
            <p className="text-gray-600 text-lg">Manage travelers and moderators</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleExportUsers}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Export Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="banned">Banned</option>
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
        </CardContent>
      </Card>

      {/* More Filters Panel */}
      {showMoreFilters && (
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <select
                  className="input w-full"
                  value={moreFilters.dateRange}
                  onChange={(e) => setMoreFilters({ ...moreFilters, dateRange: e.target.value })}
                >
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="3months">Last 3 Months</option>
                  <option value="year">Last Year</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  className="input w-full"
                  value={moreFilters.sortField}
                  onChange={(e) => setMoreFilters({ ...moreFilters, sortField: e.target.value })}
                >
                  <option value="createdAt">Join Date</option>
                  <option value="fullName">Full Name</option>
                  <option value="email">Email</option>
                  <option value="updatedAt">Last Active</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSortBy(moreFilters.sortField)
                    toast.success('Filters applied')
                    setShowMoreFilters(false)
                  }}
                  className="btn btn-primary w-full"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedUsers.length} user(s) selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkActionPreview('activate')}
                  className="btn btn-sm btn-success"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Activate
                </button>
                <button
                  onClick={() => handleBulkActionPreview('deactivate')}
                  className="btn btn-sm btn-warning"
                >
                  <Ban className="w-4 h-4 mr-1" />
                  Deactivate
                </button>
                <button
                  onClick={() => handleBulkActionPreview('ban')}
                  className="btn btn-sm bg-red-600 hover:bg-red-700 text-white"
                >
                  <Ban className="w-4 h-4 mr-1" />
                  Ban
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="btn btn-sm bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="btn btn-sm btn-secondary"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Last Action Display */}
      {lastAction && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Last Action: {lastAction.action} {Array.isArray(lastAction.userIds) ? `${lastAction.userIds.length} users` : 'user'}
                  </p>
                  <p className="text-xs text-blue-700">
                    {lastAction.timestamp && new Date(lastAction.timestamp).toLocaleString()} by {lastAction.adminEmail}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLastAction(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Bulk Action Modal */}
      <Modal isOpen={showBulkActionModal} onClose={() => {
        if (!showBulkActionModal) {
          setShowBulkActionModal(false)
          setBulkActionType(null)
          setBulkActionPreview(null)
        }
      }} className="max-w-2xl bg-white">
        <ModalHeader onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
          setBulkActionPreview(null)
        }}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${
              bulkActionType === 'ban' || bulkActionType === 'delete' ? 'bg-red-100' :
              bulkActionType === 'deactivate' ? 'bg-orange-100' :
              'bg-green-100'
            } rounded-lg`}>
              {bulkActionType === 'ban' || bulkActionType === 'delete' ? (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              ) : bulkActionType === 'deactivate' ? (
                <Ban className="w-5 h-5 text-orange-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {bulkActionType === 'ban' ? 'Ban Users' :
               bulkActionType === 'delete' ? 'Delete Users' :
               bulkActionType === 'deactivate' ? 'Deactivate Users' :
               'Activate Users'}
            </h2>
          </div>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            {bulkActionPreview && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Action Summary</p>
                  <p className="text-sm text-blue-800">
                    This will {bulkActionType} <strong>{bulkActionPreview.count} user(s)</strong>
                  </p>
                </div>
                
                {bulkActionType === 'ban' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-900 mb-2">Impact:</p>
                    <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                      <li>Users will be permanently banned</li>
                      <li>Access to the platform will be restricted</li>
                      <li>Their content will be hidden from other users</li>
                      <li>This action can be reversed later</li>
                    </ul>
                  </div>
                )}
                
                {bulkActionType === 'delete' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-orange-900 mb-2">Impact:</p>
                    <ul className="text-sm text-orange-800 list-disc list-inside space-y-1">
                      <li>User accounts will be permanently deleted</li>
                      <li>All associated posts and content will be removed</li>
                      <li>All followers and following relationships will be deleted</li>
                      <li><strong>This action CANNOT be undone</strong></li>
                    </ul>
                  </div>
                )}
                
                {bulkActionType === 'deactivate' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-yellow-900 mb-2">Impact:</p>
                    <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                      <li>Users will be temporarily deactivated</li>
                      <li>Access to the platform will be restricted</li>
                      <li>Their content will remain but be hidden</li>
                      <li>This action can be reversed by activating them</li>
                    </ul>
                  </div>
                )}
                
                {bulkActionType === 'activate' && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-green-900 mb-2">Impact:</p>
                    <ul className="text-sm text-green-800 list-disc list-inside space-y-1">
                      <li>Users will be activated and can access the platform</li>
                      <li>Their content will be visible to other users</li>
                      <li>All previous restrictions will be removed</li>
                    </ul>
                  </div>
                )}
                
                {bulkActionPreview.affectedUsers && bulkActionPreview.affectedUsers.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Affected Users ({bulkActionPreview.count}):</p>
                    <div className="space-y-1">
                      {bulkActionPreview.affectedUsers.slice(0, 10).map((u, idx) => (
                        <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          {u.name} ({u.email})
                        </div>
                      ))}
                      {bulkActionPreview.affectedUsers.length > 10 && (
                        <div className="text-xs text-gray-500 italic">
                          ... and {bulkActionPreview.affectedUsers.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              setShowBulkActionModal(false)
              setBulkActionType(null)
              setBulkActionPreview(null)
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBulkActionConfirm}
            className={`btn ${
              bulkActionType === 'ban' || bulkActionType === 'delete'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : bulkActionType === 'deactivate'
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {bulkActionType === 'ban' ? 'Confirm Ban' :
             bulkActionType === 'delete' ? 'Confirm Delete' :
             bulkActionType === 'deactivate' ? 'Confirm Deactivate' :
             'Confirm Activate'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users ({users.length})</CardTitle>
            <div className="flex items-center space-x-2">
              <select
                className="input text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="createdAt">Sort by Date</option>
                <option value="fullName">Sort by Name</option>
                <option value="email">Sort by Email</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn btn-sm btn-secondary"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === currentUsers.length && currentUsers.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Posts</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((user, index) => (
                  <UserRow
                    key={user._id}
                    user={user}
                    index={index}
                    selectedUsers={selectedUsers}
                    onSelect={handleUserSelect}
                    onView={handleView}
                    onEdit={handleEdit}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                    getRiskBadge={getRiskBadge}
                    expandedRows={expandedRows}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
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

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedUser?.action === 'view' && 'User Details'}
          {selectedUser?.action === 'edit' && 'Edit User'}
          {selectedUser?.action === 'ban' && 'Ban User'}
          {selectedUser?.action === 'delete' && 'Delete User'}
        </ModalHeader>
        <ModalContent>
          {selectedUser?.action === 'view' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {selectedUser.profilePic ? (
                  <img 
                    src={selectedUser.profilePic} 
                    alt={selectedUser.fullName || 'User'} 
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className={`w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center ${selectedUser.profilePic ? 'hidden' : 'flex'}`}>
                  <span className="text-white font-bold">
                    {selectedUser.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.fullName || 'Unknown'}</h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <p className="text-sm text-gray-900 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedUser.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedUser.isVerified ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">User ID</label>
                    <p className="text-sm text-gray-900 mt-1 font-mono">{selectedUser._id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Join Date</label>
                    <p className="text-sm text-gray-900 mt-1">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Last Active</label>
                    <p className="text-sm text-gray-900 mt-1">{formatDate(selectedUser.metrics?.lastActive || selectedUser.createdAt)}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">User Activity Snapshot</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <label className="text-xs font-semibold text-gray-700">Posts</label>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{selectedUser.metrics?.totalPosts || 0}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <label className="text-xs font-semibold text-gray-700">Reports</label>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{selectedUser.metrics?.reportCount || 0}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-purple-600" />
                      <label className="text-xs font-semibold text-gray-700">TripScore</label>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{selectedUser.metrics?.tripScore || 0}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <UsersIcon className="w-4 h-4 text-green-600" />
                      <label className="text-xs font-semibold text-gray-700">Followers</label>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{selectedUser.metrics?.totalFollowers || 0}</p>
                  </div>
                </div>
                {/* Risk Indicator */}
                {selectedUser.metrics?.riskLevel && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Risk Level:</span>
                      {(() => {
                        const riskBadge = getRiskBadge(selectedUser.metrics.riskLevel, selectedUser.metrics.tripScore || 0, selectedUser.metrics.reportCount || 0)
                        const RiskIcon = riskBadge.icon
                        return (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border ${riskBadge.color}`}>
                            <RiskIcon className="w-3 h-3" />
                            {riskBadge.text}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {selectedUser?.action === 'edit' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 pb-4 border-b">
                {selectedUser.profilePic ? (
                  <img 
                    src={selectedUser.profilePic} 
                    alt={selectedUser.fullName || 'User'} 
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className={`w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center ${selectedUser.profilePic ? 'hidden' : 'flex'}`}>
                  <span className="text-white font-bold">
                    {selectedUser.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.fullName || 'Unknown'}</h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.fullName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: sanitizeText(e.target.value) })}
                    className="input w-full"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: sanitizeText(e.target.value) })}
                    className="input w-full"
                    placeholder="Enter email"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  <textarea
                    value={editFormData.bio || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, bio: sanitizeText(e.target.value) })}
                    className="input w-full h-24 resize-none"
                    placeholder="Enter bio"
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.isVerified || false}
                      onChange={(e) => setEditFormData({ ...editFormData, isVerified: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Verified User</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          {selectedUser?.action === 'ban' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 pb-4 border-b">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Ban className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.fullName || 'Unknown User'}</h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
              
              <p className="text-gray-700">
                Are you sure you want to <strong className="text-red-600">permanently ban</strong> this user?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm font-semibold text-red-900 mb-2">Impact:</p>
                <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                  <li>User will be permanently banned from the platform</li>
                  <li>Access to the platform will be restricted</li>
                  <li>Their content will be hidden from other users</li>
                  <li>This action can be reversed later by activating the user</li>
                </ul>
              </div>
            </div>
          )}
          
          {selectedUser?.action === 'delete' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 pb-4 border-b">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.fullName || 'Unknown User'}</h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
              
              <p className="text-gray-700">
                Are you sure you want to <strong className="text-orange-600">permanently delete</strong> this user?
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                <p className="text-sm font-semibold text-orange-900 mb-2">Impact:</p>
                <ul className="text-sm text-orange-800 list-disc list-inside space-y-1">
                  <li>User account will be permanently deleted</li>
                  <li>All associated posts and content will be removed</li>
                  <li>All followers and following relationships will be deleted</li>
                  <li><strong>This action CANNOT be undone</strong></li>
                </ul>
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
            className={`btn ${
              selectedUser?.action === 'ban' || selectedUser?.action === 'delete' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'btn-primary'
            }`}
          >
            {selectedUser?.action === 'view' && 'Close'}
            {selectedUser?.action === 'edit' && 'Save Changes'}
            {selectedUser?.action === 'ban' && 'Confirm Ban'}
            {selectedUser?.action === 'delete' && 'Confirm Delete'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Export Modal */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)}>
        <ModalHeader onClose={() => setShowExportModal(false)}>
          Export Users
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Choose what you want to export:
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => performExport('selected')}
                disabled={selectedUsers.length === 0}
                className="w-full p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Export Selected Users</div>
                    <div className="text-sm text-gray-600">
                      Export {selectedUsers.length} selected user(s)
                    </div>
                  </div>
                  {selectedUsers.length > 0 && (
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  )}
                </div>
              </button>
              
              <button
                onClick={() => performExport('all')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Export All Users</div>
                    <div className="text-sm text-gray-600">
                      Export all users in the current view
                    </div>
                  </div>
                </div>
              </button>
            </div>
            
            {selectedUsers.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <strong>No users selected.</strong> Please select at least one user to export selected users, or choose "Export All Users" to export all.
                </p>
              </div>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowExportModal(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </ModalFooter>
      </Modal>
    </div>
    </SafeComponent>
  )
}

export default Users
