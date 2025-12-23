const express = require('express')
const router = express.Router()
const SuperAdmin = require('../models/SuperAdmin')
const SystemSettings = require('../models/SystemSettings')
const logger = require('../utils/logger')
const { sendError, sendSuccess } = require('../utils/errorCodes')
const { generateCSRF } = require('../middleware/csrfProtection')
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
const {
  getTripScoreStats,
  getTopUsersByTripScore,
  getSuspiciousVisits,
  getTrustTimeline,
  getContinentBreakdown,
  getDetailedLocations
} = require('../controllers/tripScoreAnalyticsController')
const {
  getPendingReviews,
  approveTripVisit,
  rejectTripVisit,
  updateTripVisit
} = require('../controllers/adminTripVerificationController')
const {
  listSupportConversations,
  getSupportConversation,
  sendSupportMessage,
  createSupportConversation
} = require('../controllers/adminSupportChatController')

// Alias for clarity
const authenticateSuperAdmin = verifySuperAdminToken

// Public routes (no authentication required)

/**
 * @swagger
 * /api/v1/superadmin/csrf-token:
 *   get:
 *     summary: Get CSRF token for SuperAdmin requests
 *     tags: [SuperAdmin]
 *     responses:
 *       200:
 *         description: CSRF token generated and returned
 *         headers:
 *           X-CSRF-Token:
 *             description: CSRF token in response header
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 csrfToken:
 *                   type: string
 */
router.get('/csrf-token', generateCSRF, (req, res) => {
  try {
    // Get token from response header (set by generateCSRF middleware)
    const token = res.getHeader('X-CSRF-Token') || req.cookies['csrf-token']
    
    if (token) {
      return sendSuccess(res, 200, 'CSRF token generated successfully', {
        csrfToken: token
      })
    } else {
      return sendError(res, 'SRV_6001', 'Failed to generate CSRF token')
    }
  } catch (error) {
    logger.error('CSRF token generation error:', error)
    return sendError(res, 'SRV_6001', 'Failed to generate CSRF token')
  }
})

/**
 * @swagger
 * /api/v1/superadmin/login:
 *   post:
 *     summary: SuperAdmin login
 *     tags: [SuperAdmin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Step 1 login success (requires 2FA)
 */
router.post('/login', loginSuperAdmin)
/**
 * @swagger
 * /api/v1/superadmin/create:
 *   post:
 *     summary: Bootstrap a SuperAdmin account
 *     tags: [SuperAdmin]
 *     description: Intended for initial setup only.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               inviteCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: SuperAdmin created
 */
router.post('/create', createSuperAdmin) // For initial setup only
/**
 * @swagger
 * /api/v1/superadmin/verify-2fa:
 *   post:
 *     summary: Verify SuperAdmin 2FA token
 *     tags: [SuperAdmin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA verified, JWT issued
 */
router.post('/verify-2fa', verify2FA)
/**
 * @swagger
 * /api/v1/superadmin/resend-2fa:
 *   post:
 *     summary: Resend SuperAdmin 2FA code
 *     tags: [SuperAdmin]
 *     responses:
 *       200:
 *         description: Code sent
 */
router.post('/resend-2fa', resend2FA)


// Protected routes (require authentication)
router.use(verifySuperAdminToken)

// Authentication routes
/**
 * @swagger
 * /api/v1/superadmin/verify:
 *   get:
 *     summary: Validate SuperAdmin token
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valid + user payload
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
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
/**
 * @swagger
 * /api/v1/superadmin/logout:
 *   post:
 *     summary: Revoke SuperAdmin session
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', logout)
/**
 * @swagger
 * /api/v1/superadmin/change-password:
 *   patch:
 *     summary: Change SuperAdmin password
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password updated
 */
router.patch('/change-password', changePassword)
/**
 * @swagger
 * /api/v1/superadmin/profile:
 *   patch:
 *     summary: Update SuperAdmin profile details
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch('/profile', updateProfile)

// Notifications endpoint
/**
 * @swagger
 * /api/v1/superadmin/notifications:
 *   get:
 *     summary: Get latest SuperAdmin notifications (reports, new users, alerts)
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Notifications feed
 */
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
/**
 * @swagger
 * /api/v1/superadmin/dashboard/overview:
 *   get:
 *     summary: Get dashboard overview metrics
 *     tags: [SuperAdmin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview metrics and AI insights
 */
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
/**
 * @swagger
 * /api/v1/superadmin/analytics/realtime:
 *   get:
 *     summary: Get real-time analytics for dashboard charts
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *     responses:
 *       200:
 *         description: Real-time analytics payload
 */
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
/**
 * @swagger
 * /api/v1/superadmin/users:
 *   get:
 *     summary: List users with advanced filters/sorting
 *     tags: [SuperAdmin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, inactive, pending, banned]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Paginated user dataset with metrics
 */
