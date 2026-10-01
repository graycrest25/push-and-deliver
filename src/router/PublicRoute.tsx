import React from "react";
import { adminHome } from "@/lib/admin-access";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { LoadingModal } from "@/components/shared/Loader";

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return <LoadingModal />;
  }

  if (user) {
    return <Navigate to={adminHome(user.adminType)} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
