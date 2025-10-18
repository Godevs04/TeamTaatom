import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

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
  const navigate = useNavigate()

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('founder_token')
        if (!token) {
          console.log('No token found, redirecting to login')
          setLoading(false)
          setIsInitialized(true)
          return
        }

        console.log('Verifying token...')
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Token verification timeout')), 10000)
        )
        
        const verifyPromise = api.get('/api/founder/verify')
        const response = await Promise.race([verifyPromise, timeoutPromise])
        
        console.log('Token verified successfully')
        setUser(response.data.user)
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
      const response = await api.post('/api/founder/login', { 
        email, 
        password 
      })
      
      const { token, user } = response.data
      
      localStorage.setItem('founder_token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(user)
      
      return { success: true }
    } catch (error) {
      console.error('Login failed:', error)
      const errorMessage = error.response?.data?.message || 'Login failed'
      return { success: false, error: errorMessage }
    }
  }

  const logout = useCallback(() => {
    localStorage.removeItem('founder_token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    navigate('/login')
  }, [navigate])

  const updateProfile = async (profileData) => {
    try {
      const response = await api.patch('/api/founder/profile', profileData)
      setUser(response.data.user)
      return { success: true }
    } catch (error) {
      console.error('Profile update failed:', error)
      return { success: false, error: error.response?.data?.message || 'Update failed' }
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.patch('/api/founder/change-password', {
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
      const response = await api.get('/api/founder/security-logs')
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
    login,
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