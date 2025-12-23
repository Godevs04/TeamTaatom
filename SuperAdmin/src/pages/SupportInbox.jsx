import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate } from '../utils/formatDate'
import { 
  MessageSquare, 
  Search, 
  Send, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Filter,
  Sparkles,
  Tag,
  ArrowUpDown,
  Plus,
  Users,
  X,
  Loader2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'
import { api } from '../services/api'
import logger from '../utils/logger'
import { handleError } from '../utils/errorCodes'
import { motion, AnimatePresence } from 'framer-motion'
import { socketService } from '../services/socketService'

const SupportInbox = () => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const messagesEndRef = useRef(null)
  
  // Start New Conversation state
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [newConversationReason, setNewConversationReason] = useState('support')
  const [newConversationMessage, setNewConversationMessage] = useState('')
  const [creatingConversation, setCreatingConversation] = useState(false)
  const searchDebounceRef = useRef(null)

  // Fetch conversations
  const fetchConversations = useCallback(async (pageNum = 1) => {
    try {
      setLoading(pageNum === 1)
      const response = await api.get('/api/v1/superadmin/conversations', {
        params: {
          page: pageNum,
          limit: 20
        }
      })

      if (response.data?.success) {
        // Handle both response structures: {data: {conversations, pagination}} or {conversations, pagination}
        const data = response.data.data || response.data
        const conversationsList = data.conversations || []
        logger.debug(`Fetched ${conversationsList.length} conversations for page ${pageNum}`)
        
        if (pageNum === 1) {
          setConversations(conversationsList)
        } else {
          setConversations(prev => [...prev, ...conversationsList])
        }
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        logger.warn('Unexpected response structure:', response.data)
        setConversations([])
        setTotalPages(1)
      }
    } catch (error) {
      logger.error('Error fetching conversations:', error)
      const parsedError = handleError(error)
      const errorMessage = parsedError?.adminMessage || parsedError?.message || 'Failed to load conversations'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Search users for new conversation
  const searchUsers = useCallback(async (query) => {
    if (!query.trim() || query.length < 2) {
      setUserSearchResults([])
      return
    }

    try {
      setSearchingUsers(true)
      const response = await api.get('/api/v1/superadmin/users', {
        params: {
          search: query.trim(),
          limit: 50,
          page: 1
          // Don't pass status to get all users (active, inactive, etc.)
        }
      })

      logger.debug('User search response:', response.data)
      
      // Handle different response structures
      let users = []
      if (response.data?.success) {
        if (response.data?.data?.users) {
          users = response.data.data.users
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          users = response.data.data
        } else if (Array.isArray(response.data?.users)) {
          users = response.data.users
        }
      }
      
      // Filter out deleted users for conversation creation
      users = users.filter(user => !user.deletedAt)
      
      logger.debug(`Found ${users.length} users for query: ${query}`)
      setUserSearchResults(users)
      
      if (users.length === 0 && query.trim().length >= 2) {
        logger.warn(`No users found for query: ${query}`)
      }
    } catch (error) {
      logger.error('Error searching users:', error)
      const parsedError = handleError(error)
      const errorMessage = parsedError?.adminMessage || parsedError?.message || 'Failed to search users'
      // Don't show toast for search errors, just log
      logger.error('Search error details:', errorMessage)
      setUserSearchResults([])
    } finally {
      setSearchingUsers(false)
    }
  }, [])

  // Debounced user search - trigger immediately when modal opens
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    // If modal just opened, clear results
    if (showNewConversationModal && !userSearchQuery) {
      setUserSearchResults([])
      return
    }

    // If query is too short, clear results
    if (userSearchQuery.length < 2) {
      setUserSearchResults([])
      return
    }

    // Debounce search
    searchDebounceRef.current = setTimeout(() => {
      if (showNewConversationModal && userSearchQuery.trim().length >= 2) {
        searchUsers(userSearchQuery)
      }
    }, 300)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [userSearchQuery, showNewConversationModal, searchUsers])

  // Create new support conversation
  const createNewConversation = useCallback(async () => {
    if (!selectedUser) {
      toast.error('Please select a user')
      return
    }

    try {
      setCreatingConversation(true)
      const response = await api.post('/api/v1/superadmin/conversations', {
        userId: selectedUser._id,
        reason: newConversationReason,
        initialMessage: newConversationMessage.trim() || undefined
      })

      if (response.data?.success) {
        toast.success('Conversation created successfully')
        setShowNewConversationModal(false)
        setSelectedUser(null)
        setUserSearchQuery('')
        setUserSearchResults([])
        setNewConversationMessage('')
        setNewConversationReason('support')
        // Refresh conversations list immediately
        setPage(1)
        // Force refresh by clearing and fetching
        setConversations([])
        await fetchConversations(1)
        // Open the new conversation after list refreshes
        const conversationData = response.data?.data?.conversation || response.data?.conversation
        if (conversationData) {
          setTimeout(async () => {
            const convoId = conversationData._id
            logger.debug('Opening conversation:', convoId)
            const fetchedConvo = await fetchConversationDetails(convoId)
            // Use fetched conversation if available, otherwise use the one from creation response
            setSelectedConversation(fetchedConvo || conversationData)
          }, 500)
        }
      }
    } catch (error) {
      logger.error('Error creating conversation:', error)
      const parsedError = handleError(error)
      const errorMessage = parsedError?.adminMessage || parsedError?.message || 'Failed to create conversation'
      toast.error(errorMessage)
    } finally {
      setCreatingConversation(false)
    }
  }, [selectedUser, newConversationReason, newConversationMessage, fetchConversations])

  // Fetch specific conversation details
  const fetchConversationDetails = useCallback(async (conversationId) => {
    try {
      const response = await api.get(`/api/v1/superadmin/conversations/${conversationId}`)
      if (response.data?.success) {
        // Handle both response structures: {data: {conversation}} or {conversation}
        const data = response.data.data || response.data
        const conversation = data.conversation || data
        if (conversation) {
          setSelectedConversation(conversation)
          return conversation
        } else {
          logger.warn('No conversation found in response:', response.data)
          return null
        }
      }
      return null
    } catch (error) {
      logger.error('Error fetching conversation details:', error)
      const parsedError = handleError(error)
      const errorMessage = parsedError?.adminMessage || parsedError?.message || 'Failed to load conversation'
      toast.error(errorMessage)
      return null
    }
  }, [])

  // Send message
  const sendMessage = useCallback(async () => {
    if (!messageText.trim() || !selectedConversation?._id) return

    try {
      setSendingMessage(true)
      const response = await api.post(
        `/api/v1/superadmin/conversations/${selectedConversation._id}/messages`,
        { text: messageText.trim() }
      )

      if (response.data?.success) {
        setMessageText('')
        await fetchConversationDetails(selectedConversation._id)
        await fetchConversations(page)
        toast.success('Message sent successfully')
      }
    } catch (error) {
      logger.error('Error sending message:', error)
      const parsedError = handleError(error)
      const errorMessage = parsedError?.adminMessage || parsedError?.message || 'Failed to send message'
      toast.error(errorMessage)
    } finally {
      setSendingMessage(false)
    }
  }, [messageText, selectedConversation, fetchConversationDetails, fetchConversations, page])

  // Open conversation
  const openConversation = useCallback(async (conversation) => {
    setSelectedConversation(conversation)
    await fetchConversationDetails(conversation._id)
  }, [fetchConversationDetails])

  // Close conversation modal
  const closeConversation = useCallback(() => {
    setSelectedConversation(null)
    setMessageText('')
  }, [])

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    setRefreshing(true)
    setPage(1)
    setConversations([])
    await fetchConversations(1)
    fetchConversations(1)
    setPage(1)
  }, [fetchConversations])

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    let result = conversations

    if (filter === 'unread') {
      result = result.filter(conv => (conv.unreadCount || 0) > 0)
    } else if (filter === 'trip_verification') {
      result = result.filter(conv => conv.reason === 'trip_verification')
    } else if (filter === 'support') {
      result = result.filter(conv => conv.reason === 'support')
    }

    if (!searchQuery.trim()) {
      const sorted = [...result]
      if (sortBy === 'recent') {
        sorted.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      } else if (sortBy === 'oldest') {
        sorted.sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt))
      } else if (sortBy === 'unread') {
        sorted.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0))
      }
      return sorted
    }

    const query = searchQuery.toLowerCase()
    result = result.filter(conv => {
      const userName = conv.user?.fullName || conv.user?.email || ''
      const lastMessage = conv.lastMessage?.text || ''
      return userName.toLowerCase().includes(query) || 
             lastMessage.toLowerCase().includes(query)
    })

    const sorted = [...result]
    if (sortBy === 'recent') {
      sorted.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt))
    } else if (sortBy === 'unread') {
      sorted.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0))
    }

    return sorted
  }, [conversations, searchQuery, filter, sortBy])

  const quickReplies = useMemo(() => ([
    'Thanks for sharing! We\'re reviewing your submission.',
    'We need one more clear location photo to verify this trip.',
    'Can you confirm the city and landmark for this visit?',
    'Your case is in queue. We\'ll update you shortly.',
    'Thanks for the patience! Verification team is on it.'
  ]), [])

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedConversation?.messages?.length])

  // Load conversations on mount
  useEffect(() => {
    fetchConversations(1)
  }, [fetchConversations])

  // Socket connection and real-time updates
  useEffect(() => {
    let socket = null
    let cleanup = null

    const setupSocket = async () => {
      try {
        socket = await socketService.connect()
        if (!socket) {
          logger.debug('Socket not available, skipping real-time updates')
          return
        }

        // Join admin_support room
        socket.emit('join', 'admin_support')
        logger.debug('Joined admin_support room')

        // Listen for new messages in admin support conversations
        const handleNewMessage = (data) => {
          logger.debug('Received admin_support:message:new:', data)
          
          // Update selected conversation if it's the current one
          if (selectedConversation && selectedConversation._id === data.chatId) {
            fetchConversationDetails(data.chatId)
          }
          
          // Refresh conversations list to update last message and unread count
          fetchConversations(page)
        }

        // Listen for chat updates
        const handleChatUpdate = (data) => {
          logger.debug('Received admin_support:chat:update:', data)
          
          // Refresh conversations list
          fetchConversations(page)
        }

        socket.on('admin_support:message:new', handleNewMessage)
        socket.on('admin_support:chat:update', handleChatUpdate)

        cleanup = () => {
          if (socket) {
            socket.off('admin_support:message:new', handleNewMessage)
            socket.off('admin_support:chat:update', handleChatUpdate)
            socket.emit('leave', 'admin_support')
          }
        }
      } catch (error) {
        logger.error('Error setting up socket:', error)
      }
    }

    setupSocket()

    return () => {
      if (cleanup) cleanup()
      if (socket) {
        socket.emit('leave', 'admin_support')
      }
    }
  }, [selectedConversation?._id, page, fetchConversations, fetchConversationDetails])

  // Get reason badge color
  const getReasonBadge = (reason) => {
    switch (reason) {
      case 'trip_verification':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'support':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  // Get reason label
  const getReasonLabel = (reason) => {
    switch (reason) {
      case 'trip_verification':
        return 'Trip Verification'
      case 'support':
        return 'General Support'
      default:
        return 'Support'
    }
  }

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = conversations.length
    const unread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)
    const tripVerifications = conversations.filter(c => c.reason === 'trip_verification').length
    const generalSupport = conversations.filter(c => c.reason === 'support').length

    return { total, unread, tripVerifications, generalSupport }
  }, [conversations])

  return (
    <SafeComponent>
      <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        {/* Enhanced Header with Gradient */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 shadow-xl border border-blue-200"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">Support Inbox</h1>
                <p className="text-blue-100 text-lg">Manage user support conversations</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewConversationModal(true)}
                className="flex items-center gap-2 px-6 py-2 bg-white text-blue-600 rounded-lg transition-all shadow-lg hover:shadow-xl font-semibold hover:bg-blue-50"
              >
                <Plus className="w-5 h-5" />
                Start New Chat
              </button>
              <button
                onClick={refreshConversations}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">Total Conversations</p>
                    <p className="text-3xl font-bold text-blue-900">{statistics.total}</p>
                  </div>
                  <div className="p-3 bg-blue-500 rounded-xl">
                    <MessageSquare className="w-6 h-6 text-white" />
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
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 mb-1">Unread Messages</p>
                    <p className="text-3xl font-bold text-orange-900">{statistics.unread}</p>
                  </div>
                  <div className="p-3 bg-orange-500 rounded-xl">
                    <Mail className="w-6 h-6 text-white" />
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
                    <p className="text-sm font-medium text-purple-600 mb-1">Trip Verifications</p>
                    <p className="text-3xl font-bold text-purple-900">{statistics.tripVerifications}</p>
                  </div>
                  <div className="p-3 bg-purple-500 rounded-xl">
                    <MapPin className="w-6 h-6 text-white" />
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
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600 mb-1">General Support</p>
                    <p className="text-3xl font-bold text-indigo-900">{statistics.generalSupport}</p>
                  </div>
                  <div className="p-3 bg-indigo-500 rounded-xl">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <Card className="shadow-lg border-gray-200">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by user name or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 text-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <Filter className="w-4 h-4" />
                <span>Quick filters:</span>
              </div>
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'trip_verification', label: 'Trip Verification' },
                { id: 'support', label: 'General Support' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                    filter === item.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="flex items-center gap-2 text-gray-500 ml-auto">
                <ArrowUpDown className="w-4 h-4" />
                <span>Sort:</span>
                {[
                  { id: 'recent', label: 'Newest' },
                  { id: 'oldest', label: 'Oldest' },
                  { id: 'unread', label: 'Unread first' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSortBy(item.id)}
                    className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                      sortBy === item.id
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversations List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <p className="text-gray-500">Loading conversations...</p>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No conversations found</p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery ? 'Try a different search term' : 'Support conversations will appear here'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowNewConversationModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Start New Conversation
                </button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredConversations.map((conversation, index) => (
                <motion.div
                  key={conversation._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-shadow border-gray-200"
                    onClick={() => openConversation(conversation)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="relative">
                            {conversation.user?.profilePic ? (
                              <img
                                src={conversation.user.profilePic}
                                alt={conversation.user.fullName}
                                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                                {(conversation.user?.fullName?.[0] || conversation.user?.email?.[0] || 'U').toUpperCase()}
                              </div>
                            )}
                            {conversation.unreadCount > 0 && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {conversation.user?.fullName || conversation.user?.email || 'Unknown User'}
                              </h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getReasonBadge(conversation.reason)}`}>
                                {getReasonLabel(conversation.reason)}
                              </span>
                            </div>
                            {conversation.lastMessage && (
                              <p className="text-sm text-gray-600 truncate mb-1">
                                {conversation.lastMessage.text}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(conversation.updatedAt)}
                              </span>
                              {conversation.user?.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {conversation.user.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Load More */}
        {!loading && page < totalPages && (
          <div className="text-center">
            <button
              onClick={() => {
                const nextPage = page + 1
                setPage(nextPage)
                fetchConversations(nextPage)
              }}
              className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Load More
            </button>
          </div>
        )}

        {/* Start New Conversation Modal */}
        <Modal isOpen={showNewConversationModal} onClose={() => {
          setShowNewConversationModal(false)
          setSelectedUser(null)
          setUserSearchQuery('')
          setUserSearchResults([])
          setNewConversationMessage('')
          setNewConversationReason('support')
        }} size="large">
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Start New Conversation</h2>
            </div>
          </ModalHeader>
          <ModalContent className="space-y-6">
            {/* User Search */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Search User <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {searchingUsers && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>
              
              {/* User Search Results */}
              {userSearchQuery.length >= 2 && !selectedUser && (
                <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg max-h-60 overflow-y-auto">
                  {searchingUsers ? (
                    <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Searching users...</span>
                    </div>
                  ) : userSearchResults.length > 0 ? (
                    <>
                      {userSearchResults.map((user) => (
                        <button
                          key={user._id}
                          onClick={() => {
                            setSelectedUser(user)
                            setUserSearchQuery(user.fullName || user.email || '')
                            setUserSearchResults([])
                          }}
                          className="w-full p-3 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100 last:border-0 transition-colors"
                        >
                          {user.profilePic ? (
                            <img
                              src={user.profilePic}
                              alt={user.fullName}
                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold border-2 border-gray-200">
                              {(user.fullName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <p className="font-medium text-gray-900">{user.fullName || 'No name'}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </button>
                      ))}
                    </>
                  ) : userSearchQuery.length >= 2 ? (
                    <div className="p-4 text-center text-gray-500">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No users found matching "{userSearchQuery}"</p>
                      <p className="text-xs mt-1 text-gray-400">Try a different search term</p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Selected User */}
              {selectedUser && (
                <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedUser.profilePic ? (
                      <img
                        src={selectedUser.profilePic}
                        alt={selectedUser.fullName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {(selectedUser.fullName?.[0] || selectedUser.email?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{selectedUser.fullName || 'No name'}</p>
                      <p className="text-sm text-gray-500">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Reason Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Conversation Reason <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewConversationReason('support')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    newConversationReason === 'support'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className={`w-5 h-5 ${newConversationReason === 'support' ? 'text-purple-600' : 'text-gray-400'}`} />
                    <span className={`font-medium ${newConversationReason === 'support' ? 'text-purple-700' : 'text-gray-700'}`}>
                      General Support
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setNewConversationReason('trip_verification')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    newConversationReason === 'trip_verification'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-5 h-5 ${newConversationReason === 'trip_verification' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-medium ${newConversationReason === 'trip_verification' ? 'text-blue-700' : 'text-gray-700'}`}>
                      Trip Verification
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Initial Message (Optional) */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Initial Message <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <textarea
                value={newConversationMessage}
                onChange={(e) => setNewConversationMessage(e.target.value)}
                placeholder="Type an optional initial message..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </ModalContent>
          <ModalFooter>
            <button
              onClick={() => {
                setShowNewConversationModal(false)
                setSelectedUser(null)
                setUserSearchQuery('')
                setUserSearchResults([])
                setNewConversationMessage('')
                setNewConversationReason('support')
              }}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={createNewConversation}
              disabled={!selectedUser || creatingConversation}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {creatingConversation ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Start Conversation
                </>
              )}
            </button>
          </ModalFooter>
        </Modal>

        {/* Conversation Modal */}
        {selectedConversation && (
          <Modal isOpen={!!selectedConversation} onClose={closeConversation} size="large">
            <ModalHeader>
              <div className="flex items-center gap-3">
                {selectedConversation.user?.profilePic ? (
                  <img
                    src={selectedConversation.user.profilePic}
                    alt={selectedConversation.user.fullName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {(selectedConversation.user?.fullName?.[0] || selectedConversation.user?.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedConversation.user?.fullName || selectedConversation.user?.email || 'Unknown User'}
                  </h2>
                  <p className="text-sm text-gray-600">{selectedConversation.user?.email}</p>
                </div>
                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium border ${getReasonBadge(selectedConversation.reason)}`}>
                  {getReasonLabel(selectedConversation.reason)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-2 rounded-md border border-blue-100">
                  <Sparkles className="w-4 h-4" />
                  <div>
                    <p className="font-semibold">Conversation ID</p>
                    <p className="break-all text-xs text-blue-700">{selectedConversation._id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                  <Clock className="w-4 h-4" />
                  <div>
                    <p className="font-semibold text-gray-800">Last updated</p>
                    <p>{formatDate(selectedConversation.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-green-50 text-green-800 px-3 py-2 rounded-md border border-green-100">
                  <Tag className="w-4 h-4" />
                  <div>
                    <p className="font-semibold">Reason</p>
                    <p>{getReasonLabel(selectedConversation.reason)}</p>
                  </div>
                </div>
              </div>
            </ModalHeader>
            <ModalContent>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                  selectedConversation.messages.map((message, index) => {
                    const senderId = message.sender?._id?.toString() || message.sender?.toString() || ''
                    const TAATOM_OFFICIAL_USER_ID = '000000000000000000000001'
                    const isSystem = senderId === TAATOM_OFFICIAL_USER_ID
                    const previousMessage = selectedConversation.messages[index - 1]
                    const showDivider = !previousMessage || (
                      new Date(previousMessage.timestamp).toDateString() !== new Date(message.timestamp).toDateString()
                    )
                    return (
                      <React.Fragment key={message._id || index}>
                        {showDivider && (
                          <div className="flex items-center gap-2 my-2">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-500">{formatDate(message.timestamp)}</span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                        )}
                        <div
                          className={`flex ${isSystem ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[75%] rounded-lg p-3 shadow-sm ${
                            isSystem 
                              ? 'bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200' 
                              : 'bg-white border border-gray-200'
                          }`}>
                            {isSystem && (
                              <div className="flex items-center gap-1 mb-1">
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                <span className="text-xs font-medium text-blue-700">Taatom Official</span>
                              </div>
                            )}
                            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                              {message.text}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 text-right">
                              {formatDate(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ModalContent>
            <ModalFooter>
              <div className="space-y-3 w-full">
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((text, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMessageText(text)}
                      className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs hover:border-blue-400 hover:text-blue-700 transition-colors"
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={sendingMessage}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim() || sendingMessage}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sendingMessage ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </SafeComponent>
  )
}

export default SupportInbox
