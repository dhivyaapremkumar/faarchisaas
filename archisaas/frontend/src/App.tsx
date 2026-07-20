import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, Role } from "./lib/auth";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import ArchitectDashboard from "./pages/architect/Dashboard";
import MeetingReview from "./pages/architect/MeetingReview";
import VendorDashboard from "./pages/vendor/Dashboard";
import ClientDashboard from "./pages/client/Dashboard";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function RoleHome() {
  const { role } = useAuth();
  const architectRoles: Role[] = ["owner", "architect_admin", "architect_staff"];
  if (role && architectRoles.includes(role)) return <ArchitectDashboard />;
  if (role === "vendor") return <VendorDashboard />;
  return <ClientDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meetings/:meetingId"
            element={
              <ProtectedRoute>
                <MeetingReview />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
