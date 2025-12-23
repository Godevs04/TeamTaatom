import { api } from './api'
import logger from '../utils/logger'
import { parseError } from '../utils/errorCodes'

/**
 * Get query statistics
 */
export const getQueryStats = async () => {
  try {
    const response = await api.get('/api/v1/superadmin/query-stats')
    return response.data.stats
  } catch (error) {
    logger.error('Failed to fetch query statistics:', parseError(error))
    throw error
  }
}

/**
 * Reset query statistics
 */
export const resetQueryStats = async () => {
  try {
    const response = await api.post('/api/v1/superadmin/query-stats/reset')
    return response.data
  } catch (error) {
    logger.error('Failed to reset query statistics:', parseError(error))
    throw error
  }
}

