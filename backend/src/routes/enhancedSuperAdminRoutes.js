const express = require('express')
const router = express.Router()
const SuperAdmin = require('../models/SuperAdmin')
const {
  verifySuperAdminToken,
  loginSuperAdmin,
  verifyToken,
  createSuperAdmin,
  getSecurityLogs,
  changePassword,
  updateProfile,
  logout
} = require('../controllers/superAdminController')

// Public routes (no authentication required)
router.post('/login', loginSuperAdmin)
router.post('/create', createSuperAdmin) // For initial setup only


// Protected routes (require authentication)
router.use(verifySuperAdminToken)

// Authentication routes
router.get('/verify', verifyToken)
router.post('/logout', logout)
router.patch('/change-password', changePassword)
router.patch('/profile', updateProfile)

// Dashboard overview with real-time data
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
      User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Post.countDocuments({ type: 'post' }),
      Post.countDocuments({ type: 'short' }),
      Chat.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('fullName email createdAt')
    ])

    // Get recent posts with proper user population
    const recentPostsRaw = await Post.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('content type createdAt user')
      .populate('user', 'fullName email')
    
    // Transform to plain objects to avoid virtual field issues
    const recentPosts = recentPostsRaw.map(post => ({
      _id: post._id,
      content: post.content,
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
        totalPosts,
        totalShorts,
        totalChats,
        userGrowth: {
          weekly: usersLastWeek,
          monthly: usersLastMonth,
          weeklyGrowth: totalUsers > 0 ? ((usersLastWeek / totalUsers) * 100).toFixed(1) : 0,
          monthlyGrowth: totalUsers > 0 ? ((usersLastMonth / totalUsers) * 100).toFixed(1) : 0
        },
        contentGrowth: {
          weekly: postsLastWeek,
          monthly: postsLastMonth,
          weeklyGrowth: totalPosts > 0 ? ((postsLastWeek / totalPosts) * 100).toFixed(1) : 0,
          monthlyGrowth: totalPosts > 0 ? ((postsLastMonth / totalPosts) * 100).toFixed(1) : 0
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

    res.json(overview)
  } catch (error) {
    console.error('Dashboard overview error:', error)
    res.status(500).json({ message: 'Failed to fetch overview data' })
  }
})

// Real-time analytics with auto-refresh support
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
      User.countDocuments({ lastActive: timeFilter }),
      Post.aggregate([
        { $match: { createdAt: timeFilter } },
        { $group: { _id: null, totalLikes: { $sum: '$likes' }, totalComments: { $sum: '$comments' }, totalShares: { $sum: '$shares' } } }
      ])
    ])

    const analytics = {
      timestamp: new Date().toISOString(),
      period,
      userRegistrations: userRegistrations.map(item => ({ time: item._id, count: item.count })),
      postCreations: postCreations.map(item => ({ time: item._id, count: item.count })),
      activeUsers: userActivity,
      engagement: contentEngagement[0] || { totalLikes: 0, totalComments: 0, totalShares: 0 }
    }

    res.json(analytics)
  } catch (error) {
    console.error('Real-time analytics error:', error)
    res.status(500).json({ message: 'Failed to fetch real-time analytics' })
  }
})

// Users management with advanced features
router.get('/users', async (req, res) => {
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
      // Use isVerified field instead of isActive
      query.isVerified = status === 'active'
    }
    
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1
    
    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
    
    const total = await User.countDocuments(query)
    
    // Add additional user metrics
    const usersWithMetrics = await Promise.all(users.map(async (user) => {
      try {
        const userPosts = await Post.countDocuments({ user: user._id })
        const userLikes = await Post.aggregate([
          { $match: { user: user._id } },
          { $group: { _id: null, totalLikes: { $sum: '$likes' } } }
        ])
        
        return {
          ...user.toObject(),
          metrics: {
            totalPosts: userPosts,
            totalLikes: userLikes[0]?.totalLikes || 0,
            lastActive: user.lastActive || user.createdAt
          }
        }
      } catch (error) {
        console.error('Error processing user metrics for user:', user._id, error)
        return {
          ...user.toObject(),
          metrics: {
            totalPosts: 0,
            totalLikes: 0,
            lastActive: user.lastActive || user.createdAt
          }
        }
      }
    }))
    
    res.json({
      users: usersWithMetrics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Users data error:', error)
    res.status(500).json({ message: 'Failed to fetch users data' })
  }
})

