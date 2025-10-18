import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Tables/index.jsx'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../components/Modals/index.jsx'
import { formatDate, getStatusColor } from '../utils/formatDate'
import { Search, Filter, MoreHorizontal, Trash2, Eye, Flag, MapPin } from 'lucide-react'

const TravelContent = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContent, setSelectedContent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState('all')

  // Dummy data
  const content = [
    {
      id: 1,
      type: 'photo',
      title: 'Beautiful sunset in Santorini',
      author: 'John Doe',
      location: 'Santorini, Greece',
      likes: 234,
      comments: 45,
      status: 'approved',
      createdAt: '2024-10-15T10:30:00Z',
      imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400',
    },
    {
      id: 2,
      type: 'video',
      title: 'Tokyo street food adventure',
      author: 'Sarah Wilson',
      location: 'Tokyo, Japan',
      likes: 567,
      comments: 89,
      status: 'pending',
      createdAt: '2024-10-14T15:20:00Z',
      imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400',
    },
    {
      id: 3,
      type: 'photo',
      title: 'Mountain hiking trail',
      author: 'Mike Johnson',
      location: 'Swiss Alps, Switzerland',
      likes: 123,
      comments: 23,
      status: 'flagged',
      createdAt: '2024-10-13T09:15:00Z',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    },
    {
      id: 4,
      type: 'short',
      title: 'Quick tour of Barcelona',
      author: 'Emma Brown',
      location: 'Barcelona, Spain',
      likes: 789,
      comments: 156,
      status: 'approved',
      createdAt: '2024-10-12T14:45:00Z',
      imageUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400',
    },
  ]

  const filteredContent = content.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || item.type === filterType
    return matchesSearch && matchesType
  })

  const handleContentAction = (item, action) => {
    setSelectedContent({ ...item, action })
    setShowModal(true)
  }

  const handleConfirmAction = () => {
    console.log(`Performing ${selectedContent.action} on content ${selectedContent.id}`)
    setShowModal(false)
    setSelectedContent(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Travel Content</h1>
          <p className="text-gray-600 mt-2">Manage travel posts and destinations</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-primary">
            Bulk Actions
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
                  placeholder="Search content..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                className="input"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="photo">Photos</option>
                <option value="video">Videos</option>
                <option value="short">Shorts</option>
              </select>
              <button className="btn btn-secondary">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContent.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="relative">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 left-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <div className="absolute top-2 right-2">
                <span className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  {item.type}
                </span>
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-lg mb-2 line-clamp-2">{item.title}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">By:</span>
                  <span>{item.author}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>{item.location}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{item.likes} likes</span>
                  <span>{item.comments} comments</span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(item.createdAt)}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleContentAction(item, 'view')}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {item.status === 'flagged' && (
                    <button
                      onClick={() => handleContentAction(item, 'review')}
                      className="p-1 text-gray-400 hover:text-yellow-600"
                      title="Review Flag"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleContentAction(item, 'delete')}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete Content"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader onClose={() => setShowModal(false)}>
          {selectedContent?.action === 'view' && 'Content Details'}
          {selectedContent?.action === 'review' && 'Review Flagged Content'}
          {selectedContent?.action === 'delete' && 'Delete Content'}
        </ModalHeader>
        <ModalContent>
          {selectedContent?.action === 'view' && (
            <div className="space-y-4">
              <img
                src={selectedContent.imageUrl}
                alt={selectedContent.title}
                className="w-full h-48 object-cover rounded-lg"
              />
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedContent.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="font-medium text-gray-700">Author</label>
                    <p className="text-gray-900">{selectedContent.author}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Location</label>
                    <p className="text-gray-900">{selectedContent.location}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Type</label>
                    <p className="text-gray-900 capitalize">{selectedContent.type}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Status</label>
                    <p className="text-gray-900 capitalize">{selectedContent.status}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Likes</label>
                    <p className="text-gray-900">{selectedContent.likes}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Comments</label>
                    <p className="text-gray-900">{selectedContent.comments}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {(selectedContent?.action === 'review' || selectedContent?.action === 'delete') && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to {selectedContent.action} this content?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  {selectedContent.action === 'delete' 
                    ? 'This action cannot be undone. The content will be permanently removed.'
                    : 'Please review the flagged content and take appropriate action.'
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
            className={`btn ${selectedContent?.action === 'delete' ? 'btn-destructive' : 'btn-primary'}`}
          >
            {selectedContent?.action === 'view' && 'Close'}
            {selectedContent?.action === 'review' && 'Review'}
            {selectedContent?.action === 'delete' && 'Delete'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default TravelContent
