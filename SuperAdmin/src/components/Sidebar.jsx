import React from 'react'
import { NavLink } from 'react-router-dom'
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
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Travel Content', href: '/travel-content', icon: MapPin },
    { name: 'Reports', href: '/reports', icon: Flag },
    { name: 'Moderators', href: '/moderators', icon: Shield },
    { name: 'Logs', href: '/logs', icon: FileText },
    { name: 'Feature Flags', href: '/feature-flags', icon: Zap },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

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
            <span className="text-white font-bold text-xs">F</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Founder</p>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar