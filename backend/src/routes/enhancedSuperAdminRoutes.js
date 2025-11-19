const express = require('express')
const router = express.Router()
const SuperAdmin = require('../models/SuperAdmin')
const SystemSettings = require('../models/SystemSettings')
const logger = require('../utils/logger')
const { sendError, sendSuccess } = require('../utils/errorCodes')
const {
  verifySuperAdminToken,
  checkPermission,
  loginSuperAdmin,
  verify2FA,
  resend2FA,
  verifyToken,
  createSuperAdmin,
  getSecurityLogs,
  changePassword,
  updateProfile,
  logout
} = require('../controllers/superAdminController')
const {
  getAnalyticsSummary,
  getTimeSeriesData,
  getEventBreakdown,
  getTopFeatures,
  getDropOffPoints,
  getRecentEvents,
  getUserRetention
} = require('../controllers/analyticsAdminController')

// Alias for clarity
const authenticateSuperAdmin = verifySuperAdminToken

// Public routes (no authentication required)
router.post('/login', loginSuperAdmin)
router.post('/create', createSuperAdmin) // For initial setup only
router.post('/verify-2fa', verify2FA)
router.post('/resend-2fa', resend2FA)


// Protected routes (require authentication)
router.use(verifySuperAdminToken)

// Authentication routes
router.get('/verify', (req, res) => {
  try {
    return sendSuccess(res, 200, 'Token is valid', {
      user: {
        id: req.superAdmin._id,
        email: req.superAdmin.email,
        role: req.superAdmin.role,
        isActive: req.superAdmin.isActive,
        permissions: req.superAdmin.permissions
      }
    })
  } catch (error) {
    logger.error('Token verification error:', error)
    return sendError(res, 'AUTH_1001', 'Invalid token')
  }
})
router.post('/logout', logout)
router.patch('/change-password', changePassword)
router.patch('/profile', updateProfile)

