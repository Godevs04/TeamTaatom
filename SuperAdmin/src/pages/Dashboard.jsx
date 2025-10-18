import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/Cards/index.jsx'
import StatCard from '../components/Cards/StatCard'
import { LineChartComponent, AreaChartComponent } from '../components/Charts/index.jsx'
import { Users, MapPin, Flag, TrendingUp, Eye, Heart, MessageCircle } from 'lucide-react'

const Dashboard = () => {
  // Dummy data for demonstration
  const stats = [
    {
      title: 'Total Users',
      value: 12543,
      change: '+12.5%',
      trend: 'up',
      icon: Users,
    },
    {
      title: 'Travel Posts',
      value: 8942,
      change: '+8.2%',
      trend: 'up',
      icon: MapPin,
    },
    {
      title: 'Active Reports',
      value: 23,
      change: '-15.3%',
      trend: 'down',
      icon: Flag,
    },
    {
      title: 'Growth Rate',
      value: 18.7,
      change: '+2.1%',
      trend: 'up',
      icon: TrendingUp,
    },
  ]

  const userGrowthData = [
    { name: 'Jan', users: 4000, posts: 2400 },
    { name: 'Feb', users: 3000, posts: 1398 },
    { name: 'Mar', users: 2000, posts: 9800 },
    { name: 'Apr', users: 2780, posts: 3908 },
    { name: 'May', users: 1890, posts: 4800 },
    { name: 'Jun', users: 2390, posts: 3800 },
    { name: 'Jul', users: 3490, posts: 4300 },
  ]

  const engagementData = [
    { name: 'Mon', views: 4000, likes: 2400, comments: 1400 },
    { name: 'Tue', views: 3000, likes: 1398, comments: 980 },
    { name: 'Wed', views: 2000, likes: 9800, comments: 3908 },
    { name: 'Thu', views: 2780, likes: 3908, comments: 4800 },
    { name: 'Fri', views: 1890, likes: 4800, comments: 3800 },
    { name: 'Sat', views: 2390, likes: 3800, comments: 4300 },
    { name: 'Sun', views: 3490, likes: 4300, comments: 2100 },
  ]

  const recentActivity = [
    { id: 1, user: 'John Doe', action: 'created a travel post', location: 'Paris, France', time: '2 minutes ago' },
    { id: 2, user: 'Sarah Wilson', action: 'reported inappropriate content', location: 'Tokyo, Japan', time: '5 minutes ago' },
    { id: 3, user: 'Mike Johnson', action: 'joined the platform', location: 'New York, USA', time: '10 minutes ago' },
    { id: 4, user: 'Emma Brown', action: 'shared travel route', location: 'Barcelona, Spain', time: '15 minutes ago' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">Monitor your TeamTaatom platform performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            change={stat.change}
            trend={stat.trend}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth & Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartComponent data={userGrowthData} dataKey="users" name="Users" />
          </CardContent>
        </Card>

        {/* Engagement Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChartComponent data={engagementData} dataKey="views" name="Views" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {activity.user.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.user} {activity.action}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.location} • {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Eye className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium">View Reports</span>
              </button>
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Users className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium">Manage Users</span>
              </button>
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <MapPin className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium">Review Content</span>
              </button>
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Flag className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium">Handle Reports</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Health */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">99.9%</div>
              <div className="text-sm text-gray-600">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">245ms</div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">1.2GB</div>
              <div className="text-sm text-gray-600">Storage Used</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
