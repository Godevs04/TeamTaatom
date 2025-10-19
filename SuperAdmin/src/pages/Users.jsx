import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, Ban, CheckCircle, Eye, Edit } from 'lucide-react'

const Users = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')

  // Dummy data
  const users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      joinDate: '2024-01-15',
      posts: 23,
      followers: 156,
      location: 'New York, USA',
      lastActive: '2024-10-15T10:30:00Z',
    },
    {
      id: 2,
      name: 'Sarah Wilson',
      email: 'sarah@example.com',
      status: 'active',
      joinDate: '2024-02-20',
      posts: 45,
      followers: 234,
      location: 'London, UK',
      lastActive: '2024-10-15T09:15:00Z',
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike@example.com',
      status: 'banned',
      joinDate: '2024-03-10',
      posts: 12,
      followers: 89,
      location: 'Tokyo, Japan',
      lastActive: '2024-10-10T14:20:00Z',
    },
    {
      id: 4,
      name: 'Emma Brown',
      email: 'emma@example.com',
      status: 'pending',
      joinDate: '2024-10-14',
      posts: 0,
      followers: 0,
      location: 'Paris, France',
      lastActive: '2024-10-14T16:45:00Z',
    },
  ]

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const handleUserAction = (user, action) => {
    setSelectedUser({ ...user, action })
    setShowModal(true)
  }

  const handleConfirmAction = () => {
    // Handle the action here
    console.log(`Performing ${selectedUser.action} on user ${selectedUser.id}`)
    setShowModal(false)
    setSelectedUser(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-600 mt-2">Manage travelers and moderators</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-primary">
            Export Users
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                className="input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="banned">Banned</option>
              </select>
              <button className="btn btn-secondary">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead>Followers</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell>{user.posts}</TableCell>
                  <TableCell>{user.followers}</TableCell>
                  <TableCell>{user.location}</TableCell>
                  <TableCell>{formatDate(user.lastActive)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUserAction(user, 'view')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUserAction(user, 'edit')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {user.status === 'active' ? (
                        <button
                          onClick={() => handleUserAction(user, 'ban')}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Ban User"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUserAction(user, 'unban')}
                          className="p-1 text-gray-400 hover:text-green-600"
                          title="Unban User"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedUser?.action === 'view' && 'User Details'}
          {selectedUser?.action === 'edit' && 'Edit User'}
          {selectedUser?.action === 'ban' && 'Ban User'}
          {selectedUser?.action === 'unban' && 'Unban User'}
        </ModalHeader>
        <ModalContent>
          {selectedUser?.action === 'view' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.name}</h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="text-sm text-gray-900">{selectedUser.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Join Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedUser.joinDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Posts</label>
                  <p className="text-sm text-gray-900">{selectedUser.posts}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Followers</label>
                  <p className="text-sm text-gray-900">{selectedUser.followers}</p>
                </div>
              </div>
            </div>
          )}
          {(selectedUser?.action === 'ban' || selectedUser?.action === 'unban') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to {selectedUser.action} {selectedUser.name}?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  This action will {selectedUser.action === 'ban' ? 'restrict' : 'restore'} the user's access to the platform.
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
            className={`btn ${selectedUser?.action === 'ban' ? 'btn-destructive' : 'btn-primary'}`}
          >
            {selectedUser?.action === 'view' && 'Close'}
            {selectedUser?.action === 'edit' && 'Save Changes'}
            {selectedUser?.action === 'ban' && 'Ban User'}
            {selectedUser?.action === 'unban' && 'Unban User'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Users
