import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RealTimeProvider } from './context/RealTimeContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import TravelContent from './pages/TravelContent'
import Reports from './pages/Reports'
import Moderators from './pages/Moderators'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import FeatureFlags from './pages/FeatureFlags'
import Profile from './pages/Profile'
import TestPage from './pages/TestPage'
import { Toaster } from 'react-hot-toast'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RealTimeProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/travel-content" element={<TravelContent />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/moderators" element={<Moderators />} />
                      <Route path="/logs" element={<Logs />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/feature-flags" element={<FeatureFlags />} />
                      <Route path="/test" element={<TestPage />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </RealTimeProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App