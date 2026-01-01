import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { socketService } from '../services/socketService'
import toast from 'react-hot-toast'
import logger from '../utils/logger'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const [tempToken, setTempToken] = useState(null)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [sessionTimeout, setSessionTimeout] = useState(() => {
    // Get from localStorage or default to 15 minutes
    const saved = localStorage.getItem('sessionTimeout')
    return saved ? parseInt(saved, 10) : 15 * 60 * 1000
  })
  const navigate = useNavigate()

  // Define logout and handleAutoLogout before they're used in useEffect
  const logout = useCallback(() => {
    localStorage.removeItem('founder_token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    setRequires2FA(false)
    setTempToken(null)
    socketService.disconnect()
    navigate('/login')
  }, [navigate])

  const handleAutoLogout = useCallback(() => {
    toast.error('Session expired due to inactivity')
    logout()
  }, [logout])

  // Load session timeout from settings
  useEffect(() => {
    const loadSessionTimeout = async () => {
      try {
        const response = await api.get('/api/v1/superadmin/settings')
        if (response.data?.settings?.security?.sessionTimeout) {
          const timeoutMinutes = response.data.settings.security.sessionTimeout
          const timeoutMs = timeoutMinutes * 60 * 1000
          setSessionTimeout(timeoutMs)
          localStorage.setItem('sessionTimeout', timeoutMs.toString())
        }
      } catch (error) {
        // Use default if settings fetch fails
        logger.debug('Failed to load session timeout from settings, using default')
      }
    }
    
    if (user) {
      loadSessionTimeout()
    }
  }, [user])

  // Auto-logout after configured timeout of inactivity
  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivity

      if (timeSinceLastActivity > sessionTimeout && user) {
        handleAutoLogout()
      }
    }

    const interval = setInterval(checkInactivity, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [lastActivity, user, sessionTimeout, handleAutoLogout])

  // Update last activity on user interaction
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now())
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('founder_token')
        if (!token) {
          if (isMounted) {
            setLoading(false)
            setIsInitialized(true)
          }
          return
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Token verification timeout')), 10000)
        )
        
        const verifyPromise = api.get('/api/v1/superadmin/verify')
        const response = await Promise.race([verifyPromise, timeoutPromise])
        
        if (isMounted) {
          setUser(response.data.user)
          
          // Initialize real-time connection
          try {
            await socketService.connect()
          } catch (socketError) {
            logger.error('Socket connection failed during auth init:', socketError)
          }
        }
        
      } catch (error) {
        logger.error('Token verification failed:', error)
        
        // Clear token on any auth error
        localStorage.removeItem('founder_token')
        delete api.defaults.headers.common['Authorization']
        
        // Handle specific error cases
        if (error.response?.status === 401 || error.message?.includes('expired')) {
          logger.warn('Token expired or invalid, clearing session')
        }
        
        if (isMounted) {
          setUser(null)
          setLoading(false)
          setIsInitialized(true)
          
          // Only redirect if not already on login page
          if (window.location.pathname !== '/login') {
            navigate('/login')
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setIsInitialized(true)
        }
      }
    }

    if (!isInitialized) {
      initializeAuth()
    }
    
    return () => {
      isMounted = false
    }
  }, [isInitialized, navigate])

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/v1/superadmin/login', { 
        email, 
        password 
      })
      
      const { token, user: userData, requires2FA: needs2FA } = response.data
      
      if (needs2FA) {
        setRequires2FA(true)
        setTempToken(token) // Store the temporary token
        toast.success('Please check your email for 2FA code')
        return { success: true, requires2FA: true }
      }
      
      // Complete login if no 2FA required
      localStorage.setItem('founder_token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(userData)
      
      // Initialize real-time connection
      await socketService.connect()
      
      return { success: true }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      const { parseError } = await import('../utils/errorCodes')
      const parsedError = parseError(error)
      logger.error('Login failed:', parsedError.code, parsedError.message)
      return { success: false, error: parsedError.adminMessage }
    }
  }

  const verify2FA = async (code) => {
    try {
      if (!tempToken) {
        return { success: false, error: 'No temporary token found. Please try logging in again.' }
      }
      
      const response = await api.post('/api/v1/superadmin/verify-2fa', {
        token: tempToken,
        code
      })
      
      const { token, user: userData } = response.data
      
      localStorage.setItem('founder_token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(userData)
      setRequires2FA(false)
      setTempToken(null)
      
      // Initialize real-time connection
      await socketService.connect()
      
      toast.success('Login successful!')
      return { success: true }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      const { parseError } = await import('../utils/errorCodes')
      const parsedError = parseError(error)
      logger.error('2FA verification failed:', parsedError.code, parsedError.message)
      return { success: false, error: parsedError.adminMessage }
    }
  }

  const resend2FA = async () => {
    try {
      if (!tempToken) {
        toast.error('No temporary token found. Please try logging in again.')
        return { success: false, error: 'No temporary token found. Please try logging in again.' }
      }
      
      await api.post('/api/v1/superadmin/resend-2fa', {
        token: tempToken
      })
      toast.success('New 2FA code sent to your email')
      return { success: true }
    } catch (error) {
      logger.error('Resend 2FA failed:', error)
      const errorMessage = error.response?.data?.message || 'Failed to resend 2FA code'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const updateProfile = async (profileData) => {
    try {
      const response = await api.patch('/api/v1/superadmin/profile', profileData)
      setUser(response.data.user)
      return { success: true }
    } catch (error) {
      logger.error('Profile update failed:', error)
      return { success: false, error: error.response?.data?.message || 'Update failed' }
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.patch('/api/v1/superadmin/change-password', {
        currentPassword,
        newPassword
      })
      return { success: true }
    } catch (error) {
      logger.error('Password change failed:', error)
      return { success: false, error: error.response?.data?.message || 'Password change failed' }
    }
  }

  const getSecurityLogs = async () => {
    try {
      const response = await api.get('/api/v1/superadmin/security-logs')
      return { success: true, data: response.data }
    } catch (error) {
      logger.error('Failed to fetch security logs:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to fetch logs' }
    }
  }

  const value = {
    user,
    loading,
    isInitialized,
    requires2FA,
    login,
    verify2FA,
    resend2FA,
    logout,
    updateProfile,
    changePassword,
    getSecurityLogs
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}