import { LoadingModal } from "@/components/shared/Loader";
import Unauthorized from "@/components/Unauthorized";
import { useCurrentUser } from "@/contexts/UserContext";
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { adminHome, canAccessAdminScreen } from "@/lib/admin-access";

const ProtectedRoutes = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useCurrentUser();
  const location = useLocation();

  if (loading) {
    return <LoadingModal />;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!isAdmin) {
    return <Unauthorized />;
  }

  if (!canAccessAdminScreen(user.adminType, location.pathname)) {
    return <Navigate to={adminHome(user.adminType)} replace />;
  }

  return <div>{children}</div>;
};

export default ProtectedRoutes;
