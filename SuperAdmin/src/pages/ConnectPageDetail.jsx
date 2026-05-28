import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
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
  Banknote,
  Globe,
  Copy,
  ShoppingBag,
  Truck,
  Ban,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getConnectPageSubscribers } from '../services/connectAdminService'
import { getConnectPagePayouts, markPayoutPaid } from '../services/subscriptionService'
import { getCommunityPageOrders, updateOrderStatus } from '../services/communityService'


const CURRENCY_SYM = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
const sym = (c) => CURRENCY_SYM[c] || c || ''
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PayoutStatusPill = ({ status }) => {
  const map = {
    calculated: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Awaiting payout' },
    pending: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending' },
    processing: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Processing' },
    completed: { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Paid' },
    failed: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Failed' },
  }
  const m = map[status] || map.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${m.cls}`}>
      {m.label}
    </span>
  )
}

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

const OrderStatusPill = ({ status }) => {
  const map = {
    pending: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending' },
    shipped: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Shipped' },
    delivered: { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Delivered' },
    cancelled: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Cancelled' },
  }
  const m = map[status] || map.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${m.cls}`}>
      {m.label}
    </span>
  )
}


const ConnectPageDetail = () => {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Payouts state
  const [payouts, setPayouts] = useState([])
  const [payoutsSummary, setPayoutsSummary] = useState(null)
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [markPaidModal, setMarkPaidModal] = useState({ open: false, payoutId: null, payoutMethod: '', creator: '', amount: 0, currency: 'INR' })
  const [markPaidForm, setMarkPaidForm] = useState({ reference: '', notes: '', paidAt: '' })
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false)

  // Orders state (for community pages)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true)
      const ord = await getCommunityPageOrders(pageId)
      setOrders(Array.isArray(ord) ? ord : [])
    } catch (err) {
      logger.error('Orders fetch error:', err)
      toast.error('Failed to load orders')
    } finally {
      setOrdersLoading(false)
    }
  }, [pageId])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getConnectPageSubscribers(pageId)
      setData(res)
      if (res.page?.category === 'community') {
        try {
          setOrdersLoading(true)
          const ord = await getCommunityPageOrders(pageId)
          setOrders(Array.isArray(ord) ? ord : [])
        } catch (err) {
          logger.error('Orders fetch error:', err)
          toast.error('Failed to load orders')
        } finally {
          setOrdersLoading(false)
        }
      }
    } catch (err) {
      logger.error('Subscribers fetch error:', err)
      const parsed = handleError(err)
      toast.error(parsed?.adminMessage || parsed?.message || 'Failed to load page details')
    } finally {
      setLoading(false)
    }
  }, [pageId])

  const loadPayouts = useCallback(async () => {
    if (data?.page?.category === 'community') return
    try {
      setPayoutsLoading(true)
      const res = await getConnectPagePayouts(pageId, { page: 1, limit: 50 })
      setPayouts(Array.isArray(res?.payouts) ? res.payouts : [])
      setPayoutsSummary(res?.summary || null)
    } catch (err) {
      logger.error('Payouts fetch error:', err)
      const parsed = handleError(err)
      toast.error(parsed?.adminMessage || parsed?.message || 'Failed to load payouts')
    } finally {
      setPayoutsLoading(false)
    }
  }, [pageId, data?.page?.category])


  useEffect(() => { load() }, [load])
  useEffect(() => { loadPayouts() }, [loadPayouts])

  const handleOpenMarkPaid = (payout) => {
    setMarkPaidModal({
      open: true,
      payoutId: payout._id,
      payoutMethod: payout.payoutMethod || (payout.isInternational ? 'wise' : 'cashfree_bank'),
      creator: payout.creatorId?.fullName || payout.creatorId?.username || '—',
      amount: payout.creatorPayout || 0,
      currency: payout.currency || 'INR',
    })
    setMarkPaidForm({ reference: '', notes: '', paidAt: new Date().toISOString().slice(0, 10) })
  }

  const closeMarkPaid = () => {
    if (markPaidSubmitting) return
    setMarkPaidModal({ open: false, payoutId: null, payoutMethod: '', creator: '', amount: 0, currency: 'INR' })
  }

  const handleMarkPaidSubmit = async () => {
    if (!markPaidModal.payoutId) return
    const reference = markPaidForm.reference.trim()
    if (!reference) {
      toast.error('Reference number is required')
      return
    }
    try {
      setMarkPaidSubmitting(true)
      await markPayoutPaid(markPaidModal.payoutId, {
        reference,
        notes: markPaidForm.notes.trim(),
        paidAt: markPaidForm.paidAt || undefined,
      })
      toast.success('Payout marked as paid')
      closeMarkPaid()
      loadPayouts()
    } catch (err) {
      const parsed = handleError(err)
      toast.error(parsed?.adminMessage || parsed?.message || 'Failed to mark payout')
    } finally {
      setMarkPaidSubmitting(false)
    }
  }

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      toast.success(`Order status updated to ${newStatus}`)
      loadOrders()
    } catch (err) {
      const parsed = handleError(err)
      toast.error(parsed?.adminMessage || parsed?.message || 'Failed to update order status')
    }
  }


  const copyToClipboard = (text, label) => {
    if (!text) return
    try {
      navigator.clipboard.writeText(String(text))
      toast.success(`${label} copied`)
    } catch {
      toast.error('Copy failed')
    }
  }

  const [statusFilter, setStatusFilter] = useState('all')

  const page = data?.page
  const allSubscriptions = Array.isArray(data?.subscriptions) ? data.subscriptions : []
  const rawStats = data?.stats
  const stats = {
    total: Number(rawStats?.total) || 0,
    active: Number(rawStats?.active) || 0,
    cancelled: Number(rawStats?.cancelled) || 0,
    initialized: Number(rawStats?.initialized) || 0,
    monthlyRevenue: Number(rawStats?.monthlyRevenue) || 0,
  }
  const subscriptions = statusFilter === 'all'
    ? allSubscriptions
    : allSubscriptions.filter(s => s.status === statusFilter)

  const isCommunity = page?.category === 'community'

  // Filter orders
  const filteredOrders = orderStatusFilter === 'all'
    ? orders
    : orders.filter(o => o.deliveryStatus === orderStatusFilter)

  if (isCommunity) {
    const totalOrdersCount = orders.length
    const pendingOrdersCount = orders.filter(o => o.deliveryStatus === 'pending').length
    const shippedOrdersCount = orders.filter(o => o.deliveryStatus === 'shipped').length
    const deliveredOrdersCount = orders.filter(o => o.deliveryStatus === 'delivered').length
    const totalSales = orders
      .filter(o => o.paymentStatus === 'completed' && o.deliveryStatus !== 'cancelled')
      .reduce((sum, o) => sum + (o.price || 0), 0)

    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/community-pages')}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate flex items-center gap-2">
                {page?.name || (loading ? 'Loading...' : 'Page')}
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                  Community
                </span>
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
              <span className="text-xs font-medium text-gray-600">Total Orders</span>
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-blue-600">{totalOrdersCount}</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Pending</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-amber-600">{pendingOrdersCount}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Shipped</span>
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-blue-600">{shippedOrdersCount}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Delivered</span>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-xl font-bold text-green-600">{deliveredOrdersCount}</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-gray-100 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Total Sales</span>
              <IndianRupee className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-bold text-purple-600">
              ₹{totalSales.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Orders</CardTitle>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { value: 'all', label: 'All', count: totalOrdersCount },
                  { value: 'pending', label: 'Pending', count: pendingOrdersCount },
                  { value: 'shipped', label: 'Shipped', count: shippedOrdersCount },
                  { value: 'delivered', label: 'Delivered', count: deliveredOrdersCount },
                  { value: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.deliveryStatus === 'cancelled').length },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setOrderStatusFilter(f.value)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                      orderStatusFilter === f.value
                        ? 'bg-purple-600 text-white border-purple-600'
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
                  <TableHead>Date</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Shipping Details</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Delivery Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading && filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Loading orders...
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      {orderStatusFilter === 'all' ? 'No orders yet' : `No ${orderStatusFilter} orders`}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((o) => (
                    <TableRow key={o._id}>
                      <TableCell className="text-xs text-gray-600">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {o.itemName}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        ₹{(o.price || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{o.buyerName}</div>
                          {o.userId && (
                            <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                              <div><strong>Acct:</strong> {o.userId.fullName || '—'} (@{o.userId.username || '—'})</div>
                              {o.userId.email && <div><strong>Email:</strong> {o.userId.email}</div>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-700 space-y-0.5 max-w-xs">
                          <div><strong>Phone:</strong> {o.buyerPhone}</div>
                          <div><strong>Pay Phone:</strong> {o.payPhone}</div>
                          <div className="flex items-start gap-1">
                            <span className="truncate"><strong>Addr:</strong> {o.deliveryAddress}</span>
                            <button
                              onClick={() => copyToClipboard(o.deliveryAddress, 'Address')}
                              className="text-gray-400 hover:text-gray-700 flex-shrink-0"
                              title="Copy Address"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${
                          o.paymentStatus === 'completed'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : o.paymentStatus === 'failed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {o.paymentStatus}
                        </span>
                      </TableCell>
                      <TableCell>
                        <OrderStatusPill status={o.deliveryStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {o.deliveryStatus === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(o._id, 'shipped')}
                                className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                              >
                                Ship
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(o._id, 'cancelled')}
                                className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {o.deliveryStatus === 'shipped' && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(o._id, 'delivered')}
                                className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                              >
                                Deliver
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(o._id, 'cancelled')}
                                className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {(o.deliveryStatus === 'delivered' || o.deliveryStatus === 'cancelled') && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

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
                  const paymentsArr = Array.isArray(s.payments) ? s.payments : []
                  const successPayments = paymentsArr.filter(p => p?.status === 'success')
                  const lastPaid = successPayments.length
                    ? successPayments[successPayments.length - 1]?.paidAt
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

      {/* ─────── BENEFICIARY DETAILS ─────── */}
      {page?.creatorPayoutInfo && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-gray-600" />
              Where to send the payout
              {page.creatorPayoutInfo.isInternational && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                  <Globe className="w-3 h-3" /> International (Wise)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-3">
              All payouts are sent manually. Use these details from the creator, then click <strong>Mark as Paid</strong> below with the reference number.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {page.creatorPayoutInfo.isInternational ? (
                <>
                  <BeneficiaryField label="Wise email" value={page.creatorPayoutInfo.wiseEmail} onCopy={copyToClipboard} />
                  <BeneficiaryField label="Wise currency" value={page.creatorPayoutInfo.wiseCurrency} onCopy={copyToClipboard} />
                </>
              ) : (
                <>
                  <BeneficiaryField label="Account holder" value={page.creatorPayoutInfo.bankAccountName} onCopy={copyToClipboard} />
                  <BeneficiaryField label="Bank account" value={page.creatorPayoutInfo.bankAccountNumber} onCopy={copyToClipboard} />
                  <BeneficiaryField label="IFSC" value={page.creatorPayoutInfo.bankIfsc} onCopy={copyToClipboard} />
                  <BeneficiaryField label="UPI ID" value={page.creatorPayoutInfo.upiId} onCopy={copyToClipboard} />
                </>
              )}
              <BeneficiaryField label="Country" value={page.creatorPayoutInfo.country} onCopy={copyToClipboard} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────── PAYOUTS ─────── */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-600" />
              Payouts
            </CardTitle>
            <button
              onClick={loadPayouts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
              disabled={payoutsLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${payoutsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {payoutsSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {(() => {
                const cur = sym(payouts?.[0]?.currency || 'INR')
                return (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">Total gross</div>
                      <div className="text-base font-bold text-gray-800">
                        {cur}{Number(payoutsSummary.totalGross || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">Paid out</div>
                      <div className="text-base font-bold text-green-700">
                        {cur}{Number(payoutsSummary.totalPaid || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">Pending</div>
                      <div className="text-base font-bold text-amber-700">
                        {cur}{Number(payoutsSummary.totalPending || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">Records</div>
                      <div className="text-base font-bold text-blue-700">{payoutsSummary.count || 0}</div>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Creator payout</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutsLoading && payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">Loading...</TableCell>
                </TableRow>
              ) : payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No payouts yet. Records appear at the end of each month once subscribers have paid.
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((p) => {
                  const isWise = p.payoutMethod === 'wise' || p.isInternational
                  const methodLabel = isWise
                    ? 'Wise'
                    : p.payoutMethod === 'cashfree_upi' ? 'UPI' : 'Bank'
                  const canMark = p.status === 'calculated' || p.status === 'failed' || p.status === 'pending' || p.status === 'processing'
                  return (
                    <TableRow key={p._id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {MONTH_NAMES[p.periodMonth] || p.periodMonth} {p.periodYear}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {sym(p.currency || 'INR')}{(p.grossAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-green-700">
                        {sym(p.currency || 'INR')}{(p.creatorPayout || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{methodLabel}</TableCell>
                      <TableCell><PayoutStatusPill status={p.status} /></TableCell>
                      <TableCell className="text-xs text-gray-600 truncate max-w-[160px]">
                        {p.payoutReference || '—'}
                        {p.processedAt && p.status === 'completed' ? (
                          <div className="text-[10px] text-gray-400">{formatDate(p.processedAt)}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {canMark ? (
                          <button
                            onClick={() => handleOpenMarkPaid(p)}
                            className="px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100"
                          >
                            Mark as Paid
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─────── MARK AS PAID MODAL ─────── */}
      <Modal isOpen={markPaidModal.open} onClose={closeMarkPaid}>
        <ModalHeader onClose={closeMarkPaid}>Mark Payout as Paid</ModalHeader>
        <ModalContent>
          <p className="text-sm text-gray-600 mb-3">
            Recording manual payout of{' '}
            <strong>{sym(markPaidModal.currency)}{(markPaidModal.amount || 0).toLocaleString()}</strong> to{' '}
            <strong>{markPaidModal.creator}</strong>
            {markPaidModal.payoutMethod === 'wise' ? ' via Wise' : markPaidModal.payoutMethod === 'cashfree_upi' ? ' via UPI' : ' via bank transfer'}.
            This does <strong>not</strong> move money — only marks it as paid in our records after you&apos;ve sent the transfer.
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={markPaidForm.reference}
            onChange={(e) => setMarkPaidForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder={markPaidModal.payoutMethod === 'wise' ? 'Wise transaction id' : 'UTR / UPI ref no'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Paid on</label>
          <input
            type="date"
            value={markPaidForm.paidAt}
            onChange={(e) => setMarkPaidForm((f) => ({ ...f, paidAt: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={markPaidForm.notes}
            onChange={(e) => setMarkPaidForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Any context for this payout"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </ModalContent>
        <ModalFooter>
          <button
            onClick={closeMarkPaid}
            disabled={markPaidSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMarkPaidSubmit}
            disabled={markPaidSubmitting || !markPaidForm.reference.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {markPaidSubmitting ? 'Saving…' : 'Confirm'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

const BeneficiaryField = ({ label, value, onCopy }) => {
  const display = value && String(value).trim() ? String(value) : '—'
  const hasValue = display !== '—'
  return (
    <div className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-800 truncate">{display}</div>
      </div>
      {hasValue && (
        <button
          onClick={() => onCopy(value, label)}
          className="text-gray-400 hover:text-gray-700"
          title={`Copy ${label}`}
        >
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default ConnectPageDetail
