import React, { useState, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  User, Camera, Lock, Shield, Mail, Save, Upload,
  Eye, EyeOff, Key, AlertCircle, CheckCircle, X,
  ArrowLeft, Clock, Activity, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import SafeComponent from '../components/SafeComponent'

const Profile = () => {
  const navigate = useNavigate()
  const { user, updateProfile, changePassword } = useAuth()
  const fileInputRef = useRef(null)
  
  const [profileData, setProfileData] = useState({
    firstName: user?.profile?.firstName || '',
    lastName: user?.profile?.lastName || '',
    email: user?.email || '',
    phone: user?.profile?.phone || '',
    timezone: user?.profile?.timezone || 'UTC'
  })
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false
  })
  
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  // Password strength calculator
  const passwordStrength = useMemo(() => {
    const password = passwordData.newPassword
    if (!password) return { strength: 0, label: '', color: '' }
    
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    
    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' }
    if (strength <= 4) return { strength, label: 'Medium', color: 'bg-yellow-500' }
    return { strength, label: 'Strong', color: 'bg-green-500' }
  }, [passwordData.newPassword])

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }
      
      setAvatar(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const dataToSave = { ...profileData }
      
      // If avatar is selected, upload it
      if (avatar) {
        const formData = new FormData()
        formData.append('avatar', avatar)
        formData.append('firstName', profileData.firstName)
        formData.append('lastName', profileData.lastName)
        formData.append('phone', profileData.phone)
        formData.append('timezone', profileData.timezone)
        
        const response = await api.patch('/api/v1/superadmin/profile', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        
        if (response.data.success) {
          toast.success('Profile updated successfully')
          // Refresh the page to show updated data
          window.location.reload()
        }
      } else {
        // No avatar upload, just update profile data
        const response = await api.patch('/api/v1/superadmin/profile', profileData)
        if (response.data.success) {
          toast.success('Profile updated successfully')
        }
      }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      const { parseError } = await import('../utils/errorCodes')
      const parsedError = parseError(error)
      logger.error('Failed to update profile:', parsedError.code, parsedError.message)
      toast.error(parsedError.adminMessage || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    
    setIsSaving(true)
    try {
      const result = await changePassword(passwordData.currentPassword, passwordData.newPassword)
      if (result.success) {
        toast.success('Password changed successfully')
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
          showCurrent: false,
          showNew: false,
          showConfirm: false
        })
      } else {
        toast.error(result.error || 'Failed to change password')
      }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      const { parseError } = await import('../utils/errorCodes')
      const parsedError = parseError(error)
      logger.error('Password change failed:', parsedError.code, parsedError.message)
      toast.error(parsedError.adminMessage || 'Failed to change password')
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = () => {
    const firstName = profileData.firstName || user?.email?.split('@')[0] || ''
    const lastName = profileData.lastName || ''
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'A'
  }

  const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || user?.email?.split('@')[0] || 'User'

  return (
    <SafeComponent>
      <div className="space-y-6 animate-fadeIn">
        {/* Enhanced Header with Elegant Design */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full -ml-48 -mb-48"></div>
          
          <div className="relative p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white/30">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-400 rounded-full border-2 border-white shadow-lg"></div>
                </div>
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2 drop-shadow-lg">
                    My Profile
                  </h1>
                  <p className="text-indigo-100 text-lg">Manage your personal information and security settings</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center space-x-2 border border-white/30 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="flex flex-col sm:flex-row border-b border-gray-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`relative flex-1 px-6 py-4 font-semibold transition-all duration-300 ${
                activeTab === 'profile'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">Profile Information</span>
                <span className="sm:hidden">Profile</span>
              </div>
              {activeTab === 'profile' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/50"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`relative flex-1 px-6 py-4 font-semibold transition-all duration-300 ${
                activeTab === 'password'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Lock className="w-5 h-5" />
                <span className="hidden sm:inline">Change Password</span>
                <span className="sm:hidden">Password</span>
              </div>
              {activeTab === 'password' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/50"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`relative flex-1 px-6 py-4 font-semibold transition-all duration-300 ${
                activeTab === 'security'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Shield className="w-5 h-5" />
                <span className="hidden sm:inline">Security Settings</span>
                <span className="sm:hidden">Security</span>
              </div>
              {activeTab === 'security' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/50"></div>
              )}
            </button>
          </div>
        </div>

        {/* Profile Information Tab */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enhanced Avatar Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 rounded-3xl shadow-2xl border border-purple-300">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full -ml-32 -mb-32"></div>
              
              <div className="relative p-8">
                <div className="flex flex-col items-center">
                  <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative w-40 h-40 bg-gradient-to-br from-white to-gray-100 rounded-full flex items-center justify-center text-5xl font-bold text-indigo-600 shadow-2xl border-4 border-white/50">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : getInitials()}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 p-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 border-4 border-white"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
                    {fullName}
                  </h3>
                  <p className="text-purple-100 text-sm mb-6 flex items-center space-x-1">
                    <Mail className="w-4 h-4" />
                    <span>{profileData.email}</span>
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center space-x-2 border border-white/30 hover:scale-105"
                  >
                    <Upload className="w-5 h-5" />
                    <span>Upload Photo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Enhanced Profile Details */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-xl">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Personal Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter first name"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter last name"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Email cannot be changed</span>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="+1234567890"
                  />
                </div>
                
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Timezone
                  </label>
                  <select
                    value={profileData.timezone}
                    onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Asia/Dubai">Dubai</option>
                    <option value="Asia/Kolkata">India</option>
                  </select>
                </div>
              </div>
              
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="mt-8 w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              >
                <Save className="w-5 h-5" />
                <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Change Password Tab */}
        {activeTab === 'password' && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl">
            <div className="flex items-center space-x-3 mb-8">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Change Password</h3>
            </div>
            
            <div className="space-y-6 max-w-2xl">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={passwordData.showCurrent ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 hover:bg-white pr-12"
                    placeholder="Enter current password"
                  />
                  <button
                    onClick={() => setPasswordData({ ...passwordData, showCurrent: !passwordData.showCurrent })}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {passwordData.showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={passwordData.showNew ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 hover:bg-white pr-12"
                    placeholder="Enter new password (min. 8 characters)"
                  />
                  <button
                    onClick={() => setPasswordData({ ...passwordData, showNew: !passwordData.showNew })}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {passwordData.showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordData.newPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Password Strength:</span>
                      <span className={`font-semibold ${
                        passwordStrength.label === 'Weak' ? 'text-red-600' :
                        passwordStrength.label === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full ${passwordStrength.color} transition-all duration-300 rounded-full`}
                        style={{ width: `${(passwordStrength.strength / 6) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={passwordData.showConfirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all duration-200 bg-gray-50 hover:bg-white pr-12 ${
                      passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
                        ? 'border-red-300 focus:border-red-500'
                        : passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword
                        ? 'border-green-300 focus:border-green-500'
                        : 'border-gray-200 focus:border-indigo-500'
                    }`}
                    placeholder="Confirm new password"
                  />
                  <button
                    onClick={() => setPasswordData({ ...passwordData, showConfirm: !passwordData.showConfirm })}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {passwordData.showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordData.confirmPassword && (
                  <div className="flex items-center space-x-2 text-sm">
                    {passwordData.newPassword === passwordData.confirmPassword ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-red-600" />
                        <span className="text-red-600">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 mb-2">Security Tips</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Use a strong password with at least 8 characters</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Include uppercase, lowercase, numbers, and symbols</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Don't reuse passwords from other accounts</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleChangePassword}
                disabled={isSaving || passwordData.newPassword !== passwordData.confirmPassword || passwordData.newPassword.length < 8}
                className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              >
                <Key className="w-5 h-5" />
                <span>{isSaving ? 'Changing Password...' : 'Change Password'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Security Settings Tab */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl">
            <div className="flex items-center space-x-3 mb-8">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Security Settings</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl p-6 shadow-xl border border-blue-300">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-bold text-white text-lg">Two-Factor Authentication</h4>
                  </div>
                  <p className="text-blue-100 text-sm mb-4">
                    2FA is currently enabled for your account. This provides an additional layer of security.
                  </p>
                  <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-md rounded-lg px-4 py-2 border border-white/30">
                    <CheckCircle className="w-5 h-5 text-green-300" />
                    <span className="text-sm font-semibold text-white">2FA is Active</span>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 rounded-2xl p-6 shadow-xl border border-purple-300">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-bold text-white text-lg">Session Management</h4>
                  </div>
                  <p className="text-purple-100 text-sm mb-4">
                    Your session timeout is set to 30 minutes. After inactivity, you'll need to log in again.
                  </p>
                  <button
                    onClick={() => toast('Session settings are configured by the system administrator', { icon: 'ℹ️' })}
                    className="w-full px-4 py-2.5 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-lg font-semibold transition-all duration-200 border border-white/30 hover:scale-105"
                  >
                    View Session History
                  </button>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-2xl p-6 shadow-xl border border-green-300 md:col-span-2">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
                <div className="relative">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-bold text-white text-lg">Login Activity</h4>
                  </div>
                  <p className="text-green-100 text-sm mb-4">
                    View your recent login activity and security events to monitor account access.
                  </p>
                  <button
                    onClick={() => navigate('/logs')}
                    className="px-6 py-3 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-xl font-semibold transition-all duration-200 border border-white/30 hover:scale-105 flex items-center space-x-2"
                  >
                    <Activity className="w-5 h-5" />
                    <span>View Activity Log</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SafeComponent>
  )
}

export default Profile
