import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Plus, Edit, Trash2, Shield, UserCheck, UserX } from 'lucide-react'

const Moderators = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModerator, setSelectedModerator] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newModerator, setNewModerator] = useState({
    name: '',
    email: '',
    role: 'moderator',
    permissions: []
  })

  // Dummy data
  const moderators = [
    {
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@taatom.com',
      role: 'senior_moderator',
      status: 'active',
      joinDate: '2024-01-15',
      lastActive: '2024-10-15T10:30:00Z',
      reportsHandled: 156,
      permissions: ['content_moderation', 'user_management', 'report_review'],
    },
    {
      id: 2,
      name: 'Bob Smith',
      email: 'bob@taatom.com',
      role: 'moderator',
      status: 'active',
      joinDate: '2024-02-20',
      lastActive: '2024-10-15T09:15:00Z',
      reportsHandled: 89,
      permissions: ['content_moderation', 'report_review'],
    },
    {
      id: 3,
      name: 'Carol Davis',
      email: 'carol@taatom.com',
      role: 'moderator',
      status: 'inactive',
      joinDate: '2024-03-10',
      lastActive: '2024-10-10T14:20:00Z',
      reportsHandled: 45,
      permissions: ['content_moderation'],
    },
  ]

  const filteredModerators = moderators.filter(moderator =>
    moderator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    moderator.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleModeratorAction = (moderator, action) => {
    setSelectedModerator({ ...moderator, action })
    setShowModal(true)
  }

  const handleCreateModerator = () => {
    console.log('Creating moderator:', newModerator)
    setShowCreateModal(false)
    setNewModerator({ name: '', email: '', role: 'moderator', permissions: [] })
  }

  const handleConfirmAction = () => {
    console.log(`Performing ${selectedModerator.action} on moderator ${selectedModerator.id}`)
    setShowModal(false)
    setSelectedModerator(null)
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'senior_moderator': return 'text-purple-600 bg-purple-100'
      case 'moderator': return 'text-blue-600 bg-blue-100'
      case 'junior_moderator': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const permissions = [
    { id: 'content_moderation', label: 'Content Moderation' },
    { id: 'user_management', label: 'User Management' },
    { id: 'report_review', label: 'Report Review' },
    { id: 'analytics_access', label: 'Analytics Access' },
    { id: 'system_settings', label: 'System Settings' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Moderators</h1>
          <p className="text-gray-600 mt-2">Assign or revoke admin roles</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Moderator
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Moderators</p>
                <p className="text-2xl font-bold text-gray-900">{moderators.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Moderators</p>
                <p className="text-2xl font-bold text-gray-900">
                  {moderators.filter(m => m.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Senior Moderators</p>
                <p className="text-2xl font-bold text-gray-900">
                  {moderators.filter(m => m.role === 'senior_moderator').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <UserX className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Reports Handled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {moderators.reduce((sum, m) => sum + m.reportsHandled, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search moderators..."
              className="input pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Moderators Table */}
      <Card>
        <CardHeader>
          <CardTitle>Moderators ({filteredModerators.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Moderator</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reports Handled</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModerators.map((moderator) => (
                <TableRow key={moderator.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {moderator.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{moderator.name}</div>
                        <div className="text-sm text-gray-500">{moderator.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(moderator.role)}`}>
                      {moderator.role.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(moderator.status)}`}>
                      {moderator.status}
                    </span>
                  </TableCell>
                  <TableCell>{moderator.reportsHandled}</TableCell>
                  <TableCell>{formatDate(moderator.lastActive)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleModeratorAction(moderator, 'view')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="View Details"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleModeratorAction(moderator, 'edit')}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Edit Moderator"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleModeratorAction(moderator, 'remove')}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Remove Moderator"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Moderator Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader onClose={() => setShowCreateModal(false)}>
          Add New Moderator
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                className="input w-full"
                value={newModerator.name}
                onChange={(e) => setNewModerator({ ...newModerator, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                className="input w-full"
                value={newModerator.email}
                onChange={(e) => setNewModerator({ ...newModerator, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                className="input w-full"
                value={newModerator.role}
                onChange={(e) => setNewModerator({ ...newModerator, role: e.target.value })}
              >
                <option value="moderator">Moderator</option>
                <option value="senior_moderator">Senior Moderator</option>
                <option value="junior_moderator">Junior Moderator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permissions
              </label>
              <div className="space-y-2">
                {permissions.map((permission) => (
                  <label key={permission.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newModerator.permissions.includes(permission.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewModerator({
                            ...newModerator,
                            permissions: [...newModerator.permissions, permission.id]
                          })
                        } else {
                          setNewModerator({
                            ...newModerator,
                            permissions: newModerator.permissions.filter(p => p !== permission.id)
                          })
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{permission.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowCreateModal(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateModerator}
            className="btn btn-primary"
          >
            Add Moderator
          </button>
        </ModalFooter>
      </Modal>

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedModerator?.action === 'view' && 'Moderator Details'}
          {selectedModerator?.action === 'edit' && 'Edit Moderator'}
          {selectedModerator?.action === 'remove' && 'Remove Moderator'}
        </ModalHeader>
        <ModalContent>
          {selectedModerator?.action === 'view' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">
                    {selectedModerator.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedModerator.name}</h3>
                  <p className="text-gray-600">{selectedModerator.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <p className="text-sm text-gray-900 capitalize">
                    {selectedModerator.role.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="text-sm text-gray-900 capitalize">{selectedModerator.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reports Handled</label>
                  <p className="text-sm text-gray-900">{selectedModerator.reportsHandled}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Join Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedModerator.joinDate)}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Permissions</label>
                <div className="mt-2 space-y-1">
                  {selectedModerator.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs mr-2"
                    >
                      {permission.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {(selectedModerator?.action === 'edit' || selectedModerator?.action === 'remove') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to {selectedModerator.action} {selectedModerator.name}?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  {selectedModerator.action === 'remove' 
                    ? 'This will revoke all moderator privileges and remove access to the admin panel.'
                    : 'This will allow you to modify the moderator\'s role and permissions.'
                  }
                </p>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <button
            onClick={() => setShowModal(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAction}
            className={`btn ${selectedModerator?.action === 'remove' ? 'btn-destructive' : 'btn-primary'}`}
          >
            {selectedModerator?.action === 'view' && 'Close'}
            {selectedModerator?.action === 'edit' && 'Save Changes'}
            {selectedModerator?.action === 'remove' && 'Remove Moderator'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Moderators
