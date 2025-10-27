import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, Trash2, Eye, Flag, MapPin, RefreshCw } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'

const TravelContent = () => {
  const { posts, fetchPosts, isConnected } = useRealTime()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContent, setSelectedContent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  
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
        await fetchPosts({
          page: currentPage,
          search: searchTerm,
          type: filterType === 'all' ? undefined : filterType,
          sortBy,
          sortOrder
        })
      } catch (error) {
        toast.error('Failed to fetch travel content')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchPosts, currentPage, searchTerm, filterType, sortBy, sortOrder])

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
  const handleContentAction = async (contentId, action) => {
    try {
      // This would call the appropriate API endpoint
      toast.success(`Content ${action}d successfully`)
    } catch (error) {
      toast.error(`Failed to ${action} content`)
    }
  }

  // Get filtered content based on search and type
  const postsArray = Array.isArray(posts) ? posts : (posts?.posts || [])
  const filteredContent = postsArray.filter(post => {
    // Handle location as either string or object
    let locationString = ''
    if (typeof post.location === 'string') {
      locationString = post.location
    } else if (post.location && typeof post.location === 'object') {
      locationString = post.location.address || post.location.name || ''
    }
    
    const matchesSearch = !searchTerm || 
      post.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      locationString.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || post.type === filterType
    
    return matchesSearch && matchesType
  })

  // Pagination
  const contentPerPage = 20
  const totalPages = Math.ceil(filteredContent.length / contentPerPage)
  const startIndex = (currentPage - 1) * contentPerPage
  const endIndex = startIndex + contentPerPage
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
    if (selectedContent) {
      await handleContentAction(selectedContent._id, selectedContent.action)
      setShowModal(false)
      setSelectedContent(null)
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
          <button className="btn btn-primary">
            Bulk Actions
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
              <button className="btn btn-secondary">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentContent.map((item) => (
            <Card key={item._id} className="overflow-hidden">
              <div className="relative">
                <img
                  src={item.imageUrl || item.thumbnailUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                  alt={item.caption || item.content || 'Travel content'}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='
                  }}
                />
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
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleContentActionClick(item, 'flag')}
                      className="p-1 text-gray-400 hover:text-yellow-600"
                      title="Flag Content"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleContentActionClick(item, 'delete')}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete Content"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredContent.length)} of {filteredContent.length} content items
              </div>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedContent?.action === 'view' && 'Content Details'}
          {selectedContent?.action === 'review' && 'Review Flagged Content'}
          {selectedContent?.action === 'delete' && 'Delete Content'}
        </ModalHeader>
        <ModalContent>
          {selectedContent?.action === 'view' && (
            <div className="space-y-4">
              <img
                src={selectedContent.imageUrl || selectedContent.thumbnailUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='
                }}
                alt={selectedContent.caption || selectedContent.content || 'Travel content'}
                className="w-full h-48 object-cover rounded-lg"
              />
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedContent.caption || selectedContent.content || 'No title available'}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="font-medium text-gray-700">Author</label>
                    <p className="text-gray-900">{selectedContent.user?.fullName || 'Unknown User'}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Location</label>
                    <p className="text-gray-900">{selectedContent.location?.address || selectedContent.location || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Type</label>
                    <p className="text-gray-900 capitalize">{selectedContent.type || 'post'}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Status</label>
                    <p className="text-gray-900 capitalize">{selectedContent.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Likes</label>
                    <p className="text-gray-900">{Array.isArray(selectedContent.likes) ? selectedContent.likes.length : 0}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Comments</label>
                    <p className="text-gray-900">{Array.isArray(selectedContent.comments) ? selectedContent.comments.length : 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {(selectedContent?.action === 'review' || selectedContent?.action === 'delete') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to {selectedContent.action} this content?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  {selectedContent.action === 'delete' 
                    ? 'This action cannot be undone. The content will be permanently removed.'
                    : 'Please review the flagged content and take appropriate action.'
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
            className={`btn ${selectedContent?.action === 'delete' ? 'btn-destructive' : 'btn-primary'}`}
          >
            {selectedContent?.action === 'view' && 'Close'}
            {selectedContent?.action === 'review' && 'Review'}
            {selectedContent?.action === 'delete' && 'Delete'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
    </SafeComponent>
  )
}

export default TravelContent
