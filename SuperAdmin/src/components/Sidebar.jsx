import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
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
  Search,
  Database,
  Music,
  Globe,
  Server,
  MessageSquare,
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, permission: null },
  { name: 'TripScore Analytics', href: '/tripscore-analytics', icon: Globe, permission: 'canViewAnalytics' },
  { name: 'Query Monitor', href: '/query-monitor', icon: Database, permission: null },
  { name: 'Users', href: '/users', icon: Users, permission: 'canManageUsers' },
  { name: 'Travel Content', href: '/travel-content', icon: MapPin, permission: 'canManageContent' },
  { name: 'Songs', href: '/songs', icon: Music, permission: 'canManageContent' },
  { name: 'Locales', href: '/locales', icon: MapPin, permission: 'canManageContent' },
  { name: 'Reports', href: '/reports', icon: Flag, permission: 'canManageReports' },
  { name: 'Support Inbox', href: '/support-inbox', icon: MessageSquare, permission: 'canViewAnalytics' },
  { name: 'Moderators', href: '/moderators', icon: Shield, permission: 'canManageModerators' },
  { name: 'Logs', href: '/logs', icon: FileText, permission: 'canViewLogs' },
  { name: 'Feature Flags', href: '/feature-flags', icon: Zap, permission: 'canManageSettings' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'canManageSettings' },
  { name: 'System', href: '/system', icon: Server, permission: 'canManageSettings' },
]

const Sidebar = ({ isOpen = true, onClose = () => {}, isMobile = false }) => {
  const { user } = useAuth()

  const navigation = useMemo(() => {
    if (user?.role === 'founder') return navItems
    return navItems.filter(item => !item.permission || user?.permissions?.[item.permission])
  }, [user])

  return (
    <>
      {isMobile && (
        <div
          className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 z-40 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
          aria-hidden={!isOpen}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-800 text-white flex flex-col shadow-2xl transition-transform duration-300 ${
          isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'hidden lg:flex lg:translate-x-0 lg:z-40'
        }`}
      >
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 flex items-center justify-between border-b border-white/10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-white font-bold text-xs sm:text-sm">T</span>
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-bold truncate">TeamTaatom</h1>
            </div>
            <p className="text-gray-400 text-[10px] sm:text-xs md:text-sm mt-0.5 sm:mt-1 truncate">SuperAdmin Dashboard</p>
          </div>
          {isMobile && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="p-2 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/60"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
          )}
        </div>

        <nav className="flex-1 px-2 sm:px-3 md:px-4 overflow-y-auto">
          <div className="space-y-1.5 sm:space-y-2 pb-4 sm:pb-5 md:pb-6 pt-2 sm:pt-3 md:pt-4">
            {navigation.map(({ name, href, icon: Icon }) => (
              <NavLink
                key={name}
                to={href}
                className={({ isActive }) =>
                  `flex items-center space-x-2 sm:space-x-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">{name}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="p-2 sm:p-3 md:p-4 border-t border-gray-700 mt-auto bg-slate-900/40">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-inner flex-shrink-0">
              <span className="text-white font-bold text-xs sm:text-sm">
                {(user?.email?.[0] || 'A').toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-white truncate">
                {user?.email || 'User'}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-400 capitalize truncate">
                {user?.role || 'Admin'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

Sidebar.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  isMobile: PropTypes.bool
}

export default Sidebar