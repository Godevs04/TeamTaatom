import api from './api';
import { parseError } from '../utils/errorCodes';

export type VideoCreatorStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type ApplicationField = {
  id: string;
  label: string;
  type: 'select' | 'text' | 'textarea' | 'checkbox';
  required?: boolean;
  helper?: string;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  requiredWhen?: { field: string; equals: string };
};

export type CreatorApplicationPayload = {
  contentNiche: string;
  contentNicheOther?: string;
  experienceLevel: string;
  sampleLinks: string;
  postingFrequency: string;
  audienceRegions: string;
  equipment?: string;
  whyTaatom: string;
  guidelinesAccepted: boolean;
};

export type CreatorStatusResponse = {
  status: VideoCreatorStatus;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string;
  rejectionReason?: string;
  canUpload: boolean;
  canReapply?: boolean;
  applicationFields?: ApplicationField[];
  latestRequest?: Record<string, unknown> | null;
};

const FALLBACK_FIELDS: ApplicationField[] = [
  {
    id: 'contentNiche',
    label: 'What long-form content will you upload?',
    type: 'select',
    required: true,
    options: [
      { value: 'travel_vlogs', label: 'Travel vlogs' },
      { value: 'destination_guides', label: 'Destination guides' },
      { value: 'adventure_sports', label: 'Adventure & sports' },
      { value: 'culture_food', label: 'Culture & food' },
      { value: 'lifestyle_storytelling', label: 'Lifestyle storytelling' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'contentNicheOther',
    label: 'If other, describe your niche',
    type: 'text',
    requiredWhen: { field: 'contentNiche', equals: 'other' },
    maxLength: 120,
  },
  {
    id: 'experienceLevel',
    label: 'How much experience do you have with long-form video?',
    type: 'select',
    required: true,
    options: [
      { value: 'beginner', label: 'Beginner (just starting)' },
      { value: 'intermediate', label: 'Intermediate (some published work)' },
      { value: 'pro', label: 'Pro / full-time creator' },
    ],
  },
  {
    id: 'sampleLinks',
    label: 'Sample video links (1–3 URLs)',
    helper: 'YouTube, Instagram, Drive, Vimeo, or personal site',
    type: 'textarea',
    required: true,
    maxLength: 800,
  },
  {
    id: 'postingFrequency',
    label: 'How often do you plan to post on Videos?',
    type: 'select',
    required: true,
    options: [
      { value: 'weekly', label: 'Weekly or more' },
      { value: 'biweekly', label: 'Every 2 weeks' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'occasional', label: 'Occasional / project-based' },
    ],
  },
  {
    id: 'audienceRegions',
    label: 'Primary destinations / regions you cover',
    type: 'text',
    required: true,
    maxLength: 200,
  },
  {
    id: 'equipment',
    label: 'Camera / gear you will use',
    type: 'text',
    required: false,
    maxLength: 200,
  },
  {
    id: 'whyTaatom',
    label: 'Why do you want to create on TAATOM?',
    type: 'textarea',
    required: true,
    maxLength: 500,
  },
  {
    id: 'guidelinesAccepted',
    label: 'I agree to TAATOM community & content guidelines',
    type: 'checkbox',
    required: true,
  },
];

function normalizeStatus(data: any): CreatorStatusResponse {
  return {
    status: data.status || 'none',
    requestedAt: data.requestedAt,
    reviewedAt: data.reviewedAt,
    reviewNote: data.reviewNote || '',
    rejectionReason: data.rejectionReason || '',
    canUpload: !!data.canUpload,
    canReapply: data.canReapply !== false,
    applicationFields: Array.isArray(data.applicationFields)
      ? data.applicationFields
      : FALLBACK_FIELDS,
    latestRequest: data.latestRequest || null,
  };
}

export async function getVideoCreatorStatus(): Promise<CreatorStatusResponse> {
  try {
    const res = await api.get('/api/v1/video-creator/status');
    return normalizeStatus(res.data);
  } catch (error: any) {
    throw new Error(parseError(error).userMessage);
  }
}

export async function getCreatorApplicationForm(): Promise<ApplicationField[]> {
  try {
    const res = await api.get('/api/v1/video-creator/application-form');
    const fields = res.data?.fields;
    return Array.isArray(fields) && fields.length ? fields : FALLBACK_FIELDS;
  } catch {
    return FALLBACK_FIELDS;
  }
}

export async function requestVideoCreatorAccess(
  application: CreatorApplicationPayload | string
): Promise<CreatorStatusResponse> {
  try {
    const body =
      typeof application === 'string'
        ? { message: application }
        : { application, message: application.whyTaatom };
    const res = await api.post('/api/v1/video-creator/request', body);
    return normalizeStatus(res.data);
  } catch (error: any) {
    throw new Error(parseError(error).userMessage);
  }
}

export { FALLBACK_FIELDS };
