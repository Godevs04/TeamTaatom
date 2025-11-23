import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  Bell,
  LogOut,
  User,
  Moon,
  Sun,
  Search,
  ChevronDown,
  Settings,
  User as UserIcon,
  HelpCircle,
  Mail,
  FileText,
  Shield,
  Activity,
  Menu,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRealTime } from '../context/RealTimeContext'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import GlobalSearch from './GlobalSearch'
import toast from 'react-hot-toast'

const Topbar = ({ onToggleSidebar = () => {}, isDesktop = true }) => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { isConnected } = useRealTime()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  
  const profileMenuRef = useRef(null)
  const notificationsRef = useRef(null)

  // Check for saved theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  // Fetch notifications on mount and periodically
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoadingNotifications(true)
        // In a real implementation, fetch from backend
        const response = await api.get('/api/superadmin/notifications')
        if (response.data.success) {
          setNotifications(response.data.notifications || [])
        }
      } catch (error) {
        // If endpoint doesn't exist yet, use mock data
        const mockNotifications = [
          { id: 1, title: 'New user registered', message: 'New user joined the platform', time: '2 min ago', unread: true, type: 'user' },
          { id: 2, title: 'Content report pending', message: 'A new content report needs attention', time: '15 min ago', unread: true, type: 'report' },
          { id: 3, title: 'System backup completed', message: 'Daily backup completed successfully', time: '1 hour ago', unread: false, type: 'system' },
          { id: 4, title: 'New moderator added', message: 'A new moderator was assigned', time: '3 hours ago', unread: false, type: 'system' },
        ]
        setNotifications(mockNotifications)
      } finally {
        setIsLoadingNotifications(false)
      }
    }

    fetchNotifications()
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDarkMode = useCallback(() => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
    
    toast.success(`Switched to ${newDarkMode ? 'dark' : 'light'} mode`)
  }, [isDarkMode])

  const handleNotificationClick = useCallback((notification) => {
    // Mark as read
    setNotifications(prev => prev.map(n => 
      n.id === notification.id ? { ...n, unread: false } : n
    ))
    setShowNotifications(false)

    // Navigate based on notification type
    if (notification.type === 'report') {
      navigate('/reports')
    } else if (notification.type === 'user') {
      navigate('/users')
    } else if (notification.type === 'content') {
      navigate('/travel-content')
    }
  }, [navigate])

  const unreadCount = useMemo(() => 
    notifications.filter(n => n.unread).length,
    [notifications]
  )

  // Get user display name and role
  const { displayName, roleName, capitalizedName } = useMemo(() => {
    const name = user?.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Admin'
    const role = user?.role === 'founder' ? 'Founder' : 
                 user?.role === 'admin' ? 'Administrator' : 
                 user?.role === 'moderator' ? 'Moderator' : 'Admin'
    
    const capitalized = name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
    
    return { displayName: name, roleName: role, capitalizedName: capitalized }
  }, [user])

  return (
    <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white border-b border-blue-700 px-4 sm:px-6 py-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {!isDesktop && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold">
              Welcome back, {capitalizedName}
            </h2>
            <p className="text-blue-100">Manage your TeamTaatom platform</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 justify-end flex-1 min-w-[200px]">
          {/* Global Search */}
          <div className="relative w-full sm:w-auto sm:min-w-[240px] lg:min-w-[320px]">
            <GlobalSearch />
          </div>
          
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="relative p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/20"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
          
          {/* Connection Status */}
          <div className="relative px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="text-xs font-semibold">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          
          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/20"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <h3 className="font-bold text-lg">Notifications</h3>
                  <p className="text-sm text-blue-100">{unreadCount} unread</p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {isLoadingNotifications ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                      <p>Loading notifications...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            notification.unread ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg ${
                              notification.unread 
                                ? 'bg-blue-100 dark:bg-blue-900' 
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${
                                notification.unread ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                {notification.time}
                              </p>
                            </div>
                            {notification.unread && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* User Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-3 px-4 py-2 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/20"
            >
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 shadow-lg">
                <span className="text-lg font-bold text-white">
                  {capitalizedName.charAt(0)}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">{capitalizedName}</p>
                <p className="text-xs text-blue-100">{roleName}</p>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Profile Menu Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                {/* User Info Header */}
                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                      <span className="text-xl font-bold">
                        {capitalizedName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{capitalizedName}</p>
                      <p className="text-sm text-blue-100">{user?.email || 'admin@taatom.com'}</p>
                      <p className="text-xs bg-white/20 px-2 py-1 rounded-full mt-1 inline-block">
                        {roleName}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Menu Items */}
                <div className="py-2">
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      navigate('/settings')
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Settings</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      navigate('/profile')
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Profile</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      navigate('/logs')
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Activity Log</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      navigate('/logs')
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Security</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      toast.info('Help & Support coming soon')
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <HelpCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Help & Support</span>
                  </button>
                </div>
                
                {/* Logout */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      logout()
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors rounded-lg"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-semibold">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

Topbar.propTypes = {
  onToggleSidebar: PropTypes.func,
  isDesktop: PropTypes.bool
}

export default Topbar