router.get('/users', checkPermission('canManageUsers'), async (req, res) => {
  try {
    
    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query
    const skip = (page - 1) * limit
    
    const User = require('../models/User')
    const Post = require('../models/Post')
    
    let query = {}
    
    // By default, exclude deleted users unless status is 'banned' or 'all'
    if (!status || status === 'undefined' || status === 'all') {
      // When status is 'all' or not specified, exclude deleted users
      query.deletedAt = { $exists: false }
    }
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
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
      .select('fullName email bio profilePic isVerified deletedAt createdAt updatedAt username')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
    
    const total = await User.countDocuments(query)
    
    // Add additional user metrics including TripScore and report counts
    const Report = require('../models/Report')
    const TripVisit = require('../models/TripVisit')
    const { TRUSTED_TRUST_LEVELS } = require('../config/tripScoreConfig')
    
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
        
        // Calculate TripScore (unique trusted places)
        const trustedVisits = await TripVisit.find({
          user: user._id,
          trustLevel: { $in: TRUSTED_TRUST_LEVELS },
          isActive: true
        }).lean()
        
        // Get unique places (deduplicated by rounded coordinates)
        const uniquePlaces = new Set()
        trustedVisits.forEach(visit => {
          if (visit.latitude && visit.longitude) {
            const key = `${Math.round(visit.latitude * 100) / 100}_${Math.round(visit.longitude * 100) / 100}`
            uniquePlaces.add(key)
          }
        })
        const tripScore = uniquePlaces.size
        
        // Get report counts (reports against this user's content)
        const reportCount = await Report.countDocuments({
          reportedUser: user._id,
          status: { $in: ['pending', 'under_review'] }
        })
        
        // Get high-priority reports (critical priority or multiple reports)
        const highPriorityReports = await Report.countDocuments({
          reportedUser: user._id,
          priority: 'critical',
          status: { $in: ['pending', 'under_review'] }
        })
        
        // Determine risk level
        let riskLevel = 'low'
        if (tripScore === 0 && reportCount > 0) {
          riskLevel = 'medium'
        } else if (reportCount >= 5 || highPriorityReports > 0) {
          riskLevel = 'high'
        } else if (tripScore === 0 && userPosts > 10) {
          riskLevel = 'medium' // User has posts but no TripScore (suspicious)
        }
        
        return {
          ...user.toObject(),
          metrics: {
            totalPosts: userPosts,
            totalLikes: userLikesResult[0]?.totalLikes || 0,
            totalFollowers: followersCount?.followers?.length || 0,
            lastActive: user.lastLogin || user.updatedAt || user.createdAt,
            tripScore,
            reportCount,
            riskLevel
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
            lastActive: user.lastLogin || user.updatedAt || user.createdAt,
            tripScore: 0,
            reportCount: 0,
            riskLevel: 'low'
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
/**
 * @swagger
 * /api/v1/superadmin/users/{id}:
 *   patch:
 *     summary: Update a user's status or profile
 *     tags: [SuperAdmin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: User updated successfully
 */
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
/**
 * @swagger
 * /api/v1/superadmin/users/{id}:
 *   delete:
 *     summary: Delete or ban a user
 *     tags: [SuperAdmin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User removed
 */
router.delete('/users/:id', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { id } = req.params
    const User = require('../models/User')
    const { cascadeDeleteUser } = require('../utils/cascadeDelete')
    
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
    
    // Cascade delete all user-related data
    await cascadeDeleteUser(id)
    
    // Soft delete by marking as inactive
    await User.findByIdAndUpdate(id, { isActive: false, deletedAt: new Date() })
    
    return sendSuccess(res, 200, 'User deleted successfully')
  } catch (error) {
    logger.error('User deletion error:', error)
    return sendError(res, 'SRV_6001', 'Failed to delete user')
  }
})

// Bulk actions for users
/**
 * @swagger
 * /api/v1/superadmin/users/bulk-action:
 *   post:
 *     summary: Execute a bulk action across selected users
 *     tags: [SuperAdmin Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - userIds
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [ban, unban, verify, delete, restore]
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk action completed
 */
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
/**
 * @swagger
 * /api/v1/superadmin/travel-content:
 *   get:
 *     summary: List travel posts/shorts for moderation
 *     tags: [SuperAdmin Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [photo, short, video, all]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Paginated content list
 */
router.get('/travel-content', checkPermission('canManageContent'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, status } = req.query
    
    // Defensive guards: Validate and cap limit
    const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100) // Max 100 per page
    const validatedPage = Math.max(parseInt(page) || 1, 1)
    const skip = (validatedPage - 1) * validatedLimit
    
    const Post = require('../models/Post')
    const Report = require('../models/Report')
    let query = {}
    
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchTerm = search.trim().substring(0, 100) // Cap search length
      query.$or = [
        { caption: { $regex: searchTerm, $options: 'i' } },
        { 'location.address': { $regex: searchTerm, $options: 'i' } }
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
      .limit(validatedLimit)
      .lean()
    
    // Get report counts for each post (using existing Report model)
    const postIds = posts.map(p => p._id)
    const reportCounts = await Report.aggregate([
      {
        $match: {
          reportedContent: { $in: postIds },
          status: { $in: ['pending', 'under_review'] } // Only count active reports
        }
      },
      {
        $group: {
          _id: '$reportedContent',
          count: { $sum: 1 }
        }
      }
    ])
    
    // Create a map of postId -> reportCount
    const reportCountMap = {}
    reportCounts.forEach(item => {
      reportCountMap[item._id.toString()] = item.count
    })
    
    // Enhance posts with report counts and health indicators
    const enhancedPosts = posts.map(post => {
      const reportCount = reportCountMap[post._id.toString()] || 0
      const isFlagged = post.flagged === true
      
      // Determine health status
      let healthStatus = 'normal'
      if (reportCount >= 5) {
        healthStatus = 'high_reports'
      } else if (isFlagged || reportCount > 0) {
        healthStatus = 'flagged'
      }
      
      return {
        ...post,
        reportCount,
        healthStatus,
        flagged: isFlagged,
        // Review state: pending if flagged or has reports, reviewed if not flagged and no reports, disabled if !isActive
        reviewState: !post.isActive ? 'disabled' : (isFlagged || reportCount > 0 ? 'pending' : 'reviewed'),
        // Use updatedAt as last moderation timestamp (when isActive or flagged changes)
        lastModeratedAt: post.updatedAt
      }
    })
    
    const total = await Post.countDocuments(query)
    
    return sendSuccess(res, 200, 'Travel content fetched successfully', {
      posts: enhancedPosts,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total,
        pages: Math.ceil(total / validatedLimit)
      }
    })
  } catch (error) {
    logger.error('Travel content fetch error:', error)
    return sendError(res, 'SRV_6001', 'Failed to fetch travel content')
  }
})

