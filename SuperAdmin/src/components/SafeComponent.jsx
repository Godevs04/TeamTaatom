import React from 'react'
import PropTypes from 'prop-types'

const SafeComponent = ({ children, fallback = null }) => {
  try {
    return children
  } catch (error) {
    // Use dynamic import to avoid circular dependencies
    import('../utils/logger').then(({ default: logger }) => {
      logger.error('SafeComponent caught an error:', error)
    }).catch(() => {
      // Fallback to console if logger fails
      console.error('SafeComponent caught an error:', error)
    })
    return fallback || (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-gray-600">Component failed to load</p>
        </div>
      </div>
    )
  }
}

SafeComponent.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node
}

export default SafeComponent