// Bulk actions for users
router.post('/users/bulk-action', async (req, res) => {
  try {
    const { action, userIds, reason } = req.body
    const User = require('../models/User')
    
    if (!action || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ message: 'Invalid bulk action parameters' })
    }

    let updateQuery = {}
    let logAction = ''
    
    switch (action) {
      case 'activate':
        updateQuery = { isActive: true }
        logAction = 'bulk_activate_users'
        break
      case 'deactivate':
        updateQuery = { isActive: false }
        logAction = 'bulk_deactivate_users'
        break
      case 'delete':
        // Soft delete by deactivating
        updateQuery = { isActive: false, deletedAt: new Date() }
        logAction = 'bulk_delete_users'
        break
      default:
        return res.status(400).json({ message: 'Invalid action' })
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

    res.json({
      message: `Successfully ${action}d ${result.modifiedCount} users`,
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    console.error('Bulk action error:', error)
    res.status(500).json({ message: 'Failed to perform bulk action' })
  }
})

// Travel content management
router.get('/travel-content', async (req, res) => {
  try {
    
    const { page = 1, limit = 20, search, type, status } = req.query
    const skip = (page - 1) * limit
    
    const Post = require('../models/Post')
    let query = {}
    
    if (search) {
      query.$or = [
        { content: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (type) {
      query.type = type
    }
    
    if (status) {
      query.isActive = status === 'active'
    }
    
    const posts = await Post.find(query)
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
    
    const total = await Post.countDocuments(query)
    
    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Travel content error:', error)
    res.status(500).json({ message: 'Failed to fetch travel content' })
  }
})

// Reports management
router.get('/reports', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query
    const skip = (page - 1) * limit
    
    const Report = require('../models/Report')
    let query = {}
    
    if (status) {
      query.status = status
    }
    
    if (type) {
      query.type = type
    }
    
    const reports = await Report.find(query)
      .populate('reportedBy', 'fullName email')
      .populate('reportedUser', 'fullName email')
      .populate('reportedContent', 'caption type')
      .populate('resolvedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
    
    const total = await Report.countDocuments(query)
    
    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Reports error:', error)
    res.status(500).json({ message: 'Failed to fetch reports' })
  }
})

// Analytics data with enhanced metrics
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
    
    res.json({ analytics })
  } catch (error) {
    console.error('Analytics error:', error)
    res.status(500).json({ message: 'Failed to fetch analytics' })
  }
})

// Feature flags management
router.get('/feature-flags', async (req, res) => {
  try {
    // Mock feature flags - replace with real feature flags collection
    const featureFlags = [
      {
        id: '1',
        name: 'dark_mode',
        description: 'Enable dark mode for the application',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: 'all',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        name: 'ai_recommendations',
        description: 'AI-powered content recommendations',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: 'beta',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        name: 'advanced_analytics',
        description: 'Advanced analytics dashboard',
        enabled: true,
        rolloutPercentage: 50,
        targetUsers: 'premium',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
    
    res.json({ featureFlags })
  } catch (error) {
    console.error('Feature flags error:', error)
    res.status(500).json({ message: 'Failed to fetch feature flags' })
  }
})

// Update feature flags
router.patch('/feature-flags/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { enabled, rolloutPercentage, targetUsers } = req.body
    
    // Mock update - replace with real feature flags collection
    const updatedFlag = {
      id,
      enabled,
      rolloutPercentage,
      targetUsers,
      updatedAt: new Date()
    }
    
    // Log the feature flag change
    await req.superAdmin.logSecurityEvent(
      'feature_flag_updated',
      `Feature flag ${id} updated: enabled=${enabled}, rollout=${rolloutPercentage}%`,
      req.ip,
      req.get('User-Agent'),
      true
    )
    
    res.json({
      message: 'Feature flag updated successfully',
      featureFlag: updatedFlag
    })
  } catch (error) {
    console.error('Feature flag update error:', error)
    res.status(500).json({ message: 'Failed to update feature flag' })
  }
})

// Global search
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'all', limit = 10 } = req.query
    
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' })
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
    
    res.json(searchResults)
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ message: 'Failed to perform search' })
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
      return res.status(404).json({ message: 'SuperAdmin not found' })
    }
    
    let logs = superAdmin.securityLogs
    
    // Apply filters
    if (action) {
      logs = logs.filter(log => log.action.includes(action))
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
    
    res.json({
      logs: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
    
  } catch (error) {
    console.error('Audit logs error:', error)
    res.status(500).json({ message: 'Failed to fetch audit logs' })
  }
})

// Helper functions for analytics
async function getTopPerformingRegions() {
  const Post = require('../models/Post')
  const regions = await Post.aggregate([
    { $match: { location: { $exists: true, $ne: null } } },
    { $group: { _id: '$location', count: { $sum: 1 }, totalLikes: { $sum: '$likes' } } },
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
      { lastActive: { $lt: thirtyDaysAgo } },
      { lastActive: { $exists: false } }
    ]
  })
  .select('fullName email lastActive createdAt')
  .limit(10)
  return users
}

async function getVIPUsers() {
  const User = require('../models/User')
  const Post = require('../models/Post')
  
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
        totalLikes: { $sum: '$posts.likes' }
      }
    },
    {
      $match: {
        $or: [
          { totalPosts: { $gte: 10 } },
          { totalLikes: { $gte: 100 } }
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
        totalLikes: { $sum: '$likes' },
        totalComments: { $sum: '$comments' },
        totalShares: { $sum: '$shares' }
      }
    }
  ])
  return stats[0] || { totalPosts: 0, totalLikes: 0, totalComments: 0, totalShares: 0 }
}

async function getTopLocations(timeFilter) {
  const Post = require('../models/Post')
  const locations = await Post.aggregate([
    { $match: { createdAt: timeFilter, location: { $exists: true, $ne: null } } },
    { $group: { _id: '$location', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ])
  return locations.map(item => ({ name: item._id, posts: item.count }))
}

async function getEngagementMetrics(timeFilter) {
  const Post = require('../models/Post')
  const metrics = await Post.aggregate([
    { $match: { createdAt: timeFilter } },
    {
      $group: {
        _id: null,
        avgLikes: { $avg: '$likes' },
        avgComments: { $avg: '$comments' },
        avgShares: { $avg: '$shares' }
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

// Test endpoint without authentication
router.get('/test', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const postCount = await Post.countDocuments();
    const reportCount = await Report.countDocuments();
    
    res.json({
      status: 'OK',
      message: 'Backend is working correctly',
      data: {
        users: userCount,
        posts: postCount,
        reports: reportCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Backend error',
      error: error.message
    });
  }
});

module.exports = router
