/**
 * Map free-text Category / Subcategory from editorial datasets
 * to Taatom admin spotTypes.
 */
const CANONICAL = [
  'Historical spots',
  'Cultural spots',
  'Natural spots',
  'Adventure spots',
  'Religious/spiritual spots',
  'Wildlife spots',
  'Beach spots',
];

const KEYWORD_MAP = [
  { re: /\b(beach|island|sea|riviera)\b/i, type: 'Beach spots' },
  { re: /\b(wildlife|bird)\b/i, type: 'Wildlife spots' },
  { re: /\b(mosque|basilica|sanctuary|temple|religious|spiritual)\b/i, type: 'Religious/spiritual spots' },
  { re: /\b(ski|trek|trekking|adventure|climb|peak)\b/i, type: 'Adventure spots' },
  {
    re: /\b(monument|archaeolog|historic|palace|fort|castle|ruin|amphitheatre|citadel)\b/i,
    type: 'Historical spots',
  },
  { re: /\b(garden|cultural|architecture|ottoman|old\s*city|casbah)\b/i, type: 'Cultural spots' },
  {
    re: /\b(valley|national\s*park|lake|mountain|coast|desert|oasis|forest|waterfall|natural|park)\b/i,
    type: 'Natural spots',
  },
];

function mapSpotTypes({ spotTypes, categoryRaw, subcategoryRaw } = {}) {
  const out = new Set();

  const pushToken = (t) => {
    const s = String(t || '').trim();
    if (!s) return;
    const exact = CANONICAL.find((c) => c.toLowerCase() === s.toLowerCase());
    if (exact) out.add(exact);
  };

  if (spotTypes) {
    String(spotTypes)
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(pushToken);
  }

  const blob = [categoryRaw, subcategoryRaw].filter(Boolean).join(' ');
  if (blob) {
    for (const { re, type } of KEYWORD_MAP) {
      if (re.test(blob)) out.add(type);
    }
  }

  return [...out];
}

module.exports = { CANONICAL, mapSpotTypes };
