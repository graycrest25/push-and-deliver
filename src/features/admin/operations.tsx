import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import { apiResponse, segment, type RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Heading,
  Notice,
  ErrorNotice,
  RecordView,
  useResource,
  DataList,
  ActionForm,
  ResourcePanel,
  ExportForm,
  field,
  select,
  number,
  type Action,
  type ListSpec,
  type Field,
} from "./shared";
const cols = (...keys: string[]) => keys.map((key) => ({ key }));
const reason = field("reason", "Reason", { type: "textarea", maxLength: 500 });
const asset = field("proof_asset_id", "Evidence file", {
  type: "asset",
});

export function AccountsPage({
  kind = "users",
}: {
  kind?: "users" | "riders" | "vendors" | "admins";
}) {
  const [revision, setRevision] = useState(0);
  const { adminType, user } = useCurrentUser();
  const role = kind === "admins" ? "admin" : undefined;
  const review = kind === "riders" || kind === "vendors";
  const actions: Action[] = [];
  if (canOperate(adminType))
    actions.push({
      title: "Change account status",
      description:
        "This revokes all sessions for the account. You cannot change your own account.",
      path: (v) => `/v1/admin/users/${segment(v.user_id)}/status`,
      fields: [
        field("user_id", "Account ID"),
        select("status", ["disabled", "active"]),
        reason,
      ],
      body: ({ user_id, ...v }) => {
        if (user_id === user?.id)
          throw new Error("You cannot change your own account.");
        return v;
      },
    });
  return (
    <div className="space-y-6">
      <Heading
        title={
          kind === "admins"
            ? "Admin accounts"
            : kind === "riders"
              ? "Rider applications"
              : kind === "vendors"
                ? "Vendor applications"
                : "Users"
        }
        description={
          review
            ? "Discover accounts and open their application for review. Applicants may still have a customer role."
            : "Search registered accounts by name or email."
        }
      />
      {review && (
        <Notice>
          Application status is shown where available. Use the account’s review
          action to open a rider or vendor application; accounts without an
          application return “not found”.
        </Notice>
      )}
      <DataList
        revision={revision}
        spec={{
          path: "/v1/admin/users",
          key: "users",
          paging: "after-id",
          params: role ? { role } : undefined,
          columns: cols(
            "display_name",
            "email",
            "role",
            "status",
            ...(review
              ? [kind === "riders" ? "rider_status" : "vendor_status"]
              : ["admin_type"]),
            "created_at",
          ),
          filters: [
            field("search", "Name or email", { maxLength: 120 }),
            select("status", ["active", "disabled"]),
            ...(!role
              ? [select("role", ["customer", "rider", "vendor", "admin"])]
              : []),
          ],
          link: (row) => `/${review ? kind : "users"}/${segment(row.id)}`,
          note: "Accounts are ordered by ID. Application queues cannot be filtered by approval state in the current service.",
        }}
      />
      {canOperate(adminType) && (
        <ExportForm type={kind === "riders" ? "riders" : "accounts"} />
      )}{" "}
      {actions.map((action) => (
        <ActionForm
          key={action.title}
          action={action}
          onSuccess={() => setRevision((n) => n + 1)}
        />
      ))}
    </div>
  );
}
export function AccountPage({
  kind,
}: {
  kind: "users" | "riders" | "vendors";
}) {
  const { id = "" } = useParams();
  const { adminType, user } = useCurrentUser();
  const resource = useResource(
    kind === "users" ? null : `/v1/admin/${kind}/${segment(id)}`,
  );
  const profile = resource.data;
  const reviewAllowed = canOperate(adminType) || adminType === "verifier";
  return (
    <div className="space-y-6">
      <Heading
        title={
          kind === "users"
            ? "Account"
            : kind === "riders"
              ? "Rider application"
              : "Vendor application"
        }
        description={`Account ID: ${id}`}
      >
        <Button asChild variant="outline">
          <Link to={`/${kind}`}>Back to list</Link>
        </Button>
      </Heading>
      {kind === "users" ? (
        <>
          <Notice>
            Full account profiles are not available in this workspace yet. Use
            the account list for identity and status.
          </Notice>
          {reviewAllowed && (
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to={`/riders/${segment(id)}`}>Rider application</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/vendors/${segment(id)}`}>Vendor application</Link>
              </Button>
            </div>
          )}
        </>
      ) : resource.error ? (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      ) : resource.loading ? (
        <RecordSkeleton label="Loading application…" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Application details</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordView data={profile} />
            {Array.isArray(profile?.document_asset_ids) && (
              <div className="mt-6 space-y-3">
                <h2 className="font-semibold">Private documents</h2>
                {profile.document_asset_ids.map(
                  (assetId: string, i: number) => (
                    <PrivateAsset
                      key={assetId}
                      id={assetId}
                      label={
                        Object.entries(profile.document_labels || {}).find(
                          ([, value]) => value === assetId,
                        )?.[0] || `Document ${i + 1}`
                      }
                    />
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {profile &&
        reviewAllowed &&
        id !== user?.id &&
        profile.status === "pending" && (
          <ActionForm
            action={{
              title: "Review application",
              description:
                "Approval rechecks the required documents and eligibility. A rejection needs a reason.",
              path: `/v1/admin/${kind}/${segment(id)}/review`,
              fields: [
                select("status", ["approved", "rejected"], "Decision"),
                { ...reason, required: false },
              ],
              body: (v) => {
                if (v.status === "rejected" && !v.reason.trim())
                  throw new Error("Enter a reason for rejection.");
                return v;
              },
            }}
            onSuccess={resource.reload}
          />
        )}{" "}
      {adminType === "super" && kind !== "vendors" && (
        <ResourcePanel
          title="Lifetime service counts"
          path={`/v1/admin/analytics/ride-counts?account_type=${kind === "riders" ? "rider" : "customer"}&account_id=${segment(id)}`}
        />
      )}
    </div>
  );
}
function PrivateAsset({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiResponse(`/v1/media/${segment(id)}/content`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const extension =
        (
          {
            "application/pdf": "pdf",
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
          } as Record<string, string>
        )[blob.type] || "bin";
      anchor.download = `document-${id}.${extension}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        <Button variant="outline" size="sm" onClick={download} disabled={busy}>
          {busy ? "Downloading…" : "Download private document"}
        </Button>
      </div>
      {error != null && <ErrorNotice error={error} />}
    </div>
  );
}

const lists: Record<string, ListSpec> = {
  shipments: {
    path: "/v1/shipments",
    key: "shipments",
    paging: "cursor",
    columns: cols(
      "tracking_code",
      "kind",
      "fulfillment",
      "status",
      "customer_id",
      "created_at",
    ),
    filters: [field("status", "Exact status")],
    link: (r) => `/shipment-orders/${segment(r.id)}`,
  },
  rides: {
    path: "/v1/rides/trips",
    paging: "offset",
    columns: cols(
      "id",
      "service",
      "status",
      "customer_id",
      "rider_id",
      "created_at",
    ),
    filters: [field("status", "Exact status")],
    link: (r) => `/ride-hailing/${segment(r.id)}`,
  },
  marketplace: {
    path: "/v1/marketplace/orders",
    paging: "offset",
    columns: cols(
      "id",
      "kind",
      "status",
      "customer_id",
      "vendor_id",
      "created_at",
    ),
    filters: [field("status", "Status, current or history")],
    link: (r) => `/product-orders/${segment(r.id)}`,
    note: "The service lists all marketplace orders together. Food and ecommerce orders are identified by their kind.",
  },
  withdrawals: {
    path: "/v1/payouts/withdrawals",
    paging: "after-id",
    columns: cols(
      "id",
      "user_id",
      "amount_minor",
      "status",
      "review_required",
      "created_at",
    ),
    filters: [
      select("status", [
        "requested",
        "approved",
        "submitting",
        "pending",
        "otp",
        "succeeded",
        "failed",
        "reversed",
        "cancelled",
      ]),
    ],
    link: (r) => `/withdrawals/${segment(r.id)}`,
  },
};
export function OrdersPage({
  kind,
}: {
  kind: "shipments" | "rides" | "marketplace" | "withdrawals";
}) {
  const { adminType } = useCurrentUser();
  return (
    <div className="space-y-6">
      <Heading
        title={
          {
            shipments: "Shipment orders",
            rides: "Ride hailing",
            marketplace: "Marketplace orders",
            withdrawals: "Withdrawals",
          }[kind] || "Orders"
        }
        description="Open a record to inspect its current state and available actions."
      />
      <DataList spec={lists[kind]} />
      {kind === "withdrawals" && canOperate(adminType) && (
        <ExportForm type="withdrawals" />
      )}
    </div>
  );
}
const contactFields: Field[] = [
  "name",
  "email",
  "phone",
  "address",
  "postal_code",
].map((key) =>
  field(key, key.replace("_", " "), {
    required: ["name", "email", "phone"].includes(key),
    ...(key === "email" ? { type: "email" as const } : {}),
  }),
);
const customsFields: Field[] = [
  select("fulfillment", ["clearance_only", "pickup_delivery"]),
  field("office_id", "Office ID", { required: false }),
  field("details", "Customs intake", {
    type: "group",
    fields: [
      field("sender", "Sender", { type: "group", fields: contactFields }),
      field("receiver", "Receiver", {
        type: "group",
        fields: contactFields.map((f) => ({ ...f, required: false })),
      }),
      field("description", "Description", { type: "textarea" }),
      number("declared_value_minor", "Declared value (minor units)"),
      field("country_code", "Country code", { pattern: "[A-Z]{2}" }),
      number("weight_grams", "Weight (grams)", 0, 100000000),
      field("dimensions", "Dimensions (millimetres)", {
        type: "group",
        fields: ["length_mm", "width_mm", "height_mm"].map((key) =>
          number(key),
        ),
      }),
      field("pickup", "Pickup coordinates", {
        type: "group",
        fields: [
          number("latitude_e7", "Latitude × 10,000,000", -900000000, 900000000),
          number(
            "longitude_e7",
            "Longitude × 10,000,000",
            -1800000000,
            1800000000,
          ),
        ],
      }),
      field("assets", "Evidence assets", {
        type: "rows",
        fields: [
          field("id", "Evidence file", { type: "asset" }),
          select("purpose", [
            "package",
            "transport_document",
            "packing_list",
            "invoice",
          ]),
        ],
      }),
    ],
  }),
];
function shipmentActions(id: string, data: RecordData): Action[] {
  const root = `/v1/shipments/${segment(id)}`;
  const admin = `/v1/admin/shipments/${segment(id)}`;
  const actions: Action[] = [];
  if (data.kind === "customs" && data.status === "customs_review")
    actions.push({
      title: "Update customs intake",
      path: `${root}/customs`,
      method: "PUT",
      fields: customsFields,
      initial: data,
      body: (v) => ({ ...v, expected_version: data.version }),
      description:
        "Replace the complete intake at the current version. A ready transport document and sender contact details are required.",
    });
  if (data.status === "placed" && data.fulfillment === "pickup_delivery")
    actions.push({
      title: "Assign rider",
      path: `${root}/accept`,
      fields: [field("rider_id", "Rider account ID")],
    });
  if (data.status === "en_route_hq")
    actions.push({
      title: "Receive at office",
      path: `${root}/receive-at-office`,
      description: "Confirm that the shipment has arrived at the office.",
    });
  if (data.status === "at_hq" && data.due_minor === 0)
    actions.push({
      title: "Dispatch shipment",
      path: `${root}/dispatch`,
      fields: [
        field("carrier_reference", "Carrier reference", { maxLength: 150 }),
      ],
    });
  if (data.status === "in_transit" && data.due_minor === 0)
    actions.push({
      title: "Verify delivery",
      path: `${root}/deliver`,
      fields: [
        field("proof_id", "Delivery proof ID"),
        field("code", "Delivery code"),
      ],
    });
  if (["accepted", "in_transit"].includes(data.status))
    actions.push({
      title: "Reissue proof",
      path: `${root}/proofs/${data.status === "accepted" ? "pickup" : "delivery"}`,
      description:
        "The code is sent through the authorized notification channel. Allow at least 60 seconds between requests.",
    });
  if (
    ["placed", "accepted", "customs_review", "clearance_ready"].includes(
      data.status,
    )
  )
    actions.push({
      title: "Cancel shipment",
      path: `${root}/cancel`,
      description:
        "Cancels this shipment, releases its assignment, and applies eligible refunds.",
    });
  if (!["cancelled", "delivered", "in_transit"].includes(data.status))
    actions.push({
      title: "Assess charge",
      path: `${admin}/charges`,
      fields: [
        number("amount_minor", "Amount (minor units)", 1),
        reason,
        number("pickup_minor", "Pickup component (minor units)"),
        number("weight_grams", "Assessed weight (grams)", 0, 100000000),
      ],
      description:
        "100 minor units = ₦1 for NGN. Clearance-only shipments require a zero pickup component. A new charge is payable by the customer.",
    });
  if (
    Array.isArray(data.charges) &&
    data.charges.some((c: RecordData) => c.status === "due") &&
    !["delivered", "cancelled"].includes(data.status)
  )
    actions.push({
      title: "Record evidenced cash receipt",
      path: (v) => `${admin}/charges/${segment(v.charge_id)}/cash`,
      fields: [
        select(
          "charge_id",
          data.charges
            .filter((c: RecordData) => c.status === "due")
            .map((c: RecordData) => c.id),
          "Charge ID",
        ),
        field("reference", "Receipt reference"),
        asset,
      ],
      body: ({ charge_id, ...v }) => v,
    });
  if (
    data.kind === "customs" &&
    data.fulfillment === "clearance_only" &&
    data.status === "clearance_ready" &&
    data.due_minor === 0 &&
    data.paid_minor > 0
  )
    actions.push({
      title: "Complete clearance",
      path: `${admin}/complete-clearance`,
      fields: [
        asset,
        field("reference", "Clearance reference", { maxLength: 150 }),
      ],
      body: (v) => ({ ...v, expected_version: data.version }),
    });
  return actions;
}
export function OrderPage({
  kind,
}: {
  kind: "shipments" | "rides" | "marketplace" | "withdrawals";
}) {
  const { id = "" } = useParams();
  const { adminType, user } = useCurrentUser();
  const root = lists[kind].path;
  const resource = useResource(`${root}/${segment(id)}`);
  const data = resource.data;
  let actions: Action[] = [];
  if (data && canOperate(adminType)) {
    if (kind === "shipments") actions = shipmentActions(id, data);
    if (
      kind === "rides" &&
      ["searching", "accepted", "arrived"].includes(data.status)
    )
      actions = [
        {
          title: "Cancel ride",
          path: `${root}/${segment(id)}/cancel`,
          fields: [reason],
        },
      ];
    if (
      kind === "marketplace" &&
      !["completed", "cancelled", "picked_up", "arrived"].includes(data.status)
    )
      actions = [
        {
          title: "Cancel order",
          path: `${root}/${segment(id)}/cancel`,
          fields: [reason],
        },
      ];
    if (kind === "withdrawals") {
      if (data.status === "requested" && data.user_id !== user?.id)
        actions.push({
          title: "Approve withdrawal",
          path: `${root}/${segment(id)}/approve`,
          description:
            "Approval queues processing; it does not confirm payment arrival.",
        });
      if (["requested", "approved"].includes(data.status))
        actions.push({
          title: "Reject withdrawal",
          path: `${root}/${segment(id)}/reject`,
          description:
            "Cancels an eligible withdrawal and refunds reserved funds under the payout rules.",
        });
      if (["submitting", "pending", "otp", "succeeded"].includes(data.status))
        actions.push({
          title: "Reconcile provider outcome",
          path: `${root}/${segment(id)}/reconcile`,
          description:
            "Verifies the original transfer reference. Does not create a new transfer.",
        });
      if (data.status === "otp")
        actions.push({
          title: "Finalize transfer",
          path: `${root}/${segment(id)}/finalize`,
          fields: [
            field("otp", "Provider OTP", { pattern: "[0-9]{6}", maxLength: 6 }),
          ],
          success:
            "Request received. Refresh and reconcile the outcome before treating it as paid.",
        });
      if (
        data.review_required &&
        data.user_id !== user?.id &&
        ["submitting", "pending", "otp"].includes(data.status)
      )
        actions.push({
          title: "Recover transfer",
          path: `${root}/${segment(id)}/recover`,
          fields: [reason],
          success:
            "Recovery queued. Refresh this withdrawal to check progress.",
        });
    }
  }
  return (
    <div className="space-y-6">
      <Heading
        title={
          kind === "shipments"
            ? "Shipment details"
            : kind === "withdrawals"
              ? "Withdrawal details"
              : kind === "rides"
                ? "Ride details"
                : "Order details"
        }
        description={id}
      >
        <RefreshButton onClick={resource.reload} loading={resource.loading}>
          Refresh record
        </RefreshButton>
      </Heading>
      {resource.error ? (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      ) : resource.loading ? (
        <RecordSkeleton label="Loading record…" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current record</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordView data={data} />
          </CardContent>
        </Card>
      )}
      {data && (
        <>
          {kind === "shipments" && (
            <ResourcePanel
              title="Tracking events (first 100)"
              path={`${root}/${segment(id)}/tracking?limit=100`}
            />
          )}{" "}
          {actions.map((action) => (
            <ActionForm
              key={`${id}:${data.version || data.updated_at || data.status}:${action.title}`}
              action={action}
              onSuccess={resource.reload}
            />
          ))}
        </>
      )}
    </div>
  );
}
export function SupportPage() {
  return (
    <div className="space-y-6">
      <Heading
        title="Support tickets"
        description="Recent activity first. Open a conversation to reply, close, or reopen a ticket."
      />
      <DataList
        spec={{
          path: "/v1/admin/support/tickets",
          key: "tickets",
          paging: "after-cursor",
          columns: [
            ...cols("subject", "status", "user_id"),
            {
              key: "latest_message",
              label: "Latest message",
              render: (row) => row.latest_message?.body || "—",
            },
            ...cols("updated_at"),
          ],
          link: (r) => `/support-tickets/${segment(r.id)}`,
          note: "Use Refresh to check for new activity. Ticket activity can change the order between pages.",
        }}
      />
    </div>
  );
}
export function ConversationPage() {
  const { id = "" } = useParams();
  const [revision, setRevision] = useState(0);
  const root = `/v1/support/tickets/${segment(id)}`;
  return (
    <div className="space-y-6">
      <Heading
        title="Ticket conversation"
        description={`Ticket ${id}. Newest messages appear first; Next loads older messages.`}
      />
      <DataList
        revision={revision}
        spec={{
          path: `${root}/messages`,
          key: "messages",
          paging: "after-cursor",
          columns: cols("sender_id", "body", "asset_id", "created_at"),
        }}
      />
      <ActionForm
        action={{
          title: "Send reply",
          description:
            "Write a message or attach a file. Reopen closed tickets before replying.",
          body: (v) => {
            if (!v.body?.trim() && !v.asset_id)
              throw new Error("Write a message or attach a ready file.");
            return v;
          },
          path: `${root}/messages`,
          fields: [
            field("body", "Message", {
              type: "textarea",
              maxLength: 4000,
              required: false,
            }),
            field("asset_id", "Attachment", {
              type: "asset",
              ownAsset: true,
              required: false,
              help: "Closed tickets must be reopened before replying.",
            }),
          ],
        }}
        onSuccess={() => setRevision((n) => n + 1)}
      />
      <ActionForm
        action={{
          title: "Change ticket status",
          path: `${root}/status`,
          fields: [select("status", ["closed", "open"])],
        }}
        onSuccess={() => setRevision((n) => n + 1)}
      />
    </div>
  );
}
export function ReferralsPage() {
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-6">
      <Heading
        title="Referral links"
        description="Create and monitor campaign links, including disabled and expired links."
      />
      <DataList
        revision={revision}
        spec={{
          path: "/v1/admin/referrals/links",
          key: "links",
          paging: "after-id",
          columns: cols(
            "name",
            "code",
            "active",
            "claimed_count",
            "max_claims",
            "expires_at",
          ),
        }}
      />
      <ActionForm
        action={{
          title: "Create referral link",
          path: "/v1/admin/referrals/links",
          fields: [
            field("name", "Name", { maxLength: 100 }),
            field("campaign_id", "Campaign ID", { required: false }),
            number("max_claims", "Maximum claims", 1, 1000000),
          ],
        }}
        onSuccess={() => setRevision((n) => n + 1)}
      />
      <ActionForm
        action={{
          title: "Enable or disable link",
          path: (v) => `/v1/admin/referrals/links/${segment(v.id)}/status`,
          fields: [
            field("id", "Link ID"),
            select("state", ["enabled", "disabled"], "Availability"),
          ],
          body: (v) => ({ active: v.state === "enabled" }),
        }}
        onSuccess={() => setRevision((n) => n + 1)}
      />
      <Notice>
        Referral attribution history, global summaries, and referral CSV exports
        are not available in the current service. Link claims are not a
        replacement for referral attribution totals.
      </Notice>
    </div>
  );
}
export function PaymentsPage() {
  return (
    <div className="space-y-6">
      <Heading
        title="Payment review"
        description="Inspect quarantined evidence and reconcile provider payment windows."
      />
      <DataList
        spec={{
          path: "/v1/admin/payments/webhook-receipts",
          key: "items",
          paging: "cursor",
          params: { status: "quarantined" },
          filters: [
            select("status", [
              "pending",
              "processing",
              "completed",
              "ignored",
              "quarantined",
            ]),
          ],
          columns: cols(
            "id",
            "event",
            "reference",
            "status",
            "attempts",
            "replayCount",
            "receivedAt",
          ),
          link: (r) => `/payments/receipts/${segment(r.id)}`,
        }}
      />
      <ActionForm
        action={{
          title: "Start reconciliation",
          path: "/v1/admin/payments/reconcile",
          fields: [
            field("from", "From", { type: "datetime-local" }),
            field("to", "To (exclusive)", { type: "datetime-local" }),
            {
              ...number("maxPages", "Maximum provider pages", 1, 100),
              default: 10,
            },
          ],
          description:
            "Choose a window of at most 31 days. This queues verification; it does not immediately settle payments.",
          success:
            "Reconciliation queued. Use the returned job ID below to check progress.",
        }}
      />
      <Lookup
        title="Check reconciliation job"
        base="/v1/admin/payments/reconciliations"
      />
    </div>
  );
}
export function Lookup({
  title,
  base,
  suffix = "",
}: {
  title: string;
  base: string;
  suffix?: string;
}) {
  const [id, setId] = useState("");
  const [chosen, setChosen] = useState("");
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setChosen(id.trim());
        }}
      >
        <label className="space-y-2 text-sm">
          {title}
          <input
            className="block h-10 rounded-md border bg-card px-3"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
        </label>
        <Button>Look up</Button>
      </form>
      {chosen && (
        <ResourcePanel
          key={chosen}
          title={title}
          path={`${base}/${segment(chosen)}${suffix}`}
        />
      )}
    </div>
  );
}
export function ReceiptPage() {
  const { id = "" } = useParams();
  const resource = useResource(
    `/v1/admin/payments/webhook-receipts/${segment(id)}`,
  );
  return (
    <div className="space-y-6">
      <Heading title="Payment receipt" description={id} />
      {resource.error ? (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      ) : resource.loading ? (
        <RecordSkeleton label="Loading receipt…" />
      ) : (
        <RecordView data={resource.data} />
      )}{" "}
      {resource.data?.status === "quarantined" && (
        <ActionForm
          action={{
            title: "Replay receipt",
            path: `/v1/admin/payments/webhook-receipts/${segment(id)}/replay`,
            fields: [reason],
            description:
              "Resolve the underlying issue first. Explain the correction in at least 10 characters.",
            success: "Replay queued. Refresh the receipt to check processing.",
          }}
          onSuccess={resource.reload}
        />
      )}
    </div>
  );
}
