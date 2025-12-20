/**
 * Frontend input sanitization utility for XSS prevention
 * Works across React Native (iOS, Android) and Web platforms
 */

/**
 * Sanitize a string by removing potentially dangerous characters
 * This is a basic sanitization - backend also sanitizes all inputs
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeString = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove script tags and event handlers
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers like onclick="..."
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:text\/html/gi, '') // Remove data URIs with HTML
    .trim();

  // For React Native, we don't render HTML, so we can be more aggressive
  // Remove all HTML tags (React Native Text component doesn't render HTML anyway)
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  return sanitized;
};

/**
 * Sanitize hashtag - only allow alphanumeric and underscore
 * @param hashtag - Hashtag string (with or without #)
 * @returns Sanitized hashtag
 */
export const sanitizeHashtag = (hashtag: string): string => {
  if (!hashtag || typeof hashtag !== 'string') {
    return '';
  }

  // Remove # if present, sanitize, then add back
  const withoutHash = hashtag.replace(/^#/, '');
  const sanitized = withoutHash.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Limit length
  const limited = sanitized.slice(0, 50);
  
  return limited ? `#${limited}` : '';
};

/**
 * Sanitize username - only allow alphanumeric, underscore, and dot
 * @param username - Username string
 * @returns Sanitized username
 */
export const sanitizeUsername = (username: string): string => {
  if (!username || typeof username !== 'string') {
    return '';
  }

  // Only allow alphanumeric, underscore, and dot
  const sanitized = username.replace(/[^a-zA-Z0-9._]/g, '');
  
  // Limit length
  return sanitized.slice(0, 30);
};

/**
 * Sanitize mention - extract username from mention text
 * @param mention - Mention string (with or without @)
 * @returns Sanitized username
 */
export const sanitizeMention = (mention: string): string => {
  if (!mention || typeof mention !== 'string') {
    return '';
  }

  // Remove @ if present, sanitize
  const withoutAt = mention.replace(/^@/, '');
  return sanitizeUsername(withoutAt);
};

/**
 * Sanitize text content for display (removes HTML but preserves line breaks)
 * @param text - Text to sanitize
 * @returns Sanitized text safe for display
 */
export const sanitizeTextContent = (text: string | null | undefined): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove script tags and dangerous content
  let sanitized = sanitizeString(text);

  // Preserve line breaks by converting <br> to newlines (if any)
  sanitized = sanitized.replace(/<br\s*\/?>/gi, '\n');

  return sanitized;
};

/**
 * Sanitize an object recursively (for form data)
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Skip files and binary data
        if (obj[key] instanceof File || obj[key] instanceof Blob) {
          sanitized[key] = obj[key];
        } else {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * Validate and sanitize caption before submission
 * @param caption - Caption text
 * @returns Sanitized caption or null if invalid
 */
export const validateAndSanitizeCaption = (caption: string): string | null => {
  if (!caption || typeof caption !== 'string') {
    return null;
  }

  const sanitized = sanitizeTextContent(caption.trim());
  
  // Validate length (backend also validates, but defense in depth)
  if (sanitized.length === 0) {
    return null;
  }
  
  if (sanitized.length > 1000) {
    return sanitized.slice(0, 1000);
  }

  return sanitized;
};

/**
 * Validate and sanitize comment before submission
 * @param comment - Comment text
 * @returns Sanitized comment or null if invalid
 */
export const validateAndSanitizeComment = (comment: string): string | null => {
  if (!comment || typeof comment !== 'string') {
    return null;
  }

  const sanitized = sanitizeTextContent(comment.trim());
  
  // Validate length
  if (sanitized.length === 0) {
    return null;
  }
  
  if (sanitized.length > 500) {
    return sanitized.slice(0, 500);
  }

  return sanitized;
};

/**
 * Extract and sanitize hashtags from text
 * @param text - Text containing hashtags
 * @returns Array of sanitized hashtags
 */
export const extractAndSanitizeHashtags = (text: string): string[] => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match hashtags (word starting with #)
  const hashtagRegex = /#[\w]+/g;
  const matches = text.match(hashtagRegex) || [];
  
  // Sanitize each hashtag and remove duplicates
  const sanitized = matches
    .map(tag => sanitizeHashtag(tag))
    .filter(tag => tag.length > 1) // Remove empty hashtags
    .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates

  return sanitized;
};

/**
 * Extract and sanitize mentions from text
 * @param text - Text containing mentions
 * @returns Array of sanitized usernames (without @)
 */
export const extractAndSanitizeMentions = (text: string): string[] => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match mentions (word starting with @)
  const mentionRegex = /@[\w.]+/g;
  const matches = text.match(mentionRegex) || [];
  
  // Sanitize each mention and remove duplicates
  const sanitized = matches
    .map(mention => sanitizeMention(mention))
    .filter(username => username.length > 0) // Remove empty usernames
    .filter((username, index, self) => self.indexOf(username) === index); // Remove duplicates

  return sanitized;
};

