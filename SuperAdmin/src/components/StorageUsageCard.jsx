import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Cloud, RefreshCw, AlertCircle, Database, Folder } from 'lucide-react'
import { api } from '../services/api'
import { motion } from 'framer-motion'
import { Modal, ModalHeader, ModalContent } from './Modals/index.jsx'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB
const WARNING_THRESHOLD = 0.8 // 80%
const AUTO_REFRESH_MS = 60 * 1000 // 60 seconds

const StorageUsageCard = ({ autoRefresh = false, className = '' }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showFolders, setShowFolders] = useState(false)
  const abortControllerRef = useRef(null)
  const intervalRef = useRef(null)

  const fetchStorageUsage = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const response = await api.get('/api/v1/superadmin/storage-usage', {
        signal: abortControllerRef.current.signal,
      })
      const payload = response.data?.data || response.data
      setData({
        totalObjects: payload?.totalObjects ?? 0,
        totalSizeBytes: payload?.totalSizeBytes ?? 0,
        totalSizeFormatted: payload?.totalSizeFormatted ?? '0 B',
        folders: payload?.folders || {},
      })
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return
      setError(err?.parsedError?.userMessage || err?.message || 'Failed to load storage usage')
      setData(null)
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    fetchStorageUsage()
  }, [fetchStorageUsage])

  useEffect(() => {
    if (!autoRefresh) return
    intervalRef.current = setInterval(fetchStorageUsage, AUTO_REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchStorageUsage])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const percentUsed = data?.totalSizeBytes
    ? Math.min(100, (data.totalSizeBytes / MAX_SIZE_BYTES) * 100)
    : 0
  const isWarning = percentUsed >= WARNING_THRESHOLD * 100

  const folderRows = useMemo(() => {
    if (!data?.folders) return []
    return Object.entries(data.folders)
      .map(([name, stats]) => ({
        name,
        totalObjects: stats.totalObjects || 0,
        totalSizeBytes: stats.totalSizeBytes || 0,
        totalSizeFormatted: stats.totalSizeFormatted || '0 B',
        percentOfTotal: stats.percentOfTotal ?? 0,
      }))
      .sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)
  }, [data])

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl border-2 border-red-100 shadow-lg hover:shadow-xl transition-all duration-300 p-6 ${className}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-100">
              <Cloud className="w-4 h-4 text-red-500" />
            </div>
            Storage Usage
          </h3>
          <button
            onClick={fetchStorageUsage}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-white/60 text-gray-600 transition-all duration-200 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-14 h-14 text-red-400 mb-3" />
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchStorageUsage}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-semibold hover:from-red-600 hover:to-rose-700 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-gradient-to-br ${
        isWarning ? 'from-amber-50 to-orange-50 border-amber-200' : 'from-slate-50 via-indigo-50/50 to-cyan-50 border-slate-200'
      } rounded-2xl border-2 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 p-6 relative overflow-hidden group ${className}`}
    >
      {/* Subtle decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-200/20 to-cyan-200/20 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-slate-200/30 to-indigo-200/20 rounded-full blur-xl -ml-12 -mb-12" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`p-3.5 rounded-2xl shadow-lg ${
                isWarning
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                  : 'bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500'
              } transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
            >
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Storage Usage</h3>
              <p className="text-xs text-gray-500">R2 Object Storage</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFolders(true)}
              disabled={folderRows.length === 0}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium shadow-sm transition-all ${
                folderRows.length === 0
                  ? 'bg-white/60 border-slate-200/40 text-gray-400 cursor-not-allowed'
                  : 'bg-white/80 border-slate-200/60 text-gray-600 hover:bg-white'
              }`}
              title={
                folderRows.length === 0
                  ? 'Folder breakdown not available yet'
                  : 'View usage by folder'
              }
            >
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden xs:inline">By folder</span>
            </button>
            <button
              onClick={fetchStorageUsage}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/80 hover:bg-white shadow-sm text-gray-600 hover:text-indigo-600 transition-all duration-200 disabled:opacity-50 border border-slate-200/50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-14">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent" />
              <p className="text-xs text-gray-500">Loading storage stats...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p
                className={`text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r ${
                  isWarning ? 'from-amber-600 to-orange-600' : 'from-indigo-600 via-violet-600 to-cyan-600'
                } bg-clip-text text-transparent`}
              >
                {data?.totalSizeFormatted ?? '0 B'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/60 text-xs font-medium text-gray-600 shadow-sm">
                  <Database className="w-3.5 h-3.5 text-indigo-500" />
                  {data?.totalObjects?.toLocaleString() ?? 0} objects
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-500">Capacity used</span>
                <span className={isWarning ? 'text-amber-600 font-semibold' : 'text-gray-600'}>
                  {percentUsed.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-white/80 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentUsed}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    isWarning
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                      : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500'
                  } shadow-sm`}
                />
              </div>
              <p className="text-xs text-gray-400">of 10 GB allocated</p>
            </div>

            {isWarning && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/60"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-medium text-amber-700">Usage exceeds 80% — consider cleanup</p>
              </motion.div>
            )}
          </>
        )}
      </div>
      {/* Folder breakdown modal */}
      <Modal isOpen={showFolders} onClose={() => setShowFolders(false)} zIndex={60}>
        <ModalHeader onClose={() => setShowFolders(false)}>
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-500" />
            <span>Storage by Folder</span>
          </div>
        </ModalHeader>
        <ModalContent>
          {folderRows.length === 0 ? (
            <p className="text-sm text-gray-500">No folder data available.</p>
          ) : (
            <div className="space-y-4">
              {folderRows.map((folder) => (
                <div
                  key={folder.name}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-50">
                      <Folder className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {folder.name || 'root'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {folder.totalObjects.toLocaleString()} objects
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {folder.totalSizeFormatted}
                    </p>
                    <p className="text-xs text-gray-500">
                      {folder.percentOfTotal.toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalContent>
      </Modal>
    </motion.div>
  )
}

export default StorageUsageCard
