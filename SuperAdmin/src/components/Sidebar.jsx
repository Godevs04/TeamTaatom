import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Flag, 
  BarChart3, 
  Shield, 
  FileText, 
  Settings,
  Zap,
  Bell,
  Search
} from 'lucide-react'

const Sidebar = () => {
  const { user } = useAuth()
  
  // Define navigation items with permission requirements
  const allNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null }, // Everyone can access
    { name: 'Users', href: '/users', icon: Users, permission: 'canManageUsers' },
    { name: 'Travel Content', href: '/travel-content', icon: MapPin, permission: 'canManageContent' },
    { name: 'Reports', href: '/reports', icon: Flag, permission: 'canManageReports' },
    { name: 'Moderators', href: '/moderators', icon: Shield, permission: 'canManageModerators' },
    { name: 'Logs', href: '/logs', icon: FileText, permission: 'canViewLogs' },
    { name: 'Feature Flags', href: '/feature-flags', icon: Zap, permission: 'canManageSettings' },
    { name: 'Settings', href: '/settings', icon: Settings, permission: 'canManageSettings' },
  ]
  
  // Filter navigation based on permissions
  const getFilteredNavigation = () => {
    // Founders see everything
    if (user?.role === 'founder') {
      return allNavigation
    }
    
    // For moderators and admins, filter by permissions
    return allNavigation.filter(item => {
      // No permission required - everyone can see
      if (!item.permission) return true
      
      // Check if user has the required permission
      return user?.permissions?.[item.permission] === true
    })
  }
  
  const navigation = getFilteredNavigation()

  return (
    <div className="w-64 bg-slate-800 text-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <h1 className="text-xl font-bold">TeamTaatom</h1>
        </div>
        <p className="text-gray-400 text-sm mt-1">SuperAdmin Dashboard</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4">
        <div className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
      
      {/* User Profile - Fixed positioning */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xs">
              {(user?.email?.[0] || 'A').toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {user?.email || 'User'}
            </p>
            <p className="text-xs text-gray-400 capitalize">
              {user?.role || 'Admin'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar