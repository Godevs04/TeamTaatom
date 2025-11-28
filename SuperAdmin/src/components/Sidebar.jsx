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
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, permission: null },
  { name: 'Query Monitor', href: '/query-monitor', icon: Database, permission: null },
  { name: 'Users', href: '/users', icon: Users, permission: 'canManageUsers' },
  { name: 'Travel Content', href: '/travel-content', icon: MapPin, permission: 'canManageContent' },
  { name: 'Songs', href: '/songs', icon: Music, permission: 'canManageContent' },
  { name: 'Locales', href: '/locales', icon: MapPin, permission: 'canManageContent' },
  { name: 'Reports', href: '/reports', icon: Flag, permission: 'canManageReports' },
  { name: 'Moderators', href: '/moderators', icon: Shield, permission: 'canManageModerators' },
  { name: 'Logs', href: '/logs', icon: FileText, permission: 'canViewLogs' },
  { name: 'Feature Flags', href: '/feature-flags', icon: Zap, permission: 'canManageSettings' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'canManageSettings' },
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
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <h1 className="text-xl font-bold">TeamTaatom</h1>
            </div>
            <p className="text-gray-400 text-sm mt-1">SuperAdmin Dashboard</p>
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

        <nav className="flex-1 px-4 overflow-y-auto">
          <div className="space-y-2 pb-6 pt-4">
            {navigation.map(({ name, href, icon: Icon }) => (
              <NavLink
                key={name}
                to={href}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{name}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-700 mt-auto bg-slate-900/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-inner">
              <span className="text-white font-bold text-sm">
                {(user?.email?.[0] || 'A').toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white truncate max-w-[150px]">
                {user?.email || 'User'}
              </p>
              <p className="text-xs text-gray-400 capitalize">
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