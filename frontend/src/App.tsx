import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, Role } from "./lib/auth";
import { ActiveProjectProvider } from "./lib/activeProject";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import ArchitectDashboard from "./pages/architect/Dashboard";
import MeetingReview from "./pages/architect/MeetingReview";
import ProjectDrawings from "./pages/architect/ProjectDrawings";
import ProjectFiles from "./pages/architect/ProjectFiles";
import ProjectMeetings from "./pages/architect/ProjectMeetings";
import ProjectTeam from "./pages/architect/ProjectTeam";
import VendorDirectory from "./pages/architect/VendorDirectory";
import ProjectTasks from "./pages/architect/ProjectTasks";
import ProjectProgress from "./pages/ProjectProgress";
import ProjectContacts from "./pages/ProjectContacts";
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
  if (role === "onboarding") return <ProjectProgress />;
  return <ClientDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ActiveProjectProvider>
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
              path="/drawings"
              element={
                <ProtectedRoute>
                  <ProjectDrawings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/files"
              element={
                <ProtectedRoute>
                  <ProjectFiles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meetings"
              element={
                <ProtectedRoute>
                  <ProjectMeetings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <ProjectTeam />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <ProjectTasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendors"
              element={
                <ProtectedRoute>
                  <VendorDirectory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <ProjectProgress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <ProjectContacts />
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
        </ActiveProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
