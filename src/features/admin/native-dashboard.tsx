import { FeatureTabs } from "./feature-tabs";
import { TabSectionSkeleton } from "@/components/ui/tab-section-skeleton";
import { RewardCampaignManager } from "./reward-campaigns";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { ClaimTicketButton } from "./support-conversation";
export { SupportConversation as NativeConversation } from "./support-conversation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { segment, type RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ActionForm,
  nairaField,
  DataList,
  ErrorNotice,
  Heading,
  Notice,
  RecordView,
  bool,
  field,
  number,
  select,
  useResource,
} from "./shared";

// A successful replay may contain an old snapshot. Always reload versioned reads.
export function CurrentRecord({
  path,
  title,
  children,
  skeleton,
}: {
  path: string;
  title: string;
  children: (data: RecordData, reload: () => void) => ReactNode;
  skeleton?: ReactNode;
}) {
  const resource = useResource(path);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <RefreshButton loading={resource.loading} onClick={resource.reload}>
          Refresh {title.toLowerCase()}
        </RefreshButton>
      </div>
      {resource.loading &&
        !resource.data &&
        (skeleton || (
          <RecordSkeleton label={`Loading ${title.toLowerCase()}…`} />
        ))}
      {resource.error != null && (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      )}
      {resource.data && children(resource.data, resource.reload)}
    </section>
  );
}
export const currentVersion = (data: RecordData) => {
  if (!Number.isSafeInteger(data.version) || data.version < 0)
    throw new Error("Refresh the record to load its current version.");
  return data.version;
};
const bytes = (text: string, min: number, max: number, label: string) => {
  const size = new TextEncoder().encode(text.trim()).length;
  if (size < min || size > max)
    throw new Error(`${label} must contain ${min}–${max} bytes.`);
  return text.trim();
};
export function AccountRoleEditor({ uid }: { uid: string }) {
  const { user, adminType, refetchUser } = useCurrentUser();
  if (adminType !== "super") return null;
  return (
    <CurrentRecord
      key={uid}
      title="Account role"
      path={`/v1/admin/users/${segment(uid)}/role`}
    >
      {(data, reload) => (
        <>
          <RecordView data={data} />
          <ActionForm
            key={data.version}
            onSuccess={() => {
              if (uid === user?.id) void refetchUser();
              else reload();
            }}
            action={{
              title: "Update administrator role",
              description:
                "Changing access signs this account out of existing sessions. Only existing verified, enabled accounts can be promoted.",
              path: `/v1/admin/users/${segment(uid)}/role`,
              versionPath: `/v1/admin/users/${segment(uid)}/role`,
              refreshBeforeSubmit: true,
              preserveRetry: true,
              initial: { adminType: data.adminType || "none" },
              fields: [
                select(
                  "adminType",
                  ["none", "super", "regular", "customercare", "verifier"],
                  "Administrator role (none removes access)",
                ),
                field("reason", "Reason for change", {
                  type: "textarea",
                  maxLength: 500,
                }),
              ],
              body: (values) => {
                if (!values.reason.trim())
                  throw new Error("Enter a reason for changing access.");
                if (currentVersion(data) < 1)
                  throw new Error(
                    "Reload a valid account version before changing access.",
                  );
                return {
                  adminType:
                    values.adminType === "none" ? null : values.adminType,
                  reason: values.reason.trim(),
                  expectedVersion: data.version,
                };
              },
            }}
          />
        </>
      )}
    </CurrentRecord>
  );
}
export function AdminRoles() {
  const [search] = useSearchParams();
  const selected = search.get("uid") || "";
  const [uid, setUid] = useState(selected);
  const [tab, setTab] = useState("accounts");
  useEffect(() => {
    setUid(selected);
  }, [selected]);
  return (
    <div className="space-y-6">
      <Heading
        title="Administrator access"
        description="Select an account to review access, promote an administrator or change their role."
      />
      {uid && <AccountRoleEditor uid={uid} />}
      <div className="flex flex-wrap gap-2" aria-label="Account lists">
        <Button
          variant={tab === "accounts" ? "default" : "outline"}
          aria-pressed={tab === "accounts"}
          onClick={() => setTab("accounts")}
        >
          All user accounts
        </Button>
        <Button
          variant={tab === "admins" ? "default" : "outline"}
          aria-pressed={tab === "admins"}
          onClick={() => setTab("admins")}
        >
          Administrators
        </Button>
        <Button
          variant={tab === "non_admins" ? "default" : "outline"}
          aria-pressed={tab === "non_admins"}
          onClick={() => setTab("non_admins")}
        >
          Non-admin users
        </Button>
      </div>
      <DataList
        spec={{
          title: tab === "admins" ? "Administrators" : "Select an account",
          path:
            tab === "accounts" ? "/v1/admin/users/search" : "/v1/admin/users",
          defaultPageSize: 25,
          pageSizes: [10, 25, 50],
          search: {
            param: "q",
            label: "Search by name or partial email",
            placeholder: "Enter a name or part of an email",
            help: "Clear the exact email filter before using partial search.",
          },
          key: "items",
          paging: "cursor",
          params: {
            type: "users",
            membership:
              tab === "admins"
                ? "admins"
                : tab === "non_admins"
                  ? "non_admins"
                  : undefined,
          },
          filters: [
            field("email", "Email address", { type: "email", required: false }),
            ...(tab === "admins"
              ? [
                  select(
                    "adminType",
                    ["super", "regular", "customercare", "verifier"],
                    "Administrator subtype",
                  ),
                ]
              : []),
          ],
          idKey: "uid",
          columns: [
            { key: "username", label: "Name" },
            { key: "email" },
            { key: "uid", label: "User ID" },
            { key: "emailVerified" },
            { key: "disabled" },
          ],
          link: (row) => `/admin/users?uid=${segment(row.uid)}`,
          note: "This directory includes all user accounts. Select one to read its current administrator membership.",
        }}
      />
    </div>
  );
}
const coupons = "/v1/admin/coupons";
export function NativeCoupons() {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((n) => n + 1);
  return (
    <div className="space-y-6">
      <Heading
        title="Coupons & signup rewards"
        description="Manage discount templates, generate customer codes and monitor signup issuance."
      />
      <FeatureTabs
        label="Coupon sections"
        sections={[
          {
            id: "campaigns",
            label: "Campaigns",
            content: <RewardCampaignManager />,
          },
          {
            id: "generate",
            label: "Generate code",
            content: (
              <ActionForm
                action={{
                  title: "Generate customer coupon code",
                  description:
                    "Copy a campaign ID from the list and enter the customer’s user ID. The generated code will appear here; this action does not confirm delivery to the customer.",
                  path: `${coupons}/grants`,
                  preserveRetry: true,
                  fields: [
                    field("uid", "Customer user ID"),
                    field("campaignId", "Campaign ID"),
                  ],
                  body: (values) => ({
                    uid: values.uid.trim(),
                    campaignId: values.campaignId.trim(),
                  }),
                  success:
                    "Coupon generated. Copy the code below for the customer.",
                }}
              />
            ),
          },
          {
            id: "signup-coupons",
            label: "Signup coupons",
            content: (
              <CurrentRecord
                title="Signup coupon settings"
                skeleton={<TabSectionSkeleton section="signup-coupons" />}
                path={`${coupons}/signup/settings`}
              >
                {(data, reload) => (
                  <>
                    <RecordView data={data} />
                    {data.selection === "all_eligible" && (
                      <Notice>
                        Signup currently uses all eligible campaigns. Saving
                        here switches to the specific campaign IDs you select.
                      </Notice>
                    )}
                    <ActionForm
                      onSuccess={reload}
                      action={{
                        title: "Save signup coupon settings",
                        method: "PUT",
                        path: `${coupons}/signup/settings`,
                        preserveRetry: true,
                        initial: data,
                        fields: [
                          bool("enabled", "Issue coupons at signup"),
                          field("campaignIds", "Campaign IDs", {
                            type: "list",
                            required: false,
                            help: "Comma-separated IDs from Campaigns. Choose enabled 24- or 48-hour templates.",
                          }),
                        ],
                        body: (values) => {
                          const ids = values.campaignIds;
                          if (
                            ids.length > 100 ||
                            new Set(ids).size !== ids.length
                          )
                            throw new Error(
                              "Choose at most 100 distinct campaigns.",
                            );
                          if (values.enabled && !ids.length)
                            throw new Error(
                              "Choose at least one campaign before enabling signup coupons.",
                            );
                          return {
                            ...values,
                            expectedVersion: currentVersion(data),
                          };
                        },
                      }}
                    />
                  </>
                )}
              </CurrentRecord>
            ),
          },
          {
            id: "processing",
            label: "Processing",
            content: (
              <>
                <Notice>
                  Only failed jobs marked dead can be requeued. Requeueing
                  preserves the original signup entitlement and job history.
                </Notice>
                <DataList
                  revision={revision}
                  spec={{
                    path: `${coupons}/signup/jobs`,
                    key: "items",
                    paging: "cursor",
                    filters: [
                      select("status", [
                        "",
                        "pending",
                        "processing",
                        "retry_wait",
                        "done",
                        "dead",
                      ]),
                    ],
                    columns: [
                      { key: "uid", label: "Customer" },
                      { key: "jobType", label: "Task" },
                      { key: "status" },
                      { key: "attemptCount", label: "Attempts" },
                      { key: "lastError" },
                      {
                        key: "action",
                        label: "Recovery",
                        render: (row) =>
                          row.status === "dead" ? (
                            <ActionForm
                              onSuccess={refresh}
                              action={{
                                title: "Requeue job",
                                preserveRetry: true,
                                path: `${coupons}/signup/jobs/${segment(row.uid)}/requeue`,
                                fields: [
                                  field("reason", "Reason", { maxLength: 500 }),
                                ],
                                body: (values) => ({
                                  jobId: row.id,
                                  expectedGeneration: row.generation,
                                  reason: bytes(
                                    values.reason,
                                    5,
                                    500,
                                    "Reason",
                                  ),
                                }),
                              }}
                            />
                          ) : (
                            "—"
                          ),
                      },
                    ],
                  }}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
export function SignupFunding() {
  return (
    <CurrentRecord
      title="Signup wallet bonus"
      skeleton={<TabSectionSkeleton section="signup" />}
      path="/v1/admin/config/signup-bonus"
    >
      {(data, reload) => (
        <>
          <Notice>
            This is a promotional allowance, not a bank balance. The total
            budget includes amounts already credited. Previously pending signup
            bonuses may still use the allowance after new bonuses are disabled.
          </Notice>
          <RecordView data={data} />
          <ActionForm
            onSuccess={reload}
            action={{
              title: "Save signup bonus and budget",
              path: "/v1/admin/config/signup-bonus",
              method: "PUT",
              preserveRetry: true,
              initial: data,
              fields: [
                bool("enabled", "Credit new signups"),
                nairaField(
                  "amountMinor",
                  "Bonus per signup (kobo)",
                  0,
                  100000000000,
                ),
                nairaField(
                  "budgetMinor",
                  "Total promotional budget (kobo)",
                  data.spentMinor,
                  100000000000000,
                ),
              ],
              description:
                "Enter amounts in naira. The budget is the total allowance, not an amount to add. This changes future signup settings; it does not credit arbitrary wallets.",
              body: (values) => ({
                ...values,
                expectedVersion: currentVersion(data),
              }),
            }}
          />
        </>
      )}
    </CurrentRecord>
  );
}
const tickets = "/v1/admin/support/tickets";
export function NativeSupport() {
  const { adminType } = useCurrentUser();
  const superAdmin = adminType === "super";
  const [search, setSearch] = useSearchParams();
  const selected = search.get("ticket") || "";
  const [revision, setRevision] = useState(0);
  const opener = useRef<HTMLAnchorElement | null>(null);
  const panelTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) panelTitle.current?.focus();
  }, [selected]);
  const close = () => {
    const next = new URLSearchParams(search);
    next.delete("ticket");
    setSearch(next);
    opener.current?.focus();
  };
  return (
    <div className="space-y-6">
      <Heading
        title="Support tickets"
        description="Review customer conversations, claim tickets and manage their status."
      >
        {superAdmin && (
          <Button asChild variant="outline">
            <Link to="/support-closures">Closure history</Link>
          </Button>
        )}
      </Heading>
      <div
        className={`grid items-start gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}
      >
        <div
          className="min-w-0"
          onClickCapture={(event) => {
            const target = (
              event.target as HTMLElement
            ).closest<HTMLAnchorElement>('a[href*="?ticket="]');
            if (target) opener.current = target;
          }}
        >
          <DataList
            revision={revision}
            spec={{
              path: tickets,
              key: "items",
              paging: "cursor",
              params: superAdmin ? undefined : { status: "open" },
              filters: superAdmin
                ? [select("status", ["", "open", "closed"])]
                : undefined,
              note: superAdmin
                ? "Closed tickets remain available to super administrators."
                : "Only open tickets are available. Closed tickets are restricted to super administrators.",
              link: (row) => `/support-tickets?ticket=${segment(row.id)}`,
              columns: [
                { key: "id", label: "Ticket" },
                {
                  key: "customerUid",
                  label: "Customer",
                  render: (row) =>
                    row.customer?.name || "Customer details unavailable",
                },
                { key: "status" },
                { key: "lastMessage", label: "Latest message" },
                { key: "unreadCount", label: "Unread" },
                { key: "updatedAt", label: "Updated" },
              ],
            }}
          />
        </div>
        {selected && (
          <aside
            aria-labelledby="ticket-details-heading"
            className="min-w-0 rounded-xl border bg-card p-5 space-y-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-8rem)] xl:overflow-auto"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="ticket-details-heading"
                tabIndex={-1}
                ref={panelTitle}
                className="text-lg font-semibold"
              >
                Ticket details
              </h2>
              <Button variant="outline" size="sm" onClick={close}>
                Close details
              </Button>
            </div>
            <SupportTicketPanel
              key={selected}
              id={selected}
              onUpdated={() => setRevision((value) => value + 1)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
function SupportTicketPanel({
  id,
  onUpdated,
}: {
  id: string;
  onUpdated: () => void;
}) {
  const resource = useResource(`${tickets}/${segment(id)}`);
  const { user, adminType } = useCurrentUser();
  const blocked = resource.data?.status === "closed" && adminType !== "super";
  const refresh = () => {
    resource.reload();
    onUpdated();
  };
  const state = resource.error ? (
    <ErrorNotice error={resource.error} retry={refresh} />
  ) : resource.loading ? (
    <RecordSkeleton label="Loading ticket…" fields={7} singleColumn />
  ) : blocked ? (
    <Notice>Only a super administrator can view a closed ticket.</Notice>
  ) : null;
  return (
    <>
      {state}
      {resource.data && !blocked && (
        <>
          <div className="[&_dl]:grid-cols-1">
            <RecordView
              data={{
                ticket: resource.data.id,
                customer: resource.data.customerUid,
                customerName:
                  resource.data.customer?.name ||
                  "Customer details unavailable",
                customerEmail:
                  resource.data.customer?.email ||
                  "Customer details unavailable",
                customerPhone:
                  resource.data.customer?.phoneNumber ||
                  "Customer details unavailable",
                status: resource.data.status === "open" ? "Open" : "Closed",
                assignedTo: resource.data.assignedSupportUid || "Unassigned",
                latestMessage: resource.data.lastMessage,
                unreadMessages: resource.data.unreadCount,
                updatedAt: resource.data.updatedAt,
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {resource.data.status === "open" &&
            resource.data.assignedSupportUid !== user?.id ? (
              <ClaimTicketButton id={id} reload={refresh} />
            ) : null}
            <Button
              asChild
              variant={
                resource.data.assignedSupportUid === user?.id
                  ? "default"
                  : "outline"
              }
            >
              <Link to={`/support-tickets/${segment(id)}`}>
                Open conversation
              </Link>
            </Button>
            <RefreshButton onClick={refresh} loading={resource.loading}>
              Refresh ticket
            </RefreshButton>
          </div>
        </>
      )}
    </>
  );
}
