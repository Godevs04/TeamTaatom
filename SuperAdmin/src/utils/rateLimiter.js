/**
 * Rate limiter utility for frontend request throttling
 * Prevents accidental spam and DoS attacks
 */

class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = new Map() // Store request timestamps by endpoint
  }

  /**
   * Check if request is allowed
   * @param {string} endpoint - API endpoint identifier
   * @returns {boolean} True if request is allowed
   */
  isAllowed(endpoint) {
    const now = Date.now()
    const key = endpoint || 'default'
    
    if (!this.requests.has(key)) {
      this.requests.set(key, [])
    }
    
    const timestamps = this.requests.get(key)
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs)
    
    // Check if we've exceeded the limit
    if (validTimestamps.length >= this.maxRequests) {
      return false
    }
    
    // Add current timestamp
    validTimestamps.push(now)
    this.requests.set(key, validTimestamps)
    
    return true
  }

  /**
   * Get remaining requests for an endpoint
   * @param {string} endpoint - API endpoint identifier
   * @returns {number} Number of remaining requests
   */
  getRemaining(endpoint) {
    const now = Date.now()
    const key = endpoint || 'default'
    
    if (!this.requests.has(key)) {
      return this.maxRequests
    }
    
    const timestamps = this.requests.get(key)
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs)
    
    return Math.max(0, this.maxRequests - validTimestamps.length)
  }

  /**
   * Reset rate limiter for an endpoint
   * @param {string} endpoint - API endpoint identifier
   */
  reset(endpoint) {
    const key = endpoint || 'default'
    this.requests.delete(key)
  }

  /**
   * Reset all rate limiters
   */
  resetAll() {
    this.requests.clear()
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter(10, 60000) // 10 requests per minute

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, delay = 1000) => {
  let lastCall = 0
  let timeoutId = null
  
  return function(...args) {
    const now = Date.now()
    const timeSinceLastCall = now - lastCall
    
    if (timeSinceLastCall >= delay) {
      lastCall = now
      func.apply(this, args)
    } else {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        func.apply(this, args)
      }, delay - timeSinceLastCall)
    }
  }
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay = 500) => {
  let timeoutId = null
  
  return function(...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

export default rateLimiter

