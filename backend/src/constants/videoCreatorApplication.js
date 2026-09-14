/**
 * Shared creator application schema for mobile/web/admin.
 * Keep labels stable — stored answers are keyed by field id.
 */
const CONTENT_NICHES = [
  { value: 'travel_vlogs', label: 'Travel vlogs' },
  { value: 'destination_guides', label: 'Destination guides' },
  { value: 'adventure_sports', label: 'Adventure & sports' },
  { value: 'culture_food', label: 'Culture & food' },
  { value: 'lifestyle_storytelling', label: 'Lifestyle storytelling' },
  { value: 'other', label: 'Other' },
];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner (just starting)' },
  { value: 'intermediate', label: 'Intermediate (some published work)' },
  { value: 'pro', label: 'Pro / full-time creator' },
];

const POSTING_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly or more' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'occasional', label: 'Occasional / project-based' },
];

const APPLICATION_FIELDS = [
  {
    id: 'contentNiche',
    label: 'What long-form content will you upload?',
    type: 'select',
    required: true,
    options: CONTENT_NICHES,
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
    options: EXPERIENCE_LEVELS,
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
    options: POSTING_FREQUENCIES,
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

const ALLOWED = {
  contentNiche: new Set(CONTENT_NICHES.map((o) => o.value)),
  experienceLevel: new Set(EXPERIENCE_LEVELS.map((o) => o.value)),
  postingFrequency: new Set(POSTING_FREQUENCIES.map((o) => o.value)),
};

function trimStr(v, max) {
  return String(v ?? '')
    .trim()
    .slice(0, max);
}

/**
 * Validate + normalize application payload from client.
 * @returns {{ ok: true, application: object } | { ok: false, message: string }}
 */
function validateCreatorApplication(body = {}) {
  const src = body.application && typeof body.application === 'object' ? body.application : body;

  const contentNiche = trimStr(src.contentNiche, 40);
  if (!ALLOWED.contentNiche.has(contentNiche)) {
    return { ok: false, message: 'Please select a content niche' };
  }

  const contentNicheOther =
    contentNiche === 'other' ? trimStr(src.contentNicheOther, 120) : '';
  if (contentNiche === 'other' && contentNicheOther.length < 2) {
    return { ok: false, message: 'Please describe your niche' };
  }

  const experienceLevel = trimStr(src.experienceLevel, 40);
  if (!ALLOWED.experienceLevel.has(experienceLevel)) {
    return { ok: false, message: 'Please select your experience level' };
  }

  const sampleLinks = trimStr(src.sampleLinks, 800);
  if (sampleLinks.length < 8) {
    return { ok: false, message: 'Please share at least one sample video link' };
  }

  const postingFrequency = trimStr(src.postingFrequency, 40);
  if (!ALLOWED.postingFrequency.has(postingFrequency)) {
    return { ok: false, message: 'Please select a posting frequency' };
  }

  const audienceRegions = trimStr(src.audienceRegions, 200);
  if (audienceRegions.length < 2) {
    return { ok: false, message: 'Please list the regions or destinations you cover' };
  }

  const equipment = trimStr(src.equipment, 200);
  const whyTaatom = trimStr(src.whyTaatom, 500);
  if (whyTaatom.length < 10) {
    return { ok: false, message: 'Please tell us why you want to create on TAATOM (min 10 characters)' };
  }

  const guidelinesAccepted =
    src.guidelinesAccepted === true ||
    src.guidelinesAccepted === 'true' ||
    src.guidelinesAccepted === 1 ||
    src.guidelinesAccepted === '1';
  if (!guidelinesAccepted) {
    return { ok: false, message: 'You must accept the community guidelines to apply' };
  }

  const message = trimStr(src.message || body.message || whyTaatom, 500);

  return {
    ok: true,
    application: {
      contentNiche,
      contentNicheOther,
      experienceLevel,
      sampleLinks,
      postingFrequency,
      audienceRegions,
      equipment,
      whyTaatom,
      guidelinesAccepted: true,
      submittedAt: new Date(),
    },
    message,
  };
}

function labelFor(fieldId, value) {
  const field = APPLICATION_FIELDS.find((f) => f.id === fieldId);
  if (!field?.options) return value;
  return field.options.find((o) => o.value === value)?.label || value;
}

module.exports = {
  APPLICATION_FIELDS,
  CONTENT_NICHES,
  EXPERIENCE_LEVELS,
  POSTING_FREQUENCIES,
  validateCreatorApplication,
  labelFor,
};
