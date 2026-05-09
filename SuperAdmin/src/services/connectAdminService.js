import { api } from './api'
import logger from '../utils/logger'

const BASE = '/api/v1/superadmin'

// List user-created Connect pages with subscriber counts
export const getConnectPagesList = async ({ page = 1, limit = 20, search = '', status } = {}) => {
  try {
    const params = { page, limit }
    if (search) params.search = search
    if (status) params.status = status
    const response = await api.get(`${BASE}/connect-pages`, { params })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch connect pages:', error)
    throw error
  }
}

// Drill-in: subscribers for a specific Connect page
export const getConnectPageSubscribers = async (pageId) => {
  try {
    const response = await api.get(`${BASE}/connect-pages/${pageId}/subscribers`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch connect page subscribers:', error)
    throw error
  }
}