// Delete a post
/**
 * @swagger
 * /api/v1/superadmin/posts/{id}:
 *   delete:
 *     summary: Permanently delete a post
 *     tags: [SuperAdmin Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post deleted
 */
router.delete('/posts/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const Post = require('../models/Post')
    const { cascadeDeletePost } = require('../utils/cascadeDelete')
    const post = await Post.findById(req.params.id)
    
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found')
    }
    
    // Cascade delete all related data FIRST (before deleting the post)
    await cascadeDeletePost(post._id, post)
    
    // Hard delete - completely remove the post from database
    await Post.findByIdAndDelete(req.params.id)
    logger.info(`Hard deleted post ${post._id} from database by admin ${req.superAdmin._id}`)
    
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
/**
 * @swagger
 * /api/v1/superadmin/posts/{id}:
 *   patch:
 *     summary: Update post moderation attributes
 *     tags: [SuperAdmin Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *               flagged:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Post updated
 */
router.patch('/posts/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { isActive, flagged } = req.body
    const Post = require('../models/Post')
    
    // Defensive guards: Validate post exists
    const post = await Post.findById(req.params.id)
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found')
    }
    
    const updateData = {}
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return sendError(res, 'VAL_2001', 'isActive must be a boolean')
      }
      updateData.isActive = isActive
    }
    if (flagged !== undefined) {
      if (typeof flagged !== 'boolean') {
        return sendError(res, 'VAL_2001', 'flagged must be a boolean')
      }
      updateData.flagged = flagged
    }
    
    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return sendSuccess(res, 200, 'No changes to update', { post })
    }
    
    const updatedPost = await Post.findByIdAndUpdate(req.params.id, updateData, { new: true })
    
    // Log moderation event
    await req.superAdmin.logSecurityEvent(
      'content_updated',
      `Updated post: ${req.params.id} - ${JSON.stringify(updateData)}`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    return sendSuccess(res, 200, 'Post updated successfully', { post: updatedPost })
  } catch (error) {
    logger.error('Update post error:', error)
    return sendError(res, 'SRV_6001', 'Failed to update post')
  }
})

// Flag a post
/**
 * @swagger
 * /api/v1/superadmin/posts/{id}/flag:
 *   patch:
 *     summary: Flag a post for review
 *     tags: [SuperAdmin Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post flagged
 */
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
/**
 * @swagger
 * /api/v1/superadmin/reports:
 *   get:
 *     summary: Fetch content reports for moderation
 *     tags: [SuperAdmin Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated reports list
 */
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
/**
 * @swagger
 * /api/v1/superadmin/reports/{id}:
 *   patch:
 *     summary: Update report status, priority, or notes
 *     tags: [SuperAdmin Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               priority:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report updated
 */
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
/**
 * @swagger
 * /api/v1/superadmin/analytics:
 *   get:
 *     summary: Fetch advanced analytics dataset
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 30d, 90d]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Analytics payload
 * /api/v1/superadmin/analytics/summary:
 *   get:
 *     summary: Key KPI summary metrics
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 * /api/v1/superadmin/analytics/timeseries:
 *   get:
 *     summary: Time series data for charts
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 * /api/v1/superadmin/analytics/breakdown:
 *   get:
 *     summary: Event breakdown analytics
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 * /api/v1/superadmin/analytics/features:
 *   get:
 *     summary: Feature usage analytics
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 * /api/v1/superadmin/analytics/dropoffs:
 *   get:
 *     summary: Funnel drop-off analytics
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 * /api/v1/superadmin/analytics/events:
 *   get:
 *     summary: Recent analytics events
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 * /api/v1/superadmin/analytics/retention:
 *   get:
 *     summary: Retention cohort analytics
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 */
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

// TripScore Analytics endpoints
/**
 * @swagger
 * /api/v1/superadmin/tripscore/stats:
 *   get:
 *     summary: Get TripScore overall statistics
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: TripScore statistics
 */
router.get('/tripscore/stats', checkPermission('canViewAnalytics'), getTripScoreStats)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/top-users:
 *   get:
 *     summary: Get top users by TripScore
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Top users by TripScore
 */
