import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import {
  ArrowLeft,
  Users,
  IndianRupee,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  CreditCard,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getConnectPageSubscribers } from '../services/connectAdminService'

const StatusPill = ({ status }) => {
  const map = {
    active: { cls: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
    initialized: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
    cancelled: { cls: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
    completed: { cls: 'bg-gray-50 text-gray-700 border-gray-200', icon: CheckCircle },
    expired: { cls: 'bg-gray-50 text-gray-500 border-gray-200', icon: XCircle },
    on_hold: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  }
  const m = map[status] || map.expired
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-full ${m.cls}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

const ConnectPageDetail = () => {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getConnectPageSubscribers(pageId)
      setData(res)
    } catch (err) {
      logger.error('Subscribers fetch error:', err)
      toast.error(handleError(err) || 'Failed to load subscribers')
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => { load() }, [load])

  const [statusFilter, setStatusFilter] = useState('all')

  const page = data?.page
  const allSubscriptions = data?.subscriptions || []
  const stats = data?.stats || { total: 0, active: 0, cancelled: 0, initialized: 0, monthlyRevenue: 0 }
  const subscriptions = statusFilter === 'all'
    ? allSubscriptions
    : allSubscriptions.filter(s => s.status === statusFilter)

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/connect-dashboard')}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate flex items-center gap-2">
              {page?.name || (loading ? 'Loading...' : 'Page')}
              {page?.category && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${page.category === 'community' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                  {page.category === 'community' ? 'Community' : 'Connect'}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 truncate">
              Owned by {page?.userId?.fullName || page?.userId?.username || '—'} ({page?.userId?.email || 'no email'})
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Total</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-600">{stats.total}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Active</span>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-600">{stats.initialized}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Cancelled</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-xl font-bold text-red-600">{stats.cancelled}</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-gray-100 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">MRR</span>
            <IndianRupee className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-600">
            ₹{stats.monthlyRevenue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Subscribers table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Subscribers</CardTitle>
            <div className="flex items-center gap-2">
              {[
                { value: 'all', label: 'All', count: stats.total },
                { value: 'active', label: 'Active', count: stats.active },
                { value: 'initialized', label: 'Pending', count: stats.initialized },
                { value: 'cancelled', label: 'Cancelled', count: stats.cancelled },
                { value: 'expired', label: 'Expired', count: allSubscriptions.filter(s => s.status === 'expired').length },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    statusFilter === f.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscriber</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Activated</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead>Last Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {statusFilter === 'all' ? 'No subscribers yet' : `No ${statusFilter} subscribers`}
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((s) => {
                  const successPayments = (s.payments || []).filter(p => p.status === 'success')
                  const lastPaid = successPayments.length
                    ? successPayments[successPayments.length - 1].paidAt
                    : null
                  return (
                    <TableRow key={s._id}>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {s.userId?.fullName || s.userId?.username || 'Deleted user'}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{s.userId?.username || '—'} • {s.userId?.email || 'no email'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><StatusPill status={s.status} /></TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        ₹{(s.amount || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {s.activatedAt ? formatDate(s.activatedAt) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-700">
                          <CreditCard className="w-3 h-3" />
                          {successPayments.length}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {lastPaid ? formatDate(lastPaid) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default ConnectPageDetail
