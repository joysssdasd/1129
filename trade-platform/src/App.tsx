import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './contexts/UserContext'
import LoginPage from './components/pages/LoginPage'
import HomePage from './components/pages/HomePage'
import PostDetailPage from './components/pages/PostDetailPage'
import PublishPage from './components/pages/PublishPage'
import ProfilePage from './components/pages/ProfilePage'
import AdminPage from './components/pages/AdminPage'
import './App.css'

// 🔐 老王我移除了EnvDebug组件，生产环境不需要调试工具
// 开发环境如需调试，可以通过浏览器开发者工具查看

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  return user ? <>{children}</> : <Navigate to="/login" />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  return user?.is_admin ? <>{children}</> : <Navigate to="/" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/post/:id"
        element={
          <ProtectedRoute>
            <PostDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publish"
        element={
          <ProtectedRoute>
            <PublishPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  )
}

export default React.memo(App)