// Notifications endpoint
router.get('/notifications', async (req, res) => {
  try {
    const User = require('../models/User')
    const Post = require('../models/Post')
    const Report = require('../models/Report')
    
    // Get recent notifications for SuperAdmin
    // This includes: new user registrations, pending reports, system alerts, etc.
    const notifications = []
    
    // Get recent user registrations (last 24 hours)
    const recentUsers = await User.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
      .select('fullName email createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
    
    recentUsers.forEach(user => {
      const timeAgo = getTimeAgo(new Date(user.createdAt))
      notifications.push({
        id: `user_${user._id}`,
        title: 'New user registered',
        message: `${user.fullName || user.email} joined the platform`,
        time: timeAgo,
        unread: true,
        type: 'user',
        link: `/users?search=${user.email}`
      })
    })
    
    // Get pending reports
    const pendingReports = await Report.find({ status: 'pending' })
      .populate('reportedBy', 'fullName email')
      .populate('reportedUser', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
    
    pendingReports.forEach(report => {
      const timeAgo = getTimeAgo(new Date(report.createdAt))
      notifications.push({
        id: `report_${report._id}`,
        title: 'Content report pending',
        message: `Report from ${report.reportedBy?.fullName || report.reportedBy?.email || 'Unknown'} needs attention`,
        time: timeAgo,
        unread: true,
        type: 'report',
        link: `/reports?id=${report._id}`
      })
    })
    
    // Get recent posts that might need moderation
    const recentPosts = await Post.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      flagged: { $ne: true }
    })
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()
    
    // Sort all notifications by time (newest first)
    notifications.sort((a, b) => {
      // Convert time strings back to dates for sorting
      const timeA = parseTimeAgo(a.time)
      const timeB = parseTimeAgo(b.time)
      return timeB - timeA
    })
    
    // Limit to 20 most recent
    const limitedNotifications = notifications.slice(0, 20)
    
    // Return in format expected by frontend
    return sendSuccess(res, 200, 'Notifications fetched successfully', {
      notifications: limitedNotifications,
      unreadCount: limitedNotifications.filter(n => n.unread).length
    })
  } catch (error) {
    logger.error('Get notifications error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch notifications')
  }
})

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)
  if (seconds < 60) return `${seconds} sec ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

// Helper function to parse time ago back to date for sorting
function parseTimeAgo(timeStr) {
  const match = timeStr.match(/(\d+)\s*(sec|min|hour|day)/)
  if (!match) return 0
  const value = parseInt(match[1])
  const unit = match[2]
  const multipliers = { sec: 1, min: 60, hour: 3600, day: 86400 }
  return value * multipliers[unit] * 1000
}

// Dashboard overview with real-time data (all roles can view)
router.get('/dashboard/overview', async (req, res) => {
  try {
    const User = require('../models/User')
    const Post = require('../models/Post')
    const Chat = require('../models/Chat')
    
    // Get real-time counts
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      totalShorts,
      totalChats,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 
        $or: [
          { lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          { updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        ]
      }),
      Post.countDocuments({ type: 'photo', isActive: true }),
      Post.countDocuments({ type: 'short', isActive: true }),
      Chat.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('fullName email createdAt')
    ])
    
    // Calculate total active posts (photos + shorts)
    const totalActivePosts = totalPosts + totalShorts

    // Get recent posts with proper user population
    const recentPostsRaw = await Post.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('caption type createdAt user')
      .populate('user', 'fullName email')
    
    // Transform to plain objects to avoid virtual field issues
    const recentPosts = recentPostsRaw.map(post => ({
      _id: post._id,
      content: post.caption,
      type: post.type,
      createdAt: post.createdAt,
      user: post.user ? {
        _id: post.user._id,
        fullName: post.user.fullName,
        email: post.user.email
      } : null
    }))

    // Calculate growth metrics
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const [usersLastWeek, usersLastMonth, postsLastWeek, postsLastMonth] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: lastWeek } }),
      User.countDocuments({ createdAt: { $gte: lastMonth } }),
      Post.countDocuments({ createdAt: { $gte: lastWeek } }),
      Post.countDocuments({ createdAt: { $gte: lastMonth } })
    ])

    const overview = {
      metrics: {
        totalUsers,
        activeUsers,
        totalPosts: totalActivePosts,
        totalShorts,
        totalChats,
        userGrowth: {
          weekly: usersLastWeek,
          monthly: usersLastMonth,
          weeklyGrowth: totalUsers > 0 ? ((usersLastWeek / totalUsers) * 100).toFixed(1) : 0,
          monthlyGrowth: totalUsers > 0 ? ((usersLastMonth / totalUsers) * 100).toFixed(1) : 0
        },
        contentGrowth: {
          weekly: postsLastWeek + totalShorts, // Include shorts in weekly growth
          monthly: postsLastMonth + totalShorts, // Include shorts in monthly growth
          weeklyGrowth: totalActivePosts > 0 ? ((postsLastWeek / totalActivePosts) * 100).toFixed(1) : 0,
          monthlyGrowth: totalActivePosts > 0 ? ((postsLastMonth / totalActivePosts) * 100).toFixed(1) : 0
        }
      },
      recentActivity: {
        users: recentUsers,
        posts: recentPosts
      },
      aiInsights: {
        topPerformingRegions: await getTopPerformingRegions(),
        inactiveUsers: await getInactiveUsers(),
        vipUsers: await getVIPUsers(),
        recommendations: await getAIRecommendations()
      }
    }

    return sendSuccess(res, 200, 'Dashboard overview fetched successfully', overview)
  } catch (error) {
    logger.error('Dashboard overview error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch overview data')
  }
})

// Real-time analytics with auto-refresh support (Dashboard has basic analytics, this is for detailed)
router.get('/analytics/realtime', async (req, res) => {
  try {
    const { period = '24h' } = req.query
    const User = require('../models/User')
    const Post = require('../models/Post')
    
    let timeFilter = {}
    switch (period) {
      case '1h':
        timeFilter = { $gte: new Date(Date.now() - 60 * 60 * 1000) }
        break
      case '24h':
        timeFilter = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        break
      case '7d':
        timeFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        break
      case '30d':
        timeFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        break
    }

    // Get real-time data
    const [
      userRegistrations,
      postCreations,
      userActivity,
      contentEngagement
    ] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: timeFilter } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Post.aggregate([
        { $match: { createdAt: timeFilter } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      User.countDocuments({ 
        $or: [
          { lastLogin: timeFilter },
          { updatedAt: timeFilter }
        ]
      }),
      Post.aggregate([
        { $match: { createdAt: timeFilter } },
        { $group: { 
          _id: null, 
          totalLikes: { $sum: { $size: '$likes' } }, 
          totalComments: { $sum: { $size: '$comments' } }
        }}
      ])
    ])
    
    // Calculate total shares (not stored in Post model, so set to 0)
    const totalShares = 0

    const analytics = {
      timestamp: new Date().toISOString(),
      period,
      userRegistrations: userRegistrations.map(item => ({ time: item._id, count: item.count })),
      postCreations: postCreations.map(item => ({ time: item._id, count: item.count })),
      activeUsers: userActivity,
      engagement: {
        totalLikes: contentEngagement[0]?.totalLikes || 0,
        totalComments: contentEngagement[0]?.totalComments || 0,
        totalShares: totalShares
      }
    }

    return sendSuccess(res, 200, 'Real-time analytics fetched successfully', analytics)
  } catch (error) {
    logger.error('Real-time analytics error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch real-time analytics')
  }
})

// Users management with advanced features
router.get('/users', checkPermission('canManageUsers'), async (req, res) => {
  try {
    
    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query
    const skip = (page - 1) * limit
    
    const User = require('../models/User')
    const Post = require('../models/Post')
    
    let query = {}
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (status && status !== 'undefined' && status !== 'all') {
      // Handle different status filters
      if (status === 'active') {
        query.isVerified = true
        query.deletedAt = { $exists: false }
      } else if (status === 'inactive') {
        query.isVerified = false
        query.deletedAt = { $exists: false }
      } else if (status === 'pending') {
        // For pending users, check if they haven't verified their email
        query.isVerified = false
        query.deletedAt = { $exists: false }
      } else if (status === 'banned') {
        query.deletedAt = { $exists: true }
      }
    }
    
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1
    
    const users = await User.find(query)
      .select('fullName email bio profilePic isVerified deletedAt createdAt updatedAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
    
    const total = await User.countDocuments(query)
    
    // Add additional user metrics
    const usersWithMetrics = await Promise.all(users.map(async (user) => {
      try {
        const userPosts = await Post.countDocuments({ user: user._id })
        
        // Calculate total likes correctly by summing the size of likes arrays
        const userLikesResult = await Post.aggregate([
          { $match: { user: user._id } },
          { $group: { _id: null, totalLikes: { $sum: { $size: '$likes' } } } }
        ])
        
        // Get followers count
        const followersCount = await User.findById(user._id).select('followers')
        
        return {
          ...user.toObject(),
          metrics: {
            totalPosts: userPosts,
            totalLikes: userLikesResult[0]?.totalLikes || 0,
            totalFollowers: followersCount?.followers?.length || 0,
            lastActive: user.lastLogin || user.updatedAt || user.createdAt
          }
        }
      } catch (error) {
        logger.error('Error processing user metrics for user:', user._id, error)
        return {
          ...user.toObject(),
          metrics: {
            totalPosts: 0,
            totalLikes: 0,
            totalFollowers: 0,
            lastActive: user.lastLogin || user.updatedAt || user.createdAt
          }
        }
      }
    }))
    
    return sendSuccess(res, 200, 'Users fetched successfully', {
      users: usersWithMetrics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Users data error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch users data')
  }
})

// Update single user
router.patch('/users/:id', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    const User = require('../models/User')
    
    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select('-password')
    
    if (!user) {
      return sendError(res, 'RES_3001', 'User not found')
    }
    
    // Log the action
    await req.superAdmin.logSecurityEvent(
      'update_user',
      `Updated user: ${user.email}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 200, 'User updated successfully', { user })
  } catch (error) {
    logger.error('User update error:', error)
    return sendError(res, 'SRV_6001', 'Failed to update user')
  }
})

