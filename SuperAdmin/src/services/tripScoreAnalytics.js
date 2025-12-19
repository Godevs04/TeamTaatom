import api from './api'
import logger from '../utils/logger'

/**
 * Get TripScore overall statistics
 */
export const getTripScoreStats = async (startDate, endDate) => {
  try {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/tripscore/stats', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch TripScore stats:', error)
    throw error
  }
}

/**
 * Get top users by TripScore
 */
export const getTopUsersByTripScore = async (options = {}) => {
  try {
    const { limit = 10, startDate, endDate } = options
    
    const params = { limit }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/tripscore/top-users', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch top users:', error)
    throw error
  }
}

/**
 * Get suspicious visits
 */
export const getSuspiciousVisits = async (options = {}) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = options
    
    const params = { page, limit }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/tripscore/suspicious-visits', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch suspicious visits:', error)
    throw error
  }
}

/**
 * Get trust level timeline
 */
export const getTrustTimeline = async (options = {}) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = options
    
    const params = { groupBy }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/tripscore/trust-timeline', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch trust timeline:', error)
    throw error
  }
}

/**
 * Get continent breakdown
 */
export const getContinentBreakdown = async (startDate, endDate) => {
  try {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/tripscore/continents', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch continent breakdown:', error)
    throw error
  }
}

/**
 * Get detailed locations breakdown
 */
export const getDetailedLocations = async (options = {}) => {
  try {
    const { startDate, endDate, groupBy = 'location', limit = 100, page = 1 } = options
    
    const params = { groupBy, limit, page }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/tripscore/locations', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch detailed locations:', error)
    throw error
  }
}

/**
 * Get pending TripScore reviews
 */
export const getPendingReviews = async (options = {}) => {
  try {
    const { page = 1, limit = 20 } = options
    
    const params = { page, limit }
    
    const response = await api.get('/api/v1/superadmin/tripscore/review/pending', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch pending reviews:', error)
    throw error
  }
}

/**
 * Approve a TripVisit
 */
export const approveTripVisit = async (tripVisitId) => {
  try {
    const response = await api.post(`/api/v1/superadmin/tripscore/review/${tripVisitId}/approve`)
    return response.data
  } catch (error) {
    logger.error('Failed to approve TripVisit:', error)
    throw error
  }
}

/**
 * Reject a TripVisit
 */
export const rejectTripVisit = async (tripVisitId) => {
  try {
    const response = await api.post(`/api/v1/superadmin/tripscore/review/${tripVisitId}/reject`)
    return response.data
  } catch (error) {
    logger.error('Failed to reject TripVisit:', error)
    throw error
  }
}