router.get('/tripscore/top-users', checkPermission('canViewAnalytics'), getTopUsersByTripScore)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/suspicious-visits:
 *   get:
 *     summary: Get suspicious visits
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Suspicious visits list
 */
router.get('/tripscore/suspicious-visits', checkPermission('canViewAnalytics'), getSuspiciousVisits)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/trust-timeline:
 *   get:
 *     summary: Get trust level breakdown over time
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Trust timeline data
 */
router.get('/tripscore/trust-timeline', checkPermission('canViewAnalytics'), getTrustTimeline)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/continents:
 *   get:
 *     summary: Get continent breakdown
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Continent breakdown
 */
router.get('/tripscore/continents', checkPermission('canViewAnalytics'), getContinentBreakdown)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/locations:
 *   get:
 *     summary: Get detailed locations breakdown
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [location, user, country, state]
 *           default: location
 *         description: Group by location, user, country, or state
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of results per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Detailed locations fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/tripscore/locations', checkPermission('canViewAnalytics'), getDetailedLocations)

// TripScore Verification endpoints
/**
 * @swagger
 * /api/v1/superadmin/tripscore/review/pending:
 *   get:
 *     summary: Get pending TripScore reviews
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Pending reviews fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/tripscore/review/pending', checkPermission('canViewAnalytics'), getPendingReviews)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/review/{tripVisitId}/approve:
 *   post:
 *     summary: Approve a TripVisit
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripVisitId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: TripVisit approved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/tripscore/review/:tripVisitId/approve', checkPermission('canViewAnalytics'), approveTripVisit)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/review/{tripVisitId}/reject:
 *   post:
 *     summary: Reject a TripVisit
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripVisitId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: TripVisit rejected successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/tripscore/review/:tripVisitId/reject', checkPermission('canViewAnalytics'), rejectTripVisit)

// Admin Support Chat endpoints
/**
 * @swagger
 * /api/v1/superadmin/conversations:
 *   get:
 *     summary: List all support conversations
 *     tags: [Admin Support Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Support conversations list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversations:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 */
router.get('/conversations', checkPermission('canViewAnalytics'), listSupportConversations)

/**
 * @swagger
 * /api/v1/superadmin/conversations/{conversationId}:
 *   get:
 *     summary: Get a specific support conversation
 *     tags: [Admin Support Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Support conversation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversation:
 *                       type: object
 */
router.get('/conversations/:conversationId', checkPermission('canViewAnalytics'), getSupportConversation)

/**
 * @swagger
 * /api/v1/superadmin/conversations/{conversationId}/messages:
 *   post:
 *     summary: Send a message in a support conversation
 *     tags: [Admin Support Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Message text content
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: object
 */
router.post('/conversations/:conversationId/messages', checkPermission('canViewAnalytics'), sendSupportMessage)

/**
 * @swagger
 * /api/v1/superadmin/conversations:
 *   post:
 *     summary: Create a new support conversation for a user
 *     tags: [Admin Support Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to start conversation with
 *               reason:
 *                 type: string
 *                 enum: [trip_verification, support]
 *                 default: support
 *               refId:
 *                 type: string
 *                 description: Optional reference ID (e.g., TripVisit ID)
 *               initialMessage:
 *                 type: string
 *                 description: Optional initial message to send
 *     responses:
 *       200:
 *         description: Support conversation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversation:
 *                       type: object
 */
router.post('/conversations', checkPermission('canViewAnalytics'), createSupportConversation)

/**
 * @swagger
 * /api/v1/superadmin/tripscore/review/{tripVisitId}:
 *   patch:
 *     summary: Update TripVisit details
 *     tags: [SuperAdmin TripScore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripVisitId
 *         required: true
 *         schema:
 *           type: string
 *         description: TripVisit ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               country:
 *                 type: string
 *               continent:
 *                 type: string
 *                 enum: [ASIA, AFRICA, NORTH AMERICA, SOUTH AMERICA, AUSTRALIA, EUROPE, ANTARCTICA, Unknown]
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               verificationReason:
 *                 type: string
 *                 enum: [no_exif, manual_location, suspicious_pattern, photo_requires_review, gallery_exif_requires_review, photo_from_camera_requires_review, requires_admin_review]
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *     responses:
 *       200:
 *         description: TripVisit updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: TripVisit not found
 */
router.patch('/tripscore/review/:tripVisitId', checkPermission('canViewAnalytics'), updateTripVisit)

