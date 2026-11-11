import { Skeleton } from "./skeleton";
import {
  FormSkeleton,
  RecordSkeleton,
  TableSkeleton,
} from "./loading-skeletons";

/** Mirrors the content of a single tab, including its persistent card boundaries. */
export function TabSectionSkeleton({
  section,
  domestic = false,
}: {
  section: string;
  domestic?: boolean;
}) {
  if (section === "rules") return <TabSectionSkeleton section="game" />;
  if (["generate", "renew"].includes(section))
    return (
      <div
        role="status"
        aria-label="Loading form…"
        className="rounded-xl border bg-card p-5"
      >
        <Skeleton className="h-5 w-56 max-w-full" />
      </div>
    );
  if (section === "export")
    return (
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <Skeleton className="h-5 w-44" />
        <FormSkeleton label="Loading withdrawal export…" fields={3} />
      </div>
    );
  if (section === "signup-coupons")
    return (
      <div className="space-y-5">
        <RecordSkeleton label="Loading signup coupon settings…" fields={4} />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  const featureColumns: Record<string, string[]> = {
    requests: [
      "ID",
      "Amount",
      "Status",
      "Assigned to me",
      "Account number",
      "Created at",
    ],
    links: [
      "Promoter name",
      "Code",
      "Share URL",
      "Availability",
      "Attributed referrals",
      "Expires",
      "Manage",
    ],
    campaigns: [
      "Title",
      "Campaign ID",
      "Discount (%)",
      "Hours",
      "Services",
      "Active",
      "Game eligible",
    ],
    processing: [
      "Customer",
      "Task",
      "Status",
      "Attempts",
      "Last error",
      "Recovery",
    ],
  };
  if (featureColumns[section])
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-full" />
        <TableSkeleton
          columns={featureColumns[section]}
          label={`Loading ${section}…`}
        />
      </div>
    );
  const bar = <Skeleton className="h-12 w-full rounded-lg" />;
  if (section === "dispatch")
    return (
      <div
        role="status"
        aria-label="Loading dispatch settings…"
        className="space-y-4"
      >
        <Skeleton className="h-4 w-full max-w-3xl" />
        {bar}
      </div>
    );
  if (["releases", "signup"].includes(section))
    return (
      <div className="space-y-5">
        {section === "signup" && bar}
        <RecordSkeleton
          label={`Loading ${section === "signup" ? "signup bonuses" : "mobile releases"}…`}
          fields={section === "signup" ? 8 : 18}
        />
        {section === "releases" && <Skeleton className="h-9 w-48" />}
        {bar}
      </div>
    );
  if (section === "information")
    return (
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <Skeleton className="h-5 w-40" />
        <RecordSkeleton
          label="Loading tariff information…"
          fields={domestic ? 6 : 9}
        />
      </div>
    );
  if (section === "pdf")
    return (
      <div
        role="status"
        aria-label="Loading PDF upload…"
        className="rounded-xl border bg-card p-5"
      >
        <Skeleton className="h-5 w-48" />
      </div>
    );
  if (section === "create" || section === "workflow")
    return (
      <div
        role="status"
        aria-label={
          section === "workflow"
            ? "Loading tariff workflow…"
            : "Loading tariff form…"
        }
        className="rounded-xl border bg-card p-6 space-y-5"
      >
        <Skeleton className="h-5 w-44" />
        {section === "workflow" && <Skeleton className="h-16 w-full" />}
        {Array.from({ length: section === "workflow" ? 4 : 1 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  if (section === "game")
    return (
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {[2, 4, 6].map((fields) => (
            <div
              key={fields}
              className="rounded-xl border bg-card p-6 space-y-5"
            >
              <Skeleton className="h-5 w-44" />
              <FormSkeleton label="Loading game rules…" fields={fields} />
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  const columns =
    section === "country-zones"
      ? ["Country", "Code", "Zone", "Availability", "Prices"]
      : section === "prices"
        ? domestic
          ? ["Weight (kg)", "Amount (₦)"]
          : ["Zone", "Weight (kg)", "Price (NGN)", "Destinations"]
        : section === "states"
          ? ["ID", "Name", "Local zone"]
          : section === "countries"
            ? ["Code", "Name", "Active", "Postal code required"]
            : section === "local-types"
              ? ["ID", "Name", "Details", "Active", "Version"]
              : domestic
                ? [
                    "ID",
                    "Local type",
                    "Zone",
                    "Status",
                    "Volumetric divisor",
                    "Created at",
                  ]
                : [
                    "ID",
                    "Name",
                    "Carrier",
                    "Direction",
                    "Cargo",
                    "Status",
                    "Historical",
                    "Created at",
                  ];
  return (
    <div
      className={
        section === "prices" || section === "country-zones"
          ? "rounded-xl border bg-card p-6 space-y-5"
          : "space-y-5"
      }
    >
      <div className="flex justify-between gap-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-9 w-32" />
      </div>
      {((section === "prices" && !domestic) || section === "country-zones") && (
        <>
          <Skeleton className="h-4 w-full max-w-2xl" />
          <div
            className={`grid gap-4 ${section === "prices" ? "sm:grid-cols-2" : ""}`}
          >
            <Skeleton className="h-10 w-full" />
            {section === "prices" && <Skeleton className="h-10 w-full" />}
          </div>
        </>
      )}
      <TableSkeleton
        label={`Loading ${section === "prices" ? "tariff prices" : section === "country-zones" ? "country zones" : section}…`}
        columns={columns}
        rows={6}
        hasAction={!["prices", "country-zones"].includes(section)}
      />
    </div>
  );
}

export function tabPageLayout(path: string) {
  const pages: Record<string, { title: string; tabs: string[][] }> = {
    "/coupons": {
      title: "Coupons & signup rewards",
      tabs: [
        ["campaigns", "Campaigns"],
        ["generate", "Generate code"],
        ["signup-coupons", "Signup coupons"],
        ["processing", "Processing"],
      ],
    },
    "/withdrawals": {
      title: "Withdrawals",
      tabs: [
        ["requests", "Requests"],
        ["export", "Export"],
      ],
    },
    "/game-rules": {
      title: "Ten Seconds",
      tabs: [
        ["rules", "Game rules"],
        ["campaigns", "Reward campaigns"],
      ],
    },
    "/promoter-links": {
      title: "Promoter referral links",
      tabs: [
        ["links", "Promoter links"],
        ["renew", "Create or renew"],
      ],
    },
  };
  if (pages[path]) return { ...pages[path], domestic: false };
  const domestic = path.startsWith("/delivery-zones");
  if (path === "/app-config")
    return {
      title: "App configuration",
      domestic,
      tabs: [
        ["dispatch", "Dispatch"],
        ["releases", "Mobile releases"],
        ["signup", "Signup bonuses"],
        ["game", "Game rules"],
      ],
    };
  if (/^\/(delivery-zones|export-rates)\/tariffs\/[^/]+\/?$/.test(path))
    return {
      title: "Tariff details",
      domestic,
      tabs: [
        ["prices", "Prices"],
        ...(!domestic ? [["country-zones", "Country zones"]] : []),
        ["information", "Tariff information"],
        ...(!domestic ? [["pdf", "PDF upload"]] : []),
        ["workflow", "Edit & publish"],
      ],
    };
  if (["/delivery-zones", "/export-rates"].includes(path))
    return {
      title: domestic
        ? "Local shipment tariffs"
        : "International shipment tariffs",
      domestic,
      tabs: [
        ["tariffs", "Tariffs"],
        ...(domestic
          ? [
              ["local-types", "Local shipping types"],
              ["states", "States & zones"],
            ]
          : [["countries", "Countries"]]),
        ["create", "Create tariff"],
      ],
    };
  return null;
}