// Delete single user
router.delete('/users/:id', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { id } = req.params
    const User = require('../models/User')
    
    const user = await User.findById(id)
    
    if (!user) {
      return sendError(res, 'RES_3001', 'User not found')
    }
    
    // Log before deletion
    await req.superAdmin.logSecurityEvent(
      'delete_user',
      `Deleted user: ${user.email}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    // Soft delete by marking as inactive
    await User.findByIdAndUpdate(id, { isActive: false, deletedAt: new Date() })
    
    return sendSuccess(res, 200, 'User deleted successfully')
  } catch (error) {
    logger.error('User deletion error:', error)
    return sendError(res, 'SRV_6001', 'Failed to delete user')
  }
})

// Bulk actions for users
router.post('/users/bulk-action', async (req, res) => {
  try {
    const { action, userIds, reason } = req.body
    const User = require('../models/User')
    
    if (!action || !userIds || !Array.isArray(userIds)) {
      return sendError(res, 'VAL_2001', 'Invalid bulk action parameters')
    }

    let updateQuery = {}
    let logAction = ''
    
    switch (action) {
      case 'activate':
        updateQuery = { isVerified: true }
        logAction = 'bulk_activate_users'
        break
      case 'deactivate':
        updateQuery = { isVerified: false }
        logAction = 'bulk_deactivate_users'
        break
      case 'ban':
        updateQuery = { isVerified: false, deletedAt: new Date() }
        logAction = 'bulk_ban_users'
        break
      case 'delete':
        // Soft delete by deactivating
        updateQuery = { isVerified: false, deletedAt: new Date() }
        logAction = 'bulk_delete_users'
        break
      default:
        return sendError(res, 'VAL_2001', 'Invalid action')
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      updateQuery
    )

    // Log the bulk action
    await req.superAdmin.logSecurityEvent(
      logAction,
      `Bulk ${action} for ${userIds.length} users. Reason: ${reason || 'No reason provided'}`,
      req.ip,
      req.get('User-Agent'),
      true
    )

    return sendSuccess(res, 200, `Successfully ${action}d ${result.modifiedCount} users`, {
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    logger.error('Bulk action error:', error)
    return sendError(res, 'SRV_6001', 'Failed to perform bulk action')
  }
})

// Travel content management
router.get('/travel-content', checkPermission('canManageContent'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, status } = req.query
    const skip = (page - 1) * limit
    
    const Post = require('../models/Post')
    let query = {}
    
    if (search) {
      query.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } }
      ]
    }
    
    // Only filter by type if it's not 'all' and is a valid type
    if (type && type !== 'all') {
      if (type === 'video') {
        // Map 'video' to 'short' since that's what's stored in DB
        query.type = 'short'
      } else {
        query.type = type
      }
    }
    
    if (status) {
      query.isActive = status === 'active'
    }
    
    // Get all posts with active status if not specified
    if (!status) {
      query.isActive = true
    }
    
    const posts = await Post.find(query)
      .populate('user', 'fullName email profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
    
    const total = await Post.countDocuments(query)
    
    return sendSuccess(res, 200, 'Travel content fetched successfully', {
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Travel content fetch error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch travel content')
  }
})

// Delete a post
router.delete('/posts/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const Post = require('../models/Post')
    const post = await Post.findById(req.params.id)
    
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found')
    }
    
    await Post.findByIdAndDelete(req.params.id)
    
    await req.superAdmin.logSecurityEvent(
      'content_deleted',
      `Deleted post: ${post._id}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 200, 'Post deleted successfully')
  } catch (error) {
    logger.error('Delete post error:', error)
    return sendError(res, 'SRV_6001', 'Failed to delete post')
  }
})

// Update a post (activate/deactivate/flag)
router.patch('/posts/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { isActive, flagged } = req.body
    const Post = require('../models/Post')
    
    const updateData = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (flagged !== undefined) updateData.flagged = flagged
    
    const post = await Post.findByIdAndUpdate(req.params.id, updateData, { new: true })
    
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found')
    }
    
    return sendSuccess(res, 200, 'Post updated successfully', { post })
  } catch (error) {
    logger.error('Update post error:', error)
    return sendError(res, 'SRV_6001', 'Failed to update post')
  }
})

// Flag a post
router.patch('/posts/:id/flag', authenticateSuperAdmin, async (req, res) => {
  try {
    const Post = require('../models/Post')
    const post = await Post.findByIdAndUpdate(req.params.id, { flagged: true }, { new: true })
    
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found')
    }
    
    await req.superAdmin.logSecurityEvent(
      'content_flagged',
      `Flagged post: ${post._id}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 200, 'Post flagged successfully', { post })
  } catch (error) {
    logger.error('Flag post error:', error)
    return sendError(res, 'SRV_6001', 'Failed to flag post')
  }
})

// Reports management
router.get('/reports', checkPermission('canManageContent'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, priority } = req.query
    const skip = (page - 1) * limit
    
    const Report = require('../models/Report')
    let query = {}
    
    if (status && status !== 'all') {
      query.status = status
    }
    
    if (type && type !== 'all') {
      query.type = type
    }
    
    if (priority && priority !== 'all') {
      query.priority = priority
    }
    
    const reports = await Report.find(query)
      .populate('reportedBy', 'fullName email profilePic')
      .populate('reportedUser', 'fullName email profilePic')
      .populate('reportedContent', 'caption type imageUrl videoUrl')
      .populate('resolvedBy', 'profile firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
    
    const total = await Report.countDocuments(query)
    
    return sendSuccess(res, 200, 'Reports fetched successfully', {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Reports error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch reports')
  }
})

// Update report status (accept/reject)
router.patch('/reports/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { status, adminNotes } = req.body
    const Report = require('../models/Report')
    
    const updateData = {
      status,
      resolvedBy: req.superAdmin._id,
      resolvedAt: new Date()
    }
    
    if (adminNotes) {
      updateData.adminNotes = adminNotes
    }
    
    const report = await Report.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('reportedBy', 'fullName email')
      .populate('reportedUser', 'fullName email')
      .populate('reportedContent', 'caption type')
    
    if (!report) {
      return sendError(res, 'RES_3001', 'Report not found')
    }
    
    await req.superAdmin.logSecurityEvent(
      'report_processed',
      `Report ${status}: ${report._id}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 200, 'Report updated successfully', { report })
  } catch (error) {
    logger.error('Update report error:', error)
    return sendError(res, 'SRV_6001', 'Failed to update report')
  }
})

