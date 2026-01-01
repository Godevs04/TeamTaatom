/**
 * Utility to extract mentions from text
 * Mentions are in the format @username
 */

/**
 * Extract mentions from text
 * @param {string} text - Text to extract mentions from
 * @returns {string[]} - Array of usernames (without @)
 */
const extractMentions = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match @username pattern (username can contain letters, numbers, underscores, dots)
  // Username must start with letter or number, and be 3-20 characters
  const mentionRegex = /@([a-z0-9][a-z0-9_.]{2,19})\b/gi;
  const matches = text.match(mentionRegex);
  
  if (!matches) {
    return [];
  }

  // Extract usernames (remove @ symbol) and remove duplicates
  const usernames = matches
    .map(match => match.substring(1).toLowerCase())
    .filter((username, index, self) => self.indexOf(username) === index);

  return usernames;
};

/**
 * Replace mentions in text with formatted HTML/text
 * @param {string} text - Original text
 * @param {Function} replacer - Function to replace mention with formatted text
 * @returns {string} - Text with replaced mentions
 */
const replaceMentions = (text, replacer) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const mentionRegex = /@([a-z0-9][a-z0-9_.]{2,19})\b/gi;
  return text.replace(mentionRegex, (match, username) => {
    return replacer(match, username);
  });
};

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} - True if valid
 */
const isValidUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return false;
  }
  // Username: 3-20 chars, starts with letter/number, contains letters, numbers, underscores, dots
  const usernameRegex = /^[a-z0-9][a-z0-9_.]{2,19}$/i;
  return usernameRegex.test(username);
};

module.exports = {
  extractMentions,
  replaceMentions,
  isValidUsername
};

