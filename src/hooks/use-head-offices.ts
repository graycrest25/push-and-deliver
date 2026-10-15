import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { headOfficesService } from "@/services/head-offices.service";
import type { HeadOfficeAddress } from "@/types";

export function useHeadOffices() {
  const { adminType, user } = useCurrentUser();
  const allowed = adminType === "super";
  const [offices, setOffices] = useState<HeadOfficeAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setOffices([]);
    setError("");
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    headOfficesService
      .getAll()
      .then((data) => {
        if (active) setOffices(data);
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load head offices",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, user?.id, revision]);
  return {
    offices: allowed ? offices : [],
    loading: allowed && loading,
    error: allowed ? error : "",
    reload,
  };
}
