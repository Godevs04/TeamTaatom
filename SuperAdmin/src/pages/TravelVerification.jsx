import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  User,
  Calendar,
  RefreshCw,
  Eye,
  MessageSquare,
  Search,
  Filter,
  Globe,
  Camera,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import {
  getPendingApprovals,
  approveVerification,
  rejectVerification
} from '../services/verificationService'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { motion } from 'framer-motion'

// Memoized review row component
const ReviewRow = memo(({
  review,
  onApprove,
  onReject,
  onView,
  isLoading,
  imageError,
  onImageError
}) => {
  const city = review.location?.city || 'Unknown'
  const country = review.location?.country || 'Unknown'
  const fullLocation = `${city}, ${country}`

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {review.user?.profilePic ? (
            <img
              src={review.user.profilePic}
              alt={review.user.fullName}
              className="w-8 h-8 rounded-full object-cover"
              onError={() => onImageError(review._id)}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold">
              {review.user?.fullName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="text-sm">
            <p className="font-semibold">{review.user?.fullName || 'Unknown'}</p>
            <p className="text-xs text-gray-500">@{review.user?.username || 'unknown'}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm">{fullLocation}</span>
        </div>
      </TableCell>
      <TableCell>
        {review.post?.imageUrl && !imageError ? (
          <img
            src={review.post.imageUrl}
            alt="Content thumbnail"
            className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
            onClick={() => onView(review)}
            onError={() => onImageError(review._id)}
          />
        ) : (
          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs">
            No image
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="text-xs text-gray-600">
          <p>{review.location?.coordinates?.latitude?.toFixed(4) || 'N/A'}</p>
          <p>{review.location?.coordinates?.longitude?.toFixed(4) || 'N/A'}</p>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {review.source === 'taatom_camera_live' && <Camera className="w-3 h-3" />}
          {review.source === 'gallery_exif' && 'EXIF'}
          {review.source === 'gallery_no_exif' && 'No EXIF'}
          {review.source === 'manual_only' && 'Manual'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-gray-600">
          {formatDate(review.uploadedAt)}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-xs px-2 py-1 bg-gray-100 rounded">
          {review.post?.type || 'unknown'}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(review)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onApprove(review._id)}
            disabled={isLoading === review._id}
            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Approve"
          >
            {isLoading === review._id ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onReject(review._id)}
            disabled={isLoading === review._id}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reject"
          >
            {isLoading === review._id ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
})

ReviewRow.displayName = 'ReviewRow'

const TravelVerification = () => {
  const [reviews, setReviews] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedReview, setSelectedReview] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectContentId, setRejectContentId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [imageErrors, setImageErrors] = useState(new Set())
  const [stats, setStats] = useState({
    totalPending: 0,
    approvedToday: 0,
    rejectedToday: 0
  })

  // Fetch pending reviews
  const fetchPendingReviews = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const data = await getPendingApprovals(page, pagination.limit)

      if (data?.reviews) {
        setReviews(data.reviews)
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        })

        // Update stats
        setStats(prev => ({
          ...prev,
          totalPending: data.pagination.total
        }))
      }
    } catch (error) {
      logger.error('Error fetching pending reviews:', error)
      handleError(error)
    } finally {
      setLoading(false)
    }
  }, [pagination.limit])

  // Initial fetch
  useEffect(() => {
    fetchPendingReviews(1)
  }, [])

  // Handle approve
  const handleApprove = useCallback(async (contentId) => {
    try {
      setActionLoading(contentId)
      await approveVerification(contentId)

      toast.success('Verification approved')

      // Refresh the list
      setReviews(prev => prev.filter(r => r._id !== contentId))

      // Update stats
      setStats(prev => ({
        ...prev,
        approvedToday: prev.approvedToday + 1,
        totalPending: Math.max(0, prev.totalPending - 1)
      }))
    } catch (error) {
      logger.error('Error approving verification:', error)
      handleError(error)
    } finally {
      setActionLoading(null)
    }
  }, [])

  // Handle reject
  const handleReject = useCallback(async () => {
    if (!rejectContentId) return

    try {
      setActionLoading(rejectContentId)
      await rejectVerification(rejectContentId, rejectReason)

      toast.success('Verification rejected')

      // Refresh the list
      setReviews(prev => prev.filter(r => r._id !== rejectContentId))

      // Update stats
      setStats(prev => ({
        ...prev,
        rejectedToday: prev.rejectedToday + 1,
        totalPending: Math.max(0, prev.totalPending - 1)
      }))

      // Close modal and reset
      setIsRejectModalOpen(false)
      setRejectReason('')
      setRejectContentId(null)
    } catch (error) {
      logger.error('Error rejecting verification:', error)
      handleError(error)
    } finally {
      setActionLoading(null)
    }
  }, [rejectContentId, rejectReason])

  // Handle view
  const handleView = useCallback((review) => {
    setSelectedReview(review)
    setIsViewModalOpen(true)
  }, [])

  // Handle reject modal
  const handleOpenRejectModal = useCallback((contentId) => {
    setRejectContentId(contentId)
    setIsRejectModalOpen(true)
  }, [])

  // Handle image error
  const handleImageError = useCallback((reviewId) => {
    setImageErrors(prev => new Set([...prev, reviewId]))
  }, [])

  // Filter reviews
  const filteredReviews = useMemo(() => {
    if (!searchTerm) return reviews

    const term = searchTerm.toLowerCase()
    return reviews.filter(review =>
      review.user?.fullName?.toLowerCase().includes(term) ||
      review.user?.username?.toLowerCase().includes(term) ||
      review.location?.city?.toLowerCase().includes(term) ||
      review.location?.country?.toLowerCase().includes(term)
    )
  }, [reviews, searchTerm])

  return (
    <SafeComponent>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Travel Verification</h1>
          <p className="text-gray-600 mt-2">Review and approve/reject pending travel verifications</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending Reviews</p>
                    <p className="text-3xl font-bold text-amber-900">{stats.totalPending}</p>
                  </div>
                  <AlertTriangle className="w-12 h-12 text-amber-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Approved Today</p>
                    <p className="text-3xl font-bold text-green-900">{stats.approvedToday}</p>
                  </div>
                  <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Rejected Today</p>
                    <p className="text-3xl font-bold text-red-900">{stats.rejectedToday}</p>
                  </div>
                  <XCircle className="w-12 h-12 text-red-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Reviews</CardTitle>
              <button
                onClick={() => fetchPendingReviews(pagination.page)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredReviews.length === 0 ? (
              <div className="py-12 text-center">
                <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No pending reviews</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Photo</TableCell>
                      <TableCell>GPS Coords</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredReviews.map(review => (
                      <ReviewRow
                        key={review._id}
                        review={review}
                        onApprove={handleApprove}
                        onReject={handleOpenRejectModal}
                        onView={handleView}
                        isLoading={actionLoading}
                        imageError={imageErrors.has(review._id)}
                        onImageError={handleImageError}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchPendingReviews(Math.max(1, pagination.page - 1))}
                    disabled={pagination.page === 1 || loading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchPendingReviews(Math.min(pagination.totalPages, pagination.page + 1))}
                    disabled={pagination.page === pagination.totalPages || loading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)}>
        <ModalHeader>Travel Verification Details</ModalHeader>
        <ModalContent>
          {selectedReview && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3">
                {selectedReview.user?.profilePic ? (
                  <img
                    src={selectedReview.user.profilePic}
                    alt={selectedReview.user.fullName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-sm font-semibold">
                    {selectedReview.user?.fullName?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{selectedReview.user?.fullName}</p>
                  <p className="text-sm text-gray-600">@{selectedReview.user?.username}</p>
                  <p className="text-xs text-gray-500">{selectedReview.user?.email}</p>
                </div>
              </div>

              {/* Location */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </p>
                <p className="text-sm">{selectedReview.location?.address}</p>
                <p className="text-sm text-gray-600">
                  {selectedReview.location?.city}, {selectedReview.location?.country}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedReview.location?.continent}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Coords: {selectedReview.location?.coordinates?.latitude?.toFixed(4)}, {selectedReview.location?.coordinates?.longitude?.toFixed(4)}
                </p>
              </div>

              {/* Image */}
              {selectedReview.post?.imageUrl && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Photo</p>
                  <img
                    src={selectedReview.post.imageUrl}
                    alt="Travel content"
                    className="w-full h-80 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Post Details */}
              {selectedReview.post && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Post Details</p>
                  <p className="text-sm">{selectedReview.post.caption || 'No caption'}</p>
                  <p className="text-xs text-gray-500 mt-2">Type: {selectedReview.post.type}</p>
                  <p className="text-xs text-gray-500">Posted: {formatDate(selectedReview.post.createdAt)}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-2">Verification Info</p>
                <p className="text-xs text-blue-800">Source: {selectedReview.source}</p>
                <p className="text-xs text-blue-800">Reason: {selectedReview.verificationReason}</p>
                <p className="text-xs text-blue-800">Submitted: {formatDate(selectedReview.uploadedAt)}</p>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setIsViewModalOpen(false)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)}>
        <ModalHeader>Reject Verification</ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to reject this verification? Please provide a reason.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={4}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => {
              setIsRejectModalOpen(false)
              setRejectReason('')
              setRejectContentId(null)
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading === rejectContentId}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {actionLoading === rejectContentId ? 'Rejecting...' : 'Reject'}
          </button>
        </ModalFooter>
      </Modal>
    </SafeComponent>
  )
}

export default TravelVerification
