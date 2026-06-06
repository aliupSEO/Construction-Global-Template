import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ForcePasswordResetModal } from './ForcePasswordResetModal';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'vorarbeiter' | 'mitarbeiter')[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { currentUser, userRole, loading, requiresPasswordChange } = useAuth();
  const location = useLocation();

  // Show spinner while auth + role are being resolved
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  // Not authenticated → redirect to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password reset before any navigation
  if (requiresPasswordChange) {
    return <ForcePasswordResetModal />;
  }

  // L1 FIX: if role is still null after loading finished, treat as unauthorized
  // This prevents silent pass-through when token claims haven't propagated yet
  if (allowedRoles && !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark text-slate-100 flex-col">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Lade Berechtigungen...</p>
      </div>
    );
  }

  // Role check — deny access if role not in allowedRoles
  if (allowedRoles && userRole && !allowedRoles.includes(userRole as 'admin' | 'vorarbeiter' | 'mitarbeiter')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark text-slate-100 flex-col">
        <h1 className="text-2xl font-bold mb-4">Zugriff verweigert</h1>
        <p>Ihre Rolle berechtigt Sie nicht, diese Seite anzuzeigen.</p>
        <button 
          onClick={() => window.history.back()} 
          className="mt-6 px-4 py-2 bg-brand-primary rounded hover:bg-brand-primary/90 transition-colors"
        >
          Zurück
        </button>
      </div>
    );
  }

  return <Outlet />;
}
