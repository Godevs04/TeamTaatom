import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import { LineChartComponent, AreaChartComponent, BarChartComponent, PieChartComponent } from '../components/Charts/index.jsx'
import { Calendar, Download, Filter } from 'lucide-react'

const Analytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [selectedChart, setSelectedChart] = useState('users')

  // Dummy data
  const userGrowthData = [
    { name: 'Jan', users: 4000, posts: 2400, engagement: 65 },
    { name: 'Feb', users: 3000, posts: 1398, engagement: 72 },
    { name: 'Mar', users: 2000, posts: 9800, engagement: 68 },
    { name: 'Apr', users: 2780, posts: 3908, engagement: 75 },
    { name: 'May', users: 1890, posts: 4800, engagement: 70 },
    { name: 'Jun', users: 2390, posts: 3800, engagement: 78 },
    { name: 'Jul', users: 3490, posts: 4300, engagement: 82 },
  ]

  const engagementData = [
    { name: 'Mon', views: 4000, likes: 2400, comments: 1400, shares: 800 },
    { name: 'Tue', views: 3000, likes: 1398, comments: 980, shares: 600 },
    { name: 'Wed', views: 2000, likes: 9800, comments: 3908, shares: 1200 },
    { name: 'Thu', views: 2780, likes: 3908, comments: 4800, shares: 900 },
    { name: 'Fri', views: 1890, likes: 4800, comments: 3800, shares: 1100 },
    { name: 'Sat', views: 2390, likes: 3800, comments: 4300, shares: 1000 },
    { name: 'Sun', views: 3490, likes: 4300, comments: 2100, shares: 1300 },
  ]

  const locationData = [
    { name: 'Europe', users: 4000, posts: 12000 },
    { name: 'Asia', users: 3000, posts: 8000 },
    { name: 'North America', users: 2500, posts: 6000 },
    { name: 'South America', users: 1500, posts: 4000 },
    { name: 'Africa', users: 1000, posts: 2000 },
    { name: 'Oceania', users: 500, posts: 1000 },
  ]

  const contentTypeData = [
    { name: 'Photos', value: 45, count: 4500 },
    { name: 'Videos', value: 30, count: 3000 },
    { name: 'Shorts', value: 20, count: 2000 },
    { name: 'Text Posts', value: 5, count: 500 },
  ]

  const deviceData = [
    { name: 'iOS', value: 60, users: 6000 },
    { name: 'Android', value: 35, users: 3500 },
    { name: 'Web', value: 5, users: 500 },
  ]

  const retentionData = [
    { day: 'Day 1', retention: 100 },
    { day: 'Day 7', retention: 65 },
    { day: 'Day 14', retention: 45 },
    { day: 'Day 30', retention: 30 },
    { day: 'Day 60', retention: 20 },
    { day: 'Day 90', retention: 15 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">Charts for usage, trends, and growth</p>
        </div>
        <div className="flex space-x-3">
          <select
            className="input"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button className="btn btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">12,543</p>
                <p className="text-xs text-green-600">+12.5% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">8,942</p>
                <p className="text-xs text-green-600">+8.2% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">45,231</p>
                <p className="text-xs text-green-600">+15.3% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-bold text-gray-900">78.5%</p>
                <p className="text-xs text-green-600">+2.1% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedChart('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'users'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              User Growth
            </button>
            <button
              onClick={() => setSelectedChart('engagement')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'engagement'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Engagement
            </button>
            <button
              onClick={() => setSelectedChart('locations')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'locations'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Locations
            </button>
            <button
              onClick={() => setSelectedChart('content')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChart === 'content'
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Content Types
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedChart === 'users' && 'User Growth & Posts'}
            {selectedChart === 'engagement' && 'Daily Engagement Metrics'}
            {selectedChart === 'locations' && 'Users by Region'}
            {selectedChart === 'content' && 'Content Type Distribution'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedChart === 'users' && (
            <LineChartComponent data={userGrowthData} dataKey="users" name="Users" />
          )}
          {selectedChart === 'engagement' && (
            <AreaChartComponent data={engagementData} dataKey="views" name="Views" />
          )}
          {selectedChart === 'locations' && (
            <BarChartComponent data={locationData} dataKey="users" name="Users" />
          )}
          {selectedChart === 'content' && (
            <PieChartComponent data={contentTypeData} dataKey="value" nameKey="name" />
          )}
        </CardContent>
      </Card>

      {/* Additional Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Device Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChartComponent data={deviceData} dataKey="value" nameKey="name" />
          </CardContent>
        </Card>

        {/* User Retention */}
        <Card>
          <CardHeader>
            <CardTitle>User Retention</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartComponent data={retentionData} dataKey="retention" name="Retention %" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Top Travel Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {locationData.slice(0, 5).map((location, index) => (
                <div key={location.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium">{location.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{location.users.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{location.posts.toLocaleString()} posts</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Content Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentTypeData.map((content, index) => (
                <div key={content.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{content.name}</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{content.value}%</div>
                    <div className="text-xs text-gray-500">{content.count.toLocaleString()} posts</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Likes per Post</span>
                <span className="text-sm font-bold">156</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Comments per Post</span>
                <span className="text-sm font-bold">23</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Shares per Post</span>
                <span className="text-sm font-bold">8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Peak Activity Time</span>
                <span className="text-sm font-bold">7-9 PM</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Analytics
