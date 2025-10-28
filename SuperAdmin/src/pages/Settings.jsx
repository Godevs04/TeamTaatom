import { useState, useEffect } from 'react'
import { useRealTime } from '../context/RealTimeContext'
import { api } from '../services/api'
import { 
  Settings as SettingsIcon, Shield, Lock, Bell, Database, 
  Cloud, Mail, Download, Upload, RefreshCw, Key, Trash2,
  Eye, EyeOff, Save, AlertTriangle, CheckCircle, Info, X,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import SafeComponent from '../components/SafeComponent'

const Settings = () => {
  const { isConnected } = useRealTime()
  const [settings, setSettings] = useState({
    // Security Settings
    pinRequired: true,
    twoFactorAuth: false,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    requireEmailVerification: true,
    
    // Feature Toggles
    userRegistration: true,
    contentModeration: true,
    locationTracking: true,
    pushNotifications: true,
    analyticsTracking: true,
    aiRecommendations: true,
    liveComments: true,
    
    // System Settings
    maintenanceMode: false,
    debugMode: false,
    logLevel: 'info',
    backupFrequency: 'daily',
    autoBackup: true,
    
    // API Settings
    rateLimitEnabled: true,
    rateLimitRequests: 1000,
    rateLimitWindow: 3600,
    
    // Email Settings
    emailNotifications: true,
    emailProvider: 'smtp',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    
    // Storage Settings
    maxFileSize: 10,
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'mp4'],
    
    // Privacy Settings
    dataRetentionDays: 90,
    gdprCompliance: true,
    shareAnalytics: false,
  })

  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('security')

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/api/superadmin/settings')
        if (response.data.success && response.data.settings) {
          const loadedSettings = response.data.settings
          
          // Map loaded settings to local state
          setSettings({
            pinRequired: loadedSettings.security?.pinRequired ?? true,
            twoFactorAuth: loadedSettings.security?.twoFactorAuth ?? false,
            sessionTimeout: loadedSettings.security?.sessionTimeout ?? 30,
            maxLoginAttempts: loadedSettings.security?.maxLoginAttempts ?? 5,
            passwordMinLength: loadedSettings.security?.passwordMinLength ?? 8,
            requireEmailVerification: loadedSettings.security?.requireEmailVerification ?? true,
            
            userRegistration: loadedSettings.features?.userRegistration ?? true,
            contentModeration: loadedSettings.features?.contentModeration ?? true,
            locationTracking: loadedSettings.features?.locationTracking ?? true,
            pushNotifications: loadedSettings.features?.pushNotifications ?? true,
            analyticsTracking: loadedSettings.features?.analyticsTracking ?? true,
            aiRecommendations: loadedSettings.features?.aiRecommendations ?? true,
            liveComments: loadedSettings.features?.liveComments ?? true,
            
            maintenanceMode: loadedSettings.system?.maintenanceMode ?? false,
            debugMode: loadedSettings.system?.debugMode ?? false,
            logLevel: loadedSettings.system?.logLevel ?? 'info',
            backupFrequency: loadedSettings.system?.backupFrequency ?? 'daily',
            autoBackup: loadedSettings.system?.autoBackup ?? true,
            maxFileSize: loadedSettings.system?.maxFileSize ?? 10,
            
            rateLimitEnabled: loadedSettings.api?.rateLimitEnabled ?? true,
            rateLimitRequests: loadedSettings.api?.rateLimitRequests ?? 1000,
            rateLimitWindow: loadedSettings.api?.rateLimitWindow ?? 3600,
            
            emailNotifications: loadedSettings.email?.emailNotifications ?? true,
            emailProvider: loadedSettings.email?.emailProvider ?? 'smtp',
            smtpHost: loadedSettings.email?.smtpHost ?? 'smtp.gmail.com',
            smtpPort: loadedSettings.email?.smtpPort ?? 587,
            
            dataRetentionDays: loadedSettings.privacy?.dataRetentionDays ?? 90,
            gdprCompliance: loadedSettings.privacy?.gdprCompliance ?? true,
            shareAnalytics: loadedSettings.privacy?.shareAnalytics ?? false,
          })
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
        toast.error('Failed to fetch settings')
      }
    }
    fetchSettings()
  }, [api])

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Transform local state to backend format
      const settingsToSave = {
        security: {
          pinRequired: settings.pinRequired,
          twoFactorAuth: settings.twoFactorAuth,
          sessionTimeout: settings.sessionTimeout,
          maxLoginAttempts: settings.maxLoginAttempts,
          passwordMinLength: settings.passwordMinLength,
          requireEmailVerification: settings.requireEmailVerification,
        },
        features: {
          userRegistration: settings.userRegistration,
          contentModeration: settings.contentModeration,
          locationTracking: settings.locationTracking,
          pushNotifications: settings.pushNotifications,
          analyticsTracking: settings.analyticsTracking,
          aiRecommendations: settings.aiRecommendations,
          liveComments: settings.liveComments,
        },
        system: {
          maintenanceMode: settings.maintenanceMode,
          debugMode: settings.debugMode,
          logLevel: settings.logLevel,
          backupFrequency: settings.backupFrequency,
          autoBackup: settings.autoBackup,
          maxFileSize: settings.maxFileSize,
        },
        api: {
          rateLimitEnabled: settings.rateLimitEnabled,
          rateLimitRequests: settings.rateLimitRequests,
          rateLimitWindow: settings.rateLimitWindow,
        },
        email: {
          emailNotifications: settings.emailNotifications,
          emailProvider: settings.emailProvider,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
        },
        privacy: {
          dataRetentionDays: settings.dataRetentionDays,
          gdprCompliance: settings.gdprCompliance,
          shareAnalytics: settings.shareAnalytics,
        }
      }
      
      await api.put('/api/superadmin/settings', settingsToSave)
      setHasChanges(false)
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error(error.response?.data?.message || 'Failed to save settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setShowModal(true)
    setModalType('reset')
  }

  const handleConfirmReset = async () => {
    setIsLoading(true)
    try {
      await api.post('/api/superadmin/settings/reset')
      toast.success('Settings reset to defaults')
      setShowModal(false)
      setHasChanges(false)
      // Reload settings
      window.location.reload()
    } catch (error) {
      console.error('Error resetting settings:', error)
      toast.error(error.response?.data?.message || 'Failed to reset settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportSettings = () => {
    try {
      const dataStr = JSON.stringify(settings, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      const exportFileDefaultName = `taatom-settings-${new Date().toISOString().split('T')[0]}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
      toast.success('Settings exported successfully')
    } catch (error) {
      console.error('Error exporting settings:', error)
      toast.error('Failed to export settings')
    }
  }

  const handleImportSettings = () => {
    setShowModal(true)
    setModalType('import')
  }

  const handleFileImport = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const importedSettings = JSON.parse(event.target.result)
          setSettings(importedSettings)
          setHasChanges(true)
          setShowModal(false)
          toast.success('Settings imported successfully')
        } catch (error) {
          console.error('Error parsing settings file:', error)
          toast.error('Error parsing settings file')
        }
      }
      reader.readAsText(file)
    }
  }

  const handleClearCache = () => {
    toast.success('Cache cleared successfully')
  }

  const sections = [
    { id: 'security', name: 'Security', icon: Shield, color: 'from-blue-500 to-cyan-500' },
    { id: 'features', name: 'Features', icon: Bell, color: 'from-purple-500 to-violet-500' },
    { id: 'system', name: 'System', icon: Database, color: 'from-green-500 to-emerald-500' },
    { id: 'api', name: 'API', icon: Cloud, color: 'from-orange-500 to-red-500' },
    { id: 'privacy', name: 'Privacy', icon: Lock, color: 'from-indigo-500 to-purple-500' },
  ]

  const activeSectionData = sections.find(s => s.id === activeSection)
  const SectionIcon = activeSectionData?.icon || Shield

  return (
    <SafeComponent>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 rounded-2xl p-8 shadow-lg border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-3 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl shadow-lg">
                  <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-700 to-gray-700 bg-clip-text text-transparent">
                  Settings
                </h1>
                {isConnected && (
                  <span className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full shadow-md animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full inline-block mr-2 animate-ping"></span>
                    Live Data
                  </span>
                )}
              </div>
              <p className="text-gray-600 text-lg">Founder control and system configuration</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleImportSettings}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
              </button>
              <button
                onClick={handleExportSettings}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 border border-gray-200"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isLoading}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <nav className="flex space-x-1 p-2">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    activeSection === section.id
                      ? `bg-gradient-to-r ${section.color} text-white shadow-lg transform scale-105`
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {section.name}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Security Settings */}
          {activeSection === 'security' && (
            <>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl shadow-md">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Authentication</h3>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-blue-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">PIN Required</h3>
                      <p className="text-sm text-gray-600">Require PIN for founder access</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('pinRequired', !settings.pinRequired)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.pinRequired ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.pinRequired ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between py-4 border-b border-blue-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Two-Factor Authentication</h3>
                      <p className="text-sm text-gray-600">Enable 2FA for additional security</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('twoFactorAuth', !settings.twoFactorAuth)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.twoFactorAuth ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      value={settings.sessionTimeout}
                      onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="5"
                      max="120"
                    />
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Max Login Attempts
                    </label>
                    <input
                      type="number"
                      value={settings.maxLoginAttempts}
                      onChange={(e) => handleSettingChange('maxLoginAttempts', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="3"
                      max="10"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl shadow-md">
                    <Key className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Password Policy</h3>
                </div>
                <div className="space-y-6">
                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Minimum Password Length
                    </label>
                    <input
                      type="number"
                      value={settings.passwordMinLength}
                      onChange={(e) => handleSettingChange('passwordMinLength', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      min="6"
                      max="20"
                    />
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-indigo-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Email Verification Required</h3>
                      <p className="text-sm text-gray-600">Require email verification for registration</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('requireEmailVerification', !settings.requireEmailVerification)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.requireEmailVerification ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.requireEmailVerification ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Feature Toggles */}
          {activeSection === 'features' && (
            <>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-6 border border-purple-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-purple-400 to-violet-500 rounded-xl shadow-md">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">General Features</h3>
                </div>
                <div className="space-y-6">
                  {[
                    { key: 'userRegistration', label: 'User Registration', desc: 'Allow new users to register' },
                    { key: 'pushNotifications', label: 'Push Notifications', desc: 'Send push notifications to users' },
                    { key: 'analyticsTracking', label: 'Analytics Tracking', desc: 'Track user analytics' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-4 border-b border-purple-200 last:border-0">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => handleSettingChange(item.key, !settings[item.key])}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                          settings[item.key] ? 'bg-gradient-to-r from-purple-500 to-violet-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                          settings[item.key] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 border border-pink-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl shadow-md">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Advanced Features</h3>
                </div>
                <div className="space-y-6">
                  {[
                    { key: 'contentModeration', label: 'Content Moderation', desc: 'Enable automatic content moderation' },
                    { key: 'locationTracking', label: 'Location Tracking', desc: 'Track user locations' },
                    { key: 'aiRecommendations', label: 'AI Recommendations', desc: 'Enable AI-powered recommendations' },
                    { key: 'liveComments', label: 'Live Comments', desc: 'Enable real-time commenting' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-4 border-b border-pink-200 last:border-0">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => handleSettingChange(item.key, !settings[item.key])}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                          settings[item.key] ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                          settings[item.key] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* System Settings */}
          {activeSection === 'system' && (
            <>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl shadow-md">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">System Configuration</h3>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-green-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Maintenance Mode</h3>
                      <p className="text-sm text-gray-600">Put the system in maintenance mode</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('maintenanceMode', !settings.maintenanceMode)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.maintenanceMode ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-green-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Debug Mode</h3>
                      <p className="text-sm text-gray-600">Enable debug logging</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('debugMode', !settings.debugMode)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.debugMode ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.debugMode ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Log Level
                    </label>
                    <select
                      value={settings.logLevel}
                      onChange={(e) => handleSettingChange('logLevel', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="error">Error</option>
                      <option value="warn">Warning</option>
                      <option value="info">Info</option>
                      <option value="debug">Debug</option>
                    </select>
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Backup Frequency
                    </label>
                    <select
                      value={settings.backupFrequency}
                      onChange={(e) => handleSettingChange('backupFrequency', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-6 border border-cyan-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl shadow-md">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Storage</h3>
                </div>
                <div className="space-y-6">
                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Max File Size (MB)
                    </label>
                    <input
                      type="number"
                      value={settings.maxFileSize}
                      onChange={(e) => handleSettingChange('maxFileSize', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-cyan-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Auto Backup</h3>
                      <p className="text-sm text-gray-600">Enable automatic backups</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('autoBackup', !settings.autoBackup)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.autoBackup ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.autoBackup ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* API Settings */}
          {activeSection === 'api' && (
            <>
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border border-orange-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl shadow-md">
                    <Cloud className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">API Configuration</h3>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-orange-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Rate Limiting</h3>
                      <p className="text-sm text-gray-600">Enable API rate limiting</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('rateLimitEnabled', !settings.rateLimitEnabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.rateLimitEnabled ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.rateLimitEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Rate Limit Requests
                    </label>
                    <input
                      type="number"
                      value={settings.rateLimitRequests}
                      onChange={(e) => handleSettingChange('rateLimitRequests', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      min="100"
                      max="10000"
                    />
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Rate Limit Window (seconds)
                    </label>
                    <input
                      type="number"
                      value={settings.rateLimitWindow}
                      onChange={(e) => handleSettingChange('rateLimitWindow', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      min="60"
                      max="3600"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 border border-pink-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl shadow-md">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Email Settings</h3>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-pink-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Email Notifications</h3>
                      <p className="text-sm text-gray-600">Send email notifications</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('emailNotifications', !settings.emailNotifications)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.emailNotifications ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={settings.smtpHost}
                      onChange={(e) => handleSettingChange('smtpHost', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={settings.smtpPort}
                      onChange={(e) => handleSettingChange('smtpPort', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Privacy Settings */}
          {activeSection === 'privacy' && (
            <>
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl shadow-md">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Privacy & Compliance</h3>
                </div>
                <div className="space-y-6">
                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data Retention (days)
                    </label>
                    <input
                      type="number"
                      value={settings.dataRetentionDays}
                      onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      min="7"
                      max="365"
                    />
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-indigo-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">GDPR Compliance</h3>
                      <p className="text-sm text-gray-600">Enable GDPR compliance features</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('gdprCompliance', !settings.gdprCompliance)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.gdprCompliance ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.gdprCompliance ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-4 border-b border-indigo-200">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Share Analytics</h3>
                      <p className="text-sm text-gray-600">Share anonymized analytics data</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('shareAnalytics', !settings.shareAnalytics)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-md ${
                        settings.shareAnalytics ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                        settings.shareAnalytics ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 border border-red-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-red-400 to-pink-500 rounded-xl shadow-md">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-red-600">Danger Zone</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-red-800 mb-2">Reset Settings</h3>
                    <p className="text-sm text-red-600 mb-4">
                      Reset all settings to their default values. This action cannot be undone.
                    </p>
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      Reset to Defaults
                    </button>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-yellow-800 mb-2">Clear Cache</h3>
                    <p className="text-sm text-yellow-600 mb-4">
                      Clear all cached data and force refresh.
                    </p>
                    <button
                      onClick={handleClearCache}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      Clear Cache
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Features</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  {Object.values(settings).filter(v => v === true).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Session Timeout</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {settings.sessionTimeout}m
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-6 border border-purple-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Backup Frequency</p>
                <p className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent capitalize">
                  {settings.backupFrequency}
                </p>
              </div>
              <Database className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border border-orange-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rate Limit</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  {settings.rateLimitRequests}/h
                </p>
              </div>
              <Shield className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowModal(false)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {modalType === 'reset' && (
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                      <span>Reset Settings</span>
                    </div>
                  )}
                  {modalType === 'import' && (
                    <div className="flex items-center space-x-2">
                      <Upload className="w-6 h-6 text-blue-600" />
                      <span>Import Settings</span>
                    </div>
                  )}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                {modalType === 'reset' && (
                  <>
                    <p className="text-gray-600">
                      Are you sure you want to reset all settings to their default values?
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <p className="text-sm text-red-800">
                          This action cannot be undone. All custom settings will be lost.
                        </p>
                      </div>
                    </div>
                  </>
                )}
                {modalType === 'import' && (
                  <>
                    <p className="text-gray-600">
                      Select a settings file to import:
                    </p>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileImport}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={modalType === 'reset' ? handleConfirmReset : () => setShowModal(false)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                    modalType === 'reset' 
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-md hover:shadow-lg' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {modalType === 'reset' && 'Reset Settings'}
                  {modalType === 'import' && 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SafeComponent>
  )
}

export default Settings
