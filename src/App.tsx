import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { Tasks } from './pages/Tasks';
import { Settings } from './pages/Settings';
import { Employees } from './pages/Employees';
import { Managers } from './pages/Managers';
import { Clients } from './pages/Clients';
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
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Account } from './pages/Account';

export function NavigationTracker() {
  const location = useLocation();
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'MARKUP_PATH_CHANGE', 
        path: location.pathname 
      }, '*');
    }
  }, [location.pathname]);
  return null;
}

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-red-600 bg-red-50 min-h-screen">
          <h1 className="text-2xl font-bold mb-4">Print Render Crash</h1>
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
                <Route path="/login" element={<Login />} />
                
                {/* Admin only */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/managers" element={<Managers />} />
                    <Route path="/clients" element={<Clients />} />
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
