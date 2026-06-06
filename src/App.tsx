import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { Tasks } from './pages/Tasks';
import { Settings } from './pages/Settings';
import { Employees } from './pages/Employees';
import { DailyReports } from './pages/DailyReports';
import { DailyReportForm } from './pages/DailyReportForm';
import { WeeklyReports } from './pages/WeeklyReports';
import { WeeklyReportForm } from './pages/WeeklyReportForm';
import { PrintReport } from './pages/PrintReport';
import { ReportDetail } from './pages/ReportDetail';
import { Sites } from './pages/Sites';
import { SiteDetail } from './pages/SiteDetail';
import { LeaveRequests } from './pages/LeaveRequests';
import { AuthProvider } from './contexts/AuthContext';
import { useAppSettings } from './hooks/useAppSettings';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Account } from './pages/Account';

// Only post navigation messages in development/iframe preview contexts
export function NavigationTracker() {
  const location = useLocation();
  useEffect(() => {
    if (import.meta.env.DEV && window.parent !== window) {
      window.parent.postMessage({ 
        type: 'MARKUP_PATH_CHANGE', 
        path: location.pathname 
      }, '*');
    }
  }, [location.pathname]);
  return null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // In production, send to monitoring service here (e.g. Sentry)
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Production: show friendly message only — never expose stack traces
      if (import.meta.env.PROD) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Ein Fehler ist aufgetreten</h1>
              <p className="text-gray-500 mb-6">Bitte laden Sie die Seite neu. Wenn das Problem weiterhin besteht, wenden Sie sich an den Support.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 transition-colors"
              >
                Seite neu laden
              </button>
            </div>
          </div>
        );
      }

      // Development: show full details
      return (
        <div className="p-10 text-red-600 bg-red-50 min-h-screen">
          <h1 className="text-2xl font-bold mb-4">Render Error (Dev Only)</h1>
          <p className="font-mono text-sm mb-4">{this.state.error && this.state.error.toString()}</p>
          <pre className="font-mono text-xs overflow-auto bg-gray-100 p-4">{this.state.errorInfo?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
    return (
        <ErrorBoundary>
        <AuthProvider>
        <Router>
            <NavigationTracker />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Admin only */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/settings" element={<Settings />} />
                </Route>

                {/* Admin + Vorarbeiter */}
                <Route element={<ProtectedRoute allowedRoles={['admin', 'vorarbeiter']} />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/daily-reports/:id" element={<DailyReportForm />} />
                    <Route path="/weekly-reports/:id" element={<WeeklyReportForm />} />
                    <Route path="/sites" element={<Sites />} />
                    <Route path="/sites/:id" element={<SiteDetail />} />
                    <Route path="/tasks" element={<Tasks />} />
                </Route>

                {/* All roles (including mitarbeiter) */}
                <Route element={<ProtectedRoute allowedRoles={['admin', 'vorarbeiter', 'mitarbeiter']} />}>
                    <Route path="/urlaubsantraege" element={<LeaveRequests />} />
                    <Route path="/konto" element={<Account />} />
                    <Route path="/report-detail/:id" element={<ReportDetail />} />
                    <Route path="/print/:type/:id" element={<PrintReport />} />
                </Route>
            </Routes>
        </Router>
        </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
