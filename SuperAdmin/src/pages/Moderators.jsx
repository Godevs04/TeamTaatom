import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { 
  Search, Plus, Edit, Trash2, Shield, UserCheck, UserX, RefreshCw, Eye, 
  Filter, MoreVertical, ToggleLeft, ToggleRight, Ban, CheckCircle, XCircle,
  Save, X, Power, Settings2, TrendingUp, Activity
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'

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
  const [moreFilters, setMoreFilters] = useState({
    permission: 'all',
    activityRange: 'all', // last 7 days, 30 days, all time
    createdRange: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })
  
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

  // Fetch moderators data
  const fetchModerators = async () => {
    setLoading(true)
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage
      }
      
      if (searchTerm) {
        params.search = searchTerm
      }
      
      const response = await api.get('/api/superadmin/moderators', { params })
      
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
      }
    } catch (error) {
      console.error('Failed to fetch moderators:', error)
      toast.error('Failed to fetch moderators')
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchModerators()
  }, [currentPage, itemsPerPage, filterRole, filterStatus, moreFilters])

  // Search debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1)
      }
      fetchModerators()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const handleRefresh = async () => {
    await fetchModerators()
    toast.success('Moderators refreshed successfully')
  }

  const handleModeratorActionClick = (moderator, action) => {
    setSelectedModerator({ ...moderator, action })
    setShowModal(true)
  }

  const handleToggleActive = async (moderator, isActive) => {
    try {
      await api.patch(`/api/superadmin/moderators/${moderator._id}`, {
        isActive: !isActive
      })
      toast.success(`Moderator ${!isActive ? 'activated' : 'deactivated'} successfully`)
      await fetchModerators()
    } catch (error) {
      console.error('Failed to toggle status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleModeratorAction = async (moderatorId, action) => {
    try {
      if (action === 'remove') {
        await api.delete(`/api/superadmin/moderators/${moderatorId}`)
        toast.success('Moderator removed successfully')
      } else if (action === 'edit') {
        await api.patch(`/api/superadmin/moderators/${moderatorId}`, {
          role: selectedModerator.role,
          isActive: selectedModerator.isActive
        })
        toast.success('Moderator updated successfully')
      }
      await fetchModerators()
      setShowModal(false)
      setSelectedModerator(null)
    } catch (error) {
      console.error('Failed to perform action:', error)
      toast.error(`Failed to ${action} moderator`)
    }
  }

  const handleOpenEditPermissions = (moderator) => {
    setEditingPermissions(moderator)
    setTempPermissions(moderator.permissions || {})
    setShowEditPermissionsModal(true)
  }

  const handleSavePermissions = async () => {
    try {
      await api.patch(`/api/superadmin/moderators/${editingPermissions._id}`, {
        permissions: tempPermissions
      })
      toast.success('Permissions updated successfully')
      setShowEditPermissionsModal(false)
      setEditingPermissions(null)
      await fetchModerators()
    } catch (error) {
      console.error('Failed to update permissions:', error)
      toast.error('Failed to update permissions')
    }
  }

  const handleBulkAction = async (action) => {
    try {
      for (const moderatorId of selectedModerators) {
        if (action === 'activate') {
          await api.patch(`/api/superadmin/moderators/${moderatorId}`, { isActive: true })
        } else if (action === 'deactivate') {
          await api.patch(`/api/superadmin/moderators/${moderatorId}`, { isActive: false })
        } else if (action === 'remove') {
          await api.delete(`/api/superadmin/moderators/${moderatorId}`)
        }
      }
      toast.success(`Bulk ${action} completed successfully`)
      setSelectedModerators([])
      setShowBulkActions(false)
      await fetchModerators()
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error(`Failed to ${action} moderators`)
    }
  }

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
      console.error('Failed to create moderator:', error)
      toast.error(error.response?.data?.message || 'Failed to create moderator')
    }
  }

  const handleConfirmAction = async () => {
    if (selectedModerator) {
      await handleModeratorAction(selectedModerator._id, selectedModerator.action)
    }
  }

  const handleSelectModerator = (moderatorId) => {
    setSelectedModerators(prev => 
      prev.includes(moderatorId) 
        ? prev.filter(id => id !== moderatorId)
        : [...prev, moderatorId]
    )
  }

  const handleSelectAll = () => {
    if (selectedModerators.length === moderatorsList.length) {
      setSelectedModerators([])
    } else {
      setSelectedModerators(moderatorsList.map(m => m._id))
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'text-purple-600 bg-purple-100'
      case 'moderator': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const permissions = [
    { id: 'canManageUsers', label: 'Manage Users', icon: UserCheck },
    { id: 'canManageContent', label: 'Manage Content', icon: Shield },
    { id: 'canManageReports', label: 'Manage Reports', icon: Filter },
    { id: 'canManageModerators', label: 'Manage Moderators', icon: Settings2 },
    { id: 'canViewLogs', label: 'View Logs', icon: Activity },
    { id: 'canManageSettings', label: 'Manage Settings', icon: Settings2 },
  ]

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentModerators = moderatorsList.slice(startIndex, endIndex)

  const activeCount = moderatorsList.filter(m => m.isActive).length
  const inactiveCount = moderatorsList.filter(m => !m.isActive).length
  const adminCount = moderatorsList.filter(m => m.role === 'admin').length
  const moderatorCount = moderatorsList.filter(m => m.role === 'moderator').length

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
                  <TableRow key={moderator._id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedModerators.includes(moderator._id)}
                        onChange={() => handleSelectModerator(moderator._id)}
                        className="rounded border-gray-300"
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
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(moderator.permissions || {})
                          .filter(([_, enabled]) => enabled)
                          .slice(0, 2)
                          .map(([key]) => {
                            const perm = permissions.find(p => p.id === key)
                            return (
                              <span key={key} className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {perm?.label || key}
                              </span>
                            )
                          })}
                        {Object.entries(moderator.permissions || {}).filter(([_, enabled]) => enabled).length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{Object.entries(moderator.permissions || {}).filter(([_, enabled]) => enabled).length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(moderator, moderator.isActive)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          moderator.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={moderator.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {moderator.isActive ? (
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
                          onClick={() => handleModeratorActionClick(moderator, 'view')}
                          className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditPermissions(moderator)}
                          className="p-2 text-gray-400 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors"
                          title="Edit Permissions"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleModeratorActionClick(moderator, 'remove')}
                          className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
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
                onChange={(e) => setNewModerator({ ...newModerator, email: e.target.value })}
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

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedModerator?.action === 'view' && 'Moderator Details'}
          {selectedModerator?.action === 'edit' && 'Edit Moderator'}
          {selectedModerator?.action === 'remove' && 'Remove Moderator'}
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
              </div>
            </div>
          )}
          {(selectedModerator?.action === 'edit' || selectedModerator?.action === 'remove') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to {selectedModerator.action} {selectedModerator.email}?
              </p>
              {selectedModerator.action === 'edit' && (
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
              )}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  {selectedModerator.action === 'remove' 
                    ? 'This will revoke all moderator privileges and remove access to the admin panel.'
                    : 'This will allow you to modify the moderator\'s role and permissions.'
                  }
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
            className={`btn ${selectedModerator?.action === 'remove' ? 'btn-destructive' : 'btn-primary'}`}
          >
            {selectedModerator?.action === 'view' && 'Close'}
            {selectedModerator?.action === 'edit' && 'Save Changes'}
            {selectedModerator?.action === 'remove' && 'Remove Moderator'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
    </SafeComponent>
  )
}

export default Moderators
