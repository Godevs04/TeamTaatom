/**
 * Utility functions for extracting and processing hashtags from text
 */

/**
 * Extract hashtags from a text string
 * @param {string} text - The text to extract hashtags from
 * @returns {string[]} - Array of unique hashtags (without # symbol, lowercase)
 */
const extractHashtags = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match hashtags: # followed by alphanumeric characters, underscores, and emojis
  // Regex: #[\w\u{1F300}-\u{1F9FF}]+ (supports Unicode emojis)
  const hashtagRegex = /#[\w\u{1F300}-\u{1F9FF}]+/gu;
  const matches = text.match(hashtagRegex);

  if (!matches) {
    return [];
  }

  // Remove # symbol, convert to lowercase, and get unique values
  const hashtags = matches
    .map(tag => tag.substring(1).toLowerCase().trim())
    .filter(tag => tag.length > 0 && tag.length <= 100); // Max 100 chars per hashtag

  // Return unique hashtags
  return [...new Set(hashtags)];
};

/**
 * Replace hashtags in text with formatted versions (for display)
 * @param {string} text - The text containing hashtags
 * @returns {string} - Text with hashtags preserved
 */
const preserveHashtags = (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }
  // Just return the text as-is, hashtags are already in the format #hashtag
  return text;
};

/**
 * Validate hashtag format
 * @param {string} hashtag - The hashtag to validate (without #)
 * @returns {boolean} - True if valid
 */
const isValidHashtag = (hashtag) => {
  if (!hashtag || typeof hashtag !== 'string') {
    return false;
  }
  // Hashtag should be 1-100 characters, alphanumeric, underscores, and emojis
  const hashtagRegex = /^[\w\u{1F300}-\u{1F9FF}]{1,100}$/u;
  return hashtagRegex.test(hashtag);
};

/**
 * Format hashtag for display (add # symbol)
 * @param {string} hashtag - The hashtag (without #)
 * @returns {string} - Formatted hashtag with #
 */
const formatHashtag = (hashtag) => {
  if (!hashtag) return '';
  return hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
};

module.exports = {
  extractHashtags,
  preserveHashtags,
  isValidHashtag,
  formatHashtag,
};

