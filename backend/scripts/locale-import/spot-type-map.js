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
  { re: /\b(beach|beaches|island|sea|seas|riviera|coastal|harbour|harbor|waterfront|marina)\b/i, type: 'Beach spots' },
  {
    re: /\b(marine|reef|coral|scuba|diving|shark|lagoon|underwater|aquarium|zoo)\b/i,
    type: 'Wildlife spots',
  },
  { re: /\b(wildlife|bird|primate|elephant|penguin|polar)\b/i, type: 'Wildlife spots' },
  {
    // Exclude "marine/shark sanctuary" (wildlife) — those hit the marine rule above
    re: /\b(mosque|basilica|cathedral|abbey|(?<!marine\s)(?<!shark\s)sanctuary|temple|religious|spiritual|monastery|pagoda|church|memorial)\b/i,
    type: 'Religious/spiritual spots',
  },
  {
    re: /\b(ski|trek|trekking|adventure|climb|peak|gondola|canyon|glacier|volcano|mountain|mountains|viewpoint|scenic\s*(route|drive))\b/i,
    type: 'Adventure spots',
  },
  {
    // Stems without trailing \b so Archaeological / Historical match
    re: /\b(monument|monuments|archaeolog\w*|historic\w*|palace|fort|fortress|castle|ruin|amphitheatre|citadel|museum|tower|lighthouse|memorial|ancient\s*city|medieval|engineering|hydraulic|theatre|theater|science\s*center|educational)\b/i,
    type: 'Historical spots',
  },
  {
    re: /\b(garden|cultural|architecture|ottoman|old\s*city|casbah|market|art\s*gallery|art|entertainment|village|wine|spa|wellness|observatory|city\s*landmark|scenic\s*region|leisure)\b/i,
    type: 'Cultural spots',
  },
  {
    re: /\b(valley|national\s*park|park|parks|lake|lakes|mountain|mountains|coast|desert|oasis|forest|forests|waterfall|natural|nature|river|rivers|canal|rock|cave|caves|viewpoint)\b/i,
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
