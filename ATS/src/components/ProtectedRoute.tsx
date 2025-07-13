import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role: 'hr' | 'candidate';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
  const { user, userRole } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (userRole !== role) {
    return <Navigate to={`/${userRole}/dashboard`} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;