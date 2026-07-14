import { lazy, Suspense, useState, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "./components/PageTransition";
import LoginTransition from "./components/LoginTransition";


const LoginPage           = lazy(() => import("./pages/LoginPage"));
const DashboardPage       = lazy(() => import("./pages/DashboardPage"));
const SnapshotsPage       = lazy(() => import("./pages/SnapshotsPage"));
const ArchivedPage        = lazy(() => import("./pages/ArchivedPage"));
const StaffPage           = lazy(() => import("./pages/StaffPage"));
const StaffEngagementPage = lazy(() => import("./pages/StaffEngagementPage"));
const MonitoringPage      = lazy(() => import("./pages/MonitoringPage"));
const ReportsPage         = lazy(() => import("./pages/ReportsPage"));
const AuditPage           = lazy(() => import("./pages/AuditPage"));
const CompanyPage         = lazy(() => import("./pages/CompanyPage"));
const DepartmentPage      = lazy(() => import("./pages/DepartmentPage"));


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

// AnimatedRoutes — needs to be inside BrowserRouter to use useLocation
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Login — no PageTransition wrapper */}
        <Route path="/" element={<LoginPage />} />

        {/* All protected pages — wrapped with slide transition */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <PageTransition><DashboardPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/staff" element={
          <ProtectedRoute>
            <PageTransition><StaffPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/company" element={
          <ProtectedRoute>
            <PageTransition><CompanyPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/departments" element={
          <ProtectedRoute>
            <PageTransition><DepartmentPage /></PageTransition>
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
        <Route path="/audit" element={
          <ProtectedRoute>
            <PageTransition><AuditPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/snapshots" element={
          <ProtectedRoute>
            <PageTransition><SnapshotsPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/archived" element={
          <ProtectedRoute>
            <PageTransition><ArchivedPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AnimatePresence>
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
      <AnimatePresence>
        {showOverlay && (
          <LoginTransition
            key="login-transition"
            onMidpoint={handleMidpoint}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;