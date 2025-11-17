import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '../components/Cards/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { 
  Calendar, AlertCircle, CheckCircle, Clock, Send, 
  Mail, Trash2, X, CheckSquare
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import SafeComponent from '../components/SafeComponent'

const ScheduledDowntime = () => {
  const [downtimes, setDowntimes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedDowntime, setSelectedDowntime] = useState(null)
  const [schedule, setSchedule] = useState({
    reason: '',
    scheduledDate: '',
    scheduledTime: '',
    duration: 30
  })

  const fetchDowntimes = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/superadmin/scheduled-downtimes')
      if (response.data.success) {
        setDowntimes(response.data.downtimes)
      }
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      logger.error('Failed to fetch downtimes:', error)
      toast.error('Failed to fetch scheduled downtimes')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDowntimes()
  }, [])

  const handleScheduleDowntime = async () => {
    if (!schedule.reason || !schedule.scheduledDate || !schedule.scheduledTime || !schedule.duration) {
      toast.error('Please fill all fields')
      return
    }

    setIsLoading(true)
    try {
      await api.post('/api/superadmin/schedule-downtime', schedule)
      toast.success('Downtime scheduled and notifications sent to all users')
      setShowModal(false)
      setSchedule({ reason: '', scheduledDate: '', scheduledTime: '', duration: 30 })
      await fetchDowntimes()
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      const { parseError } = await import('../utils/errorCodes')
      const parsedError = parseError(error)
      logger.error('Failed to schedule downtime:', parsedError.code, parsedError.message)
      toast.error(error.response?.data?.message || 'Failed to schedule downtime')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteDowntime = async (downtimeId) => {
    if (!window.confirm('Mark this downtime as complete and notify all users?')) {
      return
    }

    setIsLoading(true)
    try {
      await api.post(`/api/superadmin/complete-downtime/${downtimeId}`)
      toast.success('Maintenance completion emails sent to all users')
      await fetchDowntimes()
    } catch (error) {
      const logger = (await import('../utils/logger')).default
      const { parseError } = await import('../utils/errorCodes')
      const parsedError = parseError(error)
      logger.error('Failed to complete downtime:', parsedError.code, parsedError.message)
      toast.error('Failed to complete downtime')
    } finally {
      setIsLoading(false)
    }
  }

  const pendingCount = downtimes.filter(d => !d.completed && !d.notificationSent).length
  const sentCount = downtimes.filter(d => !d.completed && d.notificationSent).length
  const completedCount = downtimes.filter(d => d.completed).length

  return (
    <SafeComponent>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 via-red-50 to-pink-50 rounded-2xl p-8 shadow-lg border border-orange-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Scheduled Downtime
                </h2>
              </div>
              <p className="text-gray-600 text-lg">Manage system maintenance schedules</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule New Downtime</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 border border-yellow-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl shadow-md">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Notifications</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">{pendingCount}</p>
                </div>
              </div>
              <div className="text-3xl animate-pulse">⏰</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl shadow-md">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Notifications Sent</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{sentCount}</p>
                </div>
              </div>
              <div className="text-3xl animate-bounce">📧</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl shadow-md">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{completedCount}</p>
                </div>
              </div>
              <div className="text-3xl animate-pulse">✓</div>
            </div>
          </div>
        </div>

        {/* Downtimes List */}
        {isLoading && !downtimes.length ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : downtimes.length === 0 ? (
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-16 border border-gray-200 shadow-lg text-center">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-gradient-to-br from-gray-400 to-slate-500 rounded-2xl shadow-lg mb-6">
                <Calendar className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-700 to-slate-700 bg-clip-text text-transparent mb-3">
                No Scheduled Downtimes
              </h3>
              <p className="text-gray-600 text-lg mb-6">Schedule your first maintenance window</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
              >
                <Calendar className="w-5 h-5" />
                <span>Create Your First Schedule</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {downtimes.map((downtime) => (
              <div 
                key={downtime._id} 
                className={`group rounded-2xl p-6 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 ${
                  downtime.completed 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 opacity-75' 
                    : 'bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className={`p-3 rounded-xl shadow-md ${
                        downtime.completed 
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                          : 'bg-gradient-to-br from-orange-400 to-red-500'
                      }`}>
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold ${downtime.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {downtime.reason}
                        </h3>
                        {downtime.completed && (
                          <span className="inline-block px-3 py-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-semibold rounded-full mt-2 shadow-md">
                            ✓ Completed
                          </span>
                        )}
                      </div>
                    </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-600">Scheduled Date</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(downtime.scheduledDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Time</p>
                          <p className="text-sm font-medium text-gray-900">{downtime.scheduledTime}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Duration</p>
                          <p className="text-sm font-medium text-gray-900">{downtime.duration} minutes</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Status</p>
                          <div className="flex items-center space-x-1">
                            {downtime.notificationSent ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-yellow-600" />
                            )}
                            <span className="text-xs text-gray-600">
                              {downtime.notificationSent ? 'Sent' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Scheduled {new Date(downtime.createdAt).toLocaleString()}</span>
                        </div>
                        {downtime.completed && (
                          <div className="flex items-center space-x-1">
                            <CheckSquare className="w-3 h-3" />
                            <span>Completed {new Date(downtime.updatedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!downtime.completed && (
                      <button
                        onClick={() => handleCompleteDowntime(downtime._id)}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2"
                        title="Mark as Complete"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Mark Complete</span>
                      </button>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}

        {/* Schedule Modal */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
          <ModalHeader onClose={() => setShowModal(false)}>
            Schedule System Downtime
          </ModalHeader>
          <ModalContent>
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-orange-600 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-900">Important Notice</h4>
                    <p className="text-sm text-orange-700">
                      Emails will be sent to ALL users automatically once scheduled. Please ensure all details are correct.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Maintenance <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input w-full"
                  rows="3"
                  placeholder="Enter the reason for scheduled maintenance (e.g., System upgrade, Security patch, etc.)"
                  value={schedule.reason}
                  onChange={(e) => setSchedule({ ...schedule, reason: e.target.value })}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {schedule.reason.length}/500 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scheduled Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="input w-full"
                  value={schedule.scheduledDate}
                  onChange={(e) => setSchedule({ ...schedule, scheduledDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scheduled Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  className="input w-full"
                  value={schedule.scheduledTime}
                  onChange={(e) => setSchedule({ ...schedule, scheduledTime: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="input w-full"
                  min="1"
                  max="1440"
                  value={schedule.duration}
                  onChange={(e) => setSchedule({ ...schedule, duration: parseInt(e.target.value) })}
                  placeholder="e.g., 30"
                />
                <p className="text-xs text-gray-500 mt-1">Duration in minutes (1-1440)</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> {schedule.reason && `"${schedule.reason}"`}<br />
                  {schedule.scheduledDate && `Scheduled for ${new Date(schedule.scheduledDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}`}
                  {schedule.scheduledTime && ` at ${schedule.scheduledTime}`}
                  {schedule.duration && ` for ${schedule.duration} minutes`}
                </p>
              </div>
            </div>
          </ModalContent>
          <ModalFooter>
            <button
              onClick={() => {
                setShowModal(false)
                setSchedule({ reason: '', scheduledDate: '', scheduledTime: '', duration: 30 })
              }}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleScheduleDowntime}
              disabled={isLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>Schedule & Send Notifications</span>
            </button>
          </ModalFooter>
        </Modal>
      </div>
    </SafeComponent>
  )
}

export default ScheduledDowntime

