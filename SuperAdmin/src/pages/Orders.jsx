import React, { useState, useEffect, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { useDebounce } from '../utils/debounce'
import { getOrders, updateOrderStatus } from '../services/connectAdminService'
import {
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Check,
  MapPin,
  User,
  Phone,
  Package,
  CreditCard,
  Truck,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────
// Stat Cards Component
// ─────────────────────────────────────────────
const StatCards = memo(({ stats, loading }) => {
  const cards = [
    {
      title: 'Total Revenue',
      value: stats?.totalRevenue != null ? `₹${stats.totalRevenue.toLocaleString('en-IN')}` : '—',
      icon: TrendingUp,
      color: 'text-emerald-600 border-emerald-100',
      bg: 'bg-emerald-50/60',
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders ?? '—',
      icon: ShoppingBag,
      color: 'text-indigo-600 border-indigo-100',
      bg: 'bg-indigo-50/60',
    },
    {
      title: 'Paid Purchases',
      value: stats?.paidOrders ?? '—',
      icon: CheckCircle,
      color: 'text-blue-600 border-blue-100',
      bg: 'bg-blue-50/60',
    },
    {
      title: 'Pending Delivery',
      value: stats?.pendingDelivery ?? '—',
      icon: Clock,
      color: 'text-amber-600 border-amber-100',
      bg: 'bg-amber-50/60',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.bg} rounded-xl p-5 border shadow-sm transition-all hover:shadow-md flex items-center justify-between`}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{card.title}</span>
            <div className={`text-2xl font-bold ${card.color.split(' ')[0]}`}>
              {loading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
              ) : (
                card.value
              )}
            </div>
          </div>
          <div className={`p-3 rounded-lg border ${card.color} bg-white flex items-center justify-center`}>
            <card.icon className="w-5 h-5" />
          </div>
        </div>
      ))}
    </div>
  )
})
StatCards.displayName = 'StatCards'

// ─────────────────────────────────────────────
// Status Badges Component
// ─────────────────────────────────────────────
const PaymentStatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    paid: { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle className="w-3 h-3" />, label: 'Paid' },
    failed: { bg: 'bg-rose-100 text-rose-700 border-rose-200', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
  }
  const c = config[status?.toLowerCase()] || { bg: 'bg-gray-100 text-gray-600 border-gray-200', icon: null, label: status }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

const DeliveryStatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    shipped: { bg: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Truck className="w-3 h-3" />, label: 'Shipped' },
    delivered: { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle className="w-3 h-3" />, label: 'Delivered' },
    cancelled: { bg: 'bg-gray-100 text-gray-700 border-gray-200', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
  }
  const c = config[status?.toLowerCase()] || { bg: 'bg-gray-100 text-gray-600 border-gray-200', icon: null, label: status }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────
// Main Orders Component
// ─────────────────────────────────────────────
export default function Orders() {
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  // Filtering states
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 400)
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [deliveryFilter, setDeliveryFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 })

  // Detailed Modal state
  const [detailModal, setDetailModal] = useState({ open: false, order: null })
  const [copiedField, setCopiedField] = useState(null)

  // ── Copy to clipboard micro-interaction ──
  const handleCopy = (text, fieldName) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ── Load Orders function ──
  const loadOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const data = await getOrders({
        page,
        limit: pagination.limit,
        paymentStatus: paymentFilter,
        deliveryStatus: deliveryFilter,
        search: debouncedSearch,
      })
      setOrders(data.orders || [])
      setStats(data.stats || null)
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 })
    } catch (err) {
      logger.error('Failed to load orders:', err)
      toast.error(handleError(err) || 'Failed to fetch physical item purchase orders')
    } finally {
      setLoading(false)
    }
  }, [paymentFilter, deliveryFilter, debouncedSearch, pagination.limit])

  // ── Initial Fetch & Trigger on Filter Change ──
  useEffect(() => {
    loadOrders(1)
  }, [paymentFilter, deliveryFilter, debouncedSearch])

  // ── Handle Status Update ──
  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdatingId(orderId)
      await updateOrderStatus(orderId, newStatus)
      toast.success(`Delivery status updated to "${newStatus}"`)
      
      // Update local state smoothly
      setOrders(prev => prev.map(order => 
        order._id === orderId ? { ...order, deliveryStatus: newStatus } : order
      ))

      // If active detailed order is open, update its local state too
      if (detailModal.open && detailModal.order?._id === orderId) {
        setDetailModal(prev => ({
          ...prev,
          order: { ...prev.order, deliveryStatus: newStatus }
        }))
      }

      // Re-fetch stats in background to keep totals accurate
      const data = await getOrders({
        page: pagination.page,
        limit: pagination.limit,
        paymentStatus: paymentFilter,
        deliveryStatus: deliveryFilter,
        search: debouncedSearch,
      })
      setStats(data.stats || null)
    } catch (err) {
      toast.error(handleError(err) || 'Failed to update delivery status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Physical Purchases & Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Track physical item sales, manage buyer shipping addresses, and update delivery status</p>
        </div>
        <button
          onClick={() => loadOrders(pagination.page)}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Panel */}
      <StatCards stats={stats} loading={loading && !stats} />

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by buyer name, phone, or item name..."
              className="block w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50"
            />
          </div>

          {/* Filtering options */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Payment Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" /> Payment:
              </span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Delivery Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-gray-400" /> Delivery:
              </span>
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
              >
                <option value="all">All Deliveries</option>
                <option value="pending">Pending</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

          </div>
        </div>
      </div>

      {/* Main Table / Grid Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium text-gray-600">Loading purchase orders...</p>
            <p className="text-xs text-gray-400 mt-1">Fetching buyer shipping addresses and records</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-gray-50/50">
            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center text-gray-400 mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No Purchase Orders Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              We couldn't find any physical item orders matching your current filters. Try relaxing your search query or filters.
            </p>
          </div>
        ) : (
          <div className="relative">
            <Table>
              <TableHeader className="bg-gray-50/70 border-b border-gray-100">
                <TableRow>
                  <TableHead className="w-[180px] font-semibold text-gray-600 text-xs tracking-wider uppercase py-3">Order ID & Date</TableHead>
                  <TableHead className="min-w-[150px] font-semibold text-gray-600 text-xs tracking-wider uppercase py-3">Buyer Details</TableHead>
                  <TableHead className="min-w-[180px] font-semibold text-gray-600 text-xs tracking-wider uppercase py-3">Item & Creator</TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-gray-600 text-xs tracking-wider uppercase py-3">Amount</TableHead>
                  <TableHead className="min-w-[180px] font-semibold text-gray-600 text-xs tracking-wider uppercase py-3">Delivery Address</TableHead>
                  <TableHead className="w-[140px] text-center font-semibold text-gray-600 text-xs tracking-wider uppercase py-3">Delivery Status</TableHead>
                  <TableHead className="w-[100px] text-center font-semibold text-gray-600 text-xs tracking-wider uppercase py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const creator = order.userId || {}
                  const page = order.connectPageId || {}
                  const isUpdating = updatingId === order._id

                  return (
                    <TableRow key={order._id} className="hover:bg-gray-50/30 transition-colors group">
                      {/* Order ID / Date */}
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 font-mono text-xs select-all">
                            {order._id.substring(0, 10)}...
                          </span>
                          <button
                            onClick={() => handleCopy(order._id, 'Order ID')}
                            className="text-gray-400 hover:text-blue-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy full Order ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {formatDate(order.createdAt)}
                        </div>
                      </TableCell>

                      {/* Buyer Details */}
                      <TableCell className="py-4">
                        <div className="font-semibold text-gray-800 flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          {order.buyerName}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1 hover:text-blue-600 transition-colors font-mono">
                          <Phone className="w-3 h-3 text-gray-300" />
                          <span>{order.buyerPhone}</span>
                          <button
                            onClick={() => handleCopy(order.buyerPhone, 'Phone number')}
                            className="p-0.5 rounded ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Copy className="w-2.5 h-2.5 text-gray-400" />
                          </button>
                        </div>
                      </TableCell>

                      {/* Item & Creator */}
                      <TableCell className="py-4">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-blue-500" />
                          <span className="truncate max-w-[200px]" title={order.itemName}>
                            {order.itemName}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                          <span className="truncate">Creator: <strong className="font-medium text-gray-700">{creator.fullName || creator.username || 'Unknown'}</strong></span>
                          {page.name && <span className="text-[10px] text-blue-600 bg-blue-50/60 border border-blue-100/50 rounded-md px-1.5 py-0.5 w-fit font-medium truncate max-w-[180px] mt-0.5">{page.name}</span>}
                        </div>
                      </TableCell>

                      {/* Amount / Payment Status */}
                      <TableCell className="text-right py-4">
                        <div className="font-bold text-gray-900 text-sm">
                          {order.currency === 'INR' ? '₹' : order.currency + ' '}
                          {(order.price || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="mt-1">
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </div>
                      </TableCell>

                      {/* Delivery Address */}
                      <TableCell className="py-4">
                        <div className="text-xs text-gray-600 max-w-[220px] line-clamp-2" title={order.deliveryAddress}>
                          {order.deliveryAddress}
                        </div>
                        <button
                          onClick={() => handleCopy(order.deliveryAddress, 'Delivery Address')}
                          className="mt-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Copy full address
                        </button>
                      </TableCell>

                      {/* Delivery Status (Interactable Select) */}
                      <TableCell className="py-4 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {isUpdating ? (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                              Updating...
                            </div>
                          ) : (
                            <select
                              value={order.deliveryStatus || 'pending'}
                              disabled={isUpdating}
                              onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                              className={`text-xs font-semibold rounded-full border px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all cursor-pointer ${
                                order.deliveryStatus === 'pending'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/60'
                                  : order.deliveryStatus === 'shipped'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/60'
                                  : order.deliveryStatus === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100/60'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-4 text-center">
                        <button
                          onClick={() => setDetailModal({ open: true, order })}
                          className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all"
                          title="View complete order details"
                        >
                          <Eye className="w-4.5 h-4.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <span className="text-xs font-medium text-gray-500">
                  Showing Page <strong className="text-gray-900">{pagination.page}</strong> of <strong className="text-gray-900">{pagination.totalPages}</strong> ({pagination.total} total orders)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => loadOrders(pagination.page - 1)}
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages || loading}
                    onClick={() => loadOrders(pagination.page + 1)}
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────
          ORDER DETAILS MODAL
      ───────────────────────────────────────────── */}
      {detailModal.open && detailModal.order && (() => {
        const order = detailModal.order
        const creator = order.userId || {}
        const page = order.connectPageId || {}
        const isUpdating = updatingId === order._id

        return (
          <Modal
            isOpen={detailModal.open}
            onClose={() => setDetailModal({ open: false, order: null })}
            className="sm:max-w-2xl"
          >
            <ModalHeader onClose={() => setDetailModal({ open: false, order: null })}>
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <span>Order Receipt & Details</span>
              </div>
            </ModalHeader>
            <ModalContent className="bg-gray-50/50">
              <div className="space-y-6">
                
                {/* Header Summary Card */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Order Reference ID</div>
                      <div className="text-sm font-semibold font-mono text-gray-800 select-all flex items-center gap-1.5 mt-0.5">
                        {order._id}
                        <button
                          onClick={() => handleCopy(order._id, 'Full Order ID')}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === 'Full Order ID' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Purchased on {formatDate(order.createdAt)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="text-xl font-black text-gray-900">
                        {order.currency === 'INR' ? '₹' : order.currency + ' '}
                        {(order.price || 0).toLocaleString('en-IN')}
                      </div>
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </div>
                  </div>

                  {/* Core product title */}
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 flex-shrink-0 mt-0.5">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Physical Purchased Item</h4>
                      <p className="text-base font-extrabold text-blue-600 mt-0.5">{order.itemName}</p>
                      {page.name && (
                        <div className="text-xs text-gray-500 mt-1">
                          Listed inside Page: <strong className="font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-md px-1.5 py-0.5 ml-1 inline-block">{page.name}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buyer & Shipping Info */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2.5">
                    <User className="w-3.5 h-3.5 text-gray-400" /> Buyer & Delivery Logistics
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-400">Buyer Full Name</div>
                      <div className="text-sm font-bold text-gray-800 mt-1">{order.buyerName}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400">Buyer Contact Phone</div>
                      <div className="text-sm font-semibold text-gray-800 mt-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-mono">{order.buyerPhone}</span>
                        <button
                          onClick={() => handleCopy(order.buyerPhone, 'Phone Number')}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === 'Phone Number' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2 mt-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" /> Shipping Destination Address
                    </div>
                    <p className="text-sm font-medium text-gray-700 leading-relaxed select-all whitespace-pre-line bg-white/70 p-3 rounded-lg border border-gray-200/50">
                      {order.deliveryAddress}
                    </p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleCopy(order.deliveryAddress, 'Shipping Address')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-100 rounded-md transition-colors"
                      >
                        {copiedField === 'Shipping Address' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Address to Clipboard
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cashfree & Payment Details */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2.5">
                    <CreditCard className="w-3.5 h-3.5 text-gray-400" /> Cashfree Gateway Context
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-semibold text-gray-400">Cashfree Order ID</span>
                      <p className="font-mono font-medium text-gray-800 mt-1 select-all break-all">{order.cashfreeOrderId || '—'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">Cashfree Payment ID</span>
                      <p className="font-mono font-medium text-gray-800 mt-1 select-all break-all">{order.cashfreePaymentId || '—'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">Session Signature</span>
                      <p className="font-mono font-medium text-gray-800 mt-1 select-all break-all truncate" title={order.paymentSessionId}>{order.paymentSessionId || '—'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">Transaction Gateway Env</span>
                      <p className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.cashfreeEnvironment === 'production'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}>
                          {order.cashfreeEnvironment || 'sandbox'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Page Owner / Creator Context */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
                    Seller Info (Creator Page)
                  </h4>
                  <div className="flex items-center gap-3">
                    {creator.profilePic ? (
                      <img
                        src={creator.profilePic}
                        alt={creator.username}
                        className="w-10 h-10 rounded-full border border-gray-200 shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                        {(creator.fullName?.[0] || creator.username?.[0] || 'C').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-gray-800">{creator.fullName || creator.username || 'Unknown Seller'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{creator.email || 'No email registered'}</div>
                    </div>
                  </div>
                </div>

                {/* Delivery Administration Board */}
                <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-amber-600" /> Delivery Status Management Board
                  </div>
                  <p className="text-xs text-gray-500">Update the physical order transit status. Make sure the package is physically processed before shifting statuses.</p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      { status: 'pending', label: 'Set Pending', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200' },
                      { status: 'shipped', label: 'Mark Shipped', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200' },
                      { status: 'delivered', label: 'Mark Delivered', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' },
                      { status: 'cancelled', label: 'Cancel Purchase', color: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200' },
                    ].map((act) => {
                      const isActive = order.deliveryStatus === act.status
                      return (
                        <button
                          key={act.status}
                          disabled={isUpdating || isActive}
                          onClick={() => handleStatusUpdate(order._id, act.status)}
                          className={`text-xs font-semibold px-3.5 py-2 rounded-lg border transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                            isActive
                              ? 'bg-gray-800 text-white border-gray-900 ring-2 ring-gray-200'
                              : act.color
                          }`}
                        >
                          {act.status === 'shipped' && <Truck className="w-3.5 h-3.5" />}
                          {act.status === 'delivered' && <CheckCircle className="w-3.5 h-3.5" />}
                          {act.status === 'cancelled' && <XCircle className="w-3.5 h-3.5" />}
                          {act.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                          {act.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            </ModalContent>
            <ModalFooter className="bg-white border-t border-gray-200">
              <button
                onClick={() => setDetailModal({ open: false, order: null })}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm w-full sm:w-auto"
              >
                Close Receipt
              </button>
            </ModalFooter>
          </Modal>
        )
      })()}
    </div>
  )
}
