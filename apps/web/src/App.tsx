import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { AppProviders } from './providers/AppProviders';
import { AppShell } from './components/AppShell';
import { ProtectedRoute, PublicRoute } from './components/routing';
import { ToastViewport } from './components/ui';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LoginPage } from './pages/auth/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { InventoryFormPage } from './pages/inventory/InventoryFormPage';
import { InventoryDetailsPage } from './pages/inventory/InventoryDetailsPage';
import { ImportsPage } from './pages/imports/ImportsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';

export default function App() {
  return (
    <AppProviders>
      <Router>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/" element={<OnboardingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<Navigate to="/" replace />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/new" element={<InventoryFormPage mode="create" />} />
              <Route path="/inventory/:id" element={<InventoryDetailsPage />} />
              <Route path="/inventory/:id/edit" element={<InventoryFormPage mode="edit" />} />
              <Route path="/imports" element={<ImportsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <ToastViewport />
      </Router>
    </AppProviders>
  );
}
