import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './contexts/UserContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import PostDetailPage from './pages/PostDetailPage'
import PublishPage from './pages/PublishPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import './App.css'

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

export default App
