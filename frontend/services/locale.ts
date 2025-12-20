import api from './api';
import { createLogger } from '../utils/logger';
import { parseError } from '../utils/errorCodes';

const logger = createLogger('LocaleService');

export interface Locale {
  _id: string;
  name: string;
  country?: string;
  countryCode: string;
  stateProvince?: string;
  stateCode?: string;
  description?: string;
  imageUrl: string;
  spotTypes?: string[];
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  displayOrder?: number;
  createdAt: string;
}

export interface LocalesResponse {
  success: boolean;
  message: string;
  locales: Locale[];
  pagination: {
    currentPage: number;
    totalPages: number;
    total: number;
    limit: number;
  };
}

/**
 * Get all active locales from backend
 * @param {string} search - Search query
 * @param {string} countryCode - Optional country code filter
 * @param {string} spotType - Optional spot type filter
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {boolean} includeInactive - Whether to include inactive locales
 * @returns {Promise<LocalesResponse>} Locales array with pagination
 */
export const getLocales = async (
  search: string = '',
  countryCode: string = '',
  spotType: string = '',
  page: number = 1,
  limit: number = 50,
  includeInactive: boolean = false
): Promise<LocalesResponse> => {
  try {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    if (countryCode && countryCode !== 'all') {
      params.append('countryCode', countryCode);
    }
    if (spotType && spotType !== 'all') {
      params.append('spotType', spotType);
    }
    if (includeInactive) {
      params.append('includeInactive', 'true');
    }

    const response = await api.get(`/api/v1/locales?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    logger.error('Error fetching locales:', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Get locale by ID
 * @param {string} id - Locale ID
 * @returns {Promise<Locale>} Locale data
 */
export const getLocaleById = async (id: string): Promise<Locale> => {
  try {
    const response = await api.get(`/api/v1/locales/${id}`);
    return response.data.locale;
  } catch (error: any) {
    logger.error('Error fetching locale:', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

