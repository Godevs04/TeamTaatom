import React from 'react'

const SafeComponent = ({ children, fallback = null }) => {
  try {
    return children
  } catch (error) {
    console.error('SafeComponent caught an error:', error)
    return fallback || (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-gray-600">Component failed to load</p>
        </div>
      </div>
    )
  }
}

export default SafeComponent
