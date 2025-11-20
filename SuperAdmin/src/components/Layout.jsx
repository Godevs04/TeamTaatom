import React, { useState, useEffect, useCallback } from 'react'
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

  return (
    <div className="min-h-screen bg-gray-50 lg:bg-gradient-to-br lg:from-slate-50 lg:via-white lg:to-slate-100">
      <Sidebar
        isOpen={isSidebarOpen}
        isMobile={!isDesktop}
        onClose={handleCloseSidebar}
      />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isDesktop ? 'lg:pl-64' : ''}`}>
        <Topbar
          onToggleSidebar={handleToggleSidebar}
          isDesktop={isDesktop}
        />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout