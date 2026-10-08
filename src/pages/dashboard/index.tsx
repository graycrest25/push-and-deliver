import { SectionHelp } from "@/components/section-help";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconRefresh,
  IconPlane,
  IconShoppingCart,
  IconCar,
  IconHeadset,
  IconCircleCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/contexts/UserContext";
import { canAccessAdminScreen } from "@/lib/admin-access";
import { analyticsService } from "@/services/analytics.service";

type Stats = Record<string, number>;
const shortcuts = [
  {
    title: "Shipments",
    description: "International deliveries",
    url: "/shipment-orders",
    icon: IconPlane,
  },
  {
    title: "Restaurant orders",
    description: "Food deliveries",
    url: "/restaurant-orders",
    icon: IconShoppingCart,
  },
  {
    title: "Product orders",
    description: "Merchant purchases",
    url: "/product-orders",
    icon: IconShoppingCart,
  },
  {
    title: "Ride hailing",
    description: "Trips and riders",
    url: "/ride-hailing",
    icon: IconCar,
  },
  {
    title: "Support",
    description: "Customer conversations",
    url: "/support-tickets",
    icon: IconHeadset,
  },
];

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({});
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function loadDashboardData() {
    setLoading(true);
    const responses = await Promise.allSettled([
      analyticsService.getTotalCounts(),
      analyticsService.getVerifiedCounts(),
      analyticsService.getPendingCounts(),
      analyticsService.getBlockedCounts(),
      analyticsService.getWithdrawalStats(),
      analyticsService.getOnlineRidersCount(),
      analyticsService.getOpenRestaurantsCount(),
    ]);
    const next: Stats = {};
    responses.forEach((response, index) => {
      if (response.status !== "fulfilled") return;
      if (index === 5) next.onlineRiders = response.value as number;
      else if (index === 6) next.openRestaurants = response.value as number;
      else Object.assign(next, response.value);
    });
    setStats(next);
    setFailed(responses.some((response) => response.status === "rejected"));
    setUpdatedAt(new Date());
    setLoading(false);
  }
  useEffect(() => {
    void loadDashboardData();
  }, []);

  const count = (key: string) =>
    stats[key] === undefined ? "Unavailable" : stats[key].toLocaleString();
  const firstName = user?.username?.trim().split(/\s+/)[0] || "there";
  const queues = [
    {
      title: "Rider verification",
      description: "Riders awaiting review",
      key: "pendingRiders",
      url: "/riders",
    },
    {
      title: "Restaurant verification",
      description: "Restaurants awaiting review",
      key: "pendingRestaurants",
      url: "/vendors",
    },
    {
      title: "Pending withdrawals",
      description: "Withdrawal requests awaiting processing",
      key: "pendingWithdrawals",
      url: "/withdrawals",
    },
  ].filter((item) => canAccessAdminScreen(user?.adminType, item.url));
  const totals = [
    {
      title: "Users",
      key: "totalUsers",
      url: "/users",
      detail: "Customer accounts",
    },
    {
      title: "Riders",
      key: "totalRiders",
      url: "/riders",
      detail: `${count("onlineRiders")} online`,
    },
    {
      title: "Restaurants",
      key: "totalRestaurants",
      url: "/vendors",
      detail: `${count("openRestaurants")} open`,
    },
    {
      title: "Referrals",
      key: "totalReferrals",
      url: "/referrals",
      detail: "All-time referrals",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Overview</h1>
          <p className="text-sm text-muted-foreground">
            A clear view of your platform and the work ahead.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Updated{" "}
              {updatedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => void loadDashboardData()}
            disabled={loading}
          >
            <IconRefresh className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <section className="overview-welcome" aria-labelledby="welcome-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="welcome-title"
              className="text-2xl font-semibold tracking-tight"
            >
              Welcome back, {firstName}. <SectionHelp title="Operations shortcuts" />
            </h2>
            <p className="mt-2 text-sm">
              Keep orders moving and your team connected.
            </p>
          </div>
          <span className="welcome-mark" aria-hidden="true">
            <IconArrowUpRight size={30} stroke={1.6} />
          </span>
        </div>
        <nav aria-label="Operations shortcuts" className="workflow-shortcuts">
          {shortcuts
            .filter((item) => canAccessAdminScreen(user?.adminType, item.url))
            .map((item) => (
              <Link to={item.url} key={item.url} className="workflow-shortcut">
                <item.icon size={21} stroke={1.7} />
                <div>
                  <span className="block font-semibold text-sm">
                    {item.title}
                  </span>
                  <span className="block text-xs mt-1">{item.description}</span>
                </div>
                <IconArrowRight className="ml-auto shrink-0" size={17} />
              </Link>
            ))}
        </nav>
      </section>

      {failed && (
        <div role="alert" className="dashboard-alert">
          <IconAlertCircle size={19} className="shrink-0" />
          <span>
            Some metrics could not be loaded. Available figures are shown below;
            refresh to try again.
          </span>
        </div>
      )}

      <section className="platform-totals" aria-label="Platform totals">
        {totals.map((item) => (
          <div key={item.key} className="platform-total">
            <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">{item.title}<SectionHelp title={item.title} /></span>
            {loading ? (
              <Skeleton className="my-3 h-9 w-24" />
            ) : (
              <p
                className={
                  stats[item.key] === undefined
                    ? "my-3 text-sm text-muted-foreground"
                    : "my-2 text-3xl font-semibold tabular-nums"
                }
              >
                {count(item.key)}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {item.detail}
              </span>
              {canAccessAdminScreen(user?.adminType, item.url) && (
                <Link
                  to={item.url}
                  className="text-primary"
                  aria-label={`View ${item.title.toLowerCase()}`}
                >
                  <IconArrowUpRight size={18} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>

      <div className="dashboard-columns">
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>
              Pending work across your platform. Open a section to review its
              records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {queues.map((item) => (
              <Link to={item.url} key={item.key} className="attention-row">
                <span
                  className={
                    stats[item.key] === 0
                      ? "queue-count queue-clear"
                      : "queue-count"
                  }
                >
                  {loading ? (
                    <Skeleton className="h-6 w-6" />
                  ) : stats[item.key] === undefined ? (
                    "—"
                  ) : (
                    count(item.key)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats[item.key] === 0
                      ? "No pending records"
                      : item.description}
                  </p>
                </div>
                <IconArrowUpRight
                  size={19}
                  className="text-muted-foreground shrink-0"
                />
              </Link>
            ))}
            {!loading &&
              queues.length > 0 &&
              queues.every((item) => stats[item.key] === 0) && (
                <p className="flex items-center gap-2 pt-4 text-sm text-[var(--success)]">
                  <IconCircleCheck size={19} />
                  All caught up in these queues.
                </p>
              )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Platform availability</CardTitle>
            <CardDescription>
              Current availability and completed payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                title: "Riders online",
                key: "onlineRiders",
                total: "totalRiders",
                url: "/riders",
                label: "of all riders",
              },
              {
                title: "Restaurants open",
                key: "openRestaurants",
                total: "totalRestaurants",
                url: "/vendors",
                label: "of all restaurants",
              },
              {
                title: "Successful withdrawals",
                key: "successfulWithdrawals",
                total: "totalWithdrawals",
                url: "/withdrawals",
                label: "of all withdrawals",
              },
            ]
              .filter((item) => canAccessAdminScreen(user?.adminType, item.url))
              .map((item) => (
                <div key={item.key} className="availability-item">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{item.title}</span>
                    {loading ? (
                      <Skeleton className="h-5 w-12" />
                    ) : (
                      <span className="font-semibold tabular-nums">
                        {count(item.key)}
                      </span>
                    )}
                  </div>
                  <div className="availability-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${stats[item.total] > 0 ? Math.min(100, ((stats[item.key] || 0) / stats[item.total]) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {count(item.total)} {item.label}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account verification</CardTitle>
          <CardDescription>
            Compare account states without leaving the overview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="verification-grid">
            {[
              { title: "Riders", suffix: "Riders", url: "/riders" },
              { title: "Restaurants", suffix: "Restaurants", url: "/vendors" },
            ].map((group) => (
              <div key={group.suffix} className="verification-section">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{group.title}</h3>
                  <Link
                    to={group.url}
                    className="text-sm text-primary hover:underline"
                  >
                    View accounts{" "}
                    <IconArrowRight size={14} className="inline" />
                  </Link>
                </div>
                <dl className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Verified",
                      prefix: "verified",
                      className: "verification-success",
                    },
                    {
                      label: "Pending",
                      prefix: "pending",
                      className: "verification-pending",
                    },
                    {
                      label: "Blocked",
                      prefix: "blocked",
                      className: "verification-blocked",
                    },
                  ].map((state) => (
                    <div
                      key={state.prefix}
                      className={`verification-stat ${state.className}`}
                    >
                      <dt className="text-xs">{state.label}</dt>
                      <dd className="mt-2 text-lg font-semibold tabular-nums">
                        {loading ? (
                          <Skeleton className="h-6 w-12" />
                        ) : (
                          count(state.prefix + group.suffix)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