// Analytics data with enhanced metrics (Dashboard has basic analytics)
router.get('/analytics', async (req, res) => {
  try {
    const { period = '7d' } = req.query
    const User = require('../models/User')
    const Post = require('../models/Post')
    
    let timeFilter = {}
    switch (period) {
      case '1d':
        timeFilter = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        break
      case '7d':
        timeFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        break
      case '30d':
        timeFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        break
      case '90d':
        timeFilter = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        break
    }

    // Get comprehensive analytics
    const [
      userGrowth,
      contentStats,
      topLocations,
      engagementMetrics,
      deviceStats,
      geographicDistribution
    ] = await Promise.all([
      getUserGrowthData(timeFilter),
      getContentStats(timeFilter),
      getTopLocations(timeFilter),
      getEngagementMetrics(timeFilter),
      getDeviceStats(timeFilter),
      getGeographicDistribution(timeFilter)
    ])
    
    const analytics = {
      period,
      userGrowth,
      contentStats,
      topLocations,
      engagementMetrics,
      deviceStats,
      geographicDistribution,
      generatedAt: new Date().toISOString()
    }
    
    return sendSuccess(res, 200, 'Analytics fetched successfully', { analytics })
  } catch (error) {
    logger.error('Analytics error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch analytics')
  }
})

// Analytics Dashboard Endpoints
router.get('/analytics/summary', getAnalyticsSummary)
router.get('/analytics/timeseries', getTimeSeriesData)
router.get('/analytics/breakdown', getEventBreakdown)
router.get('/analytics/features', getTopFeatures)
router.get('/analytics/dropoffs', getDropOffPoints)
router.get('/analytics/events', getRecentEvents)
router.get('/analytics/retention', getUserRetention)

// Feature flags management
router.get('/feature-flags', async (req, res) => {
  try {
    const FeatureFlag = require('../models/FeatureFlag')
    
    const { category, enabled, search } = req.query
    let query = {}
    
    if (category && category !== 'all') {
      query.category = category
    }
    
    if (enabled !== undefined && enabled !== 'all') {
      query.enabled = enabled === 'true' || enabled === true
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }
    
    const featureFlags = await FeatureFlag.find(query)
      .populate('createdBy', 'email')
      .populate('updatedBy', 'email')
      .sort({ updatedAt: -1 })
    
    return sendSuccess(res, 200, 'Feature flags fetched successfully', {
      featureFlags: featureFlags.map(flag => flag.toObject())
    })
  } catch (error) {
    logger.error('Feature flags error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch feature flags')
  }
})

// Create new feature flag
router.post('/feature-flags', authenticateSuperAdmin, async (req, res) => {
  try {
    const FeatureFlag = require('../models/FeatureFlag')
    const { name, description, enabled, rolloutPercentage, targetUsers, category, priority, impact } = req.body
    
    const featureFlag = new FeatureFlag({
      name,
      description,
      enabled: enabled || false,
      rolloutPercentage: rolloutPercentage || 0,
      targetUsers: targetUsers || 'all',
      category: category || 'other',
      priority: priority || 'medium',
      impact: impact || 'medium',
      createdBy: req.superAdmin._id,
      updatedBy: req.superAdmin._id
    })
    
    await featureFlag.save()
    
    return sendSuccess(res, 201, 'Feature flag created successfully', {
      featureFlag
    })
  } catch (error) {
    logger.error('Create feature flag error:', error)
    return sendError(res, 'SRV_6001', 'Failed to create feature flag')
  }
})

