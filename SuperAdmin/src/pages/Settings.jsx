import { useState, useEffect } from 'react'
import { useRealTime } from '../context/RealTimeContext'

const Settings = () => {
  const [settings, setSettings] = useState({
    // Security Settings
    pinRequired: true,
    twoFactorAuth: false,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    
    // Feature Toggles
    userRegistration: true,
    contentModeration: true,
    locationTracking: true,
    pushNotifications: true,
    analyticsTracking: true,
    
    // System Settings
    maintenanceMode: false,
    debugMode: false,
    logLevel: 'info',
    backupFrequency: 'daily',
    
    // API Settings
    rateLimitEnabled: true,
    rateLimitRequests: 1000,
    rateLimitWindow: 3600,
    
    // Email Settings
    emailNotifications: true,
    emailProvider: 'smtp',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
  })

  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(true)

  const { api } = useRealTime()

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // For now, we'll use a mock API call since system settings endpoints don't exist yet
        // In a real implementation, this would be: await api.get('/api/superadmin/settings')
        console.log('Fetching system settings...')
        // Mock response - in real implementation, this would come from the API
        const mockSettings = {
          pinRequired: true,
          twoFactorAuth: false,
          sessionTimeout: 30,
          maxLoginAttempts: 5,
          userRegistration: true,
          contentModeration: true,
          locationTracking: true,
          pushNotifications: true,
          analyticsTracking: true,
          maintenanceMode: false,
          debugMode: false,
          logLevel: 'info',
          backupFrequency: 'daily',
          rateLimitEnabled: true,
          rateLimitRequests: 1000,
          rateLimitWindow: 3600,
          emailNotifications: true,
          emailProvider: 'smtp',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
        }
        setSettings(mockSettings)
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      }
    }

    fetchSettings()
  }, [])

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // For now, we'll use a mock API call since system settings endpoints don't exist yet
      // In a real implementation, this would be: await api.put('/api/superadmin/settings', { settings })
      console.log('Saving settings:', settings)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setHasChanges(false)
      // In a real implementation, you would show a success toast here
      console.log('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      // In a real implementation, you would show an error toast here
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setShowModal(true)
    setModalType('reset')
  }

  const handleConfirmReset = () => {
    console.log('Resetting settings to defaults')
    setShowModal(false)
    setHasChanges(false)
  }

  const handleExportSettings = () => {
    try {
      const dataStr = JSON.stringify(settings, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      const exportFileDefaultName = 'taatom-settings.json'
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
    } catch (error) {
      console.error('Error exporting settings:', error)
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
        } catch (error) {
          console.error('Error parsing settings file:', error)
          alert('Error parsing settings file. Please check the file format.')
        }
      }
      reader.onerror = () => {
        console.error('Error reading file')
        alert('Error reading file. Please try again.')
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            {isConnected && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Live Data
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-2">Founder control and system configuration</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleImportSettings}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-gray-200 text-gray-900 hover:bg-gray-300 h-10 py-2 px-4"
          >
            Import Settings
          </button>
          <button
            onClick={handleExportSettings}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-gray-200 text-gray-900 hover:bg-gray-300 h-10 py-2 px-4"
          >
            Export Settings
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Settings */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">PIN Required</h3>
                  <p className="text-sm text-gray-500">Require PIN for founder access</p>
                </div>
                <button
                  onClick={() => handleSettingChange('pinRequired', !settings.pinRequired)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.pinRequired ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.pinRequired ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-500">Enable 2FA for additional security</p>
                </div>
                <button
                  onClick={() => handleSettingChange('twoFactorAuth', !settings.twoFactorAuth)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.twoFactorAuth ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Toggles</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">User Registration</h3>
                  <p className="text-sm text-gray-500">Allow new users to register</p>
                </div>
                <button
                  onClick={() => handleSettingChange('userRegistration', !settings.userRegistration)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.userRegistration ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.userRegistration ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between py-4 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Content Moderation</h3>
                  <p className="text-sm text-gray-500">Enable automatic content moderation</p>
                </div>
                <button
                  onClick={() => handleSettingChange('contentModeration', !settings.contentModeration)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.contentModeration ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.contentModeration ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-red-200 bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-medium text-red-800">Reset Settings</h3>
                <p className="text-sm text-red-600 mt-1">
                  Reset all settings to their default values. This action cannot be undone.
                </p>
                <button
                  onClick={handleReset}
                  className="mt-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-red-600 text-white hover:bg-red-700 h-10 py-2 px-4"
                >
                  Reset to Defaults
                </button>
              </div>
              
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-800">Clear Cache</h3>
                <p className="text-sm text-yellow-600 mt-1">
                  Clear all cached data and force refresh.
                </p>
                <button className="mt-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-gray-200 text-gray-900 hover:bg-gray-300 h-10 py-2 px-4">
                  Clear Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {modalType === 'reset' && 'Reset Settings'}
                {modalType === 'import' && 'Import Settings'}
              </h3>
              
              <div className="space-y-4">
                {modalType === 'reset' && (
                  <>
                    <p className="text-gray-600">
                      Are you sure you want to reset all settings to their default values?
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800">
                        This action cannot be undone. All custom settings will be lost.
                      </p>
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
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={handleFileImport}
                    />
                  </>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-gray-200 text-gray-900 hover:bg-gray-300 h-10 py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  onClick={modalType === 'reset' ? handleConfirmReset : () => setShowModal(false)}
                  className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none h-10 py-2 px-4 ${
                    modalType === 'reset' 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {modalType === 'reset' && 'Reset Settings'}
                  {modalType === 'import' && 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings