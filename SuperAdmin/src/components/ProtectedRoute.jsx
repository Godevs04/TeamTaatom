import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logger from '../utils/logger'

const ProtectedRoute = ({ children }) => {
  const { user, loading, isInitialized } = useAuth()
  const [fallbackTimeout, setFallbackTimeout] = useState(false)

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading || !isInitialized) {
        logger.warn('Auth loading timeout - forcing redirect to login')
        setFallbackTimeout(true)
      }
    }, 15000) // 15 second timeout

    return () => clearTimeout(timeout)
  }, [loading, isInitialized])

  // Show loading spinner while initializing or loading
  if ((loading || !isInitialized) && !fallbackTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading SuperAdmin Dashboard...</p>
          <p className="mt-2 text-sm text-gray-500">This may take a moment...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if no user or timeout occurred
  if (!user || fallbackTimeout) {
    return <Navigate to="/login" replace />
  }

  return children
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired
}

export default ProtectedRoute