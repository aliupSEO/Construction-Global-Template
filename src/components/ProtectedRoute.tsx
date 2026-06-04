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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiresPasswordChange) {
    return <ForcePasswordResetModal />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole as any)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 flex-col">
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
