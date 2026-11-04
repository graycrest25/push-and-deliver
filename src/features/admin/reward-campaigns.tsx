import { useState } from "react";
import { api, queryPath, segment, type RecordData } from "@/lib/api";
import { ActionForm, DataList, bool, field, number, select } from "./shared";
const currentVersion = (row: RecordData) => {
  if (!Number.isSafeInteger(row.version) || row.version < 0)
    throw new Error("Refresh the campaign to load its current version.");
  return row.version;
};
const campaigns = "/v1/admin/coupons/campaigns";
const services = ["courier", "express", "local", "ridehailing"];
async function currentCampaign(id: string) {
  let cursor: string | undefined;
  const visited = new Set<string>();
  for (let page = 0; page < 200; page++) {
    const result = await api(queryPath(campaigns, { limit: 100, cursor }));
    const campaign = result.items?.find((item: RecordData) => item.id === id);
    if (campaign) return campaign;
    if (!result.hasMore || !result.nextCursor) break;
    if (visited.has(result.nextCursor))
      throw new Error(
        "Campaign pagination repeated a cursor. Refresh the campaign list.",
      );
    visited.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error(
    "The campaign is no longer available in the current list. Refresh before editing.",
  );
}
export function RewardCampaignManager({
  forGame = false,
}: {
  forGame?: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  const fresh = (row: RecordData) => ({
    versionRead: () => currentCampaign(row.id),
    refreshBeforeSubmit: true,
    validateCurrent: (current: RecordData) => {
      if (
        current.enabled !== row.enabled ||
        !!current.gameEligible !== !!row.gameEligible
      )
        throw new Error(
          "Campaign settings changed. Refresh the list and review the current values before editing.",
        );
    },
  });
  return (
    <div className="space-y-4">
      {forGame && (
        <p className="text-sm text-muted-foreground">
          Game rewards use enabled, game-eligible campaigns. Rules do not
          contain campaign IDs. Eligibility and availability are checked by the
          server; an enabled game does not guarantee a reward.
        </p>
      )}
      <ActionForm
        onSuccess={refresh}
        action={{
          title: forGame ? "Create game reward campaign" : "Create campaign",
          path: campaigns,
          preserveRetry: true,
          fields: [
            field("title", "Campaign title", { maxLength: 200 }),
            number("percentageDiscount", "Discount (%)", 1, 100),
            select("validForHours", ["24", "48"], "Valid for (hours)"),
            ...services.map((service) =>
              bool(
                service,
                service === "ridehailing"
                  ? "Ride hailing"
                  : service[0].toUpperCase() + service.slice(1),
              ),
            ),
            { ...bool("enabled", "Campaign active"), default: forGame },
            {
              ...bool("gameEligible", "Eligible for game rewards"),
              default: forGame,
            },
          ],
          body: (values) => {
            const title = String(values.title).trim();
            if (!title || new TextEncoder().encode(title).length > 200)
              throw new Error("Campaign title must contain 1–200 UTF-8 bytes.");
            if (
              !Number.isInteger(values.percentageDiscount) ||
              values.percentageDiscount < 1 ||
              values.percentageDiscount > 100
            )
              throw new Error(
                "Discount must be a whole percentage from 1 to 100.",
              );
            if (![24, 48].includes(Number(values.validForHours)))
              throw new Error("Select 24 or 48 hours of validity.");
            const eligibleServices = services.filter(
              (service) => values[service],
            );
            if (!eligibleServices.length)
              throw new Error("Select at least one eligible service.");
            return {
              title,
              percentageDiscount: values.percentageDiscount,
              validForHours: Number(values.validForHours),
              eligibleServices,
              enabled: values.enabled,
              gameEligible: values.gameEligible,
            };
          },
        }}
      />
      <DataList
        revision={revision}
        spec={{
          title: "Reward campaigns",
          path: campaigns,
          key: "items",
          paging: "cursor",
          note: "Campaigns are shown newest first. This page does not measure live reward availability or reserved quota.",
          columns: [
            { key: "title" },
            { key: "id", label: "Campaign ID" },
            { key: "percentageDiscount", label: "Discount (%)" },
            { key: "validForHours", label: "Hours" },
            {
              key: "eligibleServices",
              label: "Services",
              render: (row) => (row.eligibleServices || []).join(", "),
            },
            { key: "enabled", label: "Active" },
            {
              key: "gameEligible",
              label: "Game eligible",
              render: (row) =>
                row.gameEligible === true
                  ? "Yes"
                  : row.gameEligible === false
                    ? "No"
                    : "Unavailable",
            },
            {
              key: "actions",
              label: "Manage",
              render: (row) => (
                <div className="min-w-56 space-y-2">
                  <ActionForm
                    key={`enabled:${row.id}:${row.version}`}
                    onSuccess={refresh}
                    action={{
                      title: row.enabled
                        ? "Disable campaign"
                        : "Enable campaign",
                      path: `${campaigns}/${segment(row.id)}/status`,
                      preserveRetry: true,
                      ...fresh(row),
                      body: () => ({
                        enabled: !row.enabled,
                        expectedVersion: currentVersion(row),
                      }),
                    }}
                  />
                  <ActionForm
                    key={`eligible:${row.id}:${row.version}`}
                    onSuccess={refresh}
                    action={{
                      title: row.gameEligible
                        ? "Remove from game rewards"
                        : "Include in game rewards",
                      path: `${campaigns}/${segment(row.id)}/status`,
                      preserveRetry: true,
                      ...fresh(row),
                      body: () => ({
                        enabled: row.enabled,
                        expectedVersion: currentVersion(row),
                        gameEligible: !row.gameEligible,
                      }),
                    }}
                  />
                </div>
              ),
            },
          ],
        }}
      />
    </div>
  );
}
