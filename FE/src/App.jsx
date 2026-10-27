import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import BuddyDetailPage from "./pages/BuddyDetailPage";
import AuthPage from "./pages/AuthPage";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LocalDashboard from "./pages/LocalDashboard";
import ProfilePage from "./pages/ProfilePage";
import ProtectedRoute from "./components/ProtectedRoute";
import LocalSafetyEKYC from "./pages/LocalSafetyEKYC";
import VNPayReturnPage from "./pages/VNPayReturnPage";
export default function App() {
  return (
    <Routes>
      <Route
        path="/payment/vnpay-return"
        element={
          <MainLayout>
            <VNPayReturnPage />
          </MainLayout>
        }
      />
      <Route
        path="/local-safety-ekyc"
        element={
          <MainLayout>
            <ProtectedRoute>
              <LocalSafetyEKYC />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      <Route
        path="/"
        element={
          <MainLayout>
            <HomePage />
          </MainLayout>
        }
      />
      <Route
        path="/buddy/:id"
        element={
          <MainLayout>
            <BuddyDetailPage />
          </MainLayout>
        }
      />
      <Route
        path="/login"
        element={
          <MainLayout>
            <AuthPage mode="login" />
          </MainLayout>
        }
      />
      <Route
        path="/register"
        element={
          <MainLayout>
            <AuthPage mode="register" />
          </MainLayout>
        }
      />
      <Route
        path="/dashboard"
        element={
          <MainLayout>
            <ProtectedRoute role="traveler">
              <CustomerDashboard />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <MainLayout>
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/local-dashboard"
        element={
          <MainLayout>
            <ProtectedRoute role="local">
              <LocalDashboard />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/admin"
        element={
          <MainLayout>
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
