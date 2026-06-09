const { extractHashtags } = require('./hashtagExtractor');

// Dictionary of keyword matches to tags
const KEYWORD_TAG_MAP = {
  // Travel & Adventure
  travel: ['travel', 'adventure'],
  trip: ['travel', 'adventure'],
  journey: ['travel', 'adventure'],
  explore: ['travel', 'adventure'],
  exploring: ['travel', 'adventure'],
  tour: ['travel', 'adventure'],
  vacation: ['travel', 'adventure'],
  holiday: ['travel', 'adventure'],
  solo: ['travel', 'solo'],
  backpack: ['travel', 'backpacker'],
  backpacker: ['travel', 'backpacker'],
  backpacking: ['travel', 'backpacker'],
  
  // Outdoor & Geography
  mountain: ['mountains', 'nature', 'adventure'],
  mountains: ['mountains', 'nature', 'adventure'],
  trek: ['mountains', 'hiking', 'adventure'],
  hiking: ['mountains', 'hiking', 'adventure'],
  hike: ['mountains', 'hiking', 'adventure'],
  climb: ['mountains', 'hiking', 'adventure'],
  climbing: ['mountains', 'hiking', 'adventure'],
  summit: ['mountains', 'adventure'],
  peak: ['mountains', 'adventure'],
  himalayas: ['travel', 'mountains', 'adventure', 'nature'],
  alps: ['travel', 'mountains', 'adventure', 'nature'],
  nature: ['nature', 'outdoors'],
  natural: ['nature', 'outdoors'],
  outdoors: ['nature', 'outdoors'],
  forest: ['nature', 'outdoors'],
  river: ['nature', 'outdoors'],
  lake: ['nature', 'outdoors'],
  waterfall: ['nature', 'outdoors'],
  sea: ['nature', 'beach'],
  ocean: ['nature', 'beach'],
  beach: ['beach', 'nature'],
  beaches: ['beach', 'nature'],
  sand: ['beach', 'nature'],
  surf: ['beach', 'adventure'],
  camping: ['camping', 'nature', 'outdoors'],
  camp: ['camping', 'nature', 'outdoors'],
  bonfire: ['camping', 'nature', 'outdoors'],
  tent: ['camping', 'nature', 'outdoors'],

  // Transport
  bike: ['bike', 'adventure'],
  bicycle: ['bike', 'adventure'],
  cycle: ['bike', 'adventure'],
  cycling: ['bike', 'adventure'],
  ride: ['bike', 'adventure'],
  riding: ['bike', 'adventure'],
  motorcycle: ['bike', 'adventure'],
  drive: ['roadtrip', 'travel'],
  driving: ['roadtrip', 'travel'],
  roadtrip: ['roadtrip', 'travel', 'adventure'],
  car: ['roadtrip', 'travel'],
  flight: ['travel'],
  plane: ['travel'],
  train: ['travel'],
  boat: ['adventure'],

  // Food & Beverage
  food: ['food', 'cuisine'],
  eat: ['food', 'cuisine'],
  eating: ['food', 'cuisine'],
  delicious: ['food', 'cuisine'],
  restaurant: ['food', 'dining'],
  cafe: ['food', 'dining'],
  dinner: ['food', 'cuisine'],
  lunch: ['food', 'cuisine'],
  breakfast: ['food', 'cuisine'],
  cooking: ['food', 'cooking'],
  recipe: ['food', 'cooking'],
  streetfood: ['food', 'culture'],
  chef: ['food', 'cooking'],
  coffee: ['food', 'cafe'],
  tea: ['food', 'cafe'],

  // Fitness & Sports
  fitness: ['fitness', 'health'],
  gym: ['fitness', 'health'],
  workout: ['fitness', 'health'],
  exercise: ['fitness', 'health'],
  run: ['fitness', 'sports'],
  running: ['fitness', 'sports'],
  sports: ['sports'],
  swim: ['sports', 'nature'],
  swimming: ['sports', 'nature'],
  yoga: ['fitness', 'health'],

  // Culture & Art
  art: ['art', 'culture'],
  museum: ['art', 'culture'],
  gallery: ['art', 'culture'],
  history: ['culture', 'history'],
  historical: ['culture', 'history'],
  culture: ['culture'],
  cultural: ['culture'],
  heritage: ['culture', 'history'],
  temple: ['culture', 'history'],
  church: ['culture', 'history'],
  local: ['culture'],
  tradition: ['culture'],
  traditional: ['culture'],

  // Tech & Innovation
  tech: ['technology', 'tech'],
  technology: ['technology', 'tech'],
  gadget: ['technology', 'tech'],
  phone: ['technology', 'tech'],
  coding: ['technology', 'tech'],
  software: ['technology', 'tech'],
  computer: ['technology', 'tech'],
  ai: ['technology', 'tech']
};

/**
 * Extracts tags automatically from a description/caption using a rule-based NLP approach.
 * Falls back to extracting general tags, hashtags, and merging them.
 * 
 * @param {string} text - The description or caption text
 * @returns {string[]} - Array of unique lowercased tags
 */
const extractAITags = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 1. Extract regular hashtags first (e.g. #travel -> 'travel')
  const hashtags = extractHashtags(text);

  // 2. Clean and tokenize text (lowercase, remove punctuation, split by whitespace)
  const cleanedText = text
    .toLowerCase()
    .replace(/[^\w\s\u{1F300}-\u{1F9FF}]/gu, ' ') // Preserve emojis but remove punctuation
    .trim();
  
  const tokens = cleanedText.split(/\s+/).filter(token => token.length > 1);

  // 3. Match tokens against the keyword map
  const derivedTags = new Set(hashtags);
  
  for (const token of tokens) {
    // Direct match
    if (KEYWORD_TAG_MAP[token]) {
      KEYWORD_TAG_MAP[token].forEach(tag => derivedTags.add(tag));
    }
    
    // Simple plural/singular match (e.g. "bikes" -> match "bike")
    if (token.endsWith('s') && token.length > 2) {
      const singular = token.slice(0, -1);
      if (KEYWORD_TAG_MAP[singular]) {
        KEYWORD_TAG_MAP[singular].forEach(tag => derivedTags.add(tag));
      }
    }
  }

  // 4. Return unique tags as an array
  return [...derivedTags];
};

module.exports = {
  extractAITags,
  KEYWORD_TAG_MAP
};
