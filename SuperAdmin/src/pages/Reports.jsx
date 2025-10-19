import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react'

const Reports = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')

  // Dummy data
  const reports = [
    {
      id: 1,
      type: 'inappropriate_content',
      reporter: 'John Doe',
      reportedUser: 'Mike Johnson',
      content: 'Mountain hiking trail',
      reason: 'Contains inappropriate language',
      status: 'pending',
      priority: 'high',
      createdAt: '2024-10-15T10:30:00Z',
      description: 'User posted content with offensive language targeting other users.',
    },
    {
      id: 2,
      type: 'spam',
      reporter: 'Sarah Wilson',
      reportedUser: 'Anonymous User',
      content: 'Multiple promotional posts',
      reason: 'Spam and promotional content',
      status: 'resolved',
      priority: 'medium',
      createdAt: '2024-10-14T15:20:00Z',
      description: 'User is posting multiple promotional messages across different locations.',
    },
    {
      id: 3,
      type: 'harassment',
      reporter: 'Emma Brown',
      reportedUser: 'Tom Smith',
      content: 'Personal attacks in comments',
      reason: 'Harassment and bullying',
      status: 'investigating',
      priority: 'high',
      createdAt: '2024-10-13T09:15:00Z',
      description: 'User is sending harassing messages and making personal attacks.',
    },
    {
      id: 4,
      type: 'fake_location',
      reporter: 'Alex Chen',
      reportedUser: 'Lisa Wang',
      content: 'Fake travel location',
      reason: 'Misleading location information',
      status: 'pending',
      priority: 'low',
      createdAt: '2024-10-12T14:45:00Z',
      description: 'User is posting content with fake location tags.',
    },
  ]

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.reporter.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.reportedUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.reason.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const handleReportAction = (report, action) => {
    setSelectedReport({ ...report, action })
    setShowModal(true)
  }

  const handleConfirmAction = () => {
    console.log(`Performing ${selectedReport.action} on report ${selectedReport.id}`)
    setShowModal(false)
    setSelectedReport(null)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Reports</h1>
          <p className="text-gray-600 mt-2">Handle flagged content and abuse reports</p>
        </div>
        <div className="flex space-x-3">
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
                  {reports.filter(r => r.status === 'pending').length}
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
                  {reports.filter(r => r.status === 'investigating').length}
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
                  {reports.filter(r => r.status === 'resolved').length}
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
          <CardTitle>Reports ({filteredReports.length})</CardTitle>
        </CardHeader>
        <CardContent>
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
              {filteredReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <span className="font-medium text-gray-900 capitalize">
                      {report.type.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell>{report.reporter}</TableCell>
                  <TableCell>{report.reportedUser}</TableCell>
                  <TableCell className="max-w-xs truncate">{report.reason}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                      {report.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                      {report.status}
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
        </CardContent>
      </Card>

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
                  <p className="text-sm text-gray-900">{selectedReport.reporter}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reported User</label>
                  <p className="text-sm text-gray-900">{selectedReport.reportedUser}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Content</label>
                  <p className="text-sm text-gray-900">{selectedReport.content}</p>
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
  )
}

export default Reports
