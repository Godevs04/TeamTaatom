import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import {
  Users,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Film,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getCreatorRequests,
  approveCreatorRequest,
  rejectCreatorRequest,
  getLongVideos,
  updateLongVideo,
  deleteLongVideo,
} from '../services/longVideoService'

const formatDuration = (seconds) => {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—'
  const s = Math.max(0, Math.floor(Number(seconds)))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

const LongVideos = () => {
  const [tab, setTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [noteModal, setNoteModal] = useState({ open: false, id: null, action: null })
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const mountedRef = useRef(true)
  const debounceRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCreatorRequests({
        search: debouncedSearch,
        page: currentPage,
        limit: 20,
        status: statusFilter,
      })
      if (!mountedRef.current) return
      setRequests(data.requests || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      logger.error(error)
      toast.error(error?.response?.data?.message || 'Failed to load requests')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [debouncedSearch, currentPage, statusFilter])

  const loadVideos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLongVideos({
        search: debouncedSearch,
        page: currentPage,
        limit: 20,
      })
      if (!mountedRef.current) return
      setVideos(data.videos || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      logger.error(error)
      toast.error(error?.response?.data?.message || 'Failed to load videos')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [debouncedSearch, currentPage])

  useEffect(() => {
    if (tab === 'requests') loadRequests()
    else loadVideos()
  }, [tab, loadRequests, loadVideos])

  const runReview = async () => {
    if (!noteModal.id || !noteModal.action) return
    setSaving(true)
    try {
      if (noteModal.action === 'approve') {
        await approveCreatorRequest(noteModal.id, note.trim())
        toast.success('Creator approved')
      } else {
        await rejectCreatorRequest(noteModal.id, note.trim() || 'Not approved')
        toast.success('Creator rejected')
      }
      setNoteModal({ open: false, id: null, action: null })
      setNote('')
      loadRequests()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (row) => {
    try {
      await updateLongVideo(row._id, { isActive: !row.isActive })
      toast.success(row.isActive ? 'Deactivated' : 'Activated')
      loadVideos()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget?._id) return
    setSaving(true)
    try {
      await deleteLongVideo(deleteTarget._id)
      toast.success('Video deactivated')
      setDeleteTarget(null)
      loadVideos()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Video Creators</h1>
              <p className="text-blue-100">
                Review creator requests and manage uploaded long videos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (tab === 'requests' ? loadRequests() : loadVideos())}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setTab('requests')
            setCurrentPage(1)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            tab === 'requests' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
          }`}
        >
          Creator requests
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('videos')
            setCurrentPage(1)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            tab === 'videos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
          }`}
        >
          Uploaded videos
        </button>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <CardTitle className="text-xl font-bold text-gray-900">
            {tab === 'requests' ? 'Requests' : 'Videos'} ({total})
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {tab === 'requests' && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            )}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tab === 'requests' ? 'Search user…' : 'Search title…'}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {tab === 'requests' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                        No creator requests
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((row) => (
                      <TableRow key={row._id} className="hover:bg-blue-50/40">
                        <TableCell>
                          <div className="font-medium text-gray-900">
                            {row.user?.fullName || row.user?.username || '—'}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{row.user?.username} · {row.user?.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                          {row.message || '—'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : row.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {row.createdAt ? formatDate(row.createdAt) : '—'}
                        </TableCell>
                        <TableCell>
                          {row.status === 'pending' ? (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                title="Approve"
                                onClick={() =>
                                  setNoteModal({ open: true, id: row._id, action: 'approve' })
                                }
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Reject"
                                onClick={() =>
                                  setNoteModal({ open: true, id: row._id, action: 'reject' })
                                }
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 block text-right">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thumb</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && videos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : videos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                        No uploaded videos yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    videos.map((row) => (
                      <TableRow key={row._id} className="hover:bg-blue-50/40">
                        <TableCell>
                          {row.thumbnailUrl ? (
                            <img
                              src={row.thumbnailUrl}
                              alt=""
                              className="w-20 h-12 object-cover rounded-md bg-gray-100"
                            />
                          ) : (
                            <div className="w-20 h-12 bg-gray-100 rounded-md flex items-center justify-center">
                              <Film className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 max-w-xs truncate">
                          {row.caption || row.title || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {row.user?.fullName || row.user?.username || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDuration(row.durationSeconds)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {row.isActive ? (
                              <Power className="w-3 h-3" />
                            ) : (
                              <PowerOff className="w-3 h-3" />
                            )}
                            {row.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(row)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              {row.isActive ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={noteModal.open}
        onClose={() => !saving && setNoteModal({ open: false, id: null, action: null })}
      >
        <ModalHeader
          onClose={() => !saving && setNoteModal({ open: false, id: null, action: null })}
        >
          {noteModal.action === 'approve' ? 'Approve creator' : 'Reject creator'}
        </ModalHeader>
        <ModalContent>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            placeholder="Visible on the creator account"
          />
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => setNoteModal({ open: false, id: null, action: null })}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={runReview}
            disabled={saving}
            className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
              noteModal.action === 'approve' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {saving ? 'Saving…' : noteModal.action === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => !saving && setDeleteTarget(null)}>
        <ModalHeader onClose={() => !saving && setDeleteTarget(null)}>
          Deactivate video?
        </ModalHeader>
        <ModalContent>
          <p className="text-sm text-gray-600">
            Hide{' '}
            <span className="font-medium text-gray-900">
              {deleteTarget?.caption || 'this video'}
            </span>{' '}
            from the Videos tab.
          </p>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Removing…' : 'Deactivate'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default LongVideos
