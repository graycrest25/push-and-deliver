// Test-only component context. Never imported by the application build.
export function useCurrentUser() {
  const adminType =
    new URLSearchParams(location.search).get("role") || "regular";
  return {
    user: {
      id: "admin-1",
      username: "Test administrator",
      isAdmin: true,
      adminType,
    },
    adminType,
    isAdmin: true,
    loading: false,
    error: "",
    refetchUser: async () => true,
  };
}
