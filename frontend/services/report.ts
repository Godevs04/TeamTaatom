/**
 * Report service - Apple Guideline 1.2 UGC compliance
 */
import api from './api';
import { parseError } from '../utils/errorCodes';

export type ReportType = 'inappropriate_content' | 'spam' | 'harassment' | 'abuse' | 'fake_account' | 'user' | 'other';

export interface CreateReportParams {
  type: ReportType;
  reportedUserId: string;
  postId?: string;
  reason: string;
}

export const createReport = async (params: CreateReportParams): Promise<{ reportId: string }> => {
  try {
    const response = await api.post('/api/v1/reports', params);
    return { reportId: response.data?.reportId || response.data?.data?.reportId };
  } catch (error: any) {
    const parsed = parseError(error);
    throw new Error(parsed.userMessage || 'Failed to submit report');
  }
};
