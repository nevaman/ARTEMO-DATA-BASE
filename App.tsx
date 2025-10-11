import React, { useEffect } from 'react'; // Import useEffect
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthWrapper } from './components/AuthWrapper';
import { AuthManager } from './components/AuthManager';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore'; // Import the UI store

// Layout Components
import { AppLayout } from './layouts/AppLayout';
import { AdminLayout } from './layouts/AdminLayout';

// User Pages
import { DashboardPage } from './pages/DashboardPage';
import { AllToolsPage } from './pages/AllToolsPage';
import { ToolInterfacePage } from './pages/ToolInterfacePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { AllProjectsPage } from './pages/AllProjectsPage';
import { ChatDetailPage } from './pages/ChatDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { ClientProfilesPage } from './pages/ClientProfilesPage';
import { SettingsPage } from './pages/SettingsPage';

// Admin Pages
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminToolsPage } from './pages/AdminToolsPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminAnnouncementsPage } from './pages/AdminAnnouncementsPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({
  children,
  requireAdmin = false
}) => {
  const { isAuthenticated, isAdmin } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  // Get the current theme from the UI store
  const { theme } = useUIStore();

  // This effect runs whenever the 'theme' state changes.
  // It adds or removes the 'dark' class from the root <html> element.
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      <AuthWrapper>
        <AuthManager>
          <Routes>
            {/* User Routes with Shared Layout */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="tools" element={<AllToolsPage />} />
              <Route path="tools/:toolId" element={<ToolInterfacePage />} />
              <Route path="projects" element={<AllProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="chat/:id" element={<ChatDetailPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="profiles" element={<ClientProfilesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Admin Routes with Admin Layout */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboardPage />} />
              <Route path="tools" element={<AdminToolsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="announcements" element={<AdminAnnouncementsPage />} />
            </Route>

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthManager>
      </AuthWrapper>
    </ErrorBoundary>
  );
};

export default App;

