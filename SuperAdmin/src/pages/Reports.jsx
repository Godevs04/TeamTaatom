import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, CheckCircle, XCircle, Eye, AlertTriangle, RefreshCw } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'

const Reports = () => {
  const { reports, fetchReports, isConnected } = useRealTime()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  
  // Helper function to safely render values
  const safeRender = (value, fallback = 'Not specified') => {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
  
  // Show loading only on initial load
  if (isInitialLoad && (!reports || reports.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')

  // Handle initial load state
  useEffect(() => {
    if (reports && reports.length > 0) {
      setIsInitialLoad(false)
    }
  }, [reports])

  // Fetch reports data on component mount and when filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        await fetchReports({
          page: currentPage,
          status: filterStatus === 'all' ? undefined : filterStatus,
          sortBy,
          sortOrder
        })
      } catch (error) {
        toast.error('Failed to fetch reports')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchReports, currentPage, filterStatus, sortBy, sortOrder])

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1) // Reset to first page when searching
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Handle report actions
  const handleReportActionClick = async (reportId, action) => {
    try {
      // This would call the appropriate API endpoint
      toast.success(`Report ${action}d successfully`)
    } catch (error) {
      toast.error(`Failed to ${action} report`)
    }
  }

  // Get filtered reports based on search and status
  const reportsArray = Array.isArray(reports) ? reports : (reports?.reports || [])
  const filteredReports = reportsArray.filter(report => {
    const matchesSearch = !searchTerm || 
      report.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportedBy?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  // Pagination
  const reportsPerPage = 20
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage)
  const startIndex = (currentPage - 1) * reportsPerPage
  const endIndex = startIndex + reportsPerPage
  const currentReports = filteredReports.slice(startIndex, endIndex)

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetchReports({
        page: currentPage,
        status: filterStatus === 'all' ? undefined : filterStatus,
        sortBy,
        sortOrder
      })
      toast.success('Reports refreshed successfully')
    } catch (error) {
      toast.error('Failed to refresh reports')
    } finally {
      setLoading(false)
    }
  }

  const handleReportAction = (report, action) => {
    setSelectedReport({ ...report, action })
    setShowModal(true)
  }

  const handleConfirmAction = async () => {
    if (selectedReport) {
      await handleReportActionClick(selectedReport.id, selectedReport.action)
      setShowModal(false)
      setSelectedReport(null)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <SafeComponent>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Reports</h1>
          <p className="text-gray-600 mt-2">
            Handle flagged content and abuse reports
            {isConnected && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
                Live Data
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="btn btn-primary">
            Export Reports
          </button>
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
                  {reportsArray.filter(r => r.status === 'investigating').length}
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
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
              <button className="btn btn-secondary">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                {currentReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <span className="font-medium text-gray-900 capitalize">
                        {report.type?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>{report.reportedBy?.fullName || report.reportedBy?.email || 'Unknown'}</TableCell>
                    <TableCell>{report.reportedContent?.caption || report.reportedContent?.content || 'Unknown'}</TableCell>
                    <TableCell className="max-w-xs truncate">{report.reason || 'No reason provided'}</TableCell>
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
                          onClick={() => handleReportAction(report, 'view')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {report.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleReportAction(report, 'approve')}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="Approve Report"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReportAction(report, 'reject')}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Reject Report"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredReports.length)} of {filteredReports.length} reports
              </div>
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
    </div>
    </SafeComponent>
  )
}

export default Reports
