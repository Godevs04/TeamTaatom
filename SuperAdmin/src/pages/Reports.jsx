import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, CheckCircle, XCircle, Eye, AlertTriangle, RefreshCw, Download } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'

const Reports = () => {
  const { reports, fetchReports, isConnected } = useRealTime()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedReports, setSelectedReports] = useState([])
  const [showExportModal, setShowExportModal] = useState(false)
  
  // Handle initial load state
  useEffect(() => {
    if (reports && reports.length > 0) {
      setIsInitialLoad(false)
    }
  }, [reports])

  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, typeFilter, priorityFilter, sortBy, sortOrder])

  // Fetch reports data on component mount and when filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = {
          page: currentPage,
          limit: 20
        }
        
        // Only add status filter if not 'all'
        if (filterStatus !== 'all') {
          params.status = filterStatus
        }
        
        // Add type filter if not 'all'
        if (typeFilter !== 'all') {
          params.type = typeFilter
        }
        
        // Add priority filter if not 'all'
        if (priorityFilter !== 'all') {
          params.priority = priorityFilter
        }
        
        await fetchReports(params)
      } catch (error) {
        handleError(error, toast, 'Failed to fetch reports')
        logger.error('Error fetching reports:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchReports, currentPage, filterStatus, sortBy, sortOrder, typeFilter, priorityFilter])

  // Handle search with debouncing (standardized 500ms delay)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1) // Reset to first page when searching
      }
    }, 500) // Standardized debounce delay: 500ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Handle report actions
  const handleReportAction = async (reportId, action) => {
    try {
      const status = action === 'approve' ? 'resolved' : 'dismissed'
      
      await api.patch(`/api/superadmin/reports/${reportId}`, {
        status,
        adminNotes: action === 'approve' ? 'Report approved by admin' : 'Report dismissed by admin'
      })
      
      toast.success(`Report ${action}d successfully`)
      
      // Remove the report from selected reports if it was selected
      setSelectedReports(prev => prev.filter(id => id !== reportId))
      
      // Refresh reports after action
      setLoading(true)
      try {
        const params = {
          page: currentPage,
          limit: 20
        }
        
        if (filterStatus !== 'all') {
          params.status = filterStatus
        }
        
        if (typeFilter !== 'all') {
          params.type = typeFilter
        }
        
        if (priorityFilter !== 'all') {
          params.priority = priorityFilter
        }
        
        await fetchReports(params)
      } catch (error) {
        logger.error('Refresh error:', error)
      } finally {
        setLoading(false)
      }
    } catch (error) {
      logger.error('Report action error:', error)
      handleError(error, toast, `Failed to ${action} report`)
    }
  }
  
  // Handle report selection
  const handleReportSelect = (reportId) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    )
  }
  
  // Handle select all
  const handleSelectAll = () => {
    const reportsArray = Array.isArray(reports) ? reports : (reports?.reports || [])
    if (selectedReports.length === reportsArray.length) {
      setSelectedReports([])
    } else {
      setSelectedReports(reportsArray.map(report => report._id || report.id))
    }
  }

  // Get filtered reports based on search
  const reportsArray = Array.isArray(reports) ? reports : (reports?.reports || [])
  
  // Only do search filtering on frontend, backend already filters by status/type/priority
  const filteredReports = reportsArray.filter(report => {
    if (!searchTerm) return true
    
    const matchesSearch = report.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedBy?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedBy?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedUser?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedUser?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentReports = filteredReports.slice(startIndex, endIndex)

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const params = {
        page: currentPage,
        limit: 20
      }
      
      if (filterStatus !== 'all') {
        params.status = filterStatus
      }
      
      if (typeFilter !== 'all') {
        params.type = typeFilter
      }
      
      if (priorityFilter !== 'all') {
        params.priority = priorityFilter
      }
      
      await fetchReports(params)
      toast.success('Reports refreshed successfully')
    } catch (error) {
      toast.error('Failed to refresh reports')
    } finally {
      setLoading(false)
    }
  }

  const handleReportActionClick = (report, action) => {
    setSelectedReport({ ...report, action })
    if (action === 'view') {
      setShowModal(true)
    } else {
      // Direct action for approve/reject
      setShowModal(true)
    }
  }

  const handleConfirmAction = async () => {
    if (!selectedReport) {
      setShowModal(false)
      return
    }
    
    try {
      if (selectedReport.action === 'approve' || selectedReport.action === 'reject') {
        await handleReportAction(selectedReport._id, selectedReport.action)
      }
      setShowModal(false)
      setSelectedReport(null)
    } catch (error) {
      logger.error('Confirm action error:', error)
      handleError(error, toast, `Failed to ${selectedReport.action} report`)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-800 bg-red-100'
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const handleExportReports = () => {
    setShowExportModal(true)
  }
  
  const performExport = (exportType) => {
    try {
      let reportsToExport = []
      const reportsArray = Array.isArray(reports) ? reports : (reports?.reports || [])
      
      if (exportType === 'selected' && selectedReports.length > 0) {
        reportsToExport = reportsArray.filter(report => selectedReports.includes(report._id || report.id))
        if (reportsToExport.length === 0) {
          toast.error('No reports to export')
          return
        }
      } else if (exportType === 'selected') {
        toast.error('Please select at least one report to export')
        setShowExportModal(false)
        return
      } else {
        reportsToExport = reportsArray
      }
      
      if (reportsToExport.length === 0) {
        toast.error('No reports to export')
        setShowExportModal(false)
        return
      }
      
      // Prepare CSV data
      const csvContent = [
        ['Type', 'Reporter', 'Reported User', 'Reason', 'Priority', 'Status', 'Created At', 'Resolved At'].join(','),
        ...reportsToExport.map(report => [
          `"${report.type?.replace('_', ' ') || 'Unknown'}"`,
          `"${report.reportedBy?.fullName || report.reportedBy?.email || 'Unknown'}"`,
          `"${report.reportedUser?.fullName || report.reportedUser?.email || 'Unknown'}"`,
          `"${(report.reason || 'No reason').replace(/"/g, '""')}"`,
          `"${report.priority || 'medium'}"`,
          `"${report.status || 'pending'}"`,
          `"${formatDate(report.createdAt)}"`,
          `"${report.resolvedAt ? formatDate(report.resolvedAt) : 'N/A'}"`
        ].join(','))
      ].join('\n')
      
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileName = exportType === 'selected' 
        ? `reports_export_selected_${selectedReports.length}_${new Date().toISOString().split('T')[0]}.csv`
        : `reports_export_all_${new Date().toISOString().split('T')[0]}.csv`
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success(`Exported ${reportsToExport.length} report(s) successfully`)
      setShowExportModal(false)
    } catch (error) {
      handleError(error, toast, 'Failed to export reports')
      logger.error('Export error:', error)
      toast.error('Failed to export reports')
    }
  }

  return (
    <SafeComponent>
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 via-pink-50 to-rose-50 rounded-2xl p-8 shadow-lg border border-red-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                Content Reports
              </h1>
              {isConnected && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                  Live Data
                </span>
              )}
            </div>
            <p className="text-gray-600 text-lg">Handle flagged content and abuse reports</p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleExportReports}
              className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Reports</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reportsArray.filter(r => r.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Eye className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Investigating</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reportsArray.filter(r => r.status === 'under_review').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reportsArray.filter(r => r.status === 'resolved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
              </div>
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
                  placeholder="Search reports..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                className="input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <button 
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`btn btn-secondary ${showMoreFilters ? 'bg-blue-600 text-white' : ''}`}
              >
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* More Filters Panel */}
      {showMoreFilters && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                <select
                  className="input w-full"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="inappropriate_content">Inappropriate Content</option>
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="fake_account">Fake Account</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  className="input w-full"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setTypeFilter('all')
                    setPriorityFilter('all')
                  }}
                  className="btn btn-secondary"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reports ({reports.length})</CardTitle>
            <div className="flex items-center space-x-2">
              <select
                className="input text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="createdAt">Sort by Date</option>
                <option value="type">Sort by Type</option>
                <option value="status">Sort by Status</option>
                <option value="priority">Sort by Priority</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn btn-sm btn-secondary"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={selectedReports.length === currentReports.length && currentReports.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Reported User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentReports.map((report, index) => (
                  <TableRow key={report.id || report._id || `report-${index}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedReports.includes(report._id || report.id)}
                        onChange={() => handleReportSelect(report._id || report.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-gray-900 capitalize">
                        {report.type?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {report.reportedBy?.profilePic && (
                          <img src={report.reportedBy.profilePic} alt={report.reportedBy.fullName} className="w-6 h-6 rounded-full" />
                        )}
                        <span>{report.reportedBy?.fullName || report.reportedBy?.email || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {report.reportedUser?.profilePic && (
                          <img src={report.reportedUser.profilePic} alt={report.reportedUser.fullName} className="w-6 h-6 rounded-full" />
                        )}
                        <span>{report.reportedUser?.fullName || report.reportedUser?.email || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={report.reason}>{report.reason || 'No reason provided'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                        {report.priority || 'medium'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status || 'pending'}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(report.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleReportActionClick(report, 'view')}
                          className="p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors relative group"
                          title="View full details of this report"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            View Details
                          </span>
                        </button>
                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleReportActionClick(report, 'approve')}
                              className="p-2 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors relative group"
                              title="Approve this report"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Approve Report
                              </span>
                            </button>
                            <button
                              onClick={() => handleReportActionClick(report, 'reject')}
                              className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors relative group"
                              title="Reject this report"
                            >
                              <XCircle className="w-4 h-4" />
                              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Reject Report
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
          
          {!loading && currentReports.length === 0 && filteredReports.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">No Reports Found</p>
                <p className="text-gray-600 mt-2">
                  {searchTerm || filterStatus !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Try adjusting your filters to see more reports'
                    : 'No reports have been submitted yet'
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredReports.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredReports.length)} of {filteredReports.length} reports
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
                    <option value={20}>20</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={75}>75</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
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
                    disabled={currentPage === totalPages}
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

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedReport?.action === 'view' && 'Report Details'}
          {selectedReport?.action === 'approve' && 'Approve Report'}
          {selectedReport?.action === 'reject' && 'Reject Report'}
        </ModalHeader>
        <ModalContent>
          {selectedReport?.action === 'view' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Report Type</label>
                  <p className="text-sm text-gray-900 capitalize">
                    {selectedReport.type.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  <p className="text-sm text-gray-900 capitalize">{selectedReport.priority}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reporter</label>
                  <p className="text-sm text-gray-900">{selectedReport.reportedBy?.fullName || selectedReport.reportedBy?.email || selectedReport.reporter || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reported User</label>
                  <p className="text-sm text-gray-900">{selectedReport.reportedUser?.fullName || selectedReport.reportedUser?.email || selectedReport.reportedUser || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Content</label>
                  <p className="text-sm text-gray-900">{selectedReport.reportedContent?.caption || selectedReport.reportedContent?.content || selectedReport.content || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="text-sm text-gray-900 capitalize">{selectedReport.status}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reason</label>
                <p className="text-sm text-gray-900">{selectedReport.reason}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <p className="text-sm text-gray-900">{selectedReport.description}</p>
              </div>
            </div>
          )}
          {(selectedReport?.action === 'approve' || selectedReport?.action === 'reject') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to {selectedReport.action} this report?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  {selectedReport.action === 'approve' 
                    ? 'This will mark the report as approved and take appropriate action against the reported content/user.'
                    : 'This will mark the report as rejected and no action will be taken.'
                  }
                </p>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowModal(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAction}
            className={`btn ${selectedReport?.action === 'reject' ? 'btn-destructive' : 'btn-primary'}`}
          >
            {selectedReport?.action === 'view' && 'Close'}
            {selectedReport?.action === 'approve' && 'Approve'}
            {selectedReport?.action === 'reject' && 'Reject'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Export Modal */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)}>
        <ModalHeader onClose={() => setShowExportModal(false)}>
          Export Reports
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Choose what you want to export:
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => performExport('selected')}
                disabled={selectedReports.length === 0}
                className="w-full p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Export Selected Reports</div>
                    <div className="text-sm text-gray-600">
                      Export {selectedReports.length} selected report(s)
                    </div>
                  </div>
                  {selectedReports.length > 0 && (
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  )}
                </div>
              </button>
              
              <button
                onClick={() => performExport('all')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Export All Reports</div>
                    <div className="text-sm text-gray-600">
                      Export all reports in the current view
                    </div>
                  </div>
                </div>
              </button>
            </div>
            
            {selectedReports.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <strong>No reports selected.</strong> Please select at least one report to export selected reports, or choose "Export All Reports" to export all.
                </p>
              </div>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowExportModal(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </ModalFooter>
      </Modal>
    </div>
    </SafeComponent>
  )
}

export default Reports
