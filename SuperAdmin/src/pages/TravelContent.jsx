import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, Trash2, Eye, Flag, MapPin, RefreshCw, Edit, Download } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'

const TravelContent = () => {
  const { posts, fetchPosts, isConnected } = useRealTime()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContent, setSelectedContent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedPosts, setSelectedPosts] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  
  // Handle initial load state
  useEffect(() => {
    if (posts && posts.length > 0) {
      setIsInitialLoad(false)
    }
  }, [posts])

  // Fetch posts data on component mount and when filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Only send type to backend if it's not 'all'
        const typeParam = filterType === 'all' ? undefined : filterType
        
        const fetchParams = {
          page: currentPage,
          limit: 20
        }
        
        // Add search if provided
        if (searchTerm) {
          fetchParams.search = searchTerm
        }
        
        // Add type filter if not 'all'
        if (typeParam) {
          fetchParams.type = typeParam
        }
        
        // Add status filter
        fetchParams.status = statusFilter
        
        await fetchPosts(fetchParams)
      } catch (error) {
        console.error('Error fetching travel content:', error)
        toast.error('Failed to fetch travel content')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchPosts, currentPage, searchTerm, filterType, sortBy, sortOrder, statusFilter])

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1) // Reset to first page when searching
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Handle content actions
  const handleContentAction = async (postId, action) => {
    try {
      if (action === 'delete') {
        await api.delete(`/api/superadmin/posts/${postId}`)
        toast.success('Post deleted successfully')
        // Refresh posts
        await fetchPosts({
          page: currentPage,
          search: searchTerm,
          type: filterType === 'all' ? undefined : filterType,
          sortBy,
          sortOrder
        })
      } else if (action === 'flag') {
        // Flag the post (mark for review)
        await api.patch(`/api/superadmin/posts/${postId}/flag`)
        toast.success('Post flagged successfully')
      } else if (action === 'activate') {
        await api.patch(`/api/superadmin/posts/${postId}`, { isActive: true })
        toast.success('Post activated successfully')
      } else if (action === 'deactivate') {
        await api.patch(`/api/superadmin/posts/${postId}`, { isActive: false })
        toast.success('Post deactivated successfully')
      }
    } catch (error) {
      console.error('Content action error:', error)
      toast.error(`Failed to ${action} content`)
    }
  }

  // Get filtered content based on search and type
  const postsArray = Array.isArray(posts) ? posts : (posts?.posts || [])
  
  // Debug: Log posts data
  useEffect(() => {
    console.log('📊 Posts data:', {
      posts,
      isArray: Array.isArray(posts),
      postsLength: posts?.length,
      postsArrayLength: postsArray.length,
      filterType
    })
  }, [posts, postsArray.length, filterType])
  
  // No frontend filtering - backend already filtered the data
  // Just do search filtering if needed
  const filteredContent = postsArray.filter(post => {
    // Handle location as either string or object
    let locationString = ''
    if (typeof post.location === 'string') {
      locationString = post.location
    } else if (post.location && typeof post.location === 'object') {
      locationString = post.location.address || post.location.name || ''
    }
    
    // Only apply search filter on frontend if no backend search was applied
    if (!searchTerm) return true
    
    return post.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      locationString.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Pagination
  const totalPages = Math.ceil(filteredContent.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentContent = filteredContent.slice(startIndex, endIndex)

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetchPosts({
        page: currentPage,
        search: searchTerm,
        type: filterType === 'all' ? undefined : filterType,
        sortBy,
        sortOrder
      })
      toast.success('Travel content refreshed successfully')
    } catch (error) {
      toast.error('Failed to refresh travel content')
    } finally {
      setLoading(false)
    }
  }

  const handleContentActionClick = (item, action) => {
    setSelectedContent({ ...item, action })
    setShowModal(true)
  }

  const handleConfirmAction = async () => {
    if (!selectedContent) {
      setShowModal(false)
      return
    }
    
    try {
      if (selectedContent.action === 'delete') {
        await handleContentAction(selectedContent._id, 'delete')
        // Refresh posts
        await fetchPosts({
          page: currentPage,
          search: searchTerm,
          type: filterType === 'all' ? undefined : filterType,
          sortBy,
          sortOrder
        })
      } else if (selectedContent.action === 'flag') {
        await handleContentAction(selectedContent._id, 'flag')
      } else if (selectedContent.action === 'activate' || selectedContent.action === 'deactivate') {
        await handleContentAction(selectedContent._id, selectedContent.action)
        // Refresh posts
        await fetchPosts({
          page: currentPage,
          search: searchTerm,
          type: filterType === 'all' ? undefined : filterType,
          sortBy,
          sortOrder
        })
      }
      setShowModal(false)
      setSelectedContent(null)
    } catch (error) {
      console.error('Action error:', error)
      toast.error(`Failed to ${selectedContent.action} content`)
    }
  }
  
  const handlePostSelect = (postId) => {
    setSelectedPosts(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    )
  }
  
  const handleBulkDelete = async () => {
    if (selectedPosts.length === 0) {
      toast.error('Please select at least one post')
      return
    }
    if (!confirm(`Are you sure you want to delete ${selectedPosts.length} post(s)?`)) {
      return
    }
    
    try {
      await Promise.all(selectedPosts.map(id => api.delete(`/api/superadmin/posts/${id}`)))
      toast.success(`Successfully deleted ${selectedPosts.length} post(s)`)
      setSelectedPosts([])
      // Refresh posts
      await fetchPosts({
        page: currentPage,
        search: searchTerm,
        type: filterType === 'all' ? undefined : filterType,
        sortBy,
        sortOrder
      })
    } catch (error) {
      toast.error('Failed to delete posts')
    }
  }
  
  // Helper function to safely render values
  const safeRender = (value, fallback = 'Not specified') => {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
  
  // Show loading only on initial load
  if (isInitialLoad && (!posts || posts.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading travel content...</p>
        </div>
      </div>
    )
  }

  return (
    <SafeComponent>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
          <h1 className="text-3xl font-bold text-gray-900">Travel Content</h1>
          <p className="text-gray-600 mt-2">
            Manage travel posts and destinations
            {isConnected && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
                Live Data
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={handleBulkDelete}
            disabled={selectedPosts.length === 0}
            className="btn btn-destructive disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedPosts.length})
          </button>
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
                  placeholder="Search content..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                className="input"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="photo">Photos</option>
                <option value="short">Shorts</option>
              </select>
              <button 
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`btn btn-secondary ${showMoreFilters ? 'bg-blue-600 text-white' : ''}`}
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
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  className="input w-full"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="all">All Status</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                <input
                  type="date"
                  className="input w-full"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                <input
                  type="date"
                  className="input w-full"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setDateRange({ start: '', end: '' })
                    setStatusFilter('active')
                  }}
                  className="btn btn-secondary"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentContent.map((item) => (
            <Card key={item._id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative group">
                <input
                  type="checkbox"
                  checked={selectedPosts.includes(item._id)}
                  onChange={() => handlePostSelect(item._id)}
                  className="absolute top-2 left-2 z-10 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                />
                {/* Display image or video thumbnail */}
                {item.type === 'short' && item.videoUrl ? (
                  <video
                    src={item.videoUrl}
                    className="w-full h-48 object-cover"
                    controls={false}
                    muted
                    loop
                    onError={(e) => {
                      e.target.parentElement.innerHTML = '<img src="/placeholder.svg" class="w-full h-48 object-cover" alt="Video error" />'
                    }}
                  />
                ) : (
                  <img
                    src={item.imageUrl || item.thumbnailUrl || '/placeholder.svg'}
                    alt={item.caption || item.content || 'Travel content'}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder.svg'
                    }}
                  />
                )}
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    {item.type || 'post'}
                  </span>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                  {item.caption || item.content || 'No title available'}
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">By:</span>
                    <span>{item.user?.fullName || 'Unknown User'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>{item.location?.address || item.location || 'Location not specified'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{Array.isArray(item.likes) ? item.likes.length : 0} likes</span>
                    <span>{Array.isArray(item.comments) ? item.comments.length : 0} comments</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(item.createdAt)}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleContentActionClick(item, 'view')}
                      className="p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors relative group"
                      title="View full details of this post"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        View Details
                      </span>
                    </button>
                    {item.flagged && (
                      <button
                        onClick={() => handleContentActionClick(item, 'review')}
                        className="p-2 rounded-md text-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors relative group"
                        title="Review this flagged content"
                      >
                        <Flag className="w-4 h-4" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Review Flagged
                        </span>
                      </button>
                    )}
                    {!item.flagged && (
                      <button
                        onClick={() => handleContentActionClick(item, 'flag')}
                        className="p-2 rounded-md text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors relative group"
                        title="Flag this content for review"
                      >
                        <Flag className="w-4 h-4" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Flag Content
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleContentActionClick(item, item.isActive ? 'deactivate' : 'activate')}
                      className={`p-2 rounded-md transition-colors relative group ${
                        item.isActive 
                          ? 'text-green-600 hover:bg-red-50' 
                          : 'text-red-600 hover:bg-green-50'
                      }`}
                      title={item.isActive ? 'Hide this content from users' : 'Show this content to users'}
                    >
                      {item.isActive ? '✓' : '×'}
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {item.isActive ? 'Deactivate Post' : 'Activate Post'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleContentActionClick(item, 'delete')}
                      className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors relative group"
                      title="Permanently delete this content"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Delete Post
                      </span>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredContent.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredContent.length)} of {filteredContent.length} content items
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
          {selectedContent?.action === 'view' && 'Content Details'}
          {selectedContent?.action === 'review' && 'Review Flagged Content'}
          {(selectedContent?.action === 'activate' || selectedContent?.action === 'deactivate') && `${selectedContent?.action === 'activate' ? 'Activate' : 'Deactivate'} Content`}
          {selectedContent?.action === 'delete' && 'Delete Content'}
          {selectedContent?.action === 'flag' && 'Flag Content'}
        </ModalHeader>
        <ModalContent>
          {selectedContent?.action === 'view' && (
            <div className="space-y-4">
              {/* Display image or video thumbnail in modal */}
              {selectedContent.type === 'short' && selectedContent.videoUrl ? (
                <video
                  src={selectedContent.videoUrl}
                  className="w-full h-64 object-cover rounded-lg"
                  controls
                  loop
                  onError={(e) => {
                    e.target.parentElement.innerHTML = '<img src="/placeholder.svg" class="w-full h-64 object-cover rounded-lg" alt="Video error" />'
                  }}
                />
              ) : (
                <img
                  src={selectedContent.imageUrl || selectedContent.thumbnailUrl || '/placeholder.svg'}
                  onError={(e) => {
                    e.target.src = '/placeholder.svg'
                  }}
                  alt={selectedContent.caption || selectedContent.content || 'Travel content'}
                  className="w-full h-64 object-cover rounded-lg"
                />
              )}
              <div>
                <h3 className="font-semibold text-lg mb-3">{selectedContent.caption || selectedContent.content || 'No title available'}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Author</label>
                    <p className="text-gray-900">{selectedContent.user?.fullName || 'Unknown User'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Location</label>
                    <p className="text-gray-900">{selectedContent.location?.address || selectedContent.location || 'Not specified'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Type</label>
                    <p className="text-gray-900 capitalize">{selectedContent.type || 'post'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Status</label>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      selectedContent.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedContent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Likes</label>
                    <p className="text-gray-900 text-lg">{Array.isArray(selectedContent.likes) ? selectedContent.likes.length : 0}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="font-medium text-gray-700 block mb-1">Comments</label>
                    <p className="text-gray-900 text-lg">{Array.isArray(selectedContent.comments) ? selectedContent.comments.length : 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {(selectedContent?.action === 'review' || selectedContent?.action === 'delete' || selectedContent?.action === 'activate' || selectedContent?.action === 'deactivate' || selectedContent?.action === 'flag') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                {selectedContent.action === 'delete' && `Are you sure you want to delete this content?`}
                {selectedContent.action === 'flag' && `Are you sure you want to flag this content for review?`}
                {selectedContent.action === 'activate' && `Are you sure you want to activate this content?`}
                {selectedContent.action === 'deactivate' && `Are you sure you want to deactivate this content?`}
                {selectedContent.action === 'review' && `This content has been flagged for review. Please take appropriate action.`}
              </p>
              <div className={`border rounded-md p-3 ${
                selectedContent.action === 'delete' ? 'bg-red-50 border-red-200' :
                selectedContent.action === 'flag' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <p className={`text-sm ${
                  selectedContent.action === 'delete' ? 'text-red-800' :
                  selectedContent.action === 'flag' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {selectedContent.action === 'delete' && 'This action cannot be undone. The content will be permanently removed.'}
                  {selectedContent.action === 'flag' && 'The content will be marked for review by administrators.'}
                  {selectedContent.action === 'activate' && 'The content will be visible to all users.'}
                  {selectedContent.action === 'deactivate' && 'The content will be hidden from users.'}
                  {selectedContent.action === 'review' && 'You can approve or remove this content.'}
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
            {selectedContent?.action === 'view' ? 'Close' : 'Cancel'}
          </button>
          {selectedContent?.action !== 'view' && (
            <button
              onClick={handleConfirmAction}
              className={`btn ${
                selectedContent?.action === 'delete' || selectedContent?.action === 'deactivate'
                  ? 'btn-destructive' 
                  : 'btn-primary'
              }`}
            >
              {selectedContent?.action === 'delete' && 'Delete'}
              {selectedContent?.action === 'flag' && 'Flag'}
              {selectedContent?.action === 'activate' && 'Activate'}
              {selectedContent?.action === 'deactivate' && 'Deactivate'}
              {selectedContent?.action === 'review' && 'Review'}
            </button>
          )}
        </ModalFooter>
      </Modal>
      </div>
    </SafeComponent>
  )
}

export default TravelContent