// Feature flags management
/**
 * @swagger
 * /api/v1/superadmin/feature-flags:
 *   get:
 *     summary: List feature flags
 *     tags: [SuperAdmin Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feature flag list
 */
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
/**
 * @swagger
 * /api/v1/superadmin/feature-flags:
 *   post:
 *     summary: Create a feature flag
 *     tags: [SuperAdmin Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               description:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               rolloutPercentage:
 *                 type: number
 *               targetUsers:
 *                 type: string
 *               category:
 *                 type: string
 *               priority:
 *                 type: string
 *               impact:
 *                 type: string
 *     responses:
 *       201:
 *         description: Feature flag created
 */
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
/**
 * @swagger
 * /api/v1/superadmin/feature-flags/{id}:
 *   patch:
 *     summary: Update a feature flag
 *     tags: [SuperAdmin Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Feature flag updated
 */
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
/**
 * @swagger
 * /api/v1/superadmin/schedule-downtime:
 *   post:
 *     summary: Schedule planned downtime
 *     tags: [SuperAdmin Maintenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startTime
 *               - endTime
 *               - reason
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               reason:
 *                 type: string
 *               notifyUsers:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Downtime scheduled
 */
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
/**
 * @swagger
 * /api/v1/superadmin/complete-downtime/{id}:
 *   post:
 *     summary: Mark a scheduled downtime as completed
 *     tags: [SuperAdmin Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Downtime marked complete
 */
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
/**
 * @swagger
 * /api/v1/superadmin/scheduled-downtimes:
 *   get:
 *     summary: List scheduled downtimes
 *     tags: [SuperAdmin Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Downtime schedule list
 */
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
/**
 * @swagger
 * /api/v1/superadmin/feature-flags/{id}:
 *   delete:
 *     summary: Delete a feature flag
 *     tags: [SuperAdmin Feature Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feature flag removed
 */
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
/**
 * @swagger
 * /api/v1/superadmin/search:
 *   get:
 *     summary: Global admin search across users, posts, reports
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [users, posts, reports, all]
 *     responses:
 *       200:
 *         description: Search results grouped by type
 */
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
/**
 * @swagger
 * /api/v1/superadmin/audit-logs:
 *   get:
 *     summary: Export/view SuperAdmin audit logs
 *     tags: [SuperAdmin Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Audit log stream
 */
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
/**
 * @swagger
 * /api/v1/superadmin/moderators:
 *   get:
 *     summary: List moderators/admin accounts
 *     tags: [SuperAdmin Moderators]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moderators list
 */
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
/**
 * @swagger
 * /api/v1/superadmin/moderators:
 *   post:
 *     summary: Invite or create a moderator account
 *     tags: [SuperAdmin Moderators]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Moderator created
 */
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
/**
 * @swagger
 * /api/v1/superadmin/moderators/{id}:
 *   patch:
 *     summary: Update moderator role/permissions
 *     tags: [SuperAdmin Moderators]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Moderator updated
 */
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
/**
 * @swagger
 * /api/v1/superadmin/moderators/{id}:
 *   delete:
 *     summary: Remove moderator access
 *     tags: [SuperAdmin Moderators]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moderator removed
 */
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

// System Health Monitoring
/**
 * @swagger
 * /api/v1/superadmin/system/health:
 *   get:
 *     summary: Get system health status
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 */
router.get('/system/health', authenticateSuperAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const os = require('os');
    
    // Database health check
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // Test database connection with a simple query
    let dbHealthy = false;
    let dbResponseTime = null;
    try {
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      dbResponseTime = Date.now() - startTime;
      dbHealthy = true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      dbHealthy = false;
    }
    
    // System metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
        external: Math.round(process.memoryUsage().external / 1024 / 1024) // MB
      },
      cpu: {
        loadAverage: os.loadavg(),
        cpus: os.cpus().length
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname()
      },
      nodeVersion: process.version
    };
    
    // Overall health status
    const overallHealth = dbHealthy && dbState === 1 ? 'healthy' : 'degraded';
    
    return sendSuccess(res, 200, 'System health fetched successfully', {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      database: {
        status: dbStates[dbState] || 'unknown',
        healthy: dbHealthy,
        responseTime: dbResponseTime,
        connectionState: dbState
      },
      system: systemMetrics
    });
  } catch (error) {
    logger.error('System health check error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch system health');
  }
});

