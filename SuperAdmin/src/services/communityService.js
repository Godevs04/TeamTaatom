import { api } from './api'
import logger from '../utils/logger'

const BASE = '/api/v1/superadmin'

// Fetch community pages list
export const getCommunityPages = async ({ page = 1, limit = 20, status = 'all' } = {}) => {
  try {
    const response = await api.get(`${BASE}/community-pages`, {
      params: { page, limit, status }
    })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch community pages:', error)
    throw error
  }
}

// Create a new community page
export const createCommunityPage = async (formData) => {
  try {
    const response = await api.post(`${BASE}/community-pages`, formData, {
      timeout: 30000,
    })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to create community page:', error)
    throw error
  }
}

// Update a community page
export const updateCommunityPage = async (pageId, formData) => {
  try {
    const response = await api.put(`${BASE}/community-pages/${pageId}`, formData, {
      timeout: 30000,
    })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to update community page:', error)
    throw error
  }
}

// Delete (archive) a community page
export const deleteCommunityPage = async (pageId) => {
  try {
    const response = await api.delete(`${BASE}/community-pages/${pageId}`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to delete community page:', error)
    throw error
  }
}

// Get content (website + subscription) for a community page
export const getCommunityPageContent = async (pageId) => {
  try {
    const response = await api.get(`${BASE}/community-pages/${pageId}/content`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch community page content:', error)
    throw error
  }
}

// Update content (website and/or subscription) for a community page
export const updateCommunityPageContent = async (
  pageId,
  {
    websiteContent,
    subscriptionContent,
    websiteBackground,
    websiteTextColor,
    subscriptionBackground,
    subscriptionTextColor,
  }
) => {
  try {
    const body = { websiteContent, subscriptionContent }
    if (websiteBackground !== undefined) body.websiteBackground = websiteBackground
    if (websiteTextColor !== undefined) body.websiteTextColor = websiteTextColor
    if (subscriptionBackground !== undefined) body.subscriptionBackground = subscriptionBackground
    if (subscriptionTextColor !== undefined) body.subscriptionTextColor = subscriptionTextColor
    const response = await api.put(`${BASE}/community-pages/${pageId}/content`, body)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to update community page content:', error)
    throw error
  }
}

// Upload an image for content blocks
export const uploadContentImage = async (pageId, file) => {
  try {
    const formData = new FormData()
    formData.append('image', file)
    const response = await api.post(`${BASE}/community-pages/${pageId}/upload-image`, formData, {
      timeout: 60000,
    })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to upload content image:', error?.response?.data || error?.message || error)
    throw error
  }
}

// Fetch all orders for a community page
export const getCommunityPageOrders = async (pageId) => {
  try {
    const response = await api.get(`${BASE}/community-pages/${pageId}/orders`)
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to fetch community page orders:', error)
    throw error
  }
}

// Update the delivery status of an order
export const updateOrderStatus = async (orderId, status) => {
  try {
    const response = await api.put(`${BASE}/orders/${orderId}/status`, { status })
    return response.data?.data || response.data
  } catch (error) {
    logger.error('Failed to update order status:', error)
    throw error
  }
}

