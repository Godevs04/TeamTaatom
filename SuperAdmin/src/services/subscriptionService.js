import { api } from './api'
import logger from '../utils/logger'

const BASE = '/api/v1/superadmin'

// Fetch subscription stats overview
export const getSubscriptionStats = async () => {
  try {
    const response = await api.get(`${BASE}/subscription-stats`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch subscription stats:', error)
    throw error
  }
}

// Fetch subscription approval list
export const getSubscriptionApprovals = async ({ status = 'pending', page = 1, limit = 20 } = {}) => {
  try {
    const response = await api.get(`${BASE}/subscription-approvals`, {
      params: { status, page, limit }
    })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch subscription approvals:', error)
    throw error
  }
}

// Approve a subscription price
export const approveSubscription = async (pageId) => {
  try {
    const response = await api.put(`${BASE}/subscription-approvals/${pageId}/approve`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to approve subscription:', error)
    throw error
  }
}

// Reject a subscription price
export const rejectSubscription = async (pageId, reason) => {
  try {
    const response = await api.put(`${BASE}/subscription-approvals/${pageId}/reject`, { reason })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to reject subscription:', error)
    throw error
  }
}

// Fetch payouts list
export const getPayouts = async ({ status, month, year, page = 1, limit = 20 } = {}) => {
  try {
    const params = { page, limit }
    if (status) params.status = status
    if (month) params.month = month
    if (year) params.year = year

    const response = await api.get(`${BASE}/payouts`, { params })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch payouts:', error)
    throw error
  }
}
