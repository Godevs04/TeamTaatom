import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, Ban, CheckCircle, Eye, Edit, RefreshCw, UserX, Shield, Mail, Trash2, Users as UsersIcon, TrendingUp } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { handleModalClose } from '../utils/modalUtils'
import { sanitizeText } from '../utils/sanitize'

const Users = () => {
  const { users, fetchUsers, performBulkAction, isConnected } = useRealTime()
  
  const [searchTerm, setSearchTerm] = useState('')
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
  const [moreFilters, setMoreFilters] = useState({
    dateRange: '',
    sortField: 'createdAt',
    role: 'all'
  })

  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, sortBy, sortOrder])

  // Fetch users data on component mount and when filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        await fetchUsers({
          page: currentPage,
          search: searchTerm,
          status: filterStatus === 'all' ? undefined : filterStatus,
          sortBy,
          sortOrder
        })
      } catch (error) {
        handleError(error, toast, 'Failed to fetch users')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchUsers, currentPage, searchTerm, filterStatus, sortBy, sortOrder])

  // Handle search with debouncing (standardized 500ms delay)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1) // Reset to first page when searching
      }
    }, 500) // Standardized debounce delay: 500ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Handle bulk actions
  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users first')
      return
    }

    const reason = prompt(`Reason for ${action}:`)
    if (!reason) return

    const result = await performBulkAction(action, selectedUsers, reason)
    if (result.success) {
      setSelectedUsers([])
      setShowBulkActions(false)
      toast.success(`Successfully ${action}d ${selectedUsers.length} users`)
    }
  }

  // Handle individual user actions
  const handleUserActionClick = async (userId, action) => {
    try {
      await performBulkAction(action, [userId], `Individual ${action}`)
      toast.success(`User ${action}d successfully`)
      // Refresh users after action
      await fetchUsers({
        page: currentPage,
        search: searchTerm,
        status: filterStatus === 'all' ? undefined : filterStatus,
        sortBy,
        sortOrder
      })
    } catch (error) {
      handleError(error, toast, `Failed to ${action} user`)
    }
  }

  // Handle user selection
  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  // Get filtered users based on search and status
  const usersArray = Array.isArray(users) ? users : (users?.users || [])
  
  // Handle select all
  const handleSelectAll = () => {
    if (selectedUsers.length === usersArray.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(usersArray.map(user => user._id))
    }
  }
  
  const filteredUsers = usersArray.filter(user => {
    const matchesSearch = !searchTerm || 
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && user.isVerified) ||
      (filterStatus === 'inactive' && !user.isVerified) ||
      (filterStatus === 'pending' && (!user.isVerified || user.isVerified === false)) ||
      (filterStatus === 'banned' && user.deletedAt)
    
    return matchesSearch && matchesStatus
  })

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  const handleUserAction = (user, action) => {
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
  }

  const handleConfirmAction = async () => {
    if (selectedUser) {
      try {
        if (selectedUser.action === 'edit') {
          // Handle edit action separately
          try {
            await api.patch(`/api/superadmin/users/${selectedUser._id}`, editFormData)
            toast.success('User updated successfully')
            handleModalClose(setShowModal, setSelectedUser, () => setEditFormData({}))
            // Refresh users
            await fetchUsers({
              page: currentPage,
              search: searchTerm,
              status: filterStatus === 'all' ? undefined : filterStatus,
              sortBy,
              sortOrder
            })
          } catch (error) {
            handleError(error, toast, 'Failed to update user')
            logger.error('Update error:', error)
          }
        } else if (selectedUser.action === 'delete') {
          // Handle delete action
          try {
            await api.delete(`/api/superadmin/users/${selectedUser._id}`)
            toast.success('User deleted successfully')
            handleModalClose(setShowModal, setSelectedUser)
            // Refresh users
            await fetchUsers({
              page: currentPage,
              search: searchTerm,
              status: filterStatus === 'all' ? undefined : filterStatus,
              sortBy,
              sortOrder
            })
          } catch (error) {
            handleError(error, toast, 'Failed to delete user')
            logger.error('Delete error:', error)
          }
        } else {
          await handleUserActionClick(selectedUser._id, selectedUser.action)
          handleModalClose(setShowModal, setSelectedUser)
        }
      } catch (error) {
        handleError(error, toast, `Failed to ${selectedUser.action} user`)
      }
    }
  }
  
  const handleCloseModal = () => {
    handleModalClose(setShowModal, setSelectedUser, () => setEditFormData({}))
  }
  
  // Handle bulk delete/ban
  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users first')
      return
    }
    
    if (!confirm(`Are you sure you want to permanently ban ${selectedUsers.length} users?`)) {
      return
    }
    
    try {
      await performBulkAction('ban', selectedUsers, 'Bulk ban operation')
      setSelectedUsers([])
      setShowBulkActions(false)
      toast.success(`Successfully banned ${selectedUsers.length} users`)
    } catch (error) {
      toast.error('Failed to ban users')
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetchUsers({
        page: currentPage,
        search: searchTerm,
        status: filterStatus === 'all' ? undefined : filterStatus,
        sortBy,
        sortOrder
      })
      toast.success('Users refreshed successfully')
    } catch (error) {
      toast.error('Failed to refresh users')
    } finally {
      setLoading(false)
    }
  }
  
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
                  <Ban className="w-4 h-4 mr-1" />
                  Deactivate
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
                {currentUsers.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={() => handleUserSelect(user._id)}
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
                          <div className="font-medium text-gray-900">{user.fullName || 'Unknown'}</div>
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
                    <TableCell>{user.metrics?.totalPosts || 0}</TableCell>
                    <TableCell>{user.metrics?.totalFollowers || 0}</TableCell>
                    <TableCell>{user.location || 'Not specified'}</TableCell>
                    <TableCell>{formatDate(user.metrics?.lastActive || user.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUserAction(user, 'view')}
                          className="p-1 text-blue-400 hover:text-blue-600 transition-colors relative group"
                          title="View user details and activity"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            View Details
                          </span>
                        </button>
                        <button
                          onClick={() => handleUserAction(user, 'edit')}
                          className="p-1 text-green-400 hover:text-green-600 transition-colors relative group"
                          title="Edit user information and settings"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            Edit User
                          </span>
                        </button>
                        {user.isVerified ? (
                          <button
                            onClick={() => handleUserActionClick(user._id, 'deactivate')}
                            className="p-1 text-orange-400 hover:text-orange-600 transition-colors relative group"
                            title="Deactivate user account and restrict access"
                          >
                            <Ban className="w-4 h-4" />
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              Deactivate User
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserActionClick(user._id, 'activate')}
                            className="p-1 text-green-400 hover:text-green-600 transition-colors relative group"
                            title="Activate user account and restore access"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              Activate User
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => handleUserAction(user, 'delete')}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors relative group"
                          title="Permanently delete user account"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            Delete User
                          </span>
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
      {filteredUsers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
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
                <h4 className="text-sm font-semibold text-gray-900 mb-3">User Activity</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Total Posts</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedUser.metrics?.totalPosts || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Total Likes</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedUser.metrics?.totalLikes || 0}</p>
                  </div>
                </div>
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
              
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This action cannot be undone. The user will lose all access to the platform.
                </p>
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
                Are you sure you want to <strong className="text-orange-600">delete</strong> this user?
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <p className="text-sm text-orange-800">
                  <strong>Warning:</strong> This will permanently delete the user account and all associated data.
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
