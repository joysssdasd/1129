import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './contexts/UserContext'
import './App.css'

// 路由懒加载 - 减少首屏加载时间
const LoginPage = lazy(() => import('./components/pages/LoginPage'))
const HomePage = lazy(() => import('./components/pages/HomePage'))
const PostDetailPage = lazy(() => import('./components/pages/PostDetailPage'))
const PublishPage = lazy(() => import('./components/pages/PublishPage'))
const ProfilePage = lazy(() => import('./components/pages/ProfilePage'))
const AdminPage = lazy(() => import('./components/pages/AdminPage'))
const AgreementPage = lazy(() => import('./components/pages/AgreementPage'))
const CategoryDetailPage = lazy(() => import('./components/pages/CategoryDetailPage'))

// 加载中组件
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-2 text-gray-500 text-sm">加载中...</p>
    </div>
  </div>
)

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/agreement" element={<AgreementPage />} />
        {/* 首页开放游客浏览 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:categoryId" element={<CategoryDetailPage />} />
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
    </Suspense>
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
