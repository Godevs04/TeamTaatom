import DOMPurify from 'dompurify'

/**
 * Sanitize HTML string to prevent XSS attacks
 * @param {string} dirty - The HTML string to sanitize
 * @param {object} options - DOMPurify options
 * @returns {string} Sanitized HTML string
 */
export const sanitizeHTML = (dirty, options = {}) => {
  if (!dirty || typeof dirty !== 'string') {
    return ''
  }
  
  const defaultOptions = {
    ALLOWED_TAGS: [], // No HTML tags allowed by default
    ALLOWED_ATTR: [],
    ...options
  }
  
  return DOMPurify.sanitize(dirty, defaultOptions)
}

/**
 * Sanitize plain text (removes all HTML)
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized plain text
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}

/**
 * Sanitize user input for forms (allows basic formatting)
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  // Allow basic formatting tags for rich text inputs
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  })
}

/**
 * Sanitize URL to prevent XSS
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL
 */
export const sanitizeURL = (url) => {
  if (!url || typeof url !== 'string') {
    return ''
  }
  
  // Remove any script tags or javascript: protocols
  const sanitized = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
  
  // Check for dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:']
  const lowerUrl = sanitized.toLowerCase().trim()
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return ''
    }
  }
  
  return sanitized
}

/**
 * Sanitize object with string values recursively
 * @param {object} obj - Object to sanitize
 * @param {Function} sanitizer - Sanitization function to use
 * @returns {object} Sanitized object
 */
export const sanitizeObject = (obj, sanitizer = sanitizeText) => {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sanitizer))
  }
  
  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizer(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, sanitizer)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeInput,
  sanitizeURL,
  sanitizeObject
}

