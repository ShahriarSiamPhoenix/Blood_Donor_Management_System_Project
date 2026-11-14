import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { ModeratorDashboard } from './pages/moderator/ModeratorDashboard';
import { AboutPage } from './pages/public/AboutPage';
import { BloodRequestsPage } from './pages/public/BloodRequestsPage';
import { CompatibilityPage } from './pages/public/CompatibilityPage';
import { CreateBloodRequestPage } from './pages/public/CreateBloodRequestPage';
import { FindDonorsPage } from './pages/public/FindDonorsPage';
import { HomePage } from './pages/public/HomePage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { ProtectedRoute } from './routes/ProtectedRoute';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
              <Layout>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/donors" element={<FindDonorsPage />} />
                  <Route path="/requests" element={<BloodRequestsPage />} />
                  <Route path="/requests/new" element={<CreateBloodRequestPage />} />
                  <Route path="/compatibility" element={<CompatibilityPage />} />

                  {/* Auth Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* Role-Protected Dashboards */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['student', 'moderator', 'super_admin']}>
                        <StudentDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/moderator"
                    element={
                      <ProtectedRoute allowedRoles={['moderator', 'super_admin']}>
                        <ModeratorDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute allowedRoles={['super_admin']}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
