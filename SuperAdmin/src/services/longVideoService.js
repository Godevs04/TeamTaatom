import api from './api'
import logger from '../utils/logger'

const CREATORS = '/api/v1/superadmin/video-creators'
const VIDEOS = '/api/v1/superadmin/long-videos'

export const getCreatorRequests = async ({
  search = '',
  page = 1,
  limit = 20,
  status = 'pending',
} = {}) => {
  try {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    params.append('page', String(page))
    params.append('limit', String(limit))
    if (status) params.append('status', status)
    const response = await api.get(`${CREATORS}?${params.toString()}`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Error fetching creator requests:', error)
    throw error
  }
}

export const approveCreatorRequest = async (id, note = '') => {
  try {
    const response = await api.post(`${CREATORS}/${id}/approve`, { note })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Error approving creator:', error)
    throw error
  }
}

export const rejectCreatorRequest = async (id, reason = '') => {
  try {
    const response = await api.post(`${CREATORS}/${id}/reject`, { reason, note: reason })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Error rejecting creator:', error)
    throw error
  }
}

export const getLongVideos = async ({ search = '', page = 1, limit = 20, isActive } = {}) => {
  try {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    params.append('page', String(page))
    params.append('limit', String(limit))
    if (isActive === true || isActive === false) {
      params.append('isActive', String(isActive))
    }
    const response = await api.get(`${VIDEOS}?${params.toString()}`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Error fetching long videos:', error)
    throw error
  }
}

export const updateLongVideo = async (id, payload) => {
  try {
    const response = await api.patch(`${VIDEOS}/${id}`, payload)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Error updating long video:', error)
    throw error
  }
}

export const deleteLongVideo = async (id) => {
  try {
    const response = await api.delete(`${VIDEOS}/${id}`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Error deleting long video:', error)
    throw error
  }
}
