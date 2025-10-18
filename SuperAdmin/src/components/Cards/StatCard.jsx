import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './index'

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const StatCard = ({ title, value, change, icon: Icon, trend }) => {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600'
    if (trend === 'down') return 'text-red-600'
    return 'text-gray-600'
  }

  const getTrendIcon = () => {
    if (trend === 'up') return '↗'
    if (trend === 'down') return '↘'
    return '→'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-gray-600" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatNumber(value)}</div>
        {change && (
          <p className={`text-xs ${getTrendColor()}`}>
            <span className="mr-1">{getTrendIcon()}</span>
            {change} from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default StatCard
