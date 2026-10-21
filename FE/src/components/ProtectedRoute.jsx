import { Navigate } from "react-router-dom";
export default function ProtectedRoute({ children, role }) {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("lb_user") || "null");
  } catch {}
  const token = localStorage.getItem("lb_token");
  if (!token || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    const target =
      user.role === "admin"
        ? "/admin"
        : user.role === "local"
          ? "/local-dashboard"
          : "/dashboard";
    return <Navigate to={target} replace />;
  }
  return children;
}