// System Statistics
/**
 * @swagger
 * /api/v1/superadmin/system/statistics:
 *   get:
 *     summary: Get system statistics (database sizes, collection counts)
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 */
router.get('/system/statistics', authenticateSuperAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    if (!db) {
      return sendError(res, 'SRV_6001', 'Database connection not available');
    }
    
    // Get database stats
    let dbStats = {
      dataSize: 0,
      storageSize: 0,
      indexes: 0,
      indexSize: 0
    };
    
    try {
      const statsResult = await db.stats();
      dbStats = {
        dataSize: statsResult.dataSize || 0,
        storageSize: statsResult.storageSize || 0,
        indexes: statsResult.indexes || 0,
        indexSize: statsResult.indexSize || 0
      };
    } catch (statsError) {
      logger.warn('Failed to get database stats, using defaults:', statsError.message);
    }
    
    // Get collection names and their stats
    const collections = await db.listCollections().toArray();
    const collectionStats = await Promise.all(
      collections.map(async (collection) => {
        try {
          const coll = db.collection(collection.name);
          const count = await coll.countDocuments().catch(() => 0);
          
          let stats = {
            size: 0,
            storageSize: 0,
            nindexes: 0,
            totalIndexSize: 0
          };
          
          try {
            const collStats = await db.command({ collStats: collection.name });
            stats = {
              size: collStats.size || 0,
              storageSize: collStats.storageSize || 0,
              nindexes: collStats.nindexes || 0,
              totalIndexSize: collStats.totalIndexSize || 0
            };
          } catch (statsError) {
            // Fallback: use estimates
            const indexes = await coll.indexes().catch(() => []);
            stats = {
              size: count * 1024,
              storageSize: count * 1024,
              nindexes: indexes.length,
              totalIndexSize: indexes.length * 1024 * 10
            };
          }
          
          return {
            name: collection.name,
            count: count,
            size: stats.size || 0,
            storageSize: stats.storageSize || 0,
            indexes: stats.nindexes || 0,
            indexSize: stats.totalIndexSize || 0
          };
        } catch (error) {
          logger.warn(`Failed to get stats for collection ${collection.name}:`, error.message);
          return {
            name: collection.name,
            count: 0,
            size: 0,
            storageSize: 0,
            indexes: 0,
            indexSize: 0
          };
        }
      })
    );
    
    // Get model counts (using existing models)
    const User = require('../models/User');
    const Post = require('../models/Post');
    const TripVisit = require('../models/TripVisit');
    const Report = require('../models/Report');
    const SuperAdmin = require('../models/SuperAdmin');
    const Locale = require('../models/Locale');
    const Song = require('../models/Song');
    
    const modelCounts = await Promise.all([
      User.countDocuments().catch(() => 0),
      Post.countDocuments().catch(() => 0),
      TripVisit.countDocuments().catch(() => 0),
      Report.countDocuments().catch(() => 0),
      SuperAdmin.countDocuments().catch(() => 0),
      Locale.countDocuments().catch(() => 0),
      Song.countDocuments().catch(() => 0)
    ]);
    
    return sendSuccess(res, 200, 'System statistics fetched successfully', {
      database: {
        name: db.databaseName,
        collections: collections.length,
        dataSize: dbStats.dataSize || 0,
        storageSize: dbStats.storageSize || 0,
        indexes: dbStats.indexes || 0,
        indexSize: dbStats.indexSize || 0,
        totalSize: (dbStats.dataSize || 0) + (dbStats.indexSize || 0)
      },
      collections: collectionStats,
      modelCounts: {
        users: modelCounts[0],
        posts: modelCounts[1],
        tripVisits: modelCounts[2],
        reports: modelCounts[3],
        superAdmins: modelCounts[4],
        locales: modelCounts[5],
        songs: modelCounts[6]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('System statistics error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch system statistics');
  }
});

// Activity Logs Aggregation
/**
 * @swagger
 * /api/v1/superadmin/system/activity-logs:
 *   get:
 *     summary: Get aggregated activity logs from all admins
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: adminId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity logs
 */
router.get('/system/activity-logs', authenticateSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, adminId } = req.query;
    const skip = (page - 1) * limit;
    
    const SuperAdmin = require('../models/SuperAdmin');
    
    // Build query
    let query = {};
    if (adminId) {
      query._id = adminId;
    }
    
    // Get all super admins with their security logs
    const admins = await SuperAdmin.find(query)
      .select('email role securityLogs')
      .lean();
    
    // Aggregate all logs
    let allLogs = [];
    admins.forEach(admin => {
      if (admin.securityLogs && Array.isArray(admin.securityLogs)) {
        admin.securityLogs.forEach(log => {
          allLogs.push({
            ...log,
            adminEmail: admin.email,
            adminRole: admin.role,
            adminId: admin._id.toString()
          });
        });
      }
    });
    
    // Filter by action if provided
    if (action) {
      allLogs = allLogs.filter(log => log.action === action);
    }
    
    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
    
    // Paginate
    const total = allLogs.length;
    const paginatedLogs = allLogs.slice(skip, skip + parseInt(limit));
    
    // Get action breakdown
    const actionBreakdown = {};
    allLogs.forEach(log => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    });
    
    return sendSuccess(res, 200, 'Activity logs fetched successfully', {
      logs: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        totalLogs: total,
        actionBreakdown,
        uniqueAdmins: new Set(admins.map(a => a._id.toString())).size
      }
    });
  } catch (error) {
    logger.error('Activity logs error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch activity logs');
  }
});

// Performance Metrics
/**
 * @swagger
 * /api/v1/superadmin/system/performance:
 *   get:
 *     summary: Get system performance metrics
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics
 */
