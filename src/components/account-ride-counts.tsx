import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/contexts/UserContext";
import {
  adminRideCountsService,
  type AdminRideCounts,
  type RideCountAccountType,
} from "@/services/admin-ride-counts.service";

export function AccountRideCounts({
  id,
  usertype,
}: {
  id: string;
  usertype: RideCountAccountType;
}) {
  const { adminType } = useCurrentUser();
  if (adminType !== "super") return null;
  return <RideCounts key={`${usertype}:${id}`} id={id} usertype={usertype} />;
}

function RideCounts({
  id,
  usertype,
}: {
  id: string;
  usertype: RideCountAccountType;
}) {
  const [counts, setCounts] = useState<AdminRideCounts | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCounts(null);
    adminRideCountsService
      .getCounts(usertype, id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCounts(data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load ride counts",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, usertype, refresh]);

  const entries: [keyof AdminRideCounts, string][] = [
    ["ridehailing", "Ride hailing"],
    ["courier", "Courier"],
    ["expressshipmenr", "Express shipment"],
    ...(usertype === "user"
      ? [
          ["customclearancer", "Customs clearance"] as [
            keyof AdminRideCounts,
            string,
          ],
        ]
      : []),
  ];
  return (
    <section
      id="ride-activity"
      className="scroll-mt-24 overflow-hidden rounded-xl border bg-card"
      aria-labelledby="ride-activity-title"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="ride-activity-title" className="font-semibold">
            Ride & delivery activity
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All statuses included.
            {usertype === "rider" &&
              " Counts use this rider’s assigned orders."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw className="size-3.5" />
          {error ? "Retry" : "Refresh"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="px-5 py-5 text-sm text-destructive">
          {error}. Use Retry to try again.
        </p>
      ) : (
        <dl
          className={`grid grid-cols-2 ${usertype === "user" ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
        >
          {entries.map(([key, label]) => (
            <div key={key} className="px-5 py-5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {loading ? (
                  <Skeleton className="h-8 w-14" />
                ) : (
                  (counts?.[key]?.toLocaleString() ?? "Unavailable")
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {loading && (
        <span role="status" className="sr-only">
          Loading ride counts
        </span>
      )}
    </section>
  );
}
