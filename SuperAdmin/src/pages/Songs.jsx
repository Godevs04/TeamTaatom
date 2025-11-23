import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import { Music, Search, Upload, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSongs, uploadSong, deleteSong } from '../services/songService'

const Songs = () => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [songToDelete, setSongToDelete] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    genre: 'General',
    duration: '',
    file: null
  })

  useEffect(() => {
    loadSongs()
  }, [currentPage, searchQuery, selectedGenre])

  const loadSongs = async () => {
    setLoading(true)
    try {
      const result = await getSongs(searchQuery, selectedGenre, currentPage, 20)
      // Backend returns: { success: true, message, songs, pagination }
      if (result && result.songs) {
        setSongs(result.songs)
        setTotalPages(result.pagination?.totalPages || 1)
      } else {
        console.error('Unexpected response structure:', result)
        setSongs([])
        setTotalPages(1)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load songs')
      console.error('Error loading songs:', error)
      setSongs([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
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
      setShowUploadModal(false)
      setFormData({ title: '', artist: '', genre: 'General', duration: '', file: null })
      // Reload songs after successful upload
      await loadSongs()
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.parsedError?.message || 'Failed to upload song'
      toast.error(errorMessage)
      console.error('Upload error:', error)
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
      toast.error(error.response?.data?.message || 'Failed to delete song')
      console.error('Delete error:', error)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const genres = ['General', 'Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'Country', 'R&B', 'Other']

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Music className="w-8 h-8" />
            Song Management
          </h1>
          <p className="text-gray-400 mt-1">Manage songs available for users to add to their posts</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Upload className="w-5 h-5" />
          Upload Song
        </button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search songs by title or artist..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedGenre}
              onChange={(e) => {
                setSelectedGenre(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Genres</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Songs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Songs ({songs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : songs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No songs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Genre</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Usage Count</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {songs.map((song) => (
                    <TableRow key={song._id}>
                      <TableCell className="font-medium">{song.title}</TableCell>
                      <TableCell>{song.artist}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-gray-700 rounded text-sm">
                          {song.genre}
                        </span>
                      </TableCell>
                      <TableCell>{formatDuration(song.duration)}</TableCell>
                      <TableCell>{song.usageCount || 0}</TableCell>
                      <TableCell>{formatDate(song.createdAt)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-sm ${
                          song.isActive
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}>
                          {song.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleDeleteClick(song)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete song"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <ModalHeader>
          <h2 className="text-xl font-semibold text-white">Upload New Song</h2>
        </ModalHeader>
        <form onSubmit={handleUpload}>
          <ModalContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Song File *
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Supported formats: MP3, WAV, M4A (Max 20MB)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Song title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Artist *
                </label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Artist name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Genre
                </label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duration (seconds) - Optional
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Duration in seconds (optional)"
                  min="0"
                />
              </div>
            </div>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Song
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <ModalHeader>
          <h2 className="text-xl font-semibold text-white">Delete Song</h2>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-800 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <div>
                <p className="text-white font-medium">Are you sure you want to delete this song?</p>
                {songToDelete && (
                  <p className="text-gray-400 text-sm mt-1">
                    {songToDelete.title} - {songToDelete.artist}
                  </p>
                )}
                <p className="text-gray-400 text-sm mt-2">
                  This action cannot be undone. The song will be removed from S3 and the database.
                </p>
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => setShowDeleteModal(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Song
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Songs

