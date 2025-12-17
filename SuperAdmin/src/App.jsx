import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RealTimeProvider } from './context/RealTimeContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { Toaster } from 'react-hot-toast'

// Lazy load pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analytics = lazy(() => import('./pages/Analytics'))
const QueryMonitor = lazy(() => import('./pages/QueryMonitor'))
const Users = lazy(() => import('./pages/Users'))
const TravelContent = lazy(() => import('./pages/TravelContent'))
const Reports = lazy(() => import('./pages/Reports'))
const Moderators = lazy(() => import('./pages/Moderators'))
const Logs = lazy(() => import('./pages/Logs'))
const Settings = lazy(() => import('./pages/Settings'))
const FeatureFlags = lazy(() => import('./pages/FeatureFlags'))
const Profile = lazy(() => import('./pages/Profile'))
const TestPage = lazy(() => import('./pages/TestPage'))
const Songs = lazy(() => import('./pages/Songs'))
const Locales = lazy(() => import('./pages/Locales'))
const TripScoreAnalytics = lazy(() => import('./pages/TripScoreAnalytics'))
const System = lazy(() => import('./pages/System'))

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
)

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
            <Route 
              path="/login" 
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Login />
                </Suspense>
              } 
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/query-monitor" element={<QueryMonitor />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/travel-content" element={<TravelContent />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/moderators" element={<Moderators />} />
                        <Route path="/logs" element={<Logs />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/feature-flags" element={<FeatureFlags />} />
                        <Route path="/songs" element={<Songs />} />
                        <Route path="/locales" element={<Locales />} />
                        <Route path="/tripscore-analytics" element={<TripScoreAnalytics />} />
                        <Route path="/system" element={<System />} />
                        <Route path="/test" element={<TestPage />} />
                      </Routes>
                    </Suspense>
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