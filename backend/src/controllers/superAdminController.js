const SuperAdmin = require('../models/SuperAdmin')
const jwt = require('jsonwebtoken')
const { sendSuperAdmin2FAEmail, sendSuperAdminLoginAlertEmail } = require('../utils/sendOtp')

// Middleware to verify SuperAdmin token
const verifySuperAdminToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' })
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'superadmin_secret_key')
    const superAdmin = await SuperAdmin.findById(decoded.id).select('-password')
    
    if (!superAdmin || !superAdmin.isActive) {
      return res.status(401).json({ message: 'Invalid token or inactive account.' })
    }
    
    req.superAdmin = superAdmin
    next()
  } catch (error) {
    // Provide specific responses for token errors and avoid noisy logs
    if (error.name === 'TokenExpiredError') {
      console.warn('SuperAdmin token expired')
      return res.status(401).json({ message: 'Token expired' })
    }
    if (error.name === 'JsonWebTokenError') {
      console.warn('SuperAdmin token invalid')
      return res.status(401).json({ message: 'Invalid token' })
    }
    console.error('SuperAdmin token verification error:', error)
    return res.status(500).json({ message: 'Error verifying token' })
  }
}

// Middleware to check specific permissions
const checkPermission = (permissionName) => {
  return (req, res, next) => {
    try {
      // Founders have all permissions
      if (req.superAdmin.role === 'founder') {
        return next()
      }
      
      // Check specific permission
      if (!req.superAdmin.permissions || !req.superAdmin.permissions[permissionName]) {
        return res.status(403).json({ 
          message: 'Access denied. Insufficient permissions.',
          required: permissionName 
        })
      }
      
      next()
    } catch (error) {
      console.error('Permission check error:', error)
      res.status(500).json({ message: 'Permission check failed.' })
    }
  }
}

