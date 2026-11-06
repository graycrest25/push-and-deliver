import { RefreshButton } from "@/components/ui/refresh-button";
import React from "react";
import { adminHome } from "@/lib/admin-access";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { AuthFrame } from "@/components/auth-frame";
import { AuthFormSkeleton } from "@/components/ui/loading-skeletons";

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, error, refetchUser } = useCurrentUser();

  if (loading) {
    return (
      <AuthFrame>
        <AuthFormSkeleton />
      </AuthFrame>
    );
  }

  if (error)
    return (
      <div className="p-8 space-y-4" role="alert">
        <p>{error}</p>
        <RefreshButton onClick={() => void refetchUser()}>
          Retry session
        </RefreshButton>
      </div>
    );

  if (user) {
    return <Navigate to={adminHome(user.adminType)} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