// Update feature flags
router.patch('/feature-flags/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const FeatureFlag = require('../models/FeatureFlag')
    const { id } = req.params
    const { enabled, rolloutPercentage, targetUsers, description, category, priority, impact } = req.body
    
    const featureFlag = await FeatureFlag.findById(id)
    if (!featureFlag) {
      return sendError(res, 'RES_3001', 'Feature flag not found')
    }
    
    const changes = {}
    if (enabled !== undefined) changes.enabled = enabled
    if (rolloutPercentage !== undefined) changes.rolloutPercentage = rolloutPercentage
    if (targetUsers) changes.targetUsers = targetUsers
    if (description) changes.description = description
    if (category) changes.category = category
    if (priority) changes.priority = priority
    if (impact) changes.impact = impact
    
    Object.assign(featureFlag, changes)
    featureFlag.updatedBy = req.superAdmin._id
    
    // Initialize changelog if it doesn't exist
    if (!featureFlag.changelog) {
      featureFlag.changelog = []
    }
    
    // Log the change
    featureFlag.changelog.push({
      action: 'updated',
      changedBy: req.superAdmin._id,
      changes: changes,
      timestamp: new Date()
    })
    
    // Keep only last 50 changes
    if (featureFlag.changelog.length > 50) {
      featureFlag.changelog = featureFlag.changelog.slice(-50)
    }
    
    await featureFlag.save()
    
    // Log security event
    await req.superAdmin.logSecurityEvent(
      'feature_flag_updated',
      `Updated flag ${featureFlag.name}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    const updated = await FeatureFlag.findById(id)
      .populate('createdBy', 'email')
      .populate('updatedBy', 'email')
    
    return sendSuccess(res, 200, 'Feature flag updated successfully', {
      featureFlag: updated ? updated.toObject() : null
    })
  } catch (error) {
    logger.error('Update feature flag error:', error)
    return sendError(res, 'SRV_6001', 'Failed to update feature flag')
  }
})

// Schedule Standalone Downtime
router.post('/schedule-downtime', authenticateSuperAdmin, async (req, res) => {
  try {
    const ScheduledDowntime = require('../models/ScheduledDowntime')
    const User = require('../models/User')
    const { sendDowntimeNotificationEmail } = require('../utils/sendDowntimeEmail')
    
    const { reason, scheduledDate, scheduledTime, duration } = req.body
    
    if (!reason || !scheduledDate || !scheduledTime || !duration) {
      return sendError(res, 'VAL_2001', 'All fields are required')
    }
    
    // Create downtime record
    const downtime = new ScheduledDowntime({
      reason,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration,
      createdBy: req.superAdmin._id
    })
    await downtime.save()
    
    // Send email to all users
    const users = await User.find({}, 'email fullName')
    const emailPromises = users.map(async (user) => {
      try {
        await sendDowntimeNotificationEmail(
          user.email,
          user.fullName || 'User',
          new Date(scheduledDate).toLocaleDateString(),
          scheduledTime,
          duration,
          reason
        )
      } catch (error) {
        logger.error(`Failed to send email to ${user.email}:`, error)
      }
    })
    
    await Promise.all(emailPromises)
    downtime.notificationSent = true
    await downtime.save()
    
    // Log security event
    await req.superAdmin.logSecurityEvent(
      'downtime_scheduled',
      `Scheduled downtime: ${reason}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 201, 'Downtime scheduled and notifications sent to all users', {
      downtime
    })
  } catch (error) {
    logger.error('Schedule downtime error:', error)
    return sendError(res, 'SRV_6001', 'Failed to schedule downtime')
  }
})

// Complete Standalone Downtime
router.post('/complete-downtime/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const ScheduledDowntime = require('../models/ScheduledDowntime')
    const User = require('../models/User')
    const { sendMaintenanceCompletedEmail } = require('../utils/sendDowntimeEmail')
    
    const { id } = req.params
    const downtime = await ScheduledDowntime.findById(id)
    
    if (!downtime) {
      return sendError(res, 'RES_3001', 'Downtime not found')
    }
    
    // Send completion email to all users
    const users = await User.find({}, 'email fullName')
    const emailPromises = users.map(async (user) => {
      try {
        await sendMaintenanceCompletedEmail(user.email, user.fullName || 'User')
      } catch (error) {
        logger.error(`Failed to send email to ${user.email}:`, error)
      }
    })
    
    await Promise.all(emailPromises)
    
    // Mark as completed
    downtime.completed = true
    downtime.completedBy = req.superAdmin._id
    await downtime.save()
    
    // Log security event
    await req.superAdmin.logSecurityEvent(
      'maintenance_completed',
      `Maintenance completed: ${downtime.reason}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 200, 'Maintenance completion notifications sent to all users')
  } catch (error) {
    logger.error('Complete downtime error:', error)
    return sendError(res, 'SRV_6001', 'Failed to complete downtime')
  }
})

// Get scheduled downtimes
router.get('/scheduled-downtimes', authenticateSuperAdmin, async (req, res) => {
  try {
    const ScheduledDowntime = require('../models/ScheduledDowntime')
    
    const downtimes = await ScheduledDowntime.find()
      .populate('createdBy', 'email')
      .populate('completedBy', 'email')
      .sort({ scheduledDate: -1 })
    
    return sendSuccess(res, 200, 'Scheduled downtimes fetched successfully', {
      downtimes
    })
  } catch (error) {
    logger.error('Get scheduled downtimes error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch scheduled downtimes')
  }
})

// Delete feature flag
router.delete('/feature-flags/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const FeatureFlag = require('../models/FeatureFlag')
    const { id } = req.params
    
    const featureFlag = await FeatureFlag.findById(id)
    if (!featureFlag) {
      return sendError(res, 'RES_3001', 'Feature flag not found')
    }
    
    await FeatureFlag.findByIdAndDelete(id)
    
    // Log security event
    await req.superAdmin.logSecurityEvent(
      'feature_flag_deleted',
      `Deleted flag ${featureFlag.name}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 200, 'Feature flag deleted successfully')
  } catch (error) {
    logger.error('Delete feature flag error:', error)
    return sendError(res, 'SRV_6001', 'Failed to delete feature flag')
  }
})

// Global search
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'all', limit = 10 } = req.query
    
    if (!q || q.length < 2) {
      return sendError(res, 'VAL_2001', 'Search query must be at least 2 characters')
    }
    
    const User = require('../models/User')
    const Post = require('../models/Post')
    
    const searchResults = {
      users: [],
      posts: [],
      total: 0
    }
    
    if (type === 'all' || type === 'users') {
      const users = await User.find({
        $or: [
          { fullName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ]
      })
      .select('fullName email createdAt')
      .limit(parseInt(limit))
      
      searchResults.users = users
    }
    
    if (type === 'all' || type === 'posts') {
      const posts = await Post.find({
        $or: [
          { content: { $regex: q, $options: 'i' } },
          { location: { $regex: q, $options: 'i' } }
        ]
      })
      .populate('user', 'fullName')
      .select('content location type createdAt')
      .limit(parseInt(limit))
      .lean()
      
      searchResults.posts = posts
    }
    
    searchResults.total = searchResults.users.length + searchResults.posts.length
    
    return sendSuccess(res, 200, 'Search completed successfully', searchResults)
  } catch (error) {
    logger.error('Search error:', error)
    return sendError(res, 'SRV_6001', 'Failed to perform search')
  }
})

