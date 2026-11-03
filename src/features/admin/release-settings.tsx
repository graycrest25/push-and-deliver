import { useState } from "react";
import { Label } from "@/components/ui/label";
import { ActionForm, Notice, RecordView, bool, field } from "./shared";
import { CurrentRecord, currentVersion } from "./native-dashboard";
const features = [
  "rides",
  "courier",
  "food",
  "ecommerce",
  "internationalShipping",
  "localShipping",
  "customsClearance",
  "game",
];
export function MobileReleaseSettings() {
  const [app, setApp] = useState("user");
  const [platform, setPlatform] = useState("android");
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            label: "App",
            value: app,
            change: setApp,
            options: ["user", "rider"],
          },
          {
            label: "Platform",
            value: platform,
            change: setPlatform,
            options: ["android", "ios"],
          },
        ].map((item) => (
          <div className="space-y-2" key={item.label}>
            <Label htmlFor={`release-${item.label}`}>{item.label}</Label>
            <select
              id={`release-${item.label}`}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={item.value}
              onChange={(e) => item.change(e.target.value)}
            >
              {item.options.map((value) => (
                <option key={value} value={value}>
                  {value === "ios"
                    ? "iOS"
                    : value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <CurrentRecord
        key={`${app}:${platform}`}
        title="Release settings"
        path={`/v1/admin/config/mobile/${app}/${platform}`}
      >
        {(data, reload) => (
          <>
            {data.configuration ? (
              <RecordView data={data.configuration} />
            ) : (
              <Notice>
                {data.reason === "missing"
                  ? "Release settings have not been created for this app and platform. Enter the release versions and store link below to publish them."
                  : "The saved release settings need repair. Review and enter the complete configuration below."}
              </Notice>
            )}
            <ActionForm
              onSuccess={reload}
              action={{
                title: "Publish release settings",
                description:
                  "Changes apply to this app and platform. Feature flags advertise availability; they do not install or enable backend services.",
                method: "PUT",
                path: `/v1/admin/config/mobile/${app}/${platform}`,
                preserveRetry: true,
                initial: data.configuration || {
                  latestVersion: "",
                  minimumSupportedVersion: "",
                  storeUrl: "",
                  forceUpdate: false,
                  maintenance: { enabled: false, message: "" },
                  features: Object.fromEntries(
                    features.map((name) => [name, false]),
                  ),
                },
                fields: [
                  field("latestVersion", "Latest version", {
                    pattern: "[0-9]+\\.[0-9]+\\.[0-9]+",
                  }),
                  field(
                    "minimumSupportedVersion",
                    "Minimum supported version",
                    { pattern: "[0-9]+\\.[0-9]+\\.[0-9]+" },
                  ),
                  field("storeUrl", "App store URL"),
                  bool("forceUpdate", "Require update"),
                  field("maintenance", "Maintenance", {
                    type: "group",
                    fields: [
                      bool("enabled", "Maintenance mode"),
                      field("message", "Maintenance message", {
                        type: "textarea",
                        required: false,
                      }),
                    ],
                  }),
                  field("features", "App features", {
                    type: "group",
                    fields: features.map((name) => bool(name)),
                  }),
                ],
                body: (values) => {
                  const latest = values.latestVersion.split(".").map(Number),
                    minimum = values.minimumSupportedVersion
                      .split(".")
                      .map(Number);
                  for (let i = 0; i < 3; i++) {
                    if (minimum[i] > latest[i])
                      throw new Error(
                        "Minimum supported version cannot exceed the latest version.",
                      );
                    if (minimum[i] < latest[i]) break;
                  }
                  if (
                    values.maintenance.enabled &&
                    !values.maintenance.message?.trim()
                  )
                    throw new Error(
                      "Enter a message before enabling maintenance.",
                    );
                  const url = new URL(values.storeUrl);
                  if (
                    url.protocol !== "https:" ||
                    (platform === "android"
                      ? url.hostname !== "play.google.com" ||
                        url.pathname !== "/store/apps/details" ||
                        !url.searchParams.get("id")
                      : url.hostname !== "apps.apple.com")
                  )
                    throw new Error(
                      "Enter the official store URL for this platform.",
                    );
                  return {
                    ...values,
                    maintenance: {
                      enabled: values.maintenance.enabled,
                      message: values.maintenance.message?.trim() || null,
                    },
                    expectedVersion: currentVersion(data),
                  };
                },
              }}
            />
          </>
        )}
      </CurrentRecord>
    </section>
  );
}
