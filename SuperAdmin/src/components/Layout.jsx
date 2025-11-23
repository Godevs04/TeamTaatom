import React, { useState, useEffect, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const Layout = ({ children }) => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024
      setIsDesktop(desktop)
      setIsSidebarOpen(desktop)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  const handleCloseSidebar = useCallback(() => {
    if (!isDesktop) {
      setIsSidebarOpen(false)
    }
  }, [isDesktop])

  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    isMobile: !isDesktop,
    onClose: handleCloseSidebar
  }), [isSidebarOpen, isDesktop, handleCloseSidebar])

  const topbarProps = useMemo(() => ({
    onToggleSidebar: handleToggleSidebar,
    isDesktop
  }), [handleToggleSidebar, isDesktop])

  return (
    <div className="min-h-screen bg-gray-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-slate-100">
      <Sidebar {...sidebarProps} />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isDesktop ? 'lg:pl-64' : ''}`}>
        <Topbar {...topbarProps} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired
}

export default Layout