// Audit logs with enhanced filtering and export
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, action, startDate, endDate, export: exportFormat } = req.query
    const skip = (page - 1) * limit
    
    let query = { _id: req.superAdmin._id }
    
    const superAdmin = await SuperAdmin.findById(req.superAdmin._id)
      .select('securityLogs')
      .lean()
    
    if (!superAdmin) {
      return sendError(res, 'RES_3001', 'SuperAdmin not found')
    }
    
    let logs = superAdmin.securityLogs || []
    
    // Apply filters
    if (action) {
      logs = logs.filter(log => log.action?.includes(action))
    }
    
    if (startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate))
    }
    
    if (endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(endDate))
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    // Export functionality
    if (exportFormat === 'csv') {
      const csv = generateCSV(logs)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv')
      return res.send(csv)
    }
    
    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json')
      return res.json(logs)
    }
    
    // Paginate
    const total = logs.length
    const paginatedLogs = logs.slice(skip, skip + parseInt(limit))
    
    return sendSuccess(res, 200, 'Audit logs fetched successfully', {
      logs: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
    
  } catch (error) {
    logger.error('Audit logs error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch audit logs')
  }
})

// Helper functions for analytics
async function getTopPerformingRegions() {
  const Post = require('../models/Post')
  const regions = await Post.aggregate([
    { $match: { 'location.address': { $exists: true, $ne: '' } } },
    { 
      $group: { 
        _id: '$location.address', 
        count: { $sum: 1 }, 
        totalLikes: { $sum: { $size: '$likes' } } 
      } 
    },
    { $sort: { totalLikes: -1 } },
    { $limit: 5 }
  ])
  return regions
}

async function getInactiveUsers() {
  const User = require('../models/User')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const users = await User.find({
    $or: [
      { lastLogin: { $lt: thirtyDaysAgo } },
      { lastLogin: { $exists: false } },
      { updatedAt: { $lt: thirtyDaysAgo } }
    ]
  })
  .select('fullName email lastLogin updatedAt createdAt')
  .limit(10)
  .lean()
  
  // Transform to include lastActive for frontend compatibility
  return users.map(user => ({
    ...user,
    lastActive: user.lastLogin || user.updatedAt
  }))
}

async function getVIPUsers() {
  const User = require('../models/User')
  
  const vipUsers = await User.aggregate([
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'user',
        as: 'posts'
      }
    },
    {
      $addFields: {
        totalPosts: { $size: '$posts' },
        totalLikes: { $sum: { $map: { input: '$posts', as: 'post', in: { $size: '$$post.likes' } } } } 
      }
    },
    {
      $match: {
        $or: [
          { totalPosts: { $gte: 5 } },
          { totalLikes: { $gte: 50 } }
        ]
      }
    },
    {
      $project: {
        fullName: 1,
        email: 1,
        totalPosts: 1,
        totalLikes: 1,
        createdAt: 1
      }
    },
    { $sort: { totalLikes: -1 } },
    { $limit: 10 }
  ])
  
  return vipUsers
}

async function getAIRecommendations() {
  return [
    {
      type: 'engagement',
      title: 'Boost User Engagement',
      description: 'Consider implementing gamification features to increase user activity',
      priority: 'high',
      impact: 'medium'
    },
    {
      type: 'retention',
      title: 'Improve User Retention',
      description: 'Send personalized travel recommendations to inactive users',
      priority: 'medium',
      impact: 'high'
    },
    {
      type: 'content',
      title: 'Content Strategy',
      description: 'Focus on Paris and Tokyo content as they show highest engagement',
      priority: 'low',
      impact: 'medium'
    }
  ]
}

