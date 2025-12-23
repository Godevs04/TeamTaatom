import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, CheckCircle, XCircle, Eye, AlertTriangle, RefreshCw, Download, Clock, User, Undo2 } from 'lucide-react'
import { useRealTime } from '../context/RealTimeContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'

// Memoized Report Row Component for performance
const ReportRow = memo(({ 
  report, 
  index,
  selectedReports,
  onSelect,
  onActionClick,
  isLockedByMe,
  isLockedByOther,
  lockInfo,
  isActionInProgress,
  getAgingBadge,
  getPriorityColor,
  getStatusColor,
  formatDate
}) => {
  const reportId = report._id || report.id
  const agingBadge = getAgingBadge(report.createdAt)
  
  return (
    <TableRow className={isLockedByMe ? 'bg-blue-50' : isLockedByOther ? 'bg-yellow-50 opacity-75' : ''}>
      <TableCell>
        <input
          type="checkbox"
          checked={selectedReports.includes(reportId)}
          onChange={() => onSelect(reportId)}
          className="rounded"
          disabled={isActionInProgress}
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
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
            {report.priority || 'medium'}
          </span>
          {agingBadge && report.status === 'pending' && (
            <span className={`px-2 py-0.5 rounded-full text-xs ${agingBadge.color}`}>
              {agingBadge.text}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
            {report.status || 'pending'}
          </span>
          {isLockedByMe && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 flex items-center gap-1">
              <User className="w-3 h-3" />
              You
            </span>
          )}
          {isLockedByOther && lockInfo && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 flex items-center gap-1">
              <User className="w-3 h-3" />
              {lockInfo.reviewerEmail?.split('@')[0] || 'Other'}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>{formatDate(report.createdAt)}</TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onActionClick(report, 'view')}
            disabled={isActionInProgress}
            className="p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors relative group disabled:opacity-50"
            title="View full details of this report"
          >
            <Eye className="w-4 h-4" />
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              View Details
            </span>
          </button>
          {report.status === 'pending' && !isLockedByOther && (
            <>
              <button
                onClick={() => onActionClick(report, 'approve')}
                disabled={isActionInProgress}
                className="p-2 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors relative group disabled:opacity-50"
                title="Approve this report"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Approve Report
                </span>
              </button>
              <button
                onClick={() => onActionClick(report, 'reject')}
                disabled={isActionInProgress}
                className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors relative group disabled:opacity-50"
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
  )
})

ReportRow.displayName = 'ReportRow'

// Content Preview Component (Lazy-loaded media)
const ContentPreview = memo(({ content }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  if (!content) return null
  
  return (
    <div className="space-y-3">
      {content.imageUrl && (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <AlertTriangle className="w-12 h-12" />
            </div>
          ) : (
            <img
              src={content.imageUrl}
              alt="Reported content"
              className={`w-full h-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true)
                setImageLoaded(false)
              }}
              loading="lazy"
            />
          )}
        </div>
      )}
      {content.videoUrl && (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
          <video
            src={content.videoUrl}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          />
        </div>
      )}
      {content.caption && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-900">{content.caption}</p>
        </div>
      )}
      {!content.imageUrl && !content.videoUrl && !content.caption && (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No content preview available</p>
        </div>
      )}
    </div>
  )
})

ContentPreview.displayName = 'ContentPreview'

// Helper: Calculate aging badge text
const getAgingBadge = (createdAt) => {
  if (!createdAt) return null
  const now = Date.now()
  const created = new Date(createdAt).getTime()
  const diffMs = now - created
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  
  if (diffDays > 0) return { text: `Pending for ${diffDays}d`, color: diffDays >= 7 ? 'bg-red-100 text-red-700' : diffDays >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700' }
  if (diffHours > 0) return { text: `Pending for ${diffHours}h`, color: 'bg-blue-100 text-blue-700' }
  if (diffMinutes > 0) return { text: `Pending for ${diffMinutes}m`, color: 'bg-gray-100 text-gray-700' }
  return { text: 'Just now', color: 'bg-gray-100 text-gray-700' }
}

// Priority order for sorting (higher = more important)
const PRIORITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 }

const Reports = () => {
  const { reports, fetchReports, isConnected } = useRealTime()
  const { user: currentAdmin } = useAuth()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [sortBy, setSortBy] = useState('priority') // Default to priority sort
  const [sortOrder, setSortOrder] = useState('desc')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedReports, setSelectedReports] = useState([])
  const [showExportModal, setShowExportModal] = useState(false)
  
  // Soft locking state (client-side only, no DB changes)
  const [lockedReports, setLockedReports] = useState(new Map()) // reportId -> { reviewerEmail, lockedAt, timeoutId }
  
  // Undo state for moderation actions
  const [undoState, setUndoState] = useState(null) // { reportId, previousStatus, action, timeoutId }
  
  // Action in-flight tracking
  const actionInProgressRef = useRef(new Set()) // Track reportIds being acted upon
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const searchDebounceTimerRef = useRef(null)
  const inactivityTimerRef = useRef(null)
  const UNDO_WINDOW_MS = 5000 // 5 seconds undo window
  const LOCK_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes inactivity timeout
  
  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Clean up all locks and timers
      lockedReports.forEach((lock) => {
        if (lock.timeoutId) clearTimeout(lock.timeoutId)
      })
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
      if (undoState?.timeoutId) clearTimeout(undoState.timeoutId)
    }
  }, [lockedReports, undoState])

  // Handle initial load state
  useEffect(() => {
    if (reports && reports.length > 0 && isMountedRef.current) {
      setIsInitialLoad(false)
    }
  }, [reports])
  
  // Auto-release locks on inactivity
  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now()
      setLockedReports(prev => {
        const updated = new Map(prev)
        let changed = false
        prev.forEach((lock, reportId) => {
          if (now - lock.lockedAt > LOCK_TIMEOUT_MS) {
            if (lock.timeoutId) clearTimeout(lock.timeoutId)
            updated.delete(reportId)
            changed = true
          }
        })
        return changed ? updated : prev
      })
    }
    
    const interval = setInterval(checkInactivity, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])
  
  // Auto-release lock when navigating away from modal
  useEffect(() => {
    if (!showModal && selectedReport) {
      releaseLock(selectedReport._id || selectedReport.id)
    }
  }, [showModal, selectedReport])

  // Soft locking functions
  const acquireLock = useCallback((reportId) => {
    if (!currentAdmin?.email) return false
    const reviewerEmail = currentAdmin.email
    const now = Date.now()
    
    setLockedReports(prev => {
      const existing = prev.get(reportId)
      // If already locked by someone else, don't acquire
      if (existing && existing.reviewerEmail !== reviewerEmail) {
        return prev
      }
      
      const updated = new Map(prev)
      // Clear existing timeout if any
      if (existing?.timeoutId) clearTimeout(existing.timeoutId)
      
      // Set new lock with timeout
      const timeoutId = setTimeout(() => {
        setLockedReports(prevLocked => {
          const updatedLocked = new Map(prevLocked)
          updatedLocked.delete(reportId)
          return updatedLocked
        })
      }, LOCK_TIMEOUT_MS)
      
      updated.set(reportId, { reviewerEmail, lockedAt: now, timeoutId })
      return updated
    })
    return true
  }, [currentAdmin])
  
  const releaseLock = useCallback((reportId) => {
    if (!reportId) return
    setLockedReports(prev => {
      const lock = prev.get(reportId)
      if (lock?.timeoutId) clearTimeout(lock.timeoutId)
      const updated = new Map(prev)
      updated.delete(reportId)
      return updated
    })
  }, [])
  
  const isLockedByMe = useCallback((reportId) => {
    if (!currentAdmin?.email) return false
    const lock = lockedReports.get(reportId)
    return lock && lock.reviewerEmail === currentAdmin.email
  }, [currentAdmin, lockedReports])
  
  const isLockedByOther = useCallback((reportId) => {
    if (!currentAdmin?.email) return false
    const lock = lockedReports.get(reportId)
    return lock && lock.reviewerEmail !== currentAdmin.email
  }, [currentAdmin, lockedReports])
  
  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    if (isMountedRef.current) {
      setCurrentPage(1)
    }
  }, [filterStatus, typeFilter, priorityFilter, sortBy, sortOrder])

  // Fetch reports data on component mount and when filters change (with deduplication)
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      logger.debug('Reports fetch already in progress, skipping duplicate call')
      return
    }
    
    const fetchData = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      isFetchingRef.current = true
      
      if (isMountedRef.current) {
        setLoading(true)
      }
      
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
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
          return
        }
        if (isMountedRef.current) {
          handleError(error, toast, 'Failed to fetch reports')
          logger.error('Error fetching reports:', error)
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
        isFetchingRef.current = false
      }
    }

    fetchData()
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchReports, currentPage, filterStatus, sortBy, sortOrder, typeFilter, priorityFilter])

  // Handle search with debouncing (standardized 500ms delay)
  useEffect(() => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    
    searchDebounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && searchTerm !== '') {
        setCurrentPage(1) // Reset to first page when searching
      }
    }, 500) // Standardized debounce delay: 500ms

    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
      }
    }
  }, [searchTerm])

  // Handle report actions with optimistic updates and undo
  const handleReportAction = useCallback(async (reportId, action) => {
    // Prevent duplicate actions
    if (actionInProgressRef.current.has(reportId)) {
      logger.debug(`Action already in progress for report ${reportId}`)
      return
    }
    
    if (!isMountedRef.current) return
    
    // Get current report state for rollback
    const reportsArray = Array.isArray(reports) ? reports : (reports?.reports || [])
    const report = reportsArray.find(r => (r._id || r.id) === reportId)
    if (!report) return
    
    const previousStatus = report.status
    actionInProgressRef.current.add(reportId)
    
    // Optimistic update
    const status = action === 'approve' ? 'resolved' : 'dismissed'
    
    try {
      await api.patch(`/api/v1/superadmin/reports/${reportId}`, {
        status,
        adminNotes: action === 'approve' ? 'Report approved by admin' : 'Report dismissed by admin'
      })
      
      if (!isMountedRef.current) return
      
      // Release lock
      releaseLock(reportId)
      
      // Set undo state
      const undoTimeoutId = setTimeout(() => {
        setUndoState(null)
      }, UNDO_WINDOW_MS)
      
      setUndoState({
        reportId,
        previousStatus,
        action,
        timeoutId: undoTimeoutId
      })
      
      toast.success(
        (t) => (
          <div className="flex items-center justify-between">
            <span>Report {action}d successfully</span>
            <button
              onClick={() => {
                handleUndo(reportId, previousStatus)
                toast.dismiss(t.id)
              }}
              className="ml-4 text-blue-600 hover:text-blue-800 font-semibold"
            >
              Undo
            </button>
          </div>
        ),
        { duration: UNDO_WINDOW_MS }
      )
      
      // Remove the report from selected reports if it was selected
      setSelectedReports(prev => prev.filter(id => id !== reportId))
      
      // Refresh reports after action (non-blocking)
      if (isMountedRef.current) {
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
        
        fetchReports(params).catch(err => {
          logger.error('Refresh error:', err)
        })
      }
    } catch (error) {
      if (!isMountedRef.current) return
      
      logger.error('Report action error:', error)
      handleError(error, toast, `Failed to ${action} report`)
      
      // Rollback would happen via refetch, but we could also optimistically revert here
    } finally {
      actionInProgressRef.current.delete(reportId)
    }
  }, [reports, currentPage, filterStatus, typeFilter, priorityFilter, fetchReports, releaseLock])
  
  // Undo action (client-side only, calls API to revert)
  const handleUndo = useCallback(async (reportId, previousStatus) => {
    if (!isMountedRef.current) return
    
    try {
      await api.patch(`/api/v1/superadmin/reports/${reportId}`, {
        status: previousStatus,
        adminNotes: 'Action undone by admin'
      })
      
      // Clear undo state
      if (undoState?.timeoutId) clearTimeout(undoState.timeoutId)
      setUndoState(null)
      
      toast.success('Action undone successfully')
      
      // Refresh reports
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
      logger.error('Undo error:', error)
      handleError(error, toast, 'Failed to undo action')
    }
  }, [undoState, currentPage, filterStatus, typeFilter, priorityFilter, fetchReports])
  
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

  // Get filtered and sorted reports (with auto-sort by priority and age)
  const reportsArray = Array.isArray(reports) ? reports : (reports?.reports || [])
  
  // Filter reports
  const filteredReports = useMemo(() => {
    let filtered = reportsArray.filter(report => {
      if (searchTerm) {
        const matchesSearch = report.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reportedBy?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reportedBy?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reportedUser?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reportedUser?.email?.toLowerCase().includes(searchTerm.toLowerCase())
        
        if (!matchesSearch) return false
      }
      return true
    })
    
    // Auto-sort by priority and age (if sortBy is 'priority' or default)
    if (sortBy === 'priority' || (!sortBy || sortBy === 'createdAt')) {
      filtered.sort((a, b) => {
        // First sort by priority (critical > high > medium > low)
        const priorityA = PRIORITY_ORDER[a.priority] || 0
        const priorityB = PRIORITY_ORDER[b.priority] || 0
        
        if (priorityA !== priorityB) {
          return sortOrder === 'desc' ? priorityB - priorityA : priorityA - priorityB
        }
        
        // Then sort by age (newer first if desc, older first if asc)
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      })
    } else {
      // Manual sorting by other fields
      filtered.sort((a, b) => {
        let aVal = a[sortBy]
        let bVal = b[sortBy]
        
        if (sortBy === 'createdAt') {
          aVal = new Date(aVal).getTime()
          bVal = new Date(bVal).getTime()
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }
    
    return filtered
  }, [reportsArray, searchTerm, sortBy, sortOrder])

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

  const handleReportActionClick = useCallback((report, action) => {
    if (!isMountedRef.current) return
    
    const reportId = report._id || report.id
    
    // Acquire lock when viewing/acting on report
    if (action === 'view' || action === 'approve' || action === 'reject') {
      if (!acquireLock(reportId)) {
        // Locked by someone else
        const lock = lockedReports.get(reportId)
        toast.warning(`This report is being reviewed by ${lock?.reviewerEmail || 'another moderator'}`)
        return
      }
    }
    
    setSelectedReport({ ...report, action })
    setShowModal(true)
  }, [acquireLock, lockedReports])

  const handleConfirmAction = useCallback(async () => {
    if (!selectedReport || !isMountedRef.current) {
      setShowModal(false)
      return
    }
    
    // Soft confirmation for resolve/dismiss
    if (selectedReport.action === 'approve' || selectedReport.action === 'reject') {
      const confirmed = window.confirm(
        `Are you sure you want to ${selectedReport.action === 'approve' ? 'resolve' : 'dismiss'} this report? This action cannot be undone.`
      )
      if (!confirmed) return
    }
    
    try {
      if (selectedReport.action === 'approve' || selectedReport.action === 'reject') {
        await handleReportAction(selectedReport._id || selectedReport.id, selectedReport.action)
      }
      if (isMountedRef.current) {
        setShowModal(false)
        setSelectedReport(null)
      }
    } catch (error) {
      if (isMountedRef.current) {
        logger.error('Confirm action error:', error)
        handleError(error, toast, `Failed to ${selectedReport.action} report`)
      }
    }
  }, [selectedReport, handleReportAction])

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
                <option value="priority">Sort by Priority (Auto)</option>
                <option value="createdAt">Sort by Date</option>
                <option value="type">Sort by Type</option>
                <option value="status">Sort by Status</option>
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
                  <ReportRow
                    key={report.id || report._id || `report-${index}`}
                    report={report}
                    index={index}
                    selectedReports={selectedReports}
                    onSelect={handleReportSelect}
                    onActionClick={handleReportActionClick}
                    isLockedByMe={isLockedByMe(report._id || report.id)}
                    isLockedByOther={isLockedByOther(report._id || report.id)}
                    lockInfo={lockedReports.get(report._id || report.id)}
                    isActionInProgress={actionInProgressRef.current.has(report._id || report.id)}
                    getAgingBadge={getAgingBadge}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    formatDate={formatDate}
                  />
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
      <Modal isOpen={showModal} onClose={() => {
        if (selectedReport) {
          releaseLock(selectedReport._id || selectedReport.id)
        }
        setShowModal(false)
      }}>
        <ModalHeader onClose={() => {
          if (selectedReport) {
            releaseLock(selectedReport._id || selectedReport.id)
          }
          setShowModal(false)
        }}>
          {selectedReport?.action === 'view' && 'Report Details'}
          {selectedReport?.action === 'approve' && 'Approve Report'}
          {selectedReport?.action === 'reject' && 'Reject Report'}
        </ModalHeader>
        <ModalContent>
          {selectedReport?.action === 'view' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Report Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Report Type</label>
                    <p className="text-sm text-gray-900 capitalize">
                      {selectedReport.type?.replace('_', ' ') || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Priority</label>
                    <p className="text-sm text-gray-900 capitalize">{selectedReport.priority || 'medium'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <p className="text-sm text-gray-900 capitalize">{selectedReport.status || 'pending'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Created</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedReport.createdAt)}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reporter</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {selectedReport.reportedBy?.profilePic && (
                      <img src={selectedReport.reportedBy.profilePic} alt={selectedReport.reportedBy.fullName} className="w-8 h-8 rounded-full" />
                    )}
                    <p className="text-sm text-gray-900">{selectedReport.reportedBy?.fullName || selectedReport.reportedBy?.email || 'Unknown'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reported User</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {selectedReport.reportedUser?.profilePic && (
                      <img src={selectedReport.reportedUser.profilePic} alt={selectedReport.reportedUser.fullName} className="w-8 h-8 rounded-full" />
                    )}
                    <p className="text-sm text-gray-900">{selectedReport.reportedUser?.fullName || selectedReport.reportedUser?.email || 'Unknown'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reason</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedReport.reason || 'No reason provided'}</p>
                </div>
                {selectedReport.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedReport.description}</p>
                  </div>
                )}
              </div>
              
              {/* Right: Content Preview (Lazy-loaded) */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-gray-700">Reported Content Preview</label>
                {selectedReport.reportedContent ? (
                  <ContentPreview content={selectedReport.reportedContent} />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Content not available</p>
                  </div>
                )}
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
            onClick={() => {
              if (selectedReport) {
                releaseLock(selectedReport._id || selectedReport.id)
              }
              setShowModal(false)
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          {selectedReport?.action !== 'view' && (
            <button
              onClick={handleConfirmAction}
              className={`btn ${selectedReport?.action === 'reject' ? 'btn-destructive' : 'btn-primary'}`}
            >
              {selectedReport?.action === 'approve' && 'Approve'}
              {selectedReport?.action === 'reject' && 'Reject'}
            </button>
          )}
          {selectedReport?.action === 'view' && (
            <button
              onClick={() => {
                if (selectedReport) {
                  releaseLock(selectedReport._id || selectedReport.id)
                }
                setShowModal(false)
              }}
              className="btn btn-primary"
            >
              Close
            </button>
          )}
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
