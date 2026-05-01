import { api } from './api'
import logger from '../utils/logger'
import { parseError } from '../utils/errorCodes'

export interface PendingReview {
  _id: string
  user: {
    _id: string
    fullName: string
    username: string
    email: string
    profilePic: string | null
  } | null
  post: {
    _id: string
    caption: string
    imageUrl: string | null
    images: string[]
    createdAt: string
    type: 'photo' | 'short'
  } | null
  location: {
    address: string
    city: string
    country: string
    continent: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
  source: string
  verificationReason: string
  uploadedAt: string
  createdAt: string
}

export interface PendingReviewsResponse {
  reviews: PendingReview[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Fetch pending travel verifications for admin review
 */
export const getPendingApprovals = async (
  page: number = 1,
  limit: number = 20
): Promise<PendingReviewsResponse> => {
  try {
    const response = await api.get('/api/v1/superadmin/tripscore/review/pending', {
      params: { page, limit }
    })

    if (!response?.data?.data) {
      throw new Error('Invalid response format')
    }

    return response.data.data
  } catch (error) {
    logger.error('Failed to fetch pending approvals:', error)
    throw parseError(error)
  }
}

/**
 * Approve a travel verification
 */
export const approveVerification = async (contentId: string): Promise<any> => {
  try {
    const response = await api.post(
      `/api/v1/superadmin/tripscore/review/${contentId}/approve`
    )

    if (!response?.data) {
      throw new Error('Invalid response format')
    }

    return response.data
  } catch (error) {
    logger.error('Failed to approve verification:', error)
    throw parseError(error)
  }
}

/**
 * Reject a travel verification with reason
 */
export const rejectVerification = async (
  contentId: string,
  reason?: string
): Promise<any> => {
  try {
    const response = await api.post(
      `/api/v1/superadmin/tripscore/review/${contentId}/reject`,
      { reason }
    )

    if (!response?.data) {
      throw new Error('Invalid response format')
    }

    return response.data
  } catch (error) {
    logger.error('Failed to reject verification:', error)
    throw parseError(error)
  }
}

/**
 * Update trip visit details
 */
export const updateTripVisitDetails = async (
  contentId: string,
  updates: {
    country?: string
    continent?: string
    address?: string
    city?: string
    verificationReason?: string
    lat?: number
    lng?: number
  }
): Promise<any> => {
  try {
    const response = await api.patch(
      `/api/v1/superadmin/tripscore/review/${contentId}`,
      updates
    )

    if (!response?.data) {
      throw new Error('Invalid response format')
    }

    return response.data
  } catch (error) {
    logger.error('Failed to update trip visit:', error)
    throw parseError(error)
  }
}
