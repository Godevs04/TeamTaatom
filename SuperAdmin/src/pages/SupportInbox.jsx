import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Loader2,
  Copy,
  Check
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
  const [isTyping, setIsTyping] = useState(false)
  const [localUnreadCounts, setLocalUnreadCounts] = useState(new Map())
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const messagesContainerRef = useRef(null)
  const lastMessageCountRef = useRef(0)
  
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

  // Mark conversation as read (frontend + backend)
  const markConversationAsRead = useCallback(async (conversationId) => {
    try {
      // Call backend API to mark messages as read
      // Note: We'll update the backend to mark all user messages as seen when admin opens conversation
      await api.post(`/api/v1/superadmin/conversations/${conversationId}/mark-read`)
      
      // Update local unread count immediately
      setLocalUnreadCounts(prev => {
        const updated = new Map(prev)
        updated.set(conversationId, 0)
        return updated
      })
      
      // Update conversations list to reflect zero unread
      setConversations(prev => prev.map(conv => {
        if (conv._id === conversationId) {
          return { ...conv, unreadCount: 0 }
        }
        return conv
      }))
    } catch (error) {
      // If API call fails, still update local state for immediate UI feedback
      logger.warn('Failed to mark conversation as read on backend:', error)
      setLocalUnreadCounts(prev => {
        const updated = new Map(prev)
        updated.set(conversationId, 0)
        return updated
      })
      setConversations(prev => prev.map(conv => {
        if (conv._id === conversationId) {
          return { ...conv, unreadCount: 0 }
        }
        return conv
      }))
    }
  }, [])

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
          
          // Mark conversation as read when opened (backend + frontend)
          await markConversationAsRead(conversationId)
          
          // Reset scroll state when opening new conversation
          setUserHasScrolledUp(false)
          setIsNearBottom(true)
          lastMessageCountRef.current = conversation.messages?.length || 0
          
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
  }, [markConversationAsRead])

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
    let result = conversations.map(conv => {
      // Apply local unread count override
      const localCount = localUnreadCounts.get(conv._id)
      if (localCount !== undefined) {
        return { ...conv, unreadCount: localCount }
      }
      return conv
    })

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

  // Smart auto-scroll: only scroll if user is near bottom
  const scrollToBottom = useCallback((force = false) => {
    if (messagesEndRef.current && (force || isNearBottom)) {
      messagesEndRef.current.scrollIntoView({ behavior: force ? 'auto' : 'smooth' })
    }
  }, [isNearBottom])

  // Check if user is near bottom of messages and track manual scrolling
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !selectedConversation) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const nearBottom = distanceFromBottom < 150 // Within 150px of bottom
      
      setIsNearBottom(nearBottom)
      
      // If user scrolls up significantly, mark that they've manually scrolled
      if (distanceFromBottom > 200) {
        setUserHasScrolledUp(true)
      } else if (nearBottom) {
        // If they scroll back to bottom, reset the flag
        setUserHasScrolledUp(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [selectedConversation])

  // Auto-scroll on new messages (only if user hasn't manually scrolled up and is near bottom)
  useEffect(() => {
    if (!selectedConversation?.messages?.length) return
    
    const currentMessageCount = selectedConversation.messages.length
    const previousMessageCount = lastMessageCountRef.current
    
    // Only auto-scroll if:
    // 1. New messages were added (count increased)
    // 2. User hasn't manually scrolled up
    // 3. User is near bottom
    if (currentMessageCount > previousMessageCount && !userHasScrolledUp && isNearBottom) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (messagesEndRef.current && isNearBottom && !userHasScrolledUp) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    }
    
    lastMessageCountRef.current = currentMessageCount
  }, [selectedConversation?.messages?.length, userHasScrolledUp, isNearBottom])

  // Scroll to bottom when conversation opens (force scroll)
  useEffect(() => {
    if (selectedConversation?._id) {
      setUserHasScrolledUp(false)
      setIsNearBottom(true)
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
        }
      }, 300)
    }
  }, [selectedConversation?._id])

  // Load conversations on mount
  useEffect(() => {
    fetchConversations(1)
  }, [fetchConversations])

  // Handle opening conversation from URL parameter (e.g., from TripScore Analytics)
  useEffect(() => {
    const conversationId = new URLSearchParams(window.location.search).get('conversationId')
    if (conversationId && !selectedConversation) {
      // Small delay to ensure conversations list is loaded first
      setTimeout(() => {
        fetchConversationDetails(conversationId).then(convo => {
          if (convo) {
            setSelectedConversation(convo)
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname)
          }
        }).catch(err => {
          logger.error('Failed to open conversation from URL:', err)
          // Try to find conversation in the list instead
          const foundConvo = conversations.find(c => c._id === conversationId)
          if (foundConvo) {
            fetchConversationDetails(conversationId).catch(() => {
              // If still fails, just open what we have from the list
              setSelectedConversation(foundConvo)
            })
          }
        })
      }, 500)
    }
  }, [selectedConversation, fetchConversationDetails, conversations])

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
          
          // If message belongs to currently open conversation, mark as read immediately
          if (selectedConversation && selectedConversation._id === data.chatId) {
            // Don't increment unread count for open conversation
            markConversationAsRead(data.chatId)
            fetchConversationDetails(data.chatId)
          } else {
            // Increment unread count for other conversations
            setConversations(prev => prev.map(conv => {
              if (conv._id === data.chatId) {
                return { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
              }
              return conv
            }))
          }
          
          // Refresh conversations list to update last message
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
  }, [selectedConversation?._id, page, fetchConversations, fetchConversationDetails, markConversationAsRead])

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

  // Calculate statistics with local unread count overrides
  const statistics = useMemo(() => {
    const total = conversations.length
    const unread = conversations.reduce((sum, conv) => {
      // Use local unread count if available, otherwise use server count
      const localCount = localUnreadCounts.get(conv._id)
      const count = localCount !== undefined ? localCount : (conv.unreadCount || 0)
      return sum + count
    }, 0)
    const tripVerifications = conversations.filter(c => c.reason === 'trip_verification').length
    const generalSupport = conversations.filter(c => c.reason === 'support').length

    return { total, unread, tripVerifications, generalSupport }
  }, [conversations, localUnreadCounts])

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
          <div className="space-y-3 sm:space-y-4">
            <AnimatePresence>
              {filteredConversations.map((conversation, index) => {
                const localCount = localUnreadCounts.get(conversation._id)
                const unreadCount = localCount !== undefined ? localCount : (conversation.unreadCount || 0)
                const hasUnread = unreadCount > 0
                
                return (
                  <motion.div
                    key={conversation._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                  >
                    <Card
                      className={`group cursor-pointer transition-all duration-300 border-2 ${
                        hasUnread 
                          ? 'bg-gradient-to-r from-blue-50/50 via-white to-purple-50/50 border-blue-200/60 shadow-md hover:shadow-xl hover:border-blue-300/80 hover:-translate-y-0.5' 
                          : 'bg-white border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5'
                      }`}
                      onClick={() => openConversation(conversation)}
                    >
                      <CardContent className="p-4 sm:p-5 lg:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            {/* Enhanced Avatar with Status */}
                            <div className="relative flex-shrink-0">
                              {conversation.user?.profilePic ? (
                                <div className="relative">
                                  <img
                                    src={conversation.user.profilePic}
                                    alt={conversation.user.fullName}
                                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-white shadow-lg ring-2 ring-blue-100 group-hover:ring-blue-300 transition-all"
                                    onError={(e) => {
                                      e.target.style.display = 'none'
                                      e.target.nextSibling.style.display = 'flex'
                                    }}
                                  />
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg border-4 border-white ring-2 ring-blue-100 hidden">
                                    {(conversation.user?.fullName?.[0] || conversation.user?.email?.[0] || 'U').toUpperCase()}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg border-4 border-white ring-2 ring-blue-100 group-hover:ring-blue-300 transition-all">
                                  {(conversation.user?.fullName?.[0] || conversation.user?.email?.[0] || 'U').toUpperCase()}
                                </div>
                              )}
                              {/* Online Status Indicator */}
                              <div className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full border-4 border-white shadow-md ring-2 ring-green-100"></div>
                              {/* Unread Badge */}
                              {hasUnread && (
                                <div className="absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ring-2 ring-white animate-pulse">
                                  {unreadCount > 9 ? '9+' : unreadCount}
                                </div>
                              )}
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 min-w-0 space-y-2">
                              {/* Name and Badge Row */}
                              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                <h3 className={`font-bold text-gray-900 truncate ${
                                  hasUnread ? 'text-base sm:text-lg' : 'text-base sm:text-lg'
                                }`}>
                                  {conversation.user?.fullName || conversation.user?.email || 'Unknown User'}
                                </h3>
                                <span className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold shadow-sm transition-all ${
                                  conversation.reason === 'trip_verification'
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400/50'
                                    : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border border-purple-400/50'
                                }`}>
                                  {getReasonLabel(conversation.reason)}
                                </span>
                              </div>

                              {/* Message Preview */}
                              {conversation.lastMessage && (
                                <p className={`text-sm sm:text-base text-gray-700 line-clamp-2 leading-relaxed ${
                                  hasUnread ? 'font-medium' : 'font-normal'
                                }`}>
                                  {conversation.lastMessage.text}
                                </p>
                              )}

                              {/* Metadata Row */}
                              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 flex-wrap">
                                <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                                  <span className="font-medium">{formatDate(conversation.updatedAt)}</span>
                                </span>
                                {conversation.user?.email && (
                                  <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg truncate max-w-[200px] sm:max-w-none">
                                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium truncate">{conversation.user.email}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Arrow Icon with Hover Effect */}
                          <div className="flex-shrink-0 flex items-center">
                            <div className={`p-2 rounded-full transition-all duration-300 ${
                              hasUnread 
                                ? 'bg-blue-100 group-hover:bg-blue-200' 
                                : 'bg-gray-100 group-hover:bg-gray-200'
                            }`}>
                              <ChevronRight className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 ${
                                hasUnread ? 'text-blue-600' : 'text-gray-400'
                              } group-hover:translate-x-1`} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
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

        {/* Enhanced Conversation Modal - Wider and More Responsive */}
        {selectedConversation && (
          <Modal isOpen={!!selectedConversation} onClose={closeConversation} className="w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[95vh] sm:max-h-[90vh] flex flex-col mx-2 sm:mx-4 lg:mx-auto">
            <ModalHeader className="flex-shrink-0 p-0">
              {/* Enhanced Header with Gradient Background */}
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-4 sm:p-5 lg:p-6 rounded-t-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 lg:gap-6">
                  <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 flex-1 min-w-0">
                    {selectedConversation.user?.profilePic ? (
                      <div className="relative flex-shrink-0">
                        <img
                          src={selectedConversation.user.profilePic}
                          alt={selectedConversation.user.fullName}
                          className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full object-cover border-4 border-white shadow-xl"
                        />
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 bg-green-500 rounded-full border-4 border-white shadow-md"></div>
                      </div>
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg sm:text-xl lg:text-2xl border-4 border-white shadow-xl flex-shrink-0">
                        {(selectedConversation.user?.fullName?.[0] || selectedConversation.user?.email?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                    <div className="text-white min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 truncate">
                        {selectedConversation.user?.fullName || selectedConversation.user?.email || 'Unknown User'}
                      </h2>
                      <div className="flex items-center gap-2 sm:gap-2.5 text-blue-100">
                        <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <p className="text-xs sm:text-sm lg:text-base truncate">{selectedConversation.user?.email || 'No email'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className={`px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 rounded-full text-xs sm:text-sm lg:text-base font-semibold border-2 border-white/30 backdrop-blur-sm whitespace-nowrap ${
                      selectedConversation.reason === 'trip_verification' 
                        ? 'bg-blue-500/80 text-white' 
                        : 'bg-purple-500/80 text-white'
                    }`}>
                      {getReasonLabel(selectedConversation.reason)}
                    </span>
                    <button
                      onClick={closeConversation}
                      className="p-2 sm:p-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors flex-shrink-0"
                      aria-label="Close chat"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Enhanced Metadata Cards - Compact and Responsive */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mt-3 sm:mt-4 px-4 sm:px-5 lg:px-6 pb-4 sm:pb-5 lg:pb-6">
                <div
                  className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-2.5 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedConversation._id)
                    setCopiedId(true)
                    setTimeout(() => setCopiedId(false), 2000)
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500 rounded text-white flex-shrink-0">
                      <Sparkles className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-700">ID</p>
                      <p className="text-xs text-blue-600 truncate font-mono">{selectedConversation._id.slice(-8)}</p>
                    </div>
                    {copiedId ? (
                      <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3 text-blue-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-500 rounded text-white flex-shrink-0">
                      <Clock className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">Updated</p>
                      <p className="text-xs text-gray-600 truncate">{formatDate(selectedConversation.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-500 rounded text-white flex-shrink-0">
                      <Tag className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-green-700">Reason</p>
                      <p className="text-xs text-green-600 font-medium truncate">{getReasonLabel(selectedConversation.reason)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ModalHeader>
            <ModalContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 sm:p-5 lg:p-6">
              <style>{`
                .messages-container::-webkit-scrollbar {
                  width: 6px;
                }
                .messages-container::-webkit-scrollbar-track {
                  background: #f1f5f9;
                  border-radius: 10px;
                }
                .messages-container::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 10px;
                }
                .messages-container::-webkit-scrollbar-thumb:hover {
                  background: #94a3b8;
                }
              `}</style>
              <div 
                ref={messagesContainerRef}
                className="messages-container flex-1 space-y-2 overflow-y-auto pr-2"
                style={{ minHeight: 0 }}
                onScroll={() => {
                  // Update isNearBottom on scroll
                  const container = messagesContainerRef.current
                  if (container) {
                    const { scrollTop, scrollHeight, clientHeight } = container
                    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
                    setIsNearBottom(distanceFromBottom < 100)
                  }
                }}
              >
                {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                  selectedConversation.messages.map((message, index) => {
                    const senderId = message.sender?._id?.toString() || message.sender?.toString() || ''
                    const TAATOM_OFFICIAL_USER_ID = '000000000000000000000001'
                    // Admin messages (Taatom Official) = LEFT, User messages = RIGHT
                    const isAdminMessage = senderId === TAATOM_OFFICIAL_USER_ID
                    const isOwnMessage = isAdminMessage // From admin panel perspective
                    const previousMessage = selectedConversation.messages[index - 1]
                    const isConsecutive = previousMessage && 
                      (previousMessage.sender?.toString() === message.sender?.toString() || 
                       (previousMessage.sender?._id?.toString() === message.sender?._id?.toString())) &&
                      new Date(message.timestamp) - new Date(previousMessage.timestamp) < 60000 // Within 1 minute
                    const showDivider = !previousMessage || (
                      new Date(previousMessage.timestamp).toDateString() !== new Date(message.timestamp).toDateString()
                    )
                    
                    return (
                      <React.Fragment key={message._id || index}>
                        {showDivider && (
                          <div className="flex items-center gap-3 my-4"
                          >
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                            <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                              {formatDate(message.timestamp)}
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                          </div>
                        )}
                        <div
                          className={`flex gap-2 ${isAdminMessage ? 'justify-start' : 'justify-end'} ${isConsecutive ? 'mt-1' : 'mt-3'}`}
                        >
                          {isAdminMessage && !isConsecutive && (
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                              TO
                            </div>
                          )}
                          {isAdminMessage && isConsecutive && <div className="w-6 sm:w-7" />}
                          <div className={`max-w-[75%] sm:max-w-[65%] md:max-w-[60%] lg:max-w-[55%] rounded-xl shadow-sm hover:shadow-md transition-all ${
                            isAdminMessage
                              ? 'bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 border border-blue-200/50 rounded-bl-sm' // Left: rounded except bottom-left
                              : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200/50 rounded-br-sm' // Right: rounded except bottom-right
                          }`}>
                            <div className="p-2 sm:p-2.5 lg:p-3">
                              {isAdminMessage && !isConsecutive && (
                                <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5">
                                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse flex-shrink-0"></div>
                                  <span className="text-xs font-semibold text-blue-700">Taatom Official</span>
                                  <CheckCircle2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                </div>
                              )}
                              <p className={`text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed ${
                                isAdminMessage ? 'text-gray-800' : 'text-gray-900'
                              }`}>
                                {message.text}
                              </p>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/30">
                                <p className="text-xs text-gray-500">
                                  {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                </p>
                                {!isAdminMessage && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {message.seen ? (
                                      <CheckCircle2 className="w-3 h-3 text-blue-500" />
                                    ) : (
                                      <CheckCircle2 className="w-3 h-3 text-gray-400" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })
                ) : (
                  <div className="text-center py-12"
                  >
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-10 h-10 text-blue-400" />
                    </div>
                    <p className="text-gray-500 font-medium">No messages yet</p>
                    <p className="text-sm text-gray-400 mt-1">Start the conversation by sending a message</p>
                  </div>
                )}
                {isTyping && (
                  <div className="flex justify-start gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                      TO
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 border border-blue-200/50 rounded-xl rounded-bl-sm p-2.5 sm:p-3 shadow-sm">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ModalContent>
            <ModalFooter className="flex-shrink-0 border-t border-gray-200 bg-white p-4 sm:p-5 lg:p-6">
              <div className="space-y-3 sm:space-y-4 w-full">
                {quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 sm:gap-2.5 pb-2 max-h-28 overflow-y-auto">
                    {quickReplies.map((text, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMessageText(text)}
                        className="px-3 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-full text-xs sm:text-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors whitespace-nowrap"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 sm:gap-3 lg:gap-4">
                  <div className="flex-1 relative min-w-0">
                    <textarea
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value)
                        // Show typing indicator when typing
                        if (e.target.value.trim() && !isTyping) {
                          setIsTyping(true)
                        }
                        // Hide typing indicator after stopping
                        clearTimeout(window.typingTimeout)
                        window.typingTimeout = setTimeout(() => setIsTyping(false), 1000)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          setIsTyping(false)
                          sendMessage()
                        }
                      }}
                      placeholder="Type your message..."
                      rows={1}
                      className="w-full px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 lg:py-3.5 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm sm:text-base lg:text-lg leading-relaxed"
                      disabled={sendingMessage}
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: messageText.trim() ? 1.05 : 1 }}
                    whileTap={{ scale: messageText.trim() ? 0.95 : 1 }}
                    onClick={() => {
                      setIsTyping(false)
                      sendMessage()
                    }}
                    disabled={!messageText.trim() || sendingMessage}
                    className="px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 lg:py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl disabled:hover:scale-100 flex-shrink-0 text-sm sm:text-base lg:text-lg"
                    aria-label="Send message"
                  >
                    {sendingMessage ? (
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Send</span>
                      </>
                    )}
                  </motion.button>
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
