import React, { useState, useEffect, useMemo } from 'react'
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
  Edit2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getSongs, uploadSong, deleteSong, toggleSongStatus, updateSong } from '../services/songService'
import { motion, AnimatePresence } from 'framer-motion'

const Songs = () => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSongs, setTotalSongs] = useState(0)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [songToDelete, setSongToDelete] = useState(null)
  const [songToEdit, setSongToEdit] = useState(null)
  const [previewSong, setPreviewSong] = useState(null)
  const [editing, setEditing] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(null)
  const [sortField, setSortField] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedSongs, setSelectedSongs] = useState([])
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    genre: 'General',
    duration: '',
    file: null
  })
  const [editFormData, setEditFormData] = useState({
    title: '',
    artist: '',
    genre: 'General',
    duration: ''
  })

  // Reset to page 1 when filters change (except search which is handled separately)
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedGenre, sortField, sortOrder])

  useEffect(() => {
    loadSongs()
  }, [currentPage, searchQuery, selectedGenre, sortField, sortOrder])

  const loadSongs = async () => {
    setLoading(true)
    try {
      const result = await getSongs(searchQuery, selectedGenre, currentPage, 20)
      if (result && result.songs) {
        setSongs(result.songs)
        setTotalPages(result.pagination?.totalPages || 1)
        setTotalSongs(result.pagination?.total || 0)
      } else {
        logger.error('Unexpected response structure:', result)
        setSongs([])
        setTotalPages(1)
        setTotalSongs(0)
      }
    } catch (error) {
      handleError(error, toast, 'Failed to load songs')
      logger.error('Error loading songs:', error)
      setSongs([])
      setTotalPages(1)
      setTotalSongs(0)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const statistics = useMemo(() => {
    const activeSongs = songs.filter(s => s.isActive).length
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
      // Validate file size (20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast.error('File size must be less than 20MB')
        return
      }
      setFormData({ ...formData, file })
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    
    if (!formData.file) {
      toast.error('Please select a song file')
      return
    }

    if (!formData.title || !formData.artist) {
      toast.error('Title and artist are required')
      return
    }

    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('song', formData.file)
      uploadFormData.append('title', formData.title)
      uploadFormData.append('artist', formData.artist)
      uploadFormData.append('genre', formData.genre)
      if (formData.duration) {
        uploadFormData.append('duration', formData.duration)
      }

      const response = await uploadSong(uploadFormData)
      toast.success(response.message || 'Song uploaded successfully')
      handleModalClose(setShowUploadModal, null, () => {
        setFormData({ title: '', artist: '', genre: 'General', duration: '', file: null })
      })
      await loadSongs()
    } catch (error) {
      handleError(error, toast, 'Failed to upload song')
      logger.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteClick = (song) => {
    setSongToDelete(song)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!songToDelete) return

    try {
      await deleteSong(songToDelete._id)
      toast.success('Song deleted successfully')
      setShowDeleteModal(false)
      setSongToDelete(null)
      loadSongs()
    } catch (error) {
      handleError(error, toast, 'Failed to delete song')
      logger.error('Delete error:', error)
    }
  }

  const handleToggleStatus = async (songId, currentStatus) => {
    try {
      const newStatus = !currentStatus
      await toggleSongStatus(songId, newStatus)
      toast.success(`Song ${newStatus ? 'activated' : 'deactivated'} successfully`)
      loadSongs()
    } catch (error) {
      handleError(error, toast, 'Failed to toggle song status')
      logger.error('Toggle error:', error)
    }
  }

  const handleBulkToggleStatus = async (isActive) => {
    if (selectedSongs.length === 0) {
      toast.error('Please select at least one song')
      return
    }

    try {
      const promises = selectedSongs.map(songId => {
        const song = songs.find(s => s._id === songId)
        if (song && song.isActive !== isActive) {
          return toggleSongStatus(songId, isActive)
        }
        return Promise.resolve()
      })
      
      await Promise.all(promises)
      toast.success(`${selectedSongs.length} song(s) ${isActive ? 'activated' : 'deactivated'} successfully`)
      setSelectedSongs([])
      loadSongs()
    } catch (error) {
      handleError(error, toast, 'Failed to update song status')
      logger.error('Bulk toggle error:', error)
    }
  }

  const handlePreview = (song) => {
    setPreviewSong(song)
    setShowPreviewModal(true)
  }

  const handleEditClick = (song) => {
    setSongToEdit(song)
    setEditFormData({
      title: song.title || '',
      artist: song.artist || '',
      genre: song.genre || 'General',
      duration: song.duration ? song.duration.toString() : ''
    })
    setShowEditModal(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    
    if (!editFormData.title || !editFormData.artist) {
      toast.error('Title and artist are required')
      return
    }

    setEditing(true)
    try {
      const updateData = {
        title: editFormData.title,
        artist: editFormData.artist,
        genre: editFormData.genre
      }
      
      if (editFormData.duration) {
        updateData.duration = parseInt(editFormData.duration)
      }

      await updateSong(songToEdit._id, updateData)
      toast.success('Song updated successfully')
      handleModalClose(setShowEditModal, setSongToEdit, () => {
        setEditFormData({ title: '', artist: '', genre: 'General', duration: '' })
      })
      await loadSongs()
    } catch (error) {
      handleError(error, toast, 'Failed to update song')
      logger.error('Update error:', error)
    } finally {
      setEditing(false)
    }
  }

  const handlePlayPause = (song) => {
    if (playingAudio === song._id) {
      setPlayingAudio(null)
      // Stop audio if playing
      const audio = document.getElementById(`audio-${song._id}`)
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    } else {
      setPlayingAudio(song._id)
      // Play audio
      const audio = document.getElementById(`audio-${song._id}`)
      if (audio) {
        audio.play().catch(err => {
          logger.error('Error playing audio:', err)
          toast.error('Failed to play audio')
        })
      }
    }
  }

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
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
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
                    // Bulk delete functionality
                    toast.info('Bulk delete feature coming soon')
                  }}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                >
                  Delete Selected
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
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSongs(songs.map(s => s._id))
                          } else {
                            setSelectedSongs([])
                          }
                        }}
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
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedSongs.map((song, index) => (
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
                                setSelectedSongs([...selectedSongs, song._id])
                              } else {
                                setSelectedSongs(selectedSongs.filter(id => id !== song._id))
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handlePlayPause(song)}
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
                              src={song.s3Url}
                              onEnded={() => setPlayingAudio(null)}
                            />
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
                            {song.usageCount || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm">{formatDate(song.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleStatus(song._id, song.isActive)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer ${
                                song.isActive
                                  ? 'bg-green-500'
                                  : 'bg-gray-300'
                              }`}
                              title={`Click to ${song.isActive ? 'deactivate' : 'activate'}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                                  song.isActive ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              song.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {song.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handlePreview(song)}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => handleEditClick(song)}
                              className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(song)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </TableCell>
                      </motion.tr>
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
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} className="max-w-2xl bg-white">
        <ModalHeader onClose={() => setShowUploadModal(false)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Upload New Song</h2>
          </div>
        </ModalHeader>
        <form onSubmit={handleUpload}>
          <ModalContent className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Song File <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
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
                Supported formats: MP3, WAV, M4A (Max 20MB)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Song title"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Artist <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Artist name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Genre</label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  Duration (seconds) <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Duration in seconds"
                  min="0"
                />
              </div>
            </div>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
      <Modal isOpen={showDeleteModal} onClose={() => handleModalClose(setShowDeleteModal, setSongToDelete)} className="max-w-md bg-white">
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
                <p className="text-gray-600 text-sm mb-2">
                  <span className="font-semibold">{songToDelete.title}</span> - {songToDelete.artist}
                </p>
              )}
              <p className="text-gray-500 text-sm">
                This action cannot be undone. The song will be permanently removed from S3 and the database.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => handleModalClose(setShowDeleteModal, setSongToDelete)}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteConfirm}
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Delete Song
          </button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => handleModalClose(setShowEditModal, setSongToEdit, () => {
        setEditFormData({ title: '', artist: '', genre: 'General', duration: '' })
      })} className="max-w-2xl bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowEditModal, setSongToEdit, () => {
          setEditFormData({ title: '', artist: '', genre: 'General', duration: '' })
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
                  Duration (seconds) <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="number"
                  value={editFormData.duration}
                  onChange={(e) => setEditFormData({ ...editFormData, duration: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Duration in seconds"
                  min="0"
                />
              </div>
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
                  setEditFormData({ title: '', artist: '', genre: 'General', duration: '' })
                })
                setSongToEdit(null)
                setEditFormData({ title: '', artist: '', genre: 'General', duration: '' })
              }}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editing}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {editing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
      <Modal isOpen={showPreviewModal} onClose={() => handleModalClose(setShowPreviewModal, setPreviewSong)} className="max-w-lg bg-white">
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
                  src={previewSong.s3Url}
                  className="w-full"
                >
                  Your browser does not support the audio element.
                </audio>
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
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Songs
