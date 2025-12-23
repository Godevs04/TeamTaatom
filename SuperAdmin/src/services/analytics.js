import api from './api'
import logger from '../utils/logger'

/**
 * Get analytics summary (KPIs: DAU, MAU, engagement rate, crash count)
 */
export const getAnalyticsSummary = async (startDate, endDate) => {
  try {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/analytics/summary', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch analytics summary:', error)
    throw error
  }
}

/**
 * Get time series data for charts
 */
export const getTimeSeriesData = async (options = {}) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      platform,
      groupBy = 'day'
    } = options
    
    const params = { groupBy }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    if (eventType) params.eventType = eventType
    if (platform) params.platform = platform
    
    const response = await api.get('/api/v1/superadmin/analytics/timeseries', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch time series data:', error)
    throw error
  }
}

/**
 * Get event breakdown by type, platform, etc.
 */
export const getEventBreakdown = async (options = {}) => {
  try {
    const {
      startDate,
      endDate,
      groupBy = 'event'
    } = options
    
    const params = { groupBy }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/analytics/breakdown', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch event breakdown:', error)
    throw error
  }
}

/**
 * Get top features usage
 */
export const getTopFeatures = async (options = {}) => {
  try {
    const {
      startDate,
      endDate,
      limit = 10
    } = options
    
    const params = { limit }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/analytics/features', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch top features:', error)
    throw error
  }
}

/**
 * Get drop-off points
 */
export const getDropOffPoints = async (options = {}) => {
  try {
    const {
      startDate,
      endDate,
      limit = 10
    } = options
    
    const params = { limit }
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/analytics/dropoffs', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch drop-off points:', error)
    throw error
  }
}

/**
 * Get recent events with pagination
 */
export const getRecentEvents = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 50,
      eventType,
      platform,
      startDate,
      endDate,
      search
    } = options
    
    const params = { page, limit }
    if (eventType) params.eventType = eventType
    if (platform) params.platform = platform
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    if (search) params.search = search
    
    const response = await api.get('/api/v1/superadmin/analytics/events', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch recent events:', error)
    throw error
  }
}

/**
 * Get user retention data
 */
export const getUserRetention = async (startDate, endDate) => {
  try {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    
    const response = await api.get('/api/v1/superadmin/analytics/retention', { params })
    return response.data
  } catch (error) {
    logger.error('Failed to fetch user retention:', error)
    throw error
  }
}