// Login SuperAdmin
const loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body
    const ipAddress = req.ip || req.connection.remoteAddress
    const userAgent = req.get('User-Agent')
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }
    
    // Find SuperAdmin
    const superAdmin = await SuperAdmin.findByEmail(email)
    
    if (!superAdmin) {
      await logFailedAttempt(email, ipAddress, userAgent, 'Login attempt with non-existent email')
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    
    // Check if account is locked
    if (superAdmin.isLocked) {
      await superAdmin.logSecurityEvent('login_attempt', 'Account locked due to too many failed attempts', ipAddress, userAgent, false)
      return res.status(423).json({ message: 'Account is temporarily locked due to too many failed login attempts' })
    }
    
    // Verify password
    const isPasswordValid = await superAdmin.comparePassword(password)
    
    if (!isPasswordValid) {
      await superAdmin.incLoginAttempts()
      await superAdmin.logSecurityEvent('login_attempt', 'Invalid password', ipAddress, userAgent, false)
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    
    // ALWAYS require 2FA for SuperAdmin login (mandatory security)
    // Generate OTP and send email
    const { otp, expiresAt } = superAdmin.generateOTP()
    
    // Save the tempAuth object to database
    await superAdmin.save()
    
    try {
      await sendSuperAdmin2FAEmail(
        superAdmin.email, 
        otp, 
        superAdmin.profile.firstName || 'SuperAdmin'
      )
      
      // Generate temporary token for 2FA verification
      const tempToken = superAdmin.generateTempToken()
      
      await superAdmin.logSecurityEvent('2fa_sent', '2FA code sent via email', ipAddress, userAgent, true)
      
      res.json({
        message: '2FA code sent to your email',
        requires2FA: true,
        token: tempToken,
        expiresAt: expiresAt
      })
      return
    } catch (emailError) {
      console.error('Failed to send 2FA email:', emailError)
      await superAdmin.logSecurityEvent('2fa_email_failed', 'Failed to send 2FA email', ipAddress, userAgent, false)
      return res.status(500).json({ message: 'Failed to send 2FA code. Please try again.' })
    }
    
  } catch (error) {
    console.error('SuperAdmin login error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Verify token
const verifyToken = async (req, res) => {
  try {
    res.json({
      message: 'Token is valid',
      user: {
        id: req.superAdmin._id,
        email: req.superAdmin.email,
        role: req.superAdmin.role,
        organization: req.superAdmin.organization,
        permissions: req.superAdmin.permissions,
        profile: req.superAdmin.profile,
        lastLogin: req.superAdmin.lastLogin
      }
    })
  } catch (error) {
    console.error('Token verification error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Create SuperAdmin (for initial setup)
const createSuperAdmin = async (req, res) => {
  try {
    const { email, password, organization } = req.body
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }
    
    // Check if SuperAdmin already exists
    const existingSuperAdmin = await SuperAdmin.findByEmail(email)
    if (existingSuperAdmin) {
      return res.status(409).json({ message: 'SuperAdmin with this email already exists' })
    }
    
    // Create SuperAdmin
    const superAdmin = await SuperAdmin.createFounder(email, password, organization)
    
    // Log creation
    await superAdmin.logSecurityEvent('account_created', 'SuperAdmin account created', req.ip, req.get('User-Agent'), true)
    
    res.status(201).json({
      message: 'SuperAdmin created successfully',
      user: {
        id: superAdmin._id,
        email: superAdmin.email,
        role: superAdmin.role,
        organization: superAdmin.organization
      }
    })
    
  } catch (error) {
    console.error('Create SuperAdmin error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Get security logs
const getSecurityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query
    const skip = (page - 1) * limit
    
    let query = { _id: req.superAdmin._id }
    
    const superAdmin = await SuperAdmin.findById(req.superAdmin._id)
      .select('securityLogs')
      .lean()
    
    if (!superAdmin) {
      return res.status(404).json({ message: 'SuperAdmin not found' })
    }
    
    let logs = superAdmin.securityLogs
    
    // Filter by action if provided
    if (action) {
      logs = logs.filter(log => log.action.includes(action))
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
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
    console.error('Get security logs error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' })
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' })
    }
    
    const superAdmin = await SuperAdmin.findById(req.superAdmin._id)
    
    // Verify current password
    const isCurrentPasswordValid = await superAdmin.comparePassword(currentPassword)
    if (!isCurrentPasswordValid) {
      await superAdmin.logSecurityEvent('password_change_attempt', 'Invalid current password', req.ip, req.get('User-Agent'), false)
      return res.status(401).json({ message: 'Current password is incorrect' })
    }
    
    // Update password
    superAdmin.password = newPassword
    await superAdmin.save()
    
    // Log the event after save is complete
    await superAdmin.logSecurityEvent('password_changed', 'Password changed successfully', req.ip, req.get('User-Agent'), true)
    
    res.json({ message: 'Password changed successfully' })
    
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, timezone } = req.body
    
    const superAdmin = await SuperAdmin.findById(req.superAdmin._id)
    
    if (firstName) superAdmin.profile.firstName = firstName
    if (lastName) superAdmin.profile.lastName = lastName
    if (phone) superAdmin.profile.phone = phone
    if (timezone) superAdmin.profile.timezone = timezone
    
    await superAdmin.save()
    
    await superAdmin.logSecurityEvent('profile_updated', 'Profile information updated', req.ip, req.get('User-Agent'), true)
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: superAdmin._id,
        email: superAdmin.email,
        role: superAdmin.role,
        organization: superAdmin.organization,
        permissions: superAdmin.permissions,
        profile: superAdmin.profile
      }
    })
    
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Logout
const logout = async (req, res) => {
  try {
    await req.superAdmin.logSecurityEvent('logout', 'User logged out', req.ip, req.get('User-Agent'), true)
    
    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Helper function to log failed attempts
const logFailedAttempt = async (email, ipAddress, userAgent, details) => {
  try {
    // Log to a general security collection or file
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

// Verify 2FA code
const verify2FA = async (req, res) => {
  try {
    const { token, code } = req.body
    const ipAddress = req.ip || req.connection.remoteAddress
    const userAgent = req.get('User-Agent')
    
    // Validate input
    if (!token || !code) {
      return res.status(400).json({ message: 'Token and code are required' })
    }
    
    // Verify temporary token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'superadmin_secret_key')
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
    
    if (!decoded.temp) {
      return res.status(401).json({ message: 'Invalid token type' })
    }
    
    // Find SuperAdmin - explicitly select tempAuth field
    const superAdmin = await SuperAdmin.findById(decoded.id).select('+tempAuth')
    if (!superAdmin) {
      return res.status(401).json({ message: 'Invalid token' })
    }
    
    // Verify OTP
    const otpResult = superAdmin.verifyOTP(code)
    
    if (!otpResult.valid) {
      await superAdmin.logSecurityEvent('2fa_failed', `2FA verification failed: ${otpResult.message}`, ipAddress, userAgent, false)
      return res.status(401).json({ message: otpResult.message })
    }
    
    // Complete login - call sequentially to avoid parallel save error
    await superAdmin.resetLoginAttempts()
    await superAdmin.logSecurityEvent('2fa_success', '2FA verification successful', ipAddress, userAgent, true)
    
    // Generate final token
    const finalToken = superAdmin.generateAuthToken()
    
    // Send login alert email
    try {
      // Extract device and location info from user agent
      const device = userAgent ? userAgent.split(' ')[0] : 'Unknown Device'
      const location = 'Unknown Location' // Could be enhanced with IP geolocation
      
      await sendSuperAdminLoginAlertEmail(
        superAdmin.email,
        superAdmin.profile.firstName || 'SuperAdmin',
        device,
        location,
        ipAddress
      )
      
      await superAdmin.logSecurityEvent('login_alert_sent', 'Login alert email sent', ipAddress, userAgent, true)
    } catch (emailError) {
      console.error('Failed to send SuperAdmin login alert email:', emailError)
      await superAdmin.logSecurityEvent('login_alert_failed', 'Failed to send login alert email', ipAddress, userAgent, false)
      // Don't fail the login if email fails
    }
    
    res.json({
      message: '2FA verification successful',
      token: finalToken,
      user: {
        id: superAdmin._id,
        email: superAdmin.email,
        role: superAdmin.role,
        organization: superAdmin.organization,
        permissions: superAdmin.permissions,
        profile: superAdmin.profile,
        lastLogin: superAdmin.lastLogin
      }
    })
    
  } catch (error) {
    console.error('2FA verification error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Resend 2FA code
const resend2FA = async (req, res) => {
  try {
    const { token } = req.body
    const ipAddress = req.ip || req.connection.remoteAddress
    const userAgent = req.get('User-Agent')
    
    // Validate input
    if (!token) {
      return res.status(400).json({ message: 'Token is required' })
    }
    
    // Verify temporary token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'superadmin_secret_key')
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
    
    if (!decoded.temp) {
      return res.status(401).json({ message: 'Invalid token type' })
    }
    
    // Find SuperAdmin
    const superAdmin = await SuperAdmin.findById(decoded.id)
    if (!superAdmin) {
      return res.status(401).json({ message: 'Invalid token' })
    }
    
    // Generate new OTP and send email
    const { otp, expiresAt } = superAdmin.generateOTP()
    
    // Save the tempAuth object to database
    await superAdmin.save()
    
    try {
      await sendSuperAdmin2FAEmail(
        superAdmin.email, 
        otp, 
        superAdmin.profile.firstName || 'SuperAdmin'
      )
      
      await superAdmin.logSecurityEvent('2fa_resend', '2FA code resent', ipAddress, userAgent, true)
      
      res.json({
        message: '2FA code resent to your email',
        expiresAt: expiresAt
      })
    } catch (emailError) {
      console.error('Failed to resend 2FA email:', emailError)
      await superAdmin.logSecurityEvent('2fa_resend_failed', 'Failed to resend 2FA email', ipAddress, userAgent, false)
      return res.status(500).json({ message: 'Failed to resend 2FA code. Please try again.' })
    }
    
  } catch (error) {
    console.error('Resend 2FA error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
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
}
