import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import {
  Layers,
  Users,
  Star,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  Lock,
  IndianRupee,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getConnectPagesList } from '../services/connectAdminService'

const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-green-50 text-green-700 border-green-200',
    inactive: 'bg-gray-50 text-gray-700 border-gray-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${map[status] || map.inactive}`}>
      {status || 'unknown'}
    </span>
  )
}

const ConnectDashboard = () => {
  const navigate = useNavigate()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  const load = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true)
      const data = await getConnectPagesList({
        page: pageNum,
        limit: 15,
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setPages(data.pages || [])
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
    } catch (err) {
      logger.error('Connect pages fetch error:', err)
      toast.error(handleError(err) || 'Failed to load connect pages')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    load(1)
  }, [load])

  const onSearchSubmit = (e) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  const totalSubscribers = pages.reduce((sum, p) => sum + (p.subscriberCount || 0), 0)
  const totalRevenue = pages.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0)
  const subscribablePages = pages.filter(p => p.features?.subscription).length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600" />
            Connect Pages
          </h1>
          <p className="text-sm text-gray-500 mt-1">User-created Connect pages with subscriber counts</p>
        </div>
        <button
          onClick={() => load(pagination.page)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards (current page only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Pages</span>
            <Layers className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{pagination.total}</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">With Subscription</span>
            <Star className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-600">{subscribablePages}</div>
          <p className="text-xs text-gray-500 mt-1">on this page</p>
        </div>
        <div className="bg-green-50 rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Subscribers</span>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">{totalSubscribers}</div>
          <p className="text-xs text-gray-500 mt-1">on this page</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Page MRR</span>
            <IndianRupee className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">₹{totalRevenue.toLocaleString('en-IN')}</div>
          <p className="text-xs text-gray-500 mt-1">on this page</p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>All Connect Pages</CardTitle>
            <div className="flex items-center gap-2">
              <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search pages..."
                    className="w-48 pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </form>
              {['all', 'active', 'inactive', 'suspended'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Subscribers</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No Connect pages found
                  </TableCell>
                </TableRow>
              ) : (
                pages.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {p.profileImage ? (
                          <img
                            src={p.profileImage}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover bg-gray-100"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {(p.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate max-w-[160px]">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{p.owner?.fullName || p.owner?.username || '—'}</div>
                        <div className="text-xs text-gray-500">@{p.owner?.username || 'unknown'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${p.category === 'community' ? 'text-purple-700' : 'text-blue-700'}`}>
                          {p.category === 'community' ? 'Community' : 'Connect'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          {p.type === 'private' ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          {p.type || 'public'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-right text-sm">
                      {p.features?.subscription && p.subscriptionPrice
                        ? `₹${p.subscriptionPrice}`
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                        <Users className="w-3 h-3" />
                        {p.subscriberCount || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      ₹{(p.monthlyRevenue || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {p.createdAt ? formatDate(p.createdAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => navigate(`/connect-dashboard/${p._id}`)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-lg hover:bg-gray-50"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} pages
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConnectDashboard
