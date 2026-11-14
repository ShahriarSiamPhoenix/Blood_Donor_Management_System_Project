import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { BloodRequestsPage } from './pages/public/BloodRequestsPage';
import { CreateBloodRequestPage } from './pages/public/CreateBloodRequestPage';
import { FindDonorsPage } from './pages/public/FindDonorsPage';
import { HomePage } from './pages/public/HomePage';
import { ProtectedRoute } from './routes/ProtectedRoute';

const AboutPage = lazy(() =>
  import('./pages/public/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const CompatibilityPage = lazy(() =>
  import('./pages/public/CompatibilityPage').then((m) => ({ default: m.CompatibilityPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const StudentDashboard = lazy(() =>
  import('./pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard }))
);
const ModeratorDashboard = lazy(() =>
  import('./pages/moderator/ModeratorDashboard').then((m) => ({ default: m.ModeratorDashboard }))
);
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

function RouteLoadingFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
              <Layout>
                <Suspense fallback={<RouteLoadingFallback />}>
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
                </Suspense>
              </Layout>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