router.get('/system/performance', authenticateSuperAdmin, async (req, res) => {
  try {
    const { getQueryStats } = require('../middleware/queryMonitor');
    const queryStats = getQueryStats();
    
    // Get recent error rate (from logs if available)
    const mongoose = require('mongoose');
    const db = mongoose.connection;
    
    // Calculate average query time from query monitor
    const avgQueryTime = queryStats.averageQueryTime || 0;
    
    // Get slow queries count (not the array!)
    const slowQueriesCount = queryStats.slowQueriesCount || 0;
    
    // System performance metrics
    const performance = {
      database: {
        connectionState: db.readyState,
        avgQueryTime: Math.round(avgQueryTime),
        totalQueries: queryStats.totalQueries || 0,
        slowQueries: slowQueriesCount,
        slowQueryRate: queryStats.totalQueries > 0
          ? ((slowQueriesCount / queryStats.totalQueries) * 100).toFixed(2)
          : '0.00'
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
        heapUsagePercent: ((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100).toFixed(2)
      },
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: formatUptime(process.uptime())
      },
      timestamp: new Date().toISOString()
    };
    
    return sendSuccess(res, 200, 'Performance metrics fetched successfully', performance);
  } catch (error) {
    logger.error('Performance metrics error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch performance metrics');
  }
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Database Collection Details
/**
 * @swagger
 * /api/v1/superadmin/system/database/collections:
 *   get:
 *     summary: Get detailed database collection information
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Collection details
 */
router.get('/system/database/collections', authenticateSuperAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    if (!db) {
      return sendError(res, 'SRV_6001', 'Database connection not available');
    }
    
    const collections = await db.listCollections().toArray();
    const collectionDetails = await Promise.all(
      collections.map(async (collection) => {
        try {
          const coll = db.collection(collection.name);
          
          // Get count
          const count = await coll.countDocuments().catch(() => 0);
          
          // Get indexes
          const indexes = await coll.indexes().catch(() => []);
          
          // Try to get stats using aggregate pipeline (more reliable)
          let stats = {
            size: 0,
            storageSize: 0,
            totalIndexSize: 0
          };
          
          try {
            // Use collStats command via runCommand
            const collStats = await db.command({ collStats: collection.name });
            stats = {
              size: collStats.size || 0,
              storageSize: collStats.storageSize || 0,
              totalIndexSize: collStats.totalIndexSize || 0
            };
          } catch (statsError) {
            // Fallback: estimate size from count
            logger.debug(`Could not get stats for ${collection.name}, using estimates`);
            stats = {
              size: count * 1024, // Rough estimate: 1KB per document
              storageSize: count * 1024,
              totalIndexSize: indexes.length * 1024 * 10 // Rough estimate per index
            };
          }
          
          return {
            name: collection.name,
            count: count,
            size: {
              data: stats.size || 0,
              storage: stats.storageSize || 0,
              indexes: stats.totalIndexSize || 0,
              total: (stats.size || 0) + (stats.totalIndexSize || 0)
            },
            indexes: indexes.map(idx => ({
              name: idx.name,
              keys: idx.key,
              unique: idx.unique || false,
              sparse: idx.sparse || false
            })),
            avgObjectSize: count > 0 ? Math.round((stats.size || 0) / count) : 0
          };
        } catch (error) {
          logger.warn(`Failed to get details for collection ${collection.name}:`, error.message);
          return {
            name: collection.name,
            count: 0,
            size: { data: 0, storage: 0, indexes: 0, total: 0 },
            indexes: [],
            avgObjectSize: 0
          };
        }
      })
    );
    
    return sendSuccess(res, 200, 'Collection details fetched successfully', {
      collections: collectionDetails,
      totalCollections: collections.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Collection details error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch collection details');
  }
});

// System Maintenance Mode
/**
 * @swagger
 * /api/v1/superadmin/system/maintenance:
 *   get:
 *     summary: Get maintenance mode status
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     summary: Toggle maintenance mode
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 */
router.get('/system/maintenance', authenticateSuperAdmin, async (req, res) => {
  try {
    const SystemSettings = require('../models/SystemSettings');
    
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    
    return sendSuccess(res, 200, 'Maintenance mode status fetched', {
      maintenanceMode: settings.maintenanceMode || false,
      maintenanceMessage: settings.maintenanceMessage || '',
      scheduledDowntime: settings.scheduledDowntime || null
    });
  } catch (error) {
    logger.error('Get maintenance mode error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch maintenance mode');
  }
});

router.patch('/system/maintenance', authenticateSuperAdmin, async (req, res) => {
  try {
    const { maintenanceMode, maintenanceMessage } = req.body;
    const SystemSettings = require('../models/SystemSettings');
    
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    
    settings.maintenanceMode = maintenanceMode !== undefined ? maintenanceMode : settings.maintenanceMode;
    if (maintenanceMessage !== undefined) {
      settings.maintenanceMessage = maintenanceMessage;
    }
    
    await settings.save();
    
    // Log the action
    await req.superAdmin.logSecurityEvent(
      'toggle_maintenance_mode',
      `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'}`,
      req.ip,
      req.get('User-Agent'),
      true
    );
    
    return sendSuccess(res, 200, `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'} successfully`, {
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage
    });
  } catch (error) {
    logger.error('Toggle maintenance mode error:', error);
    return sendError(res, 'SRV_6001', 'Failed to toggle maintenance mode');
  }
});

// Cache Management
/**
 * @swagger
 * /api/v1/superadmin/system/cache:
 *   get:
 *     summary: Get cache statistics
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Clear cache
 *     tags: [SuperAdmin System]
 *     security:
 *       - bearerAuth: []
 */
router.get('/system/cache', authenticateSuperAdmin, async (req, res) => {
  try {
    const { CacheKeys, CACHE_TTL } = require('../utils/cache');
    
    // Get cache statistics if available
    const cacheStats = {
      enabled: process.env.ENABLE_CACHING !== 'false',
      defaultTTL: CACHE_TTL?.DEFAULT || 3600,
      availableKeys: Object.keys(CacheKeys || {}),
      timestamp: new Date().toISOString()
    };
    
    return sendSuccess(res, 200, 'Cache statistics fetched successfully', cacheStats);
  } catch (error) {
    logger.error('Cache stats error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch cache statistics');
  }
});

router.delete('/system/cache', authenticateSuperAdmin, async (req, res) => {
  try {
    const { deleteCache, deleteCacheByPattern } = require('../utils/cache');
    const { pattern } = req.query;
    
    if (pattern) {
      // Clear cache by pattern
      const deletedCount = await deleteCacheByPattern(pattern);
      await req.superAdmin.logSecurityEvent(
        'clear_cache_pattern',
        `Cleared cache with pattern: ${pattern} (${deletedCount} keys)`,
        req.ip,
        req.get('User-Agent'),
        true
      );
      return sendSuccess(res, 200, `Cache cleared for pattern: ${pattern} (${deletedCount} keys deleted)`);
    } else {
      // Clear all cache (if supported by implementation)
      await req.superAdmin.logSecurityEvent(
        'clear_all_cache',
        'Cleared all cache',
        req.ip,
        req.get('User-Agent'),
        true
      );
      return sendSuccess(res, 200, 'Cache clear initiated (implementation-dependent)');
    }
  } catch (error) {
    logger.error('Clear cache error:', error);
    return sendError(res, 'SRV_6001', 'Failed to clear cache');
  }
});

// Enhanced Search with Filters
/**
 * @swagger
 * /api/v1/superadmin/search/advanced:
 *   get:
 *     summary: Advanced search across multiple entities
 *     tags: [SuperAdmin Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, users, posts, locales, songs]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search/advanced', authenticateSuperAdmin, async (req, res) => {
  try {
    const { q, type = 'all', limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return sendError(res, 'VAL_2001', 'Search query is required');
    }
    
    const searchQuery = q.trim();
    const searchLimit = Math.min(parseInt(limit) || 20, 100); // Cap at 100
    
    const User = require('../models/User');
    const Post = require('../models/Post');
    const Locale = require('../models/Locale');
    const Song = require('../models/Song');
    
    const results = {
      users: [],
      posts: [],
      locales: [],
      songs: [],
      total: 0
    };
    
    // Search users
    if (type === 'all' || type === 'users') {
      const users = await User.find({
        $or: [
          { fullName: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } },
          { username: { $regex: searchQuery, $options: 'i' } }
        ]
      })
      .select('fullName email username profilePic isVerified createdAt')
      .limit(searchLimit)
      .lean();
      
      results.users = users;
    }
    
    // Search posts
    if (type === 'all' || type === 'posts') {
      const posts = await Post.find({
        $or: [
          { caption: { $regex: searchQuery, $options: 'i' } },
          { 'location.address': { $regex: searchQuery, $options: 'i' } }
        ]
      })
      .select('caption imageUrl videoUrl location createdAt type')
      .populate('user', 'fullName email profilePic')
      .limit(searchLimit)
      .lean();
      
      results.posts = posts;
    }
    
    // Search locales
    if (type === 'all' || type === 'locales') {
      const locales = await Locale.find({
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { address: { $regex: searchQuery, $options: 'i' } },
          { city: { $regex: searchQuery, $options: 'i' } },
          { country: { $regex: searchQuery, $options: 'i' } }
        ]
      })
      .select('name address city country continent coordinates')
      .limit(searchLimit)
      .lean();
      
      results.locales = locales;
    }
    
    // Search songs
    if (type === 'all' || type === 'songs') {
      const songs = await Song.find({
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { artist: { $regex: searchQuery, $options: 'i' } }
        ]
      })
      .select('title artist duration url isActive')
      .limit(searchLimit)
      .lean();
      
      results.songs = songs;
    }
    
    results.total = results.users.length + results.posts.length + results.locales.length + results.songs.length;
    
    return sendSuccess(res, 200, 'Advanced search completed successfully', {
      query: searchQuery,
      type,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Advanced search error:', error);
    return sendError(res, 'SRV_6001', 'Failed to perform advanced search');
  }
});

// User Engagement Metrics
/**
 * @swagger
 * /api/v1/superadmin/analytics/engagement:
 *   get:
 *     summary: Get user engagement metrics
 *     tags: [SuperAdmin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Engagement metrics
 */
router.get('/analytics/engagement', authenticateSuperAdmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const User = require('../models/User');
    const Post = require('../models/Post');
    
    // Active users (logged in within period)
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: startDate }
    });
    
    // Total users
    const totalUsers = await User.countDocuments();
    
    // Posts created in period
    const postsCreated = await Post.countDocuments({
      createdAt: { $gte: startDate }
    });
    
    // Total posts
    const totalPosts = await Post.countDocuments();
    
    // Calculate engagement rate
    const engagementRate = totalUsers > 0
      ? ((activeUsers / totalUsers) * 100).toFixed(2)
      : '0.00';
    
    // Average posts per user
    const avgPostsPerUser = totalUsers > 0
      ? (totalPosts / totalUsers).toFixed(2)
      : '0.00';
    
    // Posts per active user
    const postsPerActiveUser = activeUsers > 0
      ? (postsCreated / activeUsers).toFixed(2)
      : '0.00';
    
    return sendSuccess(res, 200, 'Engagement metrics fetched successfully', {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      metrics: {
        totalUsers,
        activeUsers,
        engagementRate: parseFloat(engagementRate),
        totalPosts,
        postsCreated,
        avgPostsPerUser: parseFloat(avgPostsPerUser),
        postsPerActiveUser: parseFloat(postsPerActiveUser)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Engagement metrics error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch engagement metrics');
  }
});

module.exports = router
