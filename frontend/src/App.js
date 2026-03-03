import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import NewQuestionnaire from './pages/NewQuestionnaire';
import Results from './pages/Results';
import DashboardLayout from './components/DashboardLayout';
import { Toaster } from './components/ui/sonner';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400" />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout><Dashboard /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/questionnaire/new"
            element={
              <ProtectedRoute>
                <DashboardLayout><NewQuestionnaire /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/questionnaire/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout><Results /></DashboardLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" toastOptions={{ duration: 5000 }} />
    </AuthProvider>
  );
}

export default App;
