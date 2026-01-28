import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { handleModalClose } from '../utils/modalUtils'
import { sanitizeText } from '../utils/sanitize'
import { 
  Music, 
  Search, 
  Upload, 
  Trash2, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Pause,
  Download,
  Filter,
  SortAsc,
  SortDesc,
  MoreVertical,
  TrendingUp,
  Users,
  Clock,
  FileAudio,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  AlertTriangle,
  Power,
  PowerOff,
  Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getSongs, uploadSong, deleteSong, toggleSongStatus, updateSong } from '../services/songService'
import { motion, AnimatePresence } from 'framer-motion'

// Lightweight waveform generator (simple visual bars, no audio processing)
const generateWaveform = (duration = 60, bars = 50) => {
  // Generate random heights for visual effect (not actual audio analysis)
  return Array.from({ length: bars }, () => Math.random() * 0.6 + 0.2)
}

// Memoized Song Row Component
const SongRow = memo(({
  song,
  index,
  selectedSongs,
  onSelect,
  onToggleStatus,
  onDeleteClick,
  onPreview,
  onEditClick,
  onPlayPause,
  playingAudio,
  formatDuration,
  SortIcon
}) => {
  const usageCount = song.usageCount || 0
  const isActive = song.isActive !== false
  const isUsed = usageCount > 0
  
  // Visual state: active & used, active & unused, inactive
  const getStateColor = () => {
    if (!isActive) return 'bg-gray-100 text-gray-600' // inactive
    if (isUsed) return 'bg-green-100 text-green-700' // active & used
    return 'bg-blue-100 text-blue-700' // active & unused
  }
  
  const getStateIcon = () => {
    if (!isActive) return <PowerOff className="w-3 h-3" />
    if (isUsed) return <CheckCircle className="w-3 h-3" />
    return <Music className="w-3 h-3" />
  }
  
  const getStateText = () => {
    if (!isActive) return 'Inactive'
    if (isUsed) return 'Active & Used'
    return 'Active & Unused'
  }
  
  // Lightweight waveform (generated once, cached)
  const waveform = useMemo(() => generateWaveform(song.duration), [song.duration])
  
  return (
    <motion.tr
      key={song._id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
    >
      <TableCell>
        <input
          type="checkbox"
          checked={selectedSongs.includes(song._id)}
          onChange={(e) => {
            if (e.target.checked) {
              onSelect([...selectedSongs, song._id])
            } else {
              onSelect(selectedSongs.filter(id => id !== song._id))
            }
          }}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPlayPause(song)}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
          >
            {playingAudio === song._id ? (
              <Pause className="w-4 h-4 text-blue-600" />
            ) : (
              <Play className="w-4 h-4 text-blue-600" />
            )}
          </button>
          <audio
            id={`audio-${song._id}`}
            src={song.s3Url || song.cloudinaryUrl || ''}
            onEnded={() => onPlayPause(song)}
            onError={(e) => {
              logger.error('Audio element error:', { songId: song._id, error: e })
            }}
            preload="none"
          />
          {/* Lightweight waveform preview */}
          <div className="flex items-center gap-0.5 h-8 w-20">
            {waveform.map((height, i) => (
              <div
                key={i}
                className="w-0.5 bg-blue-400 rounded-full transition-all hover:bg-blue-600"
                style={{ height: `${height * 100}%` }}
              />
            ))}
          </div>
          <span className="font-medium text-gray-900">{song.title}</span>
        </div>
      </TableCell>
      <TableCell className="text-gray-700">{song.artist}</TableCell>
      <TableCell>
        <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-semibold">
          {song.genre}
        </span>
      </TableCell>
      <TableCell className="text-gray-700">{formatDuration(song.duration)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-gray-700">
          <Users className="w-4 h-4" />
          <span className="font-medium">{usageCount}</span>
          {usageCount > 0 && (
            <span className="text-xs text-gray-500 ml-1">
              {usageCount === 1 ? 'post' : 'posts'}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-gray-600 text-sm">{formatDate(song.createdAt)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStateColor()}`}>
            {getStateIcon()}
            {getStateText()}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onPreview(song)}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
            title="Preview"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          <button
            onClick={() => onEditClick(song)}
            className="p-2 hover:bg-green-100 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4 text-green-600" />
          </button>
          <button
            onClick={() => onDeleteClick(song)}
            disabled={isUsed}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative group"
            title={isUsed ? 'Cannot delete: song is in use' : 'Delete'}
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            {isUsed && (
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                In use ({usageCount} {usageCount === 1 ? 'post' : 'posts'})
              </span>
            )}
          </button>
        </div>
      </TableCell>
    </motion.tr>
  )
})

SongRow.displayName = 'SongRow'

const Songs = () => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSongs, setTotalSongs] = useState(0)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState(null) // 'activate' | 'deactivate'
  const [bulkActionProgress, setBulkActionProgress] = useState(0)
  const [isBulkActionInProgress, setIsBulkActionInProgress] = useState(false)
  const [songToDelete, setSongToDelete] = useState(null)
  const [songToEdit, setSongToEdit] = useState(null)
  const [previewSong, setPreviewSong] = useState(null)
  const [editing, setEditing] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(null)
  const [sortField, setSortField] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedSongs, setSelectedSongs] = useState([])
  
  // Stability & performance refs
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const searchDebounceTimerRef = useRef(null)
  const cachedSongsRef = useRef(null)
  const cacheKeyRef = useRef(null)
  const beforeUnloadHandlerRef = useRef(null)
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    genre: 'General',
    durationMinutes: '', // Changed from duration to durationMinutes
    file: null,
    imageFile: null
  })
  const [editFormData, setEditFormData] = useState({
    title: '',
    artist: '',
    genre: 'General',
    durationMinutes: '', // Changed from duration to durationMinutes
    imageFile: null
  })

  // Lifecycle safety
  useEffect(() => {
    isMountedRef.current = true
    
    // Prevent navigation during bulk actions
    beforeUnloadHandlerRef.current = (e) => {
      if (isBulkActionInProgress) {
        e.preventDefault()
        e.returnValue = 'Bulk action in progress. Please wait...'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', beforeUnloadHandlerRef.current)
    
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
      }
      if (beforeUnloadHandlerRef.current) {
        window.removeEventListener('beforeunload', beforeUnloadHandlerRef.current)
      }
    }
  }, [isBulkActionInProgress])
  
  // Debounced search (combined title + artist, case-insensitive)
  useEffect(() => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    
    searchDebounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setDebouncedSearchQuery(searchQuery)
        setCurrentPage(1) // Reset to page 1 on search
      }
    }, 400) // 400ms debounce
    
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
      }
    }
  }, [searchQuery])
  
  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    if (isMountedRef.current) {
      setCurrentPage(1)
    }
  }, [selectedGenre, sortField, sortOrder, debouncedSearchQuery])
  
  // Load songs with caching and deduplication
  useEffect(() => {
    if (!isMountedRef.current) return
    
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      logger.debug('Songs fetch already in progress, skipping duplicate call')
      return
    }
    
    loadSongs()
  }, [currentPage, debouncedSearchQuery, selectedGenre, sortField, sortOrder])

  const loadSongs = useCallback(async () => {
    if (!isMountedRef.current) return
    
    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    isFetchingRef.current = true
    
    // Generate cache key
    const cacheKey = `${debouncedSearchQuery}-${selectedGenre}-${currentPage}-${sortField}-${sortOrder}`
    
    // Show cached data immediately if available
    if (cachedSongsRef.current && cacheKeyRef.current === cacheKey && isMountedRef.current) {
      setSongs(cachedSongsRef.current.songs)
      setTotalPages(cachedSongsRef.current.totalPages)
      setTotalSongs(cachedSongsRef.current.totalSongs)
    }
    
    if (isMountedRef.current) {
      setLoading(true)
    }
    
    try {
      const result = await getSongs(debouncedSearchQuery, selectedGenre, currentPage, 20)
      
      if (abortControllerRef.current?.signal?.aborted || !isMountedRef.current) {
        return
      }
      
      if (result && result.songs) {
        // Normalize songs to ensure isActive defaults to true when undefined/null
        const normalizedSongs = result.songs.map(song => ({
          ...song,
          isActive: song.isActive ?? true
        }))
        
        // Cache the result
        cachedSongsRef.current = {
          songs: normalizedSongs,
          totalPages: result.pagination?.totalPages || 1,
          totalSongs: result.pagination?.total || 0
        }
        cacheKeyRef.current = cacheKey
        
        if (isMountedRef.current) {
          setSongs(normalizedSongs)
          setTotalPages(result.pagination?.totalPages || 1)
          setTotalSongs(result.pagination?.total || 0)
        }
      } else {
        logger.error('Unexpected response structure:', result)
        if (isMountedRef.current) {
          setSongs([])
          setTotalPages(1)
          setTotalSongs(0)
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError' || !isMountedRef.current) {
        return
      }
      
      // Fallback to cached data on error
      if (cachedSongsRef.current && isMountedRef.current) {
        setSongs(cachedSongsRef.current.songs)
        setTotalPages(cachedSongsRef.current.totalPages)
        setTotalSongs(cachedSongsRef.current.totalSongs)
        toast.error('Failed to load songs. Showing cached data.', { duration: 3000 })
      } else {
        handleError(error, toast, 'Failed to load songs')
        if (isMountedRef.current) {
          setSongs([])
          setTotalPages(1)
          setTotalSongs(0)
        }
      }
      logger.error('Error loading songs:', error)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
      isFetchingRef.current = false
    }
  }, [debouncedSearchQuery, selectedGenre, currentPage, sortField, sortOrder])

  // Calculate statistics
  const statistics = useMemo(() => {
    // Count active songs (default to true when undefined/null)
    const activeSongs = songs.filter(s => s.isActive !== false).length
    const totalUsage = songs.reduce((sum, s) => sum + (s.usageCount || 0), 0)
    const avgDuration = songs.length > 0 
      ? Math.round(songs.reduce((sum, s) => sum + (s.duration || 0), 0) / songs.length)
      : 0
    
    return {
      total: totalSongs,
      active: activeSongs,
      inactive: totalSongs - activeSongs,
      totalUsage,
      avgDuration
    }
  }, [songs, totalSongs])

  // Sort songs
  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (sortField === 'duration') {
        aVal = a.duration || 0
        bVal = b.duration || 0
      } else if (sortField === 'usageCount') {
        aVal = a.usageCount || 0
        bVal = b.usageCount || 0
      } else if (sortField === 'createdAt') {
        aVal = new Date(a.createdAt).getTime()
        bVal = new Date(b.createdAt).getTime()
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }, [songs, sortField, sortOrder])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file size (100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File size must be less than 100MB')
        return
      }
      setFormData({ ...formData, file })
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate image file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid image format. Please use JPEG, PNG, WebP, or GIF')
        return
      }
      // Validate file size (10MB for images)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB')
        return
      }
      setFormData({ ...formData, imageFile: file })
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    
    if (!formData.file) {
      toast.error('Please select a song file')
      return
    }

    // Validate required fields
    const title = sanitizeText(formData.title).trim()
    const artist = sanitizeText(formData.artist).trim()

    if (!title || title.length === 0) {
      toast.error('Title is required and must be between 1 and 200 characters')
      return
    }
    if (title.length > 200) {
      toast.error('Title must be less than 200 characters')
      return
    }

    if (!artist || artist.length === 0) {
      toast.error('Artist is required and must be between 1 and 200 characters')
      return
    }
    if (artist.length > 200) {
      toast.error('Artist must be less than 200 characters')
      return
    }

    // Validate optional fields
    const genre = formData.genre ? sanitizeText(formData.genre).trim() : 'General'
    if (genre && genre.length > 50) {
      toast.error('Genre must be less than 50 characters')
      return
    }

    // Convert minutes to seconds for backend
    let durationInSeconds = 0
    if (formData.durationMinutes) {
      const minutes = parseFloat(formData.durationMinutes)
      if (isNaN(minutes) || minutes < 0) {
        toast.error('Duration must be a positive number')
        return
      }
      durationInSeconds = Math.round(minutes * 60)
    }

    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('song', formData.file)
      if (formData.imageFile) {
        uploadFormData.append('image', formData.imageFile)
      }
      uploadFormData.append('title', title)
      uploadFormData.append('artist', artist)
      uploadFormData.append('genre', genre)
      // Always send duration (even if 0) - backend expects integer
      uploadFormData.append('duration', durationInSeconds.toString())

      const response = await uploadSong(uploadFormData)
      toast.success(response.message || 'Song uploaded successfully')
      handleModalClose(setShowUploadModal, null, () => {
        setFormData({ title: '', artist: '', genre: 'General', durationMinutes: '', file: null, imageFile: null })
      })
      await loadSongs()
    } catch (error) {
      handleError(error, toast, 'Failed to upload song')
      logger.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteClick = useCallback((song) => {
    if (!isMountedRef.current) return
    
    const usageCount = song.usageCount || 0
    
    // Safe deletion: Check if song is referenced
    if (usageCount > 0) {
      toast.error(`Cannot delete: This song is used in ${usageCount} ${usageCount === 1 ? 'post' : 'posts'}. Deactivate it instead.`, { duration: 5000 })
      return
    }
    
    setSongToDelete(song)
    setShowDeleteModal(true)
  }, [])
  
  const handleDeleteConfirm = useCallback(async () => {
    if (!songToDelete || !isMountedRef.current) return
    
    const usageCount = songToDelete.usageCount || 0
    
    // Double-check usage before deletion
    if (usageCount > 0) {
      toast.error(`Cannot delete: Song is in use. Deactivate it instead.`)
      setShowDeleteModal(false)
      setSongToDelete(null)
      return
    }
    
    try {
      await deleteSong(songToDelete._id)
      if (isMountedRef.current) {
        toast.success('Song deleted successfully')
        setShowDeleteModal(false)
        setSongToDelete(null)
        loadSongs()
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, toast, 'Failed to delete song')
        logger.error('Delete error:', error)
      }
    }
  }, [songToDelete, loadSongs])

  const handleToggleStatus = useCallback(async (songId, currentStatus) => {
    if (!isMountedRef.current) return
    
    try {
      const newStatus = !currentStatus
      await toggleSongStatus(songId, newStatus)
      if (isMountedRef.current) {
        toast.success(`Song ${newStatus ? 'activated' : 'deactivated'} successfully`)
        loadSongs()
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, toast, 'Failed to toggle song status')
        logger.error('Toggle error:', error)
      }
    }
  }, [loadSongs])
  
  const handleBulkToggleStatus = useCallback(async (isActive) => {
    if (selectedSongs.length === 0 || !isMountedRef.current) {
      if (isMountedRef.current) {
        toast.error('Please select at least one song')
      }
      return
    }
    
    // Show confirmation
    const action = isActive ? 'activate' : 'deactivate'
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${selectedSongs.length} song(s)? This will ${isActive ? 'make them available' : 'hide them'} from users.`
    )
    if (!confirmed || !isMountedRef.current) return
    
    setIsBulkActionInProgress(true)
    setBulkActionProgress(0)
    
    try {
      const songsToUpdate = selectedSongs.filter(songId => {
        const song = songs.find(s => s._id === songId)
        return song && song.isActive !== isActive
      })
      
      const total = songsToUpdate.length
      let completed = 0
      
      // Process in batches to show progress
      for (const songId of songsToUpdate) {
        if (!isMountedRef.current) break
        
        try {
          await toggleSongStatus(songId, isActive)
          completed++
          if (isMountedRef.current) {
            setBulkActionProgress(Math.round((completed / total) * 100))
          }
        } catch (error) {
          logger.error(`Error updating song ${songId}:`, error)
        }
      }
      
      if (isMountedRef.current) {
        toast.success(`${completed} song(s) ${isActive ? 'activated' : 'deactivated'} successfully`)
        setSelectedSongs([])
        setBulkActionProgress(0)
        setShowBulkActionModal(false)
        setBulkActionType(null)
        loadSongs()
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, toast, 'Failed to update song status')
        logger.error('Bulk toggle error:', error)
      }
    } finally {
      if (isMountedRef.current) {
        setIsBulkActionInProgress(false)
      }
    }
  }, [selectedSongs, songs, loadSongs])

  const handleUpdate = async (e) => {
    e.preventDefault()
    
    if (!editFormData.title || !editFormData.artist) {
      toast.error('Title and artist are required')
      return
    }

    // Validate required fields
    const title = sanitizeText(editFormData.title).trim()
    const artist = sanitizeText(editFormData.artist).trim()

    if (!title || title.length === 0) {
      toast.error('Title is required and must be between 1 and 200 characters')
      return
    }
    if (title.length > 200) {
      toast.error('Title must be less than 200 characters')
      return
    }

    if (!artist || artist.length === 0) {
      toast.error('Artist is required and must be between 1 and 200 characters')
      return
    }
    if (artist.length > 200) {
      toast.error('Artist must be less than 200 characters')
      return
    }

    // Validate optional fields
    const genre = editFormData.genre ? sanitizeText(editFormData.genre).trim() : 'General'
    if (genre && genre.length > 50) {
      toast.error('Genre must be less than 50 characters')
      return
    }

    // Convert minutes to seconds for backend
    let durationInSeconds = undefined
    if (editFormData.durationMinutes) {
      const minutes = parseFloat(editFormData.durationMinutes)
      if (isNaN(minutes) || minutes < 0) {
        toast.error('Duration must be a positive number')
        return
      }
      durationInSeconds = Math.round(minutes * 60)
    }

    setEditing(true)
    try {
      // If image file is provided, use FormData; otherwise use JSON
      if (editFormData.imageFile) {
        const formData = new FormData()
        formData.append('image', editFormData.imageFile)
        formData.append('title', title)
        formData.append('artist', artist)
        formData.append('genre', genre)
        // Only include duration if provided
        if (durationInSeconds !== undefined) {
          formData.append('duration', durationInSeconds.toString())
        }

        await updateSong(songToEdit._id, formData, true) // Pass true to indicate FormData
      } else {
        const updateData = {
          title,
          artist,
          genre
        }
        
        // Only include duration if provided
        if (durationInSeconds !== undefined) {
          updateData.duration = durationInSeconds
        }

        await updateSong(songToEdit._id, updateData)
      }
      
      toast.success('Song updated successfully')
      handleModalClose(setShowEditModal, setSongToEdit, () => {
        setEditFormData({ title: '', artist: '', genre: 'General', durationMinutes: '', imageFile: null })
      })
      await loadSongs()
    } catch (error) {
      handleError(error, toast, 'Failed to update song')
      logger.error('Update error:', error)
    } finally {
      setEditing(false)
    }
  }

  const handlePlayPause = useCallback((song) => {
    if (!isMountedRef.current) return
    
    // Get the audio URL - try s3Url first, then cloudinaryUrl as fallback
    const audioUrl = song.s3Url || song.cloudinaryUrl
    
    if (!audioUrl) {
      logger.error('No audio URL available for song:', { songId: song._id, song })
      if (isMountedRef.current) {
        toast.error('Audio URL not available for this song')
      }
      return
    }
    
    if (playingAudio === song._id) {
      setPlayingAudio(null)
      // Stop audio if playing
      const audio = document.getElementById(`audio-${song._id}`)
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    } else {
      // Stop any currently playing audio
      if (playingAudio) {
        const currentAudio = document.getElementById(`audio-${playingAudio}`)
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }
      }
      
      setPlayingAudio(song._id)
      // Play audio
      const audio = document.getElementById(`audio-${song._id}`)
      if (audio) {
        // Ensure the src is set correctly
        if (audio.src !== audioUrl && audioUrl) {
          audio.src = audioUrl
        }
        
        // Add error handler
        const handleError = (e) => {
          logger.error('Error playing audio:', { 
            songId: song._id, 
            error: e, 
            url: audioUrl,
            audioError: audio.error 
          })
          if (isMountedRef.current) {
            setPlayingAudio(null)
            toast.error('Failed to play audio. The file may be corrupted or inaccessible.')
          }
        }
        
        audio.addEventListener('error', handleError, { once: true })
        
        audio.play().catch(err => {
          logger.error('Error playing audio:', { 
            songId: song._id, 
            error: err, 
            url: audioUrl,
            errorName: err.name,
            errorMessage: err.message
          })
          if (isMountedRef.current) {
            setPlayingAudio(null)
            // Provide more specific error messages
            if (err.name === 'NotSupportedError') {
              toast.error('Audio format not supported or URL is invalid')
            } else if (err.name === 'NotAllowedError') {
              toast.error('Audio playback was blocked. Please interact with the page first.')
            } else {
              toast.error('Failed to play audio. Please check the audio file.')
            }
          }
        })
      } else {
        logger.error('Audio element not found:', { songId: song._id })
        if (isMountedRef.current) {
          setPlayingAudio(null)
          toast.error('Audio player not found')
        }
      }
    }
  }, [playingAudio])
  
  const handlePreview = useCallback((song) => {
    if (isMountedRef.current) {
      setPreviewSong(song)
      setShowPreviewModal(true)
    }
  }, [])
  
  const handleEditClick = useCallback((song) => {
    if (!isMountedRef.current) return
    
    setSongToEdit(song)
    // Convert seconds to minutes for display
    const durationMinutes = song.duration ? (song.duration / 60).toFixed(2) : ''
    setEditFormData({
      title: song.title || '',
      artist: song.artist || '',
      genre: song.genre || 'General',
      durationMinutes: durationMinutes,
      imageFile: null // Reset image file on edit
    })
    setShowEditModal(true)
  }, [])

  const handleEditImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate image file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid image format. Please use JPEG, PNG, WebP, or GIF')
        return
      }
      // Validate file size (10MB for images)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB')
        return
      }
      setEditFormData({ ...editFormData, imageFile: file })
    }
  }
  
  const handleSelectAll = useCallback((e) => {
    if (!isMountedRef.current) return
    
    if (e.target.checked) {
      setSelectedSongs(songs.map(s => s._id))
    } else {
      setSelectedSongs([])
    }
  }, [songs])

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const genres = ['General', 'Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'Country', 'R&B', 'Other']

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <SortAsc className="w-4 h-4 ml-1" /> : <SortDesc className="w-4 h-4 ml-1" />
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 shadow-xl border border-blue-200"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Song Management</h1>
              <p className="text-blue-100 text-lg">Manage and organize your music library</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadSongs}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-6 py-2 bg-white text-blue-600 rounded-lg transition-all shadow-lg hover:shadow-xl font-semibold hover:bg-blue-50"
            >
              <Upload className="w-5 h-5" />
              Upload Song
            </button>
          </div>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Total Songs</p>
                  <p className="text-3xl font-bold text-blue-900">{statistics.total}</p>
                </div>
                <div className="p-3 bg-blue-500 rounded-xl">
                  <Music className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Active Songs</p>
                  <p className="text-3xl font-bold text-green-900">{statistics.active}</p>
                </div>
                <div className="p-3 bg-green-500 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 mb-1">Total Usage</p>
                  <p className="text-3xl font-bold text-purple-900">{statistics.totalUsage}</p>
                </div>
                <div className="p-3 bg-purple-500 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 mb-1">Avg Duration</p>
                  <p className="text-3xl font-bold text-orange-900">{formatDuration(statistics.avgDuration)}</p>
                </div>
                <div className="p-3 bg-orange-500 rounded-xl">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-600 mb-1">Inactive</p>
                  <p className="text-3xl font-bold text-indigo-900">{statistics.inactive}</p>
                </div>
                <div className="p-3 bg-indigo-500 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search and Filter Section */}
      <Card className="shadow-lg border-gray-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search songs by title or artist..."
                value={searchQuery}
                onChange={(e) => {
                  if (isMountedRef.current) {
                    setSearchQuery(e.target.value)
                  }
                }}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={selectedGenre}
                onChange={(e) => {
                  setSelectedGenre(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-12 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer transition-all"
              >
                <option value="all">All Genres</option>
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Songs Table */}
      <Card className="shadow-lg border-gray-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900">
              Songs ({songs.length})
            </CardTitle>
            {selectedSongs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{selectedSongs.length} selected</span>
                <button
                  onClick={() => {
                    setBulkActionType('activate')
                    setShowBulkActionModal(true)
                  }}
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors flex items-center gap-1"
                >
                  <Power className="w-4 h-4" />
                  Activate
                </button>
                <button
                  onClick={() => {
                    setBulkActionType('deactivate')
                    setShowBulkActionModal(true)
                  }}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition-colors flex items-center gap-1"
                >
                  <PowerOff className="w-4 h-4" />
                  Deactivate
                </button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                <p className="text-gray-500">Loading songs...</p>
              </div>
            </div>
          ) : songs.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <Music className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No songs found</h3>
              <p className="text-gray-500 mb-6">Get started by uploading your first song</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <Upload className="w-5 h-5" />
                Upload Song
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedSongs.length === songs.length && songs.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('title')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Title
                        <SortIcon field="title" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('artist')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Artist
                        <SortIcon field="artist" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('genre')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Genre
                        <SortIcon field="genre" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('duration')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Duration
                        <SortIcon field="duration" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('usageCount')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Usage
                        <SortIcon field="usageCount" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Upload Date
                        <SortIcon field="createdAt" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">State</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedSongs.map((song, index) => (
                      <SongRow
                        key={song._id}
                        song={song}
                        index={index}
                        selectedSongs={selectedSongs}
                        onSelect={setSelectedSongs}
                        onToggleStatus={handleToggleStatus}
                        onDeleteClick={handleDeleteClick}
                        onPreview={handlePreview}
                        onEditClick={handleEditClick}
                        onPlayPause={handlePlayPause}
                        playingAudio={playingAudio}
                        formatDuration={formatDuration}
                        SortIcon={SortIcon}
                      />
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i
                    if (page > totalPages) return null
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} className="bg-white">
        <ModalHeader onClose={() => setShowUploadModal(false)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Upload New Song</h2>
          </div>
        </ModalHeader>
        <form onSubmit={handleUpload}>
          <ModalContent className="space-y-5 sm:space-y-6">
            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-gray-800">
                Song File <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-dashed border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer hover:border-gray-400"
                  required
                />
                {formData.file && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <FileAudio className="w-4 h-4" />
                    <span>{formData.file.name}</span>
                    <span className="text-gray-400">
                      ({(formData.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: MP3, WAV, M4A (Max 100MB)
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-gray-800">
                Song Cover Image <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-dashed border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer hover:border-gray-400"
                />
                {formData.imageFile && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <ImageIcon className="w-4 h-4" />
                    <span>{formData.imageFile.name}</span>
                    <span className="text-gray-400">
                      ({(formData.imageFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Recommended size: 1000x1000 pixels (square). Supported formats: JPEG, PNG, WebP, GIF (Max 10MB)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="Song title"
                  required
                  minLength={1}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  Artist <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="Artist name"
                  required
                  minLength={1}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">Genre</label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                >
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-gray-800">
                  Duration (minutes) <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="Duration in minutes (e.g., 3.5)"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Enter duration in minutes (e.g., 3.5 for 3 minutes 30 seconds)
                </p>
              </div>
            </div>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-semibold text-base shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Song
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => handleModalClose(setShowDeleteModal, setSongToDelete)} className="bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowDeleteModal, setSongToDelete)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Delete Song</h2>
          </div>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-gray-900 font-medium mb-2">Are you sure you want to delete this song?</p>
              {songToDelete && (
                <>
                  <p className="text-gray-600 text-sm mb-2">
                    <span className="font-semibold">{songToDelete.title}</span> - {songToDelete.artist}
                  </p>
                  {(songToDelete.usageCount || 0) > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-yellow-800 font-semibold text-sm mb-1">Warning: Song is in use</p>
                          <p className="text-yellow-700 text-xs">
                            This song is used in {songToDelete.usageCount} {songToDelete.usageCount === 1 ? 'post' : 'posts'}. 
                            Deleting it will break those posts. Consider deactivating instead.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <p className="text-gray-500 text-sm">
                This action cannot be undone. The song will be permanently removed from storage and the database.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => handleModalClose(setShowDeleteModal, setSongToDelete)}
            className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-semibold text-base shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteConfirm}
            disabled={(songToDelete?.usageCount || 0) > 0}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            <Trash2 className="w-5 h-5" />
            Delete Song
          </button>
        </ModalFooter>
      </Modal>
      
      {/* Bulk Action Modal */}
      <Modal isOpen={showBulkActionModal} onClose={() => {
        if (!isBulkActionInProgress) {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }
      }} className="bg-white">
        <ModalHeader onClose={() => {
          if (!isBulkActionInProgress) {
            setShowBulkActionModal(false)
            setBulkActionType(null)
          }
        }}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${bulkActionType === 'activate' ? 'bg-green-100' : 'bg-orange-100'} rounded-lg`}>
              {bulkActionType === 'activate' ? (
                <Power className="w-5 h-5 text-green-600" />
              ) : (
                <PowerOff className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {bulkActionType === 'activate' ? 'Activate Songs' : 'Deactivate Songs'}
            </h2>
          </div>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            {!isBulkActionInProgress ? (
              <>
                <p className="text-gray-600">
                  Are you sure you want to {bulkActionType} {selectedSongs.length} song(s)?
                </p>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p className="text-sm text-yellow-800">
                    {bulkActionType === 'activate' 
                      ? 'Activated songs will be available for users to select in their posts.'
                      : 'Deactivated songs will be hidden from users but existing posts using them will continue to work.'}
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">Processing {selectedSongs.length} song(s)...</p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${bulkActionProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 text-center">{bulkActionProgress}% complete</p>
              </div>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              if (!isBulkActionInProgress) {
                setShowBulkActionModal(false)
                setBulkActionType(null)
              }
            }}
            disabled={isBulkActionInProgress}
            className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-semibold text-base shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBulkActionInProgress ? 'Processing...' : 'Cancel'}
          </button>
          {!isBulkActionInProgress && (
            <button
              type="button"
              onClick={() => {
                if (bulkActionType === 'activate') {
                  handleBulkToggleStatus(true)
                } else {
                  handleBulkToggleStatus(false)
                }
              }}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-base ${
                bulkActionType === 'activate'
                  ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                  : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
              }`}
            >
              {bulkActionType === 'activate' ? (
                <>
                  <Power className="w-5 h-5" />
                  Activate
                </>
              ) : (
                <>
                  <PowerOff className="w-5 h-5" />
                  Deactivate
                </>
              )}
            </button>
          )}
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => handleModalClose(setShowEditModal, setSongToEdit, () => {
        setEditFormData({ title: '', artist: '', genre: 'General', durationMinutes: '', imageFile: null })
      })} className="bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowEditModal, setSongToEdit, () => {
          setEditFormData({ title: '', artist: '', genre: 'General', durationMinutes: '', imageFile: null })
        })}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Edit2 className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Song</h2>
          </div>
        </ModalHeader>
        <form onSubmit={handleUpdate}>
          <ModalContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Song title"
                  required
                  minLength={1}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Artist <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.artist}
                  onChange={(e) => setEditFormData({ ...editFormData, artist: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Artist name"
                  required
                  minLength={1}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Genre</label>
                <select
                  value={editFormData.genre}
                  onChange={(e) => setEditFormData({ ...editFormData, genre: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Duration (minutes) <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.durationMinutes}
                  onChange={(e) => setEditFormData({ ...editFormData, durationMinutes: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Duration in minutes (e.g., 3.5)"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter duration in minutes (e.g., 3.5 for 3 minutes 30 seconds)
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-gray-700">
                Song Cover Image <span className="text-gray-400 text-xs">Optional</span>
              </label>
              {songToEdit?.imageUrl || songToEdit?.thumbnailUrl ? (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-2">Current image:</p>
                  <img 
                    src={songToEdit.imageUrl || songToEdit.thumbnailUrl} 
                    alt="Current song cover" 
                    className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                  />
                </div>
              ) : null}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageChange}
                  className="w-full px-4 py-3 text-base bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all cursor-pointer hover:border-gray-400"
                />
                {editFormData.imageFile && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <ImageIcon className="w-4 h-4" />
                    <span>{editFormData.imageFile.name}</span>
                    <span className="text-gray-400">
                      ({(editFormData.imageFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Recommended size: 1000x1000 pixels (square). Supported formats: JPEG, PNG, WebP, GIF (Max 10MB)
              </p>
            </div>

            {songToEdit && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Note:</span> You can only edit song metadata. The audio file cannot be changed. To replace the audio file, delete this song and upload a new one.
                </p>
              </div>
            )}
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              onClick={() => {
                handleModalClose(setShowEditModal, setSongToEdit, () => {
                  setEditFormData({ title: '', artist: '', genre: 'General', durationMinutes: '' })
                })
                setSongToEdit(null)
                setEditFormData({ title: '', artist: '', genre: 'General', durationMinutes: '' })
              }}
              className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-semibold text-base shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editing}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {editing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Edit2 className="w-5 h-5" />
                  Update Song
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={showPreviewModal} onClose={() => handleModalClose(setShowPreviewModal, setPreviewSong)} className="bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowPreviewModal, setPreviewSong)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Song Preview</h2>
          </div>
        </ModalHeader>
        <ModalContent>
          {previewSong && (
            <div className="space-y-6">
              <div className="text-center p-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mb-4">
                  <Music className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{previewSong.title}</h3>
                <p className="text-gray-600 mb-4">{previewSong.artist}</p>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold">
                    {previewSong.genre}
                  </span>
                  <span>{formatDuration(previewSong.duration)}</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {previewSong.usageCount || 0} uses
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Audio Player</label>
                <audio
                  controls
                  src={previewSong.s3Url || previewSong.cloudinaryUrl || ''}
                  onError={(e) => {
                    logger.error('Preview audio error:', { songId: previewSong._id, error: e })
                    toast.error('Failed to load audio preview')
                  }}
                  className="w-full"
                >
                  Your browser does not support the audio element.
                </audio>
                {(!previewSong.s3Url && !previewSong.cloudinaryUrl) && (
                  <p className="text-sm text-red-600 mt-2">⚠️ No audio URL available for this song</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Upload Date</p>
                  <p className="font-medium text-gray-900">{formatDate(previewSong.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    previewSong.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {previewSong.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => handleModalClose(setShowPreviewModal, setPreviewSong)}
            className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-semibold text-base shadow-sm"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Songs
