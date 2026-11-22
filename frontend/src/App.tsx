import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ApiInventory } from './pages/ApiInventory';
import { AddApi } from './pages/AddApi';
import { ApiWorkspace } from './pages/ApiWorkspace';
import { VulnerabilityScanner } from './pages/VulnerabilityScanner';
import { SecurityFindings } from './pages/SecurityFindings';
import { ApiMonitoring } from './pages/ApiMonitoring';
import { ScanHistory } from './pages/ScanHistory';
import { Reports } from './pages/Reports';
import { SimulationLab } from './pages/SimulationLab';
import { Settings } from './pages/Settings';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070a13] flex items-center justify-center text-cyan-400 font-mono text-sm">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>Authenticating Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-[#070a13]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedLayout>
                <ApiInventory />
              </ProtectedLayout>
            }
          />
          <Route
            path="/apis/new"
            element={
              <ProtectedLayout>
                <AddApi />
              </ProtectedLayout>
            }
          />
          <Route
            path="/workspace"
            element={
              <ProtectedLayout>
                <ApiWorkspace />
              </ProtectedLayout>
            }
          />
          <Route
            path="/scanner"
            element={
              <ProtectedLayout>
                <VulnerabilityScanner />
              </ProtectedLayout>
            }
          />
          <Route
            path="/findings"
            element={
              <ProtectedLayout>
                <SecurityFindings />
              </ProtectedLayout>
            }
          />
          <Route
            path="/monitoring"
            element={
              <ProtectedLayout>
                <ApiMonitoring />
              </ProtectedLayout>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedLayout>
                <ScanHistory />
              </ProtectedLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedLayout>
                <Reports />
              </ProtectedLayout>
            }
          />
          <Route
            path="/simulation"
            element={
              <ProtectedLayout>
                <SimulationLab />
              </ProtectedLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedLayout>
                <Settings />
              </ProtectedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