async function getUserGrowthData(timeFilter) {
  const User = require('../models/User')
  const data = await User.aggregate([
    { $match: { createdAt: timeFilter } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ])
  return data.map(item => ({ date: item._id, count: item.count }))
}

async function getContentStats(timeFilter) {
  const Post = require('../models/Post')
  const stats = await Post.aggregate([
    { $match: { createdAt: timeFilter } },
    {
      $group: {
        _id: null,
        totalPosts: { $sum: 1 },
        totalLikes: { $sum: { $size: '$likes' } },
        totalComments: { $sum: { $size: '$comments' } }
      }
    }
  ])
  return stats[0] || { totalPosts: 0, totalLikes: 0, totalComments: 0, totalShares: 0 }
}

async function getTopLocations(timeFilter) {
  const Post = require('../models/Post')
  const locations = await Post.aggregate([
    { $match: { createdAt: timeFilter, 'location.address': { $exists: true, $ne: '' } } },
    { $group: { _id: '$location.address', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ])
  return locations.map(item => ({ name: item._id || 'Unknown Location', posts: item.count }))
}

async function getEngagementMetrics(timeFilter) {
  const Post = require('../models/Post')
  const metrics = await Post.aggregate([
    { $match: { createdAt: timeFilter } },
    {
      $group: {
        _id: null,
        avgLikes: { $avg: { $size: '$likes' } },
        avgComments: { $avg: { $size: '$comments' } }
      }
    }
  ])
  return metrics[0] || { avgLikes: 0, avgComments: 0, avgShares: 0 }
}

async function getDeviceStats(timeFilter) {
  // Mock device stats - replace with real device tracking
  return {
    mobile: 65,
    desktop: 30,
    tablet: 5
  }
}

async function getGeographicDistribution(timeFilter) {
  // Mock geographic distribution - replace with real location data
  return [
    { country: 'United States', users: 45, percentage: 35 },
    { country: 'United Kingdom', users: 25, percentage: 20 },
    { country: 'Canada', users: 20, percentage: 15 },
    { country: 'Australia', users: 15, percentage: 12 },
    { country: 'Germany', users: 10, percentage: 8 },
    { country: 'Others', users: 15, percentage: 10 }
  ]
}

function generateCSV(logs) {
  const headers = ['Timestamp', 'Action', 'Details', 'IP Address', 'User Agent', 'Success']
  const rows = logs.map(log => [
    log.timestamp,
    log.action,
    log.details,
    log.ipAddress,
    log.userAgent,
    log.success
  ])
  
  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

// Moderators Management

// GET /moderators - Get all moderators (admin and moderator roles)
router.get('/moderators', checkPermission('canManageModerators'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const skip = (page - 1) * limit
    
    // Build query
    const query = {
      role: { $in: ['moderator', 'admin'] }
    }
    
    // Add search functionality
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ]
    }
    
    const [moderators, total] = await Promise.all([
      SuperAdmin.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('email role isActive profile lastLogin permissions createdAt'),
      SuperAdmin.countDocuments(query)
    ])
    
    return sendSuccess(res, 200, 'Moderators fetched successfully', {
      moderators,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    logger.error('Get moderators error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch moderators')
  }
})

// POST /moderators - Create a new moderator
router.post('/moderators', checkPermission('canManageModerators'), async (req, res) => {
  try {
    const { email, password, role = 'moderator', permissions } = req.body
    
    // Check if email already exists
    const existing = await SuperAdmin.findOne({ email: email.toLowerCase() })
    if (existing) {
      return sendError(res, 'VAL_2001', 'Email already exists')
    }
    
    // Create moderator
    const moderator = new SuperAdmin({
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      role,
      permissions: permissions || {
        canManageUsers: false,
        canManageContent: true,
        canManageReports: false,
        canManageModerators: false,
        canViewLogs: false,
        canManageSettings: false
      }
    })
    
    await moderator.save()
    
    return sendSuccess(res, 201, 'Moderator created successfully', {
      moderator: {
        _id: moderator._id,
        email: moderator.email,
        role: moderator.role,
        isActive: moderator.isActive,
        permissions: moderator.permissions
      }
    })
  } catch (error) {
    logger.error('Create moderator error:', error)
    return sendError(res, 'SRV_6001', 'Failed to create moderator')
  }
})

// PATCH /moderators/:id - Update moderator
router.patch('/moderators/:id', checkPermission('canManageModerators'), async (req, res) => {
  try {
    const { role, isActive, permissions } = req.body
    
    const moderator = await SuperAdmin.findById(req.params.id)
    if (!moderator) {
      return sendError(res, 'RES_3001', 'Moderator not found')
    }
    
    // Update fields
    if (role) moderator.role = role
    if (typeof isActive === 'boolean') moderator.isActive = isActive
    if (permissions) moderator.permissions = { ...moderator.permissions, ...permissions }
    
    await moderator.save()
    
    return sendSuccess(res, 200, 'Moderator updated successfully', { moderator })
  } catch (error) {
    logger.error('Update moderator error:', error)
    return sendError(res, 'SRV_6001', 'Failed to update moderator')
  }
})

// DELETE /moderators/:id - Remove moderator (deactivate)
router.delete('/moderators/:id', checkPermission('canManageModerators'), async (req, res) => {
  try {
    const moderator = await SuperAdmin.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )
    
    if (!moderator) {
      return sendError(res, 'RES_3001', 'Moderator not found')
    }
    
    return sendSuccess(res, 200, 'Moderator removed successfully')
  } catch (error) {
    logger.error('Delete moderator error:', error)
    return sendError(res, 'SRV_6001', 'Failed to remove moderator')
  }
})

// Test endpoint without authentication
router.get('/test', async (req, res) => {
  try {
    const User = require('../models/User')
    const Post = require('../models/Post')
    const Report = require('../models/Report')
    
    const [userCount, postCount, reportCount] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
      Report.countDocuments()
    ])
    
    return sendSuccess(res, 200, 'Backend is working correctly', {
      users: userCount,
      posts: postCount,
      reports: reportCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Test endpoint error:', error)
    return sendError(res, 'SRV_6001', 'Backend error')
  }
})

// GET /security-logs - Get security logs (alias for /audit-logs)
router.get('/security-logs', async (req, res) => {
  // Use the same handler as audit-logs
  try {
    const { page = 1, limit = 50, action, startDate, endDate, export: exportFormat } = req.query
    const skip = (page - 1) * limit
    
    const superAdmin = await SuperAdmin.findById(req.superAdmin._id)
      .select('securityLogs')
      .lean()
    
    if (!superAdmin) {
      return sendError(res, 'RES_3001', 'SuperAdmin not found')
    }
    
    let logs = superAdmin.securityLogs || []
    
    // Apply filters
    if (action) {
      logs = logs.filter(log => log.action?.includes(action))
    }
    
    if (startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate))
    }
    
    if (endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(endDate))
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    // Export functionality
    if (exportFormat === 'csv') {
      const csv = generateCSV(logs)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=security-logs.csv')
      return res.send(csv)
    }
    
    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename=security-logs.json')
      return res.json(logs)
    }
    
    // Paginate
    const total = logs.length
    const paginatedLogs = logs.slice(skip, skip + parseInt(limit))
    
    return sendSuccess(res, 200, 'Security logs fetched successfully', {
      logs: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Get security logs error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch security logs')
  }
})

// GET /logs - Get security logs (alias for /audit-logs)
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, level, type } = req.query
    const skip = (page - 1) * limit
    
    const SuperAdmin = require('../models/SuperAdmin')
    const User = require('../models/User')
    
    // Get all super admins to aggregate their logs
    const superAdmins = await SuperAdmin.find({}, 'securityLogs email')
    
    // Flatten and format logs
    let allLogs = []
    const crypto = require('crypto')
    superAdmins.forEach((admin, adminIndex) => {
      if (admin.securityLogs && admin.securityLogs.length > 0) {
        admin.securityLogs.forEach((log, logIndex) => {
          // Generate a unique ID using hash to avoid duplicates
          const logObj = log.toObject ? log.toObject() : log
          const hashInput = `${admin._id}_${logObj.timestamp || Date.now()}_${logObj.action || ''}_${logObj.details || ''}_${logIndex}_${adminIndex}`
          const hash = crypto.createHash('md5').update(hashInput).digest('hex')
          allLogs.push({
            ...logObj,
            adminEmail: admin.email,
            _id: `log_${hash}_${adminIndex}_${logIndex}`
          })
        })
      }
    })
    
    // Sort by timestamp descending (newest first)
    allLogs.sort((a, b) => {
      const aTime = a.timestamp || a.createdAt || 0
      const bTime = b.timestamp || b.createdAt || 0
      return new Date(bTime) - new Date(aTime)
    })
    
    // Apply filters
    let filtered = allLogs
    
    if (search) {
      filtered = filtered.filter(log => 
        log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.details?.toLowerCase().includes(search.toLowerCase()) ||
        log.ipAddress?.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    // Apply level filter (if needed, based on action type)
    if (level && level !== 'all') {
      // Map actions to levels for better filtering
      filtered = filtered.filter(log => {
        if (level === 'error') {
          return log.action?.includes('fail') || log.action?.includes('error') || !log.success
        } else if (level === 'warning') {
          return log.action?.includes('attempt') || log.action?.includes('lockout')
        } else if (level === 'success') {
          return log.success === true
        }
        return true
      })
    }
    
    // Apply type filter
    if (type && type !== 'all') {
      filtered = filtered.filter(log => {
        const actionStr = log.action?.toLowerCase() || ''
        if (type === 'security') {
          return actionStr.includes('login') || actionStr.includes('auth') || actionStr.includes('security')
        } else if (type === 'system') {
          return actionStr.includes('system') || actionStr.includes('api')
        } else if (type === 'user_action') {
          return actionStr.includes('user') || actionStr.includes('action')
        }
        return true
      })
    }
    
    const total = filtered.length
    const paginatedLogs = filtered.slice(skip, skip + parseInt(limit))
    
    // Enrich with user information if available
    const enrichedLogs = await Promise.all(paginatedLogs.map(async (log, index) => {
      // Use the already generated unique _id from the flattening step
      // If for some reason it's missing, generate a new one using crypto
      let uniqueId = log._id
      if (!uniqueId) {
        const crypto = require('crypto')
        const hashInput = `${log.timestamp}_${log.action || 'unknown'}_${log.adminEmail || 'unknown'}_${index}_${skip}`
        const hash = crypto.createHash('md5').update(hashInput).digest('hex')
        uniqueId = `log_${hash}_${index}_${skip}`
      }
      
      let enrichedLog = {
        ...log,
        _id: uniqueId, // Always use unique ID for React keys
        level: !log.success ? 'error' : (log.action?.includes('attempt') ? 'warning' : 'info'),
        type: log.action?.includes('login') || log.action?.includes('auth') ? 'security' : 
               log.action?.includes('system') ? 'system' : 'user_action',
        message: log.details || log.action,
        userId: log.adminEmail,
        timestamp: log.timestamp
      }
      return enrichedLog
    }))
    
    return sendSuccess(res, 200, 'Logs fetched successfully', {
      logs: enrichedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    logger.error('Logs fetch error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch logs')
  }
})

// System Settings Routes (Protected - requires canManageSettings permission)
router.get('/settings', checkPermission('canManageSettings'), async (req, res) => {
  try {
    const settings = await SystemSettings.getInstance()
    return sendSuccess(res, 200, 'Settings fetched successfully', {
      settings
    })
  } catch (error) {
    logger.error('Fetch settings error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch settings')
  }
})

router.put('/settings', checkPermission('canManageSettings'), async (req, res) => {
  try {
    const settings = await SystemSettings.getInstance()
    const updates = req.body
    
    // Update settings
    if (updates.security) Object.assign(settings.security, updates.security)
    if (updates.features) Object.assign(settings.features, updates.features)
    if (updates.system) Object.assign(settings.system, updates.system)
    if (updates.api) Object.assign(settings.api, updates.api)
    if (updates.email) Object.assign(settings.email, updates.email)
    if (updates.privacy) Object.assign(settings.privacy, updates.privacy)
    
    settings.lastModifiedBy = req.superAdmin._id
    settings.lastModifiedAt = new Date()
    
    await settings.save()
    
    return sendSuccess(res, 200, 'Settings updated successfully', {
      settings
    })
  } catch (error) {
    logger.error('Update settings error:', error)
    return sendError(res, 'SRV_6001', 'Failed to update settings')
  }
})

router.post('/settings/reset', checkPermission('canManageSettings'), async (req, res) => {
  try {
    const settings = await SystemSettings.findOne()
    
    if (settings) {
      // Reset to defaults
      await SystemSettings.deleteOne({ _id: settings._id })
    }
    
    const newSettings = await SystemSettings.getInstance()
    
    return sendSuccess(res, 200, 'Settings reset to defaults', {
      settings: newSettings
    })
  } catch (error) {
    logger.error('Reset settings error:', error)
    return sendError(res, 'SRV_6001', 'Failed to reset settings')
  }
})

// Query monitoring stats endpoint
const { getQueryStats, resetQueryStats } = require('../middleware/queryMonitor');
router.get('/query-stats', authenticateSuperAdmin, (req, res) => {
  try {
    const stats = getQueryStats();
    return sendSuccess(res, 200, 'Query statistics fetched successfully', { stats });
  } catch (error) {
    logger.error('Get query stats error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch query statistics');
  }
});

router.post('/query-stats/reset', authenticateSuperAdmin, (req, res) => {
  try {
    resetQueryStats();
    return sendSuccess(res, 200, 'Query statistics reset successfully');
  } catch (error) {
    logger.error('Reset query stats error:', error);
    return sendError(res, 'SRV_6001', 'Failed to reset query statistics');
  }
});

module.exports = router
