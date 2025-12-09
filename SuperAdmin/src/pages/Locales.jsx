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
  MapPin, 
  Search, 
  Upload, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getLocales, uploadLocale, deleteLocale, toggleLocaleStatus, updateLocale } from '../services/localeService'
import { motion, AnimatePresence } from 'framer-motion'

const Locales = () => {
  const [locales, setLocales] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountryCode, setSelectedCountryCode] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLocales, setTotalLocales] = useState(0)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [localeToDelete, setLocaleToDelete] = useState(null)
  const [localeToEdit, setLocaleToEdit] = useState(null)
  const [previewLocale, setPreviewLocale] = useState(null)
  const [editing, setEditing] = useState(false)
  const [sortField, setSortField] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedLocales, setSelectedLocales] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    countryCode: '',
    stateProvince: '',
    stateCode: '',
    description: '',
    displayOrder: '0',
    file: null
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    country: '',
    countryCode: '',
    stateProvince: '',
    stateCode: '',
    description: '',
    displayOrder: '0'
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCountryCode, sortField, sortOrder])

  useEffect(() => {
    loadLocales()
  }, [currentPage, searchQuery, selectedCountryCode, sortField, sortOrder])

  const loadLocales = async () => {
    setLoading(true)
    try {
      const result = await getLocales(searchQuery, selectedCountryCode, currentPage, 20)
      if (result && result.locales) {
        setLocales(result.locales)
        setTotalPages(result.pagination?.totalPages || 1)
        setTotalLocales(result.pagination?.total || 0)
      } else {
        logger.error('Unexpected response structure:', result)
        setLocales([])
        setTotalPages(1)
        setTotalLocales(0)
      }
    } catch (error) {
      handleError(error, toast, 'Failed to load locales')
      logger.error('Error loading locales:', error)
      setLocales([])
      setTotalPages(1)
      setTotalLocales(0)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const statistics = useMemo(() => {
    const activeLocales = locales.filter(l => l.isActive).length
    
    return {
      total: totalLocales,
      active: activeLocales,
      inactive: totalLocales - activeLocales
    }
  }, [locales, totalLocales])

  // Sort locales
  const sortedLocales = useMemo(() => {
    return [...locales].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (sortField === 'displayOrder') {
        aVal = a.displayOrder || 0
        bVal = b.displayOrder || 0
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
  }, [locales, sortField, sortOrder])

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
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }
      // Validate image type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, WebP, GIF)')
        return
      }
      setFormData({ ...formData, file })
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    
    if (!formData.file) {
      toast.error('Please select an image file')
      return
    }

    if (!formData.name || !formData.country || !formData.countryCode) {
      toast.error('Name, country, and country code are required')
      return
    }

    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('image', formData.file)
      uploadFormData.append('name', sanitizeText(formData.name))
      uploadFormData.append('country', sanitizeText(formData.country))
      uploadFormData.append('countryCode', sanitizeText(formData.countryCode).toUpperCase())
      if (formData.stateProvince) {
        uploadFormData.append('stateProvince', sanitizeText(formData.stateProvince))
      }
      if (formData.stateCode) {
        uploadFormData.append('stateCode', sanitizeText(formData.stateCode))
      }
      if (formData.description) {
        uploadFormData.append('description', sanitizeText(formData.description))
      }
      if (formData.displayOrder) {
        uploadFormData.append('displayOrder', formData.displayOrder)
      }

      const response = await uploadLocale(uploadFormData)
      toast.success(response.message || 'Locale uploaded successfully')
      handleModalClose(setShowUploadModal, null, () => {
        setFormData({ 
          name: '', 
          country: '', 
          countryCode: '', 
          stateProvince: '', 
          stateCode: '', 
          description: '', 
          displayOrder: '0',
          file: null 
        })
      })
      await loadLocales()
    } catch (error) {
      handleError(error, toast, 'Failed to upload locale')
      logger.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteClick = (locale) => {
    setLocaleToDelete(locale)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!localeToDelete) return

    try {
      await deleteLocale(localeToDelete._id)
      toast.success('Locale deleted successfully')
      setShowDeleteModal(false)
      setLocaleToDelete(null)
      loadLocales()
    } catch (error) {
      handleError(error, toast, 'Failed to delete locale')
      logger.error('Delete error:', error)
    }
  }

  const handleToggleStatus = async (localeId, currentStatus) => {
    try {
      const newStatus = !currentStatus
      await toggleLocaleStatus(localeId, newStatus)
      toast.success(`Locale ${newStatus ? 'activated' : 'deactivated'} successfully`)
      loadLocales()
    } catch (error) {
      handleError(error, toast, 'Failed to toggle locale status')
      logger.error('Toggle error:', error)
    }
  }

  const handlePreview = (locale) => {
    setPreviewLocale(locale)
    setShowPreviewModal(true)
  }

  const handleEditClick = (locale) => {
    setLocaleToEdit(locale)
    setEditFormData({
      name: locale.name || '',
      country: locale.country || '',
      countryCode: locale.countryCode || '',
      stateProvince: locale.stateProvince || '',
      stateCode: locale.stateCode || '',
      description: locale.description || '',
      displayOrder: locale.displayOrder ? locale.displayOrder.toString() : '0'
    })
    setShowEditModal(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    
    if (!editFormData.name || !editFormData.country || !editFormData.countryCode) {
      toast.error('Name, country, and country code are required')
      return
    }

    setEditing(true)
    try {
      const updateData = {
        name: sanitizeText(editFormData.name),
        country: sanitizeText(editFormData.country),
        countryCode: sanitizeText(editFormData.countryCode).toUpperCase()
      }
      
      if (editFormData.stateProvince) {
        updateData.stateProvince = sanitizeText(editFormData.stateProvince)
      }
      if (editFormData.stateCode) {
        updateData.stateCode = sanitizeText(editFormData.stateCode)
      }
      if (editFormData.description) {
        updateData.description = sanitizeText(editFormData.description)
      }
      if (editFormData.displayOrder) {
        updateData.displayOrder = parseInt(editFormData.displayOrder)
      }

      await updateLocale(localeToEdit._id, updateData)
      toast.success('Locale updated successfully')
      handleModalClose(setShowEditModal, setLocaleToEdit, () => {
        setEditFormData({ 
          name: '', 
          country: '', 
          countryCode: '', 
          stateProvince: '', 
          stateCode: '', 
          description: '', 
          displayOrder: '0' 
        })
      })
      await loadLocales()
    } catch (error) {
      handleError(error, toast, 'Failed to update locale')
      logger.error('Update error:', error)
    } finally {
      setEditing(false)
    }
  }

  // Get unique country codes for filter
  const countryCodes = useMemo(() => {
    const codes = [...new Set(locales.map(l => l.countryCode).filter(Boolean))]
    return codes.sort()
  }, [locales])

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
        className="bg-gradient-to-r from-green-600 via-teal-600 to-emerald-600 rounded-2xl p-8 shadow-xl border border-green-200"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Locale Management</h1>
              <p className="text-green-100 text-lg">Manage and organize location locales</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadLocales}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-6 py-2 bg-white text-green-600 rounded-lg transition-all shadow-lg hover:shadow-xl font-semibold hover:bg-green-50"
            >
              <Upload className="w-5 h-5" />
              Add Locale
            </button>
          </div>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Total Locales</p>
                  <p className="text-3xl font-bold text-green-900">{statistics.total}</p>
                </div>
                <div className="p-3 bg-green-500 rounded-xl">
                  <MapPin className="w-6 h-6 text-white" />
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
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Active Locales</p>
                  <p className="text-3xl font-bold text-blue-900">{statistics.active}</p>
                </div>
                <div className="p-3 bg-blue-500 rounded-xl">
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
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 mb-1">Inactive</p>
                  <p className="text-3xl font-bold text-orange-900">{statistics.inactive}</p>
                </div>
                <div className="p-3 bg-orange-500 rounded-xl">
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
                placeholder="Search locales by name, country, or state..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-12 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none cursor-pointer transition-all"
              >
                <option value="all">All Countries</option>
                {countryCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locales Table */}
      <Card className="shadow-lg border-gray-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900">
              Locales ({locales.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
                <p className="text-gray-500">Loading locales...</p>
              </div>
            </div>
          ) : locales.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <MapPin className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No locales found</h3>
              <p className="text-gray-500 mb-6">Get started by adding your first locale</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                <Upload className="w-5 h-5" />
                Add Locale
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead>
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Name
                        <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('country')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Country
                        <SortIcon field="country" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">Country Code</TableHead>
                    <TableHead className="font-semibold text-gray-700">State/Province</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('displayOrder')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Order
                        <SortIcon field="displayOrder" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="flex items-center font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Created
                        <SortIcon field="createdAt" />
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedLocales.map((locale, index) => (
                      <motion.tr
                        key={locale._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-gray-100 hover:bg-green-50/50 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {locale.imageUrl && (
                              <img 
                                src={locale.imageUrl} 
                                alt={locale.name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            )}
                            <span className="font-medium text-gray-900">{locale.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700">{locale.country}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                            {locale.countryCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-700">{locale.stateProvince || '-'}</TableCell>
                        <TableCell className="text-gray-700">{locale.displayOrder || 0}</TableCell>
                        <TableCell className="text-gray-600 text-sm">{formatDate(locale.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleStatus(locale._id, locale.isActive)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 cursor-pointer ${
                                locale.isActive
                                  ? 'bg-green-500'
                                  : 'bg-gray-300'
                              }`}
                              title={`Click to ${locale.isActive ? 'deactivate' : 'activate'}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                                  locale.isActive ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              locale.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {locale.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handlePreview(locale)}
                              className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={() => handleEditClick(locale)}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(locale)}
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
                            ? 'bg-green-600 text-white'
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
            <div className="p-2 bg-green-100 rounded-lg">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Add New Locale</h2>
          </div>
        </ModalHeader>
        <form onSubmit={handleUpload}>
          <ModalContent className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Image <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all cursor-pointer"
                  required
                />
                {formData.file && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <ImageIcon className="w-4 h-4" />
                    <span>{formData.file.name}</span>
                    <span className="text-gray-400">
                      ({(formData.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: JPEG, PNG, WebP, GIF (Max 10MB)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Locale name"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Country <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Country name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.countryCode}
                  onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="US, GB, IN, etc."
                  maxLength="10"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Display Order <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  State/Province <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="text"
                  value={formData.stateProvince}
                  onChange={(e) => setFormData({ ...formData, stateProvince: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="State or province"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  State Code <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="text"
                  value={formData.stateCode}
                  onChange={(e) => setFormData({ ...formData, stateCode: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="State code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Description <span className="text-gray-400 text-xs">Optional</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="Locale description"
                rows="3"
              />
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
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Add Locale
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => handleModalClose(setShowDeleteModal, setLocaleToDelete)} className="max-w-md bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowDeleteModal, setLocaleToDelete)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Delete Locale</h2>
          </div>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-gray-900 font-medium mb-2">Are you sure you want to delete this locale?</p>
              {localeToDelete && (
                <p className="text-gray-600 text-sm mb-2">
                  <span className="font-semibold">{localeToDelete.name}</span> - {localeToDelete.country}
                </p>
              )}
              <p className="text-gray-500 text-sm">
                This action cannot be undone. The locale image will be permanently removed from S3 and the database.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => handleModalClose(setShowDeleteModal, setLocaleToDelete)}
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
            Delete Locale
          </button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => handleModalClose(setShowEditModal, setLocaleToEdit, () => {
        setEditFormData({ 
          name: '', 
          country: '', 
          countryCode: '', 
          stateProvince: '', 
          stateCode: '', 
          description: '', 
          displayOrder: '0' 
        })
      })} className="max-w-2xl bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowEditModal, setLocaleToEdit, () => {
          setEditFormData({ 
            name: '', 
            country: '', 
            countryCode: '', 
            stateProvince: '', 
            stateCode: '', 
            description: '', 
            displayOrder: '0' 
          })
        })}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit2 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Locale</h2>
          </div>
        </ModalHeader>
        <form onSubmit={handleUpdate}>
          <ModalContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Locale name"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Country <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.country}
                  onChange={(e) => setEditFormData({ ...editFormData, country: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Country name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.countryCode}
                  onChange={(e) => setEditFormData({ ...editFormData, countryCode: sanitizeText(e.target.value).toUpperCase() })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="US, GB, IN, etc."
                  maxLength="10"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Display Order <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="number"
                  value={editFormData.displayOrder}
                  onChange={(e) => setEditFormData({ ...editFormData, displayOrder: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  State/Province <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="text"
                  value={editFormData.stateProvince}
                  onChange={(e) => setEditFormData({ ...editFormData, stateProvince: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="State or province"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  State Code <span className="text-gray-400 text-xs">Optional</span>
                </label>
                <input
                  type="text"
                  value={editFormData.stateCode}
                  onChange={(e) => setEditFormData({ ...editFormData, stateCode: sanitizeText(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="State code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Description <span className="text-gray-400 text-xs">Optional</span>
              </label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: sanitizeText(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Locale description"
                rows="3"
              />
            </div>

            {localeToEdit && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Note:</span> You can only edit locale metadata. The image cannot be changed. To replace the image, delete this locale and add a new one.
                </p>
              </div>
            )}
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              onClick={() => {
                handleModalClose(setShowEditModal, setLocaleToEdit, () => {
                  setEditFormData({ 
                    name: '', 
                    country: '', 
                    countryCode: '', 
                    stateProvince: '', 
                    stateCode: '', 
                    description: '', 
                    displayOrder: '0' 
                  })
                })
                setLocaleToEdit(null)
                setEditFormData({ 
                  name: '', 
                  country: '', 
                  countryCode: '', 
                  stateProvince: '', 
                  stateCode: '', 
                  description: '', 
                  displayOrder: '0' 
                })
              }}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editing}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {editing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Edit2 className="w-5 h-5" />
                  Update Locale
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={showPreviewModal} onClose={() => handleModalClose(setShowPreviewModal, setPreviewLocale)} className="max-w-lg bg-white">
        <ModalHeader onClose={() => handleModalClose(setShowPreviewModal, setPreviewLocale)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Locale Preview</h2>
          </div>
        </ModalHeader>
        <ModalContent>
          {previewLocale && (
            <div className="space-y-6">
              <div className="text-center p-8 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl">
                {previewLocale.imageUrl && (
                  <img 
                    src={previewLocale.imageUrl} 
                    alt={previewLocale.name}
                    className="w-32 h-32 rounded-xl object-cover mx-auto mb-4 shadow-lg"
                  />
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{previewLocale.name}</h3>
                <p className="text-gray-600 mb-4">{previewLocale.country}</p>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-semibold">
                    {previewLocale.countryCode}
                  </span>
                  {previewLocale.stateProvince && (
                    <span>{previewLocale.stateProvince}</span>
                  )}
                  <span className="flex items-center gap-1">
                    Order: {previewLocale.displayOrder || 0}
                  </span>
                </div>
              </div>
              {previewLocale.description && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-700">{previewLocale.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Created Date</p>
                  <p className="font-medium text-gray-900">{formatDate(previewLocale.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    previewLocale.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {previewLocale.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            type="button"
            onClick={() => handleModalClose(setShowPreviewModal, setPreviewLocale)}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Locales

