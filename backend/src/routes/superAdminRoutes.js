const express = require('express')
const router = express.Router()
const {
  verifySuperAdminToken,
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

// Public routes (no authentication required)
router.post('/login', loginSuperAdmin)
router.post('/verify-2fa', verify2FA)
router.post('/resend-2fa', resend2FA)
router.post('/create', createSuperAdmin) // For initial setup only

// Protected routes (authentication required)
router.use(verifySuperAdminToken) // All routes below require authentication

router.get('/verify', verifyToken)
router.get('/security-logs', getSecurityLogs)
router.patch('/change-password', changePassword)
router.patch('/profile', updateProfile)
router.post('/logout', logout)

// Dashboard data routes
router.get('/overview', async (req, res) => {
  try {
    // Get overview statistics
    const User = require('../models/User')
    const Post = require('../models/Post')
    
    const totalUsers = await User.countDocuments()
    const totalPosts = await Post.countDocuments()
    const activeUsers = await User.countDocuments({ isActive: true })
    const recentPosts = await Post.countDocuments({ 
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    })
    
    res.json({
      overview: {
        totalUsers,
        totalPosts,
        activeUsers,
        recentPosts,
        lastUpdated: new Date()
      }
    })
  } catch (error) {
    console.error('Overview data error:', error)
    res.status(500).json({ message: 'Failed to fetch overview data' })
  }
})

// Users management
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query
    const skip = (page - 1) * limit
    
    const User = require('../models/User')
    let query = {}
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (status) {
      query.isActive = status === 'active'
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
    
    const total = await User.countDocuments(query)
    
    res.json({
      users,
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

// Travel content management
router.get('/travel-content', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type } = req.query
    const skip = (page - 1) * limit
    
    const Post = require('../models/Post')
    let query = {}
    
    if (search) {
      query.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (type) {
      query.type = type
    }
    
    const posts = await Post.find(query)
      .populate('user', 'fullName email profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
    
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
    const { page = 1, limit = 20, status } = req.query
    const skip = (page - 1) * limit
    
    // This would connect to your reports system
    // For now, returning mock data
    const mockReports = [
      {
        id: '1',
        type: 'inappropriate_content',
        status: 'pending',
        reportedBy: 'user123',
        reportedContent: 'post456',
        reason: 'Contains inappropriate language',
        createdAt: new Date(),
        priority: 'medium'
      }
    ]
    
    res.json({
      reports: mockReports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mockReports.length,
        pages: 1
      }
    })
  } catch (error) {
    console.error('Reports error:', error)
    res.status(500).json({ message: 'Failed to fetch reports' })
  }
})

// Analytics data
router.get('/analytics', async (req, res) => {
  try {
    const { period = '7d' } = req.query
    
    // Mock analytics data - replace with real analytics
    const analytics = {
      userGrowth: {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        data: [100, 120, 150, 180, 200, 220, 250]
      },
      contentStats: {
        totalPosts: 1250,
        totalLikes: 15600,
        totalComments: 3200,
        totalShares: 890
      },
      topLocations: [
        { name: 'Paris, France', posts: 45 },
        { name: 'Tokyo, Japan', posts: 38 },
        { name: 'New York, USA', posts: 32 },
        { name: 'London, UK', posts: 28 },
        { name: 'Sydney, Australia', posts: 25 }
      ]
    }
    
    res.json({ analytics })
  } catch (error) {
    console.error('Analytics error:', error)
    res.status(500).json({ message: 'Failed to fetch analytics' })
  }
})

module.exports = router
