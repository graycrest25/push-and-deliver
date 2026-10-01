// Refresh active clients so role changes made by another admin reach their session.
// Downstream services must still validate access; old ID tokens can remain valid.
export function startAdminClaimsRefresh(refresh: () => Promise<void>) {
  let active = true;
  let refreshing = false;
  let lastRefresh = 0;
  const refreshIfVisible = async () => {
    if (
      !active ||
      refreshing ||
      document.visibilityState !== "visible" ||
      Date.now() - lastRefresh < 1000
    )
      return;
    refreshing = true;
    lastRefresh = Date.now();
    try {
      await refresh();
    } catch (error) {
      console.warn("Unable to refresh admin claims:", error);
    } finally {
      refreshing = false;
    }
  };
  const interval = window.setInterval(refreshIfVisible, 60_000);
  window.addEventListener("focus", refreshIfVisible);
  document.addEventListener("visibilitychange", refreshIfVisible);
  void refreshIfVisible();
  return () => {
    active = false;
    window.clearInterval(interval);
    window.removeEventListener("focus", refreshIfVisible);
    document.removeEventListener("visibilitychange", refreshIfVisible);
  };
}
