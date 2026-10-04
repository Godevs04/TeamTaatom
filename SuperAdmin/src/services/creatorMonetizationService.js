import { api } from './api'
import logger from '../utils/logger'

const BASE = '/api/v1/superadmin/creator-monetization'

const dataOf = (response) => response.data?.data ?? response.data

export const getCreatorProgramSettings = async () => {
  const response = await api.get(`${BASE}/settings`)
  return dataOf(response)
}

export const saveCreatorProgramSettings = async (body) => {
  const response = await api.put(`${BASE}/settings`, body)
  return dataOf(response)
}

export const listMonetizedCreators = async (params) => {
  const response = await api.get(`${BASE}/creators`, { params })
  return dataOf(response)
}

export const getMonetizedCreator = async (userId) => {
  const response = await api.get(`${BASE}/creators/${userId}`)
  return dataOf(response)
}

export const setMonetizedCreatorStatus = async (userId, body) => {
  const response = await api.post(`${BASE}/creators/${userId}/status`, body)
  return dataOf(response)
}

export const setMonetizedCreatorHold = async (userId, body) => {
  const response = await api.post(`${BASE}/creators/${userId}/hold`, body)
  return dataOf(response)
}

export const searchMonetizationVideos = async (params) => {
  const response = await api.get(`${BASE}/videos`, { params })
  return dataOf(response)
}

export const setVideoMonetizationEligibility = async (postId, body) => {
  const response = await api.post(`${BASE}/videos/${postId}/eligibility`, body)
  return dataOf(response)
}

export const listCreatorVerifications = async () => {
  const response = await api.get(`${BASE}/verifications`)
  return dataOf(response)
}

export const reviewCreatorVerification = async (userId, body) => {
  const response = await api.post(`${BASE}/verifications/${userId}`, body)
  return dataOf(response)
}

export const listCreatorWithdrawals = async (status) => {
  const response = await api.get(`${BASE}/withdrawals`, { params: status ? { status } : {} })
  return dataOf(response)
}

export const actOnCreatorWithdrawal = async (id, body) => {
  const response = await api.post(`${BASE}/withdrawals/${id}`, body)
  return dataOf(response)
}

export const listCreatorAdjustments = async () => {
  const response = await api.get(`${BASE}/adjustments`)
  return dataOf(response)
}

export const createCreatorAdjustment = async (body) => {
  try {
    const response = await api.post(`${BASE}/adjustments`, body)
    return dataOf(response)
  } catch (error) {
    logger.error('Creator adjustment failed', error)
    throw error
  }
}
