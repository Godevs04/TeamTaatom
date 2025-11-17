import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { socketService } from '../services/socketService'
import toast from 'react-hot-toast'

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
  const navigate = useNavigate()

  // Auto-logout after 15 minutes of inactivity
  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivity
      const fifteenMinutes = 15 * 60 * 1000

      if (timeSinceLastActivity > fifteenMinutes && user) {
        handleAutoLogout()
      }
    }

    const interval = setInterval(checkInactivity, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [lastActivity, user])

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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('founder_token')
        if (!token) {
          setLoading(false)
          setIsInitialized(true)
          return
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Token verification timeout')), 10000)
        )
        
        const verifyPromise = api.get('/api/superadmin/verify')
        const response = await Promise.race([verifyPromise, timeoutPromise])
        
        setUser(response.data.user)
        
        // Initialize real-time connection
        await socketService.connect()
        
      } catch (error) {
        console.error('Token verification failed:', error)
        localStorage.removeItem('founder_token')
        delete api.defaults.headers.common['Authorization']
        setUser(null)
      } finally {
        setLoading(false)
        setIsInitialized(true)
      }
    }

    if (!isInitialized) {
      initializeAuth()
    }
  }, [isInitialized])

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/superadmin/login', { 
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
      
      const response = await api.post('/api/superadmin/verify-2fa', {
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
      
      await api.post('/api/superadmin/resend-2fa', {
        token: tempToken
      })
      toast.success('New 2FA code sent to your email')
      return { success: true }
    } catch (error) {
      console.error('Resend 2FA failed:', error)
      const errorMessage = error.response?.data?.message || 'Failed to resend 2FA code'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const updateProfile = async (profileData) => {
    try {
      const response = await api.patch('/api/superadmin/profile', profileData)
      setUser(response.data.user)
      return { success: true }
    } catch (error) {
      console.error('Profile update failed:', error)
      return { success: false, error: error.response?.data?.message || 'Update failed' }
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.patch('/api/superadmin/change-password', {
        currentPassword,
        newPassword
      })
      return { success: true }
    } catch (error) {
      console.error('Password change failed:', error)
      return { success: false, error: error.response?.data?.message || 'Password change failed' }
    }
  }

  const getSecurityLogs = async () => {
    try {
      const response = await api.get('/api/superadmin/security-logs')
      return { success: true, data: response.data }
    } catch (error) {
      console.error('Failed to fetch security logs:', error)
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