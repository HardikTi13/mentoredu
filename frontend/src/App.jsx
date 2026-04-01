import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import UserAvailability from "./pages/UserAvailability";
import MentorAvailability from "./pages/MentorAvailability";
import AdminDashboard from "./pages/AdminDashboard";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0c1222 0%,#1a1a2e 50%,#16213e 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const loginRole = allowedRoles?.[0]?.toLowerCase() || "user";
    return <Navigate to={`/login/${loginRole}`} state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // redirect to the user's correct dashboard
    if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
    if (user.role === "MENTOR") return <Navigate to="/mentor" replace />;
    return <Navigate to="/user" replace />;
  }

  return children;
}

function DefaultRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0c1222 0%,#1a1a2e 50%,#16213e 100%)" }}>
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login/user" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  if (user.role === "MENTOR") return <Navigate to="/mentor" replace />;
  return <Navigate to="/user" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public login routes */}
      <Route path="/login/user"   element={<LoginPage role="user"   />} />
      <Route path="/login/mentor" element={<LoginPage role="mentor" />} />
      <Route path="/login/admin"  element={<LoginPage role="admin"  />} />
      <Route path="/login"        element={<Navigate to="/login/user" replace />} />

      {/* Protected app routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultRedirect />} />

        <Route
          path="user"
          element={
            <ProtectedRoute allowedRoles={["USER"]}>
              <UserAvailability />
            </ProtectedRoute>
          }
        />
        {/* legacy /availability -> /user */}
        <Route path="availability" element={<Navigate to="/user" replace />} />

        <Route
          path="mentor"
          element={
            <ProtectedRoute allowedRoles={["MENTOR"]}>
              <MentorAvailability />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
