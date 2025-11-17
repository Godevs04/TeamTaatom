import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { formatDate } from '../utils/formatDate'
import { Search, Filter, Download, RefreshCw, AlertTriangle, Info, CheckCircle, XCircle, Calendar, Eye, Clock, List } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import SafeComponent from '../components/SafeComponent'

const Logs = () => {
  const { isConnected } = useRealTime()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [dateRange, setDateRange] = useState('all')
  const [selectedLog, setSelectedLog] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Fetch logs from API
  // REAL-TIME LOG FETCHING EXPLANATION:
  // 1. Logs are fetched from MongoDB (SuperAdmin.securityLogs array in each SuperAdmin document)
  // 2. Backend aggregates all logs from all SuperAdmin accounts
  // 3. Works on BOTH local and production servers - no configuration needed
  // 4. Auto-refresh polls every 10 seconds when enabled
  // 5. All security events (login, logout, 2FA, etc.) are automatically logged
  // 6. Each log contains: timestamp, action, details, IP address, user agent, success status
  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage
      }
      
      if (searchTerm) {
        params.search = searchTerm
      }
      if (filterLevel !== 'all') {
        params.level = filterLevel
      }
      if (filterType !== 'all') {
        params.type = filterType
      }
      
      const response = await api.get('/api/superadmin/logs', { params })
      
      if (response.data.success) {
        setLogs(response.data.logs)
        setTotalLogs(response.data.total)
        setTotalPages(response.data.totalPages)
      }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      logger.error('Failed to fetch logs:', error)
      toast.error('Failed to fetch logs')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch logs on mount and when filters change
  useEffect(() => {
    fetchLogs()
  }, [currentPage, itemsPerPage, filterLevel, filterType, searchTerm])

  // Auto-refresh functionality
  useEffect(() => {
    let intervalId
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchLogs()
      }, 10000) // Refresh every 10 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [autoRefresh, currentPage, itemsPerPage, filterLevel, filterType, searchTerm])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1)
      }
      fetchLogs()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const handleRefresh = async () => {
    setIsLoading(true)
    await fetchLogs()
    toast.success('Logs refreshed successfully')
    setIsLoading(false)
  }

  const handleExport = async (format) => {
    try {
      const params = {}
      
      if (searchTerm) params.search = searchTerm
      if (filterLevel !== 'all') params.level = filterLevel
      if (filterType !== 'all') params.type = filterType
      
      const response = await api.get('/api/superadmin/logs', { 
        params: { ...params, limit: 1000 } // Get more for export
      })
      
      if (format === 'csv') {
        let csv = 'Timestamp,Level,Type,Action,Details,IP Address,User\n'
        response.data.logs.forEach(log => {
          csv += `${new Date(log.timestamp).toISOString()},${log.level || 'info'},${log.type || 'system'},${log.action || ''},"${(log.details || '').replace(/"/g, '""')}",${log.ipAddress || ''},${log.userId || ''}\n`
        })
        
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs_export_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        toast.success('Logs exported as CSV')
      } else if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data.logs, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs_export_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        toast.success('Logs exported as JSON')
      }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      logger.error('Failed to export logs:', error)
      toast.error('Failed to export logs')
    }
  }

  const handleViewLog = (log) => {
    setSelectedLog(log)
    setShowLogModal(true)
  }

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'info': return 'text-blue-600 bg-blue-100'
      case 'success': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4" />
      case 'warning': return <AlertTriangle className="w-4 h-4" />
      case 'info': return <Info className="w-4 h-4" />
      case 'success': return <CheckCircle className="w-4 h-4" />
      default: return <Info className="w-4 h-4" />
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'user_action': return 'text-blue-600 bg-blue-100'
      case 'security': return 'text-red-600 bg-red-100'
      case 'system': return 'text-purple-600 bg-purple-100'
      case 'moderation': return 'text-green-600 bg-green-100'
      case 'api': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const errorCount = logs.filter(l => l.level === 'error').length
  const warningCount = logs.filter(l => l.level === 'warning').length
  const infoCount = logs.filter(l => l.level === 'info').length
  const successCount = logs.filter(l => l.level === 'success').length

  return (
    <SafeComponent>
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 via-slate-50 to-zinc-50 rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-gray-500 to-slate-600 rounded-xl shadow-lg">
                <List className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-700 to-slate-700 bg-clip-text text-transparent">
                System Logs
              </h1>
              {isConnected && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                  Live Data
                </span>
              )}
              {autoRefresh && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-blue-400 to-indigo-500 text-white text-xs font-semibold rounded-full shadow-md">
                  Auto-refresh ON
                </span>
              )}
            </div>
            <p className="text-gray-600 text-lg">Monitor system and app events in real-time</p>
          </div>
          <div className="flex space-x-3">
            <button 
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2.5 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 ${
                autoRefresh ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>Auto-refresh</span>
            </button>
            <div className="relative group">
              <button className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Export Logs</span>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b"
                >
                  Export as JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Errors</p>
                  <p className="text-2xl font-bold text-gray-900">{errorCount}</p>
                </div>
              </div>
              <div className="text-red-600 text-xl">!</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Warnings</p>
                  <p className="text-2xl font-bold text-gray-900">{warningCount}</p>
                </div>
              </div>
              <div className="text-yellow-600 text-xl">⚠</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Info</p>
                  <p className="text-2xl font-bold text-gray-900">{infoCount}</p>
                </div>
              </div>
              <div className="text-blue-600 text-xl">ℹ</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Success</p>
                  <p className="text-2xl font-bold text-gray-900">{successCount}</p>
                </div>
              </div>
              <div className="text-green-600 text-xl">✓</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalLogs}</p>
                </div>
              </div>
              <div className="text-purple-600 text-xl">📊</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by action, details, IP address..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                className="input"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
              >
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
              </select>
              <select
                className="input"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="user_action">User Action</option>
                <option value="security">Security</option>
                <option value="system">System</option>
                <option value="moderation">Moderation</option>
                <option value="api">API</option>
              </select>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowMoreFilters(!showMoreFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>

          {/* More Filters */}
          {showMoreFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select
                    className="input w-full text-sm"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilterLevel('all')
                      setFilterType('all')
                      setSearchTerm('')
                      setDateRange('all')
                    }}
                    className="btn btn-sm btn-secondary w-full"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Logs ({totalLogs})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        Loading logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-semibold">No logs found</p>
                      <p className="text-sm text-gray-600 mt-2">Try adjusting your filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log._id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        {formatDate(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getLevelIcon(log.level)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                            {log.level}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(log.type)}`}>
                          {log.type?.replace('_', ' ') || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm" title={log.action}>
                          {log.action}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm" title={log.message || log.details}>
                          {log.message || log.details || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ipAddress || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.userId || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <button 
                          onClick={() => handleViewLog(log)}
                          className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {logs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalLogs)} of {totalLogs} logs
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="btn btn-sm btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`btn btn-sm ${
                            currentPage === pageNum ? 'btn-primary' : 'btn-secondary'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || isLoading}
                    className="btn btn-sm btn-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log Details Modal */}
      {showLogModal && selectedLog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogModal(false)
              setSelectedLog(null)
            }
          }}
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Log Details</h3>
                <button
                  onClick={() => {
                    setShowLogModal(false)
                    setSelectedLog(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <p className="text-sm text-gray-900 font-mono">{formatDate(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Level</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(selectedLog.level)}`}>
                      {selectedLog.level}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(selectedLog.type)}`}>
                      {selectedLog.type?.replace('_', ' ') || 'N/A'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedLog.success ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                      {selectedLog.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Action</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.action || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Details</label>
                  <p className="text-sm text-gray-900 mt-1 break-words">{selectedLog.details || selectedLog.message || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IP Address</label>
                  <p className="text-sm text-gray-900 font-mono mt-1">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">User</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.userId || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">User Agent</label>
                  <p className="text-sm text-gray-900 break-all mt-1">{selectedLog.userAgent || '-'}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowLogModal(false)
                  setSelectedLog(null)
                }}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SafeComponent>
  )
}

export default Logs
