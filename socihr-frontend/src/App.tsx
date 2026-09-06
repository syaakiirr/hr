import { lazy, Suspense, useState, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import PageTransition from "./components/PageTransition";
import LoginTransition from "./components/LoginTransition";
import { DateFilterProvider } from "./contexts/DateFilterContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

import LoginPage           from "./pages/LoginPage";
const DashboardPage       = lazy(() => import("./pages/DashboardPage"));
const LeaderboardPage     = lazy(() => import("./pages/LeaderboardPage"));
const SnapshotsPage       = lazy(() => import("./pages/SnapshotsPage"));
const ArchivedPage        = lazy(() => import("./pages/ArchivedPage"));
const StaffPage           = lazy(() => import("./pages/StaffPage"));
const StaffEngagementPage = lazy(() => import("./pages/StaffEngagementPage"));
const MonitoringPage      = lazy(() => import("./pages/MonitoringPage"));
const ReportsPage         = lazy(() => import("./pages/ReportsPage"));
const AuditPage           = lazy(() => import("./pages/AuditPage"));
const CompanyPage         = lazy(() => import("./pages/CompanyPage"));
const DepartmentPage      = lazy(() => import("./pages/DepartmentPage"));
const UsersPage           = lazy(() => import("./pages/UsersPage"));


function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 10 }}>
      <div className="spin" />
      <span style={{ fontSize: 13, color: "#7b7b96" }}>Loading...</span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate replace to="/" />;
  return <>{children}</>;
}

// SuperAdmin-only route — DeptAdmin gets redirected to dashboard
function SuperAdminRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("token");
  const { isSuperAdmin } = useAuth();
  if (!token) return <Navigate replace to="/" />;
  if (!isSuperAdmin()) return <Navigate replace to="/dashboard" />;
  return <>{children}</>;
}

// AnimatedRoutes — needs to be inside BrowserRouter to use useLocation
function AnimatedRoutes() {
  const location = useLocation();

  return (
      <Routes location={location} key={location.pathname}>
        {/* Login — no PageTransition wrapper */}
        <Route path="/" element={<LoginPage />} />

        {/* ── Both roles can access these ── */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <PageTransition><DashboardPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute>
            <PageTransition><LeaderboardPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/staff" element={
          <ProtectedRoute>
            <PageTransition><StaffPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/staff-engagement" element={
          <ProtectedRoute>
            <PageTransition><StaffEngagementPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/monitoring" element={
          <ProtectedRoute>
            <PageTransition><MonitoringPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <PageTransition><ReportsPage /></PageTransition>
          </ProtectedRoute>
        } />

        {/* ── SuperAdmin only ── */}
        <Route path="/company" element={
          <SuperAdminRoute>
            <PageTransition><CompanyPage /></PageTransition>
          </SuperAdminRoute>
        } />
        <Route path="/departments" element={
          <SuperAdminRoute>
            <PageTransition><DepartmentPage /></PageTransition>
          </SuperAdminRoute>
        } />
        <Route path="/audit" element={
          <SuperAdminRoute>
            <PageTransition><AuditPage /></PageTransition>
          </SuperAdminRoute>
        } />
        <Route path="/snapshots" element={
          <SuperAdminRoute>
            <PageTransition><SnapshotsPage /></PageTransition>
          </SuperAdminRoute>
        } />
        <Route path="/archived" element={
          <SuperAdminRoute>
            <PageTransition><ArchivedPage /></PageTransition>
          </SuperAdminRoute>
        } />
        <Route path="/users" element={
          <SuperAdminRoute>
            <PageTransition><UsersPage /></PageTransition>
          </SuperAdminRoute>
        } />

        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
  );
}

function AppContent() {
  const [showOverlay, setShowOverlay] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleTrigger = () => {
      setShowOverlay(true);
    };
    window.addEventListener("trigger-login-transition", handleTrigger);
    return () => window.removeEventListener("trigger-login-transition", handleTrigger);
  }, []);

  const handleMidpoint = () => {
    navigate("/dashboard");
    // Trigger overlay slide out
    setShowOverlay(false);
  };

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <AnimatedRoutes />
      </Suspense>
        {showOverlay && (
          <LoginTransition
            key="login-transition"
            onMidpoint={handleMidpoint}
          />
        )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <DateFilterProvider>
            <AppContent />
          </DateFilterProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;