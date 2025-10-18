import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { formatDate } from '../utils/formatDate'
import { Search, Filter, Download, RefreshCw, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'

const Logs = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterType, setFilterType] = useState('all')

  // Dummy data
  const logs = [
    {
      id: 1,
      timestamp: '2024-10-15T10:30:00Z',
      level: 'info',
      type: 'user_action',
      message: 'User John Doe created a new travel post',
      userId: 'user_123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)',
      details: { postId: 'post_456', location: 'Paris, France' },
    },
    {
      id: 2,
      timestamp: '2024-10-15T10:25:00Z',
      level: 'warning',
      type: 'security',
      message: 'Multiple failed login attempts detected',
      userId: 'user_789',
      ipAddress: '192.168.1.200',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      details: { attempts: 5, blocked: true },
    },
    {
      id: 3,
      timestamp: '2024-10-15T10:20:00Z',
      level: 'error',
      type: 'system',
      message: 'Database connection timeout',
      userId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'System',
      details: { timeout: '30s', retries: 3 },
    },
    {
      id: 4,
      timestamp: '2024-10-15T10:15:00Z',
      level: 'info',
      type: 'moderation',
      message: 'Moderator Alice Johnson reviewed flagged content',
      userId: 'moderator_001',
      ipAddress: '192.168.1.150',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      details: { contentId: 'content_789', action: 'approved' },
    },
    {
      id: 5,
      timestamp: '2024-10-15T10:10:00Z',
      level: 'error',
      type: 'api',
      message: 'Rate limit exceeded for user',
      userId: 'user_456',
      ipAddress: '192.168.1.300',
      userAgent: 'Mozilla/5.0 (Android 11; Mobile)',
      details: { endpoint: '/api/posts', limit: '100/hour' },
    },
  ]

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel
    const matchesType = filterType === 'all' || log.type === filterType
    return matchesSearch && matchesLevel && matchesType
  })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
          <p className="text-gray-600 mt-2">Monitor system and app events</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button className="btn btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Errors</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(l => l.level === 'error').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Warnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(l => l.level === 'warning').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Info</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(l => l.level === 'info').length}
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
                <p className="text-sm font-medium text-gray-600">Success</p>
                <p className="text-2xl font-bold text-gray-900">
                  {logs.filter(l => l.level === 'success').length}
                </p>
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
                  placeholder="Search logs..."
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
              <button className="btn btn-secondary">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Logs ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
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
                        {log.type.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={log.message}>
                        {log.message}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.userId || 'N/A'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.ipAddress}
                    </TableCell>
                    <TableCell>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Info className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Log Details Modal would go here */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Log Details</h3>
        <p className="text-sm text-gray-600">
          Click on the info icon next to any log entry to view detailed information including
          user agent, request details, and additional metadata.
        </p>
      </div>

      {/* Real-time Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
            <div className="space-y-1">
              <div>[2024-10-15 10:35:00] INFO: User authentication successful for user_123</div>
              <div>[2024-10-15 10:34:45] INFO: New travel post created: post_789</div>
              <div>[2024-10-15 10:34:30] WARNING: High memory usage detected: 85%</div>
              <div>[2024-10-15 10:34:15] INFO: Database backup completed successfully</div>
              <div>[2024-10-15 10:34:00] INFO: Cache cleared for user_456</div>
              <div>[2024-10-15 10:33:45] ERROR: Failed to send push notification to user_789</div>
              <div>[2024-10-15 10:33:30] INFO: Moderator action: Content approved by moderator_001</div>
              <div>[2024-10-15 10:33:15] INFO: API rate limit reset for IP 192.168.1.100</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Logs
