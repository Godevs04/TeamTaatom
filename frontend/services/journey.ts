import api from './api';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

export interface Coordinate {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

export interface Journey {
  _id: string;
  userId: string;
  startCoords: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  description?: string;
  sourceUserId?: string;
  status: 'active' | 'paused' | 'completed';
  polyline: Coordinate[];
  waypoints: Array<{
    postId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    type: 'photo' | 'video';
  }>;
  distance: number; // in meters
  duration: number; // in seconds
  startTime: string;
  pausedTime?: string;
  resumedTime?: string;
  completedTime?: string;
  autoEndAt?: string; // 24hr countdown timestamp
  createdAt: string;
  updatedAt: string;
}

export interface JourneyListResponse {
  journeys: Journey[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalJourneys: number;
    hasNextPage: boolean;
    limit: number;
  };
}

/**
 * Start a new journey
 * @param startCoords Starting coordinates
 * @param title Optional journey title
 * @param sourceUserId Optional source user ID for viewing others' journeys
 */
export const startJourney = async (
  startCoords: { lat: number; lng: number },
  title?: string,
  sourceUserId?: string
): Promise<{ journey: Journey }> => {
  try {
    const payload: any = {
      startCoords: {
        lat: startCoords.lat,
        lng: startCoords.lng,
      },
    };
    if (title) payload.title = title;
    if (sourceUserId) payload.sourceUserId = sourceUserId;

    const response = await api.post('/api/v1/journey/start', payload);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('startJourney', parsedError);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Pause an active journey
 * @param journeyId Journey ID to pause
 */
export const pauseJourney = async (journeyId: string): Promise<{ journey: Journey }> => {
  try {
    const response = await api.post(`/api/v1/journey/${journeyId}/pause`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('pauseJourney', parsedError);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Resume a paused journey
 * @param journeyId Journey ID to resume
 */
export const resumeJourney = async (journeyId: string): Promise<{ journey: Journey }> => {
  try {
    const response = await api.post(`/api/v1/journey/${journeyId}/resume`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('resumeJourney', parsedError);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Send batch GPS coordinates to update journey location
 * @param journeyId Journey ID to update
 * @param coordinates Array of coordinates with timestamp and accuracy
 */
export const updateJourneyLocation = async (
  journeyId: string,
  coordinates: Coordinate[]
): Promise<{ journey: Journey }> => {
  try {
    // Map latitude/longitude to lat/lng for backend
    const mappedCoords = coordinates.map(c => ({
      lat: c.latitude,
      lng: c.longitude,
      timestamp: c.timestamp,
      accuracy: c.accuracy,
    }));
    const response = await api.put(`/api/v1/journey/${journeyId}/location`, {
      coordinates: mappedCoords,
    });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('updateJourneyLocation', parsedError);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Complete a journey
 * @param journeyId Journey ID to complete
 */
export const completeJourney = async (journeyId: string): Promise<{ journey: Journey }> => {
  try {
    const response = await api.post(`/api/v1/journey/${journeyId}/complete`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('completeJourney', parsedError);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Get the current user's active journey
 */
export const getActiveJourney = async (): Promise<{ journey: Journey | null }> => {
  try {
    const response = await api.get('/api/v1/journey/active');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('getActiveJourney', parsedError);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Get a specific journey by ID
 * @param journeyId Journey ID
 */
export const getJourneyDetail = async (journeyId: string): Promise<{ journey: Journey }> => {
  try {
    const response = await api.get(`/api/v1/journey/${journeyId}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('getJourneyDetail', parsedError);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Get a user's journeys
 * @param userId User ID
 * @param page Page number (default 1)
 * @param limit Results per page (default 20)
 */
export const getUserJourneys = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
  includePolyline: boolean = false
): Promise<JourneyListResponse> => {
  try {
    const params: any = { page, limit };
    if (includePolyline) params.includePolyline = 'true';
    const response = await api.get(`/api/v1/journey/user/${userId}`, {
      params,
    });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    logger.error('getUserJourneys', parsedError);
    throw new Error(parsedError.userMessage);
  }
};
