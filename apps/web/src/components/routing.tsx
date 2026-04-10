import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { LoadingState } from './ui';

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const { isBootstrapping } = useSession();
  const location = useLocation();

  if (isBootstrapping) {
    return <LoadingState label="Restoring your workspace..." fullscreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated } = useAuth();
  const { isBootstrapping } = useSession();

  if (isBootstrapping) {
    return <LoadingState label="Loading app..." fullscreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
