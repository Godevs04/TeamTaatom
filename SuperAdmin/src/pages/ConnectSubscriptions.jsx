import React, { useState, useEffect, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import {
  Star,
  CheckCircle,
  XCircle,
  Clock,
  IndianRupee,
  Users,
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertTriangle,
  CreditCard,
  Globe,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getSubscriptionStats,
  getSubscriptionApprovals,
  approveSubscription,
  rejectSubscription,
  getPayouts,
} from '../services/subscriptionService'

// ─────────────────────────────────────────────
// Stat Cards
// ─────────────────────────────────────────────
const StatCards = memo(({ stats, loading }) => {
  const cards = [
    {
      title: 'Pending Approvals',
      value: stats?.pendingApprovals ?? '—',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Active Subscriptions',
      value: stats?.activeSubscriptions ?? '—',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Monthly Recurring Revenue',
      value: stats?.monthlyRecurringRevenue != null ? `₹${stats.monthlyRecurringRevenue.toLocaleString('en-IN')}` : '—',
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.bg} rounded-xl p-5 border border-gray-100`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{card.title}</span>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>
            {loading ? <span className="animate-pulse">...</span> : card.value}
          </div>
        </div>
      ))}
    </div>
  )
})
StatCards.displayName = 'StatCards'

// ─────────────────────────────────────────────
// Currency helper
// ─────────────────────────────────────────────
const CURRENCY_SYMBOLS = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ',
  JPY: '¥', KRW: '₩', THB: '฿',
}
const sym = (code) => CURRENCY_SYMBOLS[code] || code + ' '

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" /> },
    approved: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
    rejected: { bg: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
    calculated: { bg: 'bg-blue-100 text-blue-700', icon: <CreditCard className="w-3 h-3" /> },
    paid: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
    failed: { bg: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-3 h-3" /> },
  }
  const c = config[status] || { bg: 'bg-gray-100 text-gray-600', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg}`}>
      {c.icon}
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function ConnectSubscriptions() {
  const [activeTab, setActiveTab] = useState('approvals')

  // Stats
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Approvals
  const [approvals, setApprovals] = useState([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [approvalFilter, setApprovalFilter] = useState('pending')
  const [approvalPagination, setApprovalPagination] = useState({ page: 1, total: 0, totalPages: 1 })

  // Payouts
  const [payouts, setPayouts] = useState([])
  const [payoutSummary, setPayoutSummary] = useState(null)
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [payoutPagination, setPayoutPagination] = useState({ page: 1, total: 0, totalPages: 1 })

  // Reject modal
  const [rejectModal, setRejectModal] = useState({ open: false, pageId: null, pageName: '' })
  const [rejectReason, setRejectReason] = useState('')

  // ── Fetch stats ──
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const data = await getSubscriptionStats()
      setStats(data)
    } catch (err) {
      logger.error('Stats fetch error:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // ── Fetch approvals ──
  const loadApprovals = useCallback(async (page = 1) => {
    try {
      setApprovalsLoading(true)
      const data = await getSubscriptionApprovals({ status: approvalFilter, page, limit: 15 })
      setApprovals(data.pages || [])
      setApprovalPagination(data.pagination || { page: 1, total: 0, totalPages: 1 })
    } catch (err) {
      logger.error('Approvals fetch error:', err)
      toast.error('Failed to load approvals')
    } finally {
      setApprovalsLoading(false)
    }
  }, [approvalFilter])

  // ── Fetch payouts ──
  const loadPayouts = useCallback(async (page = 1) => {
    try {
      setPayoutsLoading(true)
      const data = await getPayouts({ page, limit: 15 })
      setPayouts(data.payouts || [])
      setPayoutSummary(data.summary || null)
      setPayoutPagination(data.pagination || { page: 1, total: 0, totalPages: 1 })
    } catch (err) {
      logger.error('Payouts fetch error:', err)
      toast.error('Failed to load payouts')
    } finally {
      setPayoutsLoading(false)
    }
  }, [])

  // ── Initial loads ──
  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    if (activeTab === 'approvals') loadApprovals(1)
  }, [activeTab, loadApprovals])

  useEffect(() => {
    if (activeTab === 'payouts') loadPayouts(1)
  }, [activeTab, loadPayouts])

  // ── Approve handler ──
  const handleApprove = async (pageId, pageName) => {
    if (!window.confirm(`Approve subscription price for "${pageName}"?`)) return
    try {
      await approveSubscription(pageId)
      toast.success(`Approved: ${pageName}`)
      loadApprovals(approvalPagination.page)
      loadStats()
    } catch (err) {
      toast.error(handleError(err) || 'Failed to approve')
    }
  }

  // ── Reject handler ──
  const handleRejectOpen = (pageId, pageName) => {
    setRejectModal({ open: true, pageId, pageName })
    setRejectReason('')
  }

  const handleRejectConfirm = async () => {
    if (!rejectModal.pageId) return
    try {
      await rejectSubscription(rejectModal.pageId, rejectReason)
      toast.success(`Rejected: ${rejectModal.pageName}`)
      setRejectModal({ open: false, pageId: null, pageName: '' })
      loadApprovals(approvalPagination.page)
      loadStats()
    } catch (err) {
      toast.error(handleError(err) || 'Failed to reject')
    }
  }

  // ── Pagination helpers ──
  const Pagination = ({ pagination, onPageChange }) => {
    if (pagination.totalPages <= 1) return null
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <span className="text-sm text-gray-500">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
        </span>
        <div className="flex gap-2">
          <button
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connect Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage subscription pricing approvals and creator payouts</p>
        </div>
        <button
          onClick={() => { loadStats(); if (activeTab === 'approvals') loadApprovals(1); else loadPayouts(1) }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <StatCards stats={stats} loading={statsLoading} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'approvals'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Price Approvals
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'payouts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Payouts
        </button>
      </div>

      {/* ─────── APPROVALS TAB ─────── */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Filter row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <Filter className="w-4 h-4 text-gray-400" />
            {['pending', 'approved', 'rejected', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setApprovalFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  approvalFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {approvalsLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CheckCircle className="w-10 h-10 mb-2" />
              <p className="text-sm">No {approvalFilter === 'all' ? '' : approvalFilter} approvals found</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Page</th>
                    <th className="px-4 py-3 text-left">Creator</th>
                    <th className="px-4 py-3 text-right">Requested Price</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {approvals.map((p) => {
                    const approval = p.subscriptionApproval || {}
                    const creator = p.userId || {}
                    return (
                      <tr key={p._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-[180px]">{p.name}</div>
                          <div className="text-xs text-gray-400">{p._id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-800">{creator.fullName || creator.username || '—'}</div>
                          <div className="text-xs text-gray-400">{creator.email || ''}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-gray-900">
                            {sym(p.subscriptionCurrency || 'INR')}{(approval.requestedPrice || p.subscriptionPrice || 0).toLocaleString()}
                          </span>
                          <span className="text-gray-400 text-xs">/mo</span>
                          {p.subscriptionCurrency && p.subscriptionCurrency !== 'INR' && (
                            <span className="block text-xs text-gray-400">{p.subscriptionCurrency}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={approval.status || 'none'} />
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {approval.approvedAt
                            ? formatDate(approval.approvedAt)
                            : approval.rejectedAt
                            ? formatDate(approval.rejectedAt)
                            : formatDate(p.updatedAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {approval.status === 'pending' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleApprove(p._id, p.name)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectOpen(p._id, p.name)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          ) : approval.status === 'rejected' && approval.rejectionReason ? (
                            <span className="text-xs text-red-500 italic truncate max-w-[120px] block" title={approval.rejectionReason}>
                              {approval.rejectionReason}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Pagination pagination={approvalPagination} onPageChange={(p) => loadApprovals(p)} />
            </>
          )}
        </div>
      )}

      {/* ─────── PAYOUTS TAB ─────── */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          {/* Payout summary cards */}
          {payoutSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Gross', value: payoutSummary.totalGross, color: 'text-gray-800' },
                { label: 'Commission', value: payoutSummary.totalCommission, color: 'text-blue-600' },
                { label: 'GST', value: payoutSummary.totalGst, color: 'text-amber-600' },
                { label: 'Creator Payouts', value: payoutSummary.totalCreatorPayout, color: 'text-green-600' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg border border-gray-100 p-4">
                  <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                  <div className={`text-lg font-bold ${s.color}`}>
                    ₹{(s.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payouts table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {payoutsLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading...</span>
              </div>
            ) : payouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <CreditCard className="w-10 h-10 mb-2" />
                <p className="text-sm">No payouts yet</p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Creator</th>
                      <th className="px-4 py-3 text-left">Page</th>
                      <th className="px-4 py-3 text-center">Period</th>
                      <th className="px-4 py-3 text-right">Gross</th>
                      <th className="px-4 py-3 text-right">Commission</th>
                      <th className="px-4 py-3 text-right">Creator Payout</th>
                      <th className="px-4 py-3 text-center">Method</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payouts.map((payout) => {
                      const creator = payout.creatorId || {}
                      const page = payout.connectPageId || {}
                      const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                      return (
                        <tr key={payout._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-gray-800 font-medium">{creator.fullName || creator.username || '—'}</div>
                            <div className="text-xs text-gray-400">{creator.email || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]">
                            {page.name || payout.connectPageId || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap">
                            {monthNames[payout.periodMonth] || payout.periodMonth} {payout.periodYear}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">
                            {sym(payout.currency || 'INR')}{(payout.grossAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600">
                            {sym(payout.currency || 'INR')}{(payout.commissionAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {sym(payout.currency || 'INR')}{(payout.creatorPayout || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {payout.isInternational ? (
                              <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                                <Globe className="w-3 h-3" /> Wise
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                {payout.payoutMethod === 'cashfree_upi' ? 'UPI' : 'Bank'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={payout.status} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <Pagination pagination={payoutPagination} onPageChange={(p) => loadPayouts(p)} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────── REJECT MODAL ─────── */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, pageId: null, pageName: '' })}>
        <ModalHeader onClose={() => setRejectModal({ open: false, pageId: null, pageName: '' })}>
          Reject Subscription Price
        </ModalHeader>
        <ModalContent>
          <p className="text-sm text-gray-600 mb-3">
            Rejecting price for <strong>{rejectModal.pageName}</strong>. The creator will be notified and can set a new price.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Price too high for the content offered"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setRejectModal({ open: false, pageId: null, pageName: '' })}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRejectConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Reject
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
