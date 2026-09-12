import api from './api';
import { parseError } from '../utils/errorCodes';

export type VideoCreatorStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type CreatorStatusResponse = {
  status: VideoCreatorStatus;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string;
  canUpload: boolean;
};

export async function getVideoCreatorStatus(): Promise<CreatorStatusResponse> {
  try {
    const res = await api.get('/api/v1/video-creator/status');
    const data = res.data;
    return {
      status: data.status || 'none',
      requestedAt: data.requestedAt,
      reviewedAt: data.reviewedAt,
      reviewNote: data.reviewNote || '',
      canUpload: !!data.canUpload,
    };
  } catch (error: any) {
    throw new Error(parseError(error).userMessage);
  }
}

export async function requestVideoCreatorAccess(message = ''): Promise<CreatorStatusResponse> {
  try {
    const res = await api.post('/api/v1/video-creator/request', { message });
    const data = res.data;
    return {
      status: data.status || 'pending',
      requestedAt: data.requestedAt,
      reviewedAt: data.reviewedAt,
      reviewNote: data.reviewNote || '',
      canUpload: !!data.canUpload,
    };
  } catch (error: any) {
    throw new Error(parseError(error).userMessage);
  }
}
