import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Users, MessageSquare, FileText, Clock, MapPin, Music } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealTime } from '../context/RealTimeContext'
import { formatDistanceToNow } from 'date-fns'
import logger from '../utils/logger'

const GlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ users: [], posts: [], locales: [], songs: [], total: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [selectedType, setSelectedType] = useState('all')
  const searchRef = useRef(null)
  const inputRef = useRef(null)

  const { globalSearch } = useRealTime()

  const searchTypes = [
    { value: 'all', label: 'All', icon: Search },
    { value: 'users', label: 'Users', icon: Users },
    { value: 'posts', label: 'Posts', icon: MessageSquare },
    { value: 'locales', label: 'Locales', icon: FileText },
    { value: 'songs', label: 'Songs', icon: FileText }
  ]

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (query.length >= 2) {
      const timeoutId = setTimeout(() => {
        performSearch()
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setResults({ users: [], posts: [], total: 0 })
    }
  }, [query, selectedType])

  const performSearch = async () => {
    if (!query.trim()) return

    setIsLoading(true)
    try {
      // Try advanced search first (if available), fallback to basic search
      try {
        const { api } = await import('../services/api')
        const response = await api.get('/api/v1/superadmin/search/advanced', {
          params: { q: query.trim(), type: selectedType, limit: 20 }
        })
        if (response.data && response.data.data) {
          const advancedResults = response.data.data.results
          setResults({
            users: advancedResults.users || [],
            posts: advancedResults.posts || [],
            locales: advancedResults.locales || [],
            songs: advancedResults.songs || [],
            total: advancedResults.total || 0
          })
        } else {
          // Fallback to basic search
          const searchResults = await globalSearch(query, selectedType)
          setResults(searchResults)
        }
      } catch (advancedError) {
        // Fallback to basic search if advanced search fails
        logger.debug('Advanced search not available, using basic search:', advancedError)
        const searchResults = await globalSearch(query, selectedType)
        setResults(searchResults)
      }
      
      // Add to search history
      if (query.trim() && !searchHistory.includes(query.trim())) {
        setSearchHistory(prev => [query.trim(), ...prev.slice(0, 9)])
      }
    } catch (error) {
      logger.error('Search failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResultClick = (result) => {
    // Handle navigation based on result type
    logger.debug('Navigate to:', result)
    setIsOpen(false)
    setQuery('')
  }

  const clearSearch = () => {
    setQuery('')
    setResults({ users: [], posts: [], locales: [], songs: [], total: 0 })
    inputRef.current?.focus()
  }

  const getResultIcon = (type) => {
    switch (type) {
      case 'user': return Users
      case 'post': return MessageSquare
      case 'locale': return MapPin
      case 'song': return Music
      default: return FileText
    }
  }

  const formatResultDate = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  return (
    <>
      {/* Search Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Search className="w-4 h-4 text-gray-500 mr-2" />
        <span className="text-gray-500 text-sm">Search...</span>
        <kbd className="ml-2 px-2 py-1 bg-gray-200 text-xs rounded">⌘K</kbd>
      </button>

      {/* Search Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
            onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-2xl max-h-96 overflow-hidden"
              ref={searchRef}
            >
              {/* Search Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <Search className="w-5 h-5 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users, posts, content..."
                    className="flex-1 outline-none text-lg"
                  />
                  {query && (
                    <button
                      onClick={clearSearch}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
                
                {/* Search Type Filters */}
                <div className="flex items-center space-x-2 mt-3">
                  {searchTypes.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`flex items-center px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedType === type.value
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <type.icon className="w-4 h-4 mr-1" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Results */}
              <div className="max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : query.length < 2 ? (
                  <div className="p-4">
                    <div className="text-center text-gray-500 py-8">
                      <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>Type at least 2 characters to search</p>
                    </div>
                    
                    {/* Search History */}
                    {searchHistory.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent searches</h4>
                        <div className="space-y-1">
                          {searchHistory.slice(0, 5).map((term, index) => (
                            <button
                              key={index}
                              onClick={() => setQuery(term)}
                              className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 rounded"
                            >
                              <Clock className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-600">{term}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : results.total === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No results found for "{query}"</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {/* Users Results */}
                    {results.users.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 px-2 py-1 mb-2">
                          Users ({results.users.length})
                        </h4>
                        {results.users.map((user, index) => (
                          <motion.button
                            key={user._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleResultClick(user)}
                            className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded"
                          >
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-sm font-semibold text-blue-600">
                                {user.fullName?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium text-gray-900">{user.fullName}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatResultDate(user.createdAt)}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {/* Posts Results */}
                    {results.posts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 px-2 py-1 mb-2">
                          Posts ({results.posts.length})
                        </h4>
                        {results.posts.map((post, index) => (
                          <motion.button
                            key={post._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleResultClick(post)}
                            className="flex items-start w-full px-3 py-2 hover:bg-gray-50 rounded"
                          >
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-1">
                              <MessageSquare className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium text-gray-900 line-clamp-2">
                                {post.content}
                              </p>
                              <div className="flex items-center mt-1 space-x-2">
                                <span className="text-sm text-gray-500">
                                  by {post.user?.fullName || 'Unknown'}
                                </span>
                                {post.location && (
                                  <>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-sm text-gray-500">{post.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatResultDate(post.createdAt)}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default GlobalSearch
