import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { SignupCouponSettings, SignupWalletBonus } from "./signup-rewards";
import { Link } from "react-router-dom";
import { BroadcastHistory } from "./broadcasts";
import { MobileReleaseSettings } from "./release-settings";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { segment } from "@/lib/api";
import { broadcastBody } from "@/lib/admin-contracts";
import {
  Heading,
  human,
  Notice,
  DataList,
  ActionForm,
  nairaField,
  ResourcePanel,
  RecordView,
  ErrorNotice,
  useResource,
  field,
  select,
  number,
  bool,
  type Field,
  type Action,
} from "./shared";
import { Lookup } from "./operations";
const cols = (...keys: string[]) => keys.map((key) => ({ key }));
const list = (name: string, label: string): Field =>
  field(name, label, {
    type: "list",
    required: false,
    help: "Separate IDs with commas.",
  });
const rows = (name: string, label: string, fields: Field[]): Field =>
  field(name, label, { type: "rows", fields });
const group = (name: string, label: string, fields: Field[]): Field =>
  field(name, label, { type: "group", fields });
const money = (name: string, label?: string, min = 0, max = 100000000000) =>
  nairaField(
    name,
    label || `${name.replace(/_minor$/, "").replace(/_/g, " ")} (minor units)`,
    min,
    max,
  );
const id = field("id", "Record ID");
const name = field("name", "Name", { maxLength: 100 });
const withoutID = ({ id, ...value }: Record<string, unknown>) => value;
const mobileFields = [
  bool("maintenance"),
  field("minimum_version", "Minimum version", {
    pattern: "[0-9]+\\.[0-9]+\\.[0-9]+",
  }),
  field("latest_version", "Latest version", {
    pattern: "[0-9]+\\.[0-9]+\\.[0-9]+",
  }),
  field("support_email", "Support email", { type: "email", required: false }),
  field("head_office_address", "Head office address", {
    required: false,
    maxLength: 500,
  }),
];
const tariffFields = [
  name,
  field("carrier", "Carrier"),
  select("direction", ["export", "import"]),
  select("cargo", ["document", "non_document"]),
  bool("historical"),
  number(
    "volumetric_divisor_mm3_per_gram",
    "Volumetric divisor (mm³ per gram)",
    0,
    1000000000,
  ),
  rows("zones", "Zones", [
    number("number", "Zone number", 1, 100),
    name,
    list("countries", "Country codes"),
    rows("rates", "Weight bands", [
      number("weight_grams", "Weight (grams)", 1, 100000000),
      money("amount_minor", "Amount (minor units)", 1),
    ]),
  ]),
];
const domesticFields = [
  field("name", "Tariff name", { maxLength: 150 }),
  bool("historical"),
  rows("rates", "Rates", [
    field("lga_id", "LGA ID"),
    money("fee_minor", "Delivery fee (minor units)"),
    bool("active"),
  ]),
];

export function OfficesPage() {
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-6">
      <Heading
        title="Head offices"
        description="Manage office addresses and pickup pricing. Existing bookings retain their captured office details."
      />
      <DataList
        revision={revision}
        spec={{
          path: "/v1/shipping/offices",
          key: "offices",
          paging: "none",
          params: { include_inactive: true },
          columns: cols(
            "id",
            "name",
            "address",
            "base_pickup_minor",
            "per_km_minor",
            "active",
          ),
          link: (r) => `/head-offices/${segment(r.id)}`,
        }}
      />
      <ActionForm
        action={{
          title: "Create or replace office",
          path: (v) => `/v1/admin/shipping/offices/${segment(v.id)}`,
          method: "PUT",
          fields: [id, ...officeFields],
          body: withoutID,
          description:
            "Enter the complete office record. Enter monetary values in naira; coordinates use degrees multiplied by 10,000,000.",
        }}
        onSuccess={() => setRevision((n) => n + 1)}
      />
    </div>
  );
}
const officeFields = [
  name,
  field("address", "Address", { maxLength: 500 }),
  number("latitude_e7", "Latitude × 10,000,000", -900000000, 900000000),
  number("longitude_e7", "Longitude × 10,000,000", -1800000000, 1800000000),
  money("base_pickup_minor", "Base pickup (minor units)"),
  money("per_km_minor", "Per kilometre (minor units)", 0, 100000000),
  bool("active"),
];
export function OfficePage() {
  const { id = "" } = useParams();
  const r = useResource("/v1/shipping/offices?include_inactive=true");
  const office = r.data?.offices?.find((v: { id: string }) => v.id === id);
  return (
    <div className="space-y-6">
      <Heading title="Edit office" description={id} />
      {r.error ? (
        <ErrorNotice error={r.error} retry={r.reload} />
      ) : r.loading ? (
        <RecordSkeleton label="Loading office…" />
      ) : office ? (
        <ActionForm
          key={JSON.stringify(office)}
          action={{
            title: "Save office",
            path: `/v1/admin/shipping/offices/${segment(id)}`,
            method: "PUT",
            fields: officeFields,
            initial: office,
          }}
          onSuccess={r.reload}
        />
      ) : (
        <Notice>Office not found.</Notice>
      )}
    </div>
  );
}
export function TariffsPage({ domestic = false }: { domestic?: boolean }) {
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-6">
      <Heading
        title={domestic ? "Local shipment tariffs" : "International shipment tariffs"}
        description="Create a draft, inspect its rates, then publish a reviewed version. Active tariffs cannot be edited in place."
      />
      <DataList
        revision={revision}
        spec={{
          path: domestic
            ? "/v1/admin/geography/tariffs"
            : "/v1/shipping/tariffs",
          key: "tariffs",
          paging: "none",
          params: domestic ? undefined : { include_inactive: true },
          columns: cols(
            "id",
            "name",
            ...(domestic ? [] : ["carrier", "direction", "cargo"]),
            "status",
            "historical",
          ),
          link: (r) =>
            `/${domestic ? "delivery-zones" : "export-rates"}/tariffs/${segment(r.id)}`,
          note: "The catalogue is bounded to the newest 100 tariffs; no continuation is available.",
        }}
      />
      <ActionForm
        action={{
          title: "Save draft tariff",
          path: (v) =>
            `/v1/admin/${domestic ? "geography" : "shipping"}/tariffs/${segment(v.id)}`,
          method: "PUT",
          fields: [id, ...(domestic ? domesticFields : tariffFields)],
          body: withoutID,
          description:
            "Saving replaces the entire draft. Add every required rate. Enter amounts in naira. Publish only after reviewing the saved draft.",
        }}
        onSuccess={() => setRevision((n) => n + 1)}
      />
      {domestic ? <Geography /> : <Countries />}
    </div>
  );
}
export function TariffPage({ domestic = false }: { domestic?: boolean }) {
  const { id = "" } = useParams();
  const root = `/v1/${domestic ? "admin/geography" : "shipping"}/tariffs/${segment(id)}`;
  const r = useResource(root);
  return (
    <div className="space-y-6">
      <Heading title="Tariff review" description={id} />
      {r.error ? (
        <ErrorNotice error={r.error} retry={r.reload} />
      ) : r.loading ? (
        <RecordSkeleton label="Loading tariff…" />
      ) : (
        <>
          <RecordView data={r.data} />
          {r.data?.status === "draft" && (
            <ActionForm
              key={JSON.stringify(r.data)}
              action={{
                title: "Save draft changes",
                path: `/v1/admin/${domestic ? "geography" : "shipping"}/tariffs/${segment(id)}`,
                method: "PUT",
                fields: domestic ? domesticFields : tariffFields,
                initial: r.data,
                description: "This replaces every rate in the draft.",
              }}
              onSuccess={r.reload}
            />
          )}{" "}
          {r.data && (
            <ActionForm
              action={{
                title:
                  r.data.status === "draft"
                    ? "Publish reviewed tariff"
                    : "Retire tariff",
                path: `/v1/admin/${domestic ? "geography" : "shipping"}/tariffs/${segment(id)}/publish`,
                fields: [
                  bool("reviewed", "I have reviewed the complete tariff"),
                ],
                body: (v) => {
                  if (!v.reviewed)
                    throw new Error(
                      "Review and confirm the tariff before continuing.",
                    );
                  return { reviewed: true, retire: r.data?.status !== "draft" };
                },
                description:
                  r.data.status === "draft"
                    ? "Publishing activates this tariff and retires the previous active version for this pricing scope."
                    : "Retiring stops this tariff from being used for new quotes.",
              }}
              onSuccess={r.reload}
            />
          )}
        </>
      )}
    </div>
  );
}
function Geography() {
  return (
    <>
      <ResourcePanel title="Active states" path="/v1/geography/states" />
      <Lookup
        title="State ID — inspect LGAs"
        base="/v1/geography/states"
        suffix="/lgas"
      />
      <ActionForm
        action={{
          title: "Save state",
          path: (v) => `/v1/admin/geography/states/${segment(v.id)}`,
          method: "PUT",
          fields: [
            field("id", "State slug", { pattern: "[a-z0-9][a-z0-9-]{0,119}" }),
            name,
            bool("active"),
          ],
          body: withoutID,
        }}
      />
      <ActionForm
        action={{
          title: "Save local government area",
          path: (v) => `/v1/admin/geography/lgas/${segment(v.id)}`,
          method: "PUT",
          fields: [
            field("id", "LGA slug", { pattern: "[a-z0-9][a-z0-9-]{0,119}" }),
            field("state_id", "State ID"),
            name,
            bool("active"),
          ],
          body: withoutID,
          description: "An existing LGA cannot move to another state.",
        }}
      />
    </>
  );
}
function Countries() {
  return (
    <>
      <ResourcePanel
        title="Countries"
        path="/v1/shipping/countries?include_inactive=true"
      />
      <ActionForm
        action={{
          title: "Save country",
          path: (v) => `/v1/admin/shipping/countries/${segment(v.code)}`,
          method: "PUT",
          fields: [
            field("code", "Country code", {
              pattern: "[A-Z]{2}",
              maxLength: 2,
            }),
            name,
            bool("active"),
          ],
          body: ({ code, ...v }) => v,
        }}
      />
    </>
  );
}
export function FeesPage() {
  const fareFields = [
    select("vehicle_type", ["bicycle", "motorcycle", "car"]),
    select("ride_class", [
      "standard",
      "discountexpress",
      "express",
      "premier",
      "courier",
    ]),
    bool("active"),
    money("base_minor"),
    money("per_km_minor"),
    money("per_minute_minor"),
    money("minimum_minor", "Minimum fare (minor units)", 1, 100000000),
    money("booking_minor"),
    number("commission_bps", "Commission (basis points)", 0, 5000),
    {
      ...number(
        "route_factor_bps",
        "Route factor (basis points)",
        10000,
        30000,
      ),
      default: 10000,
    },
    { ...number("speed_kmh", "Speed (km/h)", 5, 100), default: 30 },
    {
      ...number("max_distance_km", "Maximum distance (km)", 1, 200),
      default: 50,
    },
    {
      ...number("dispatch_radius_km", "Dispatch radius (km)", 1, 50),
      default: 5,
    },
    bool("cash_enabled"),
  ];
  return (
    <div className="space-y-6">
      <Heading
        title="Fees & pricing"
        description="Ride fares, marketplace fees, and shipping capacity have separate settings. Enter amounts in naira; 10000 basis points = 100%."
      />
      <ResourcePanel title="Current ride fares" path="/v1/rides/fares" />
      <ActionForm
        action={{
          title: "Replace ride fare",
          path: "/v1/rides/fares",
          method: "PUT",
          fields: fareFields,
          description:
            "Review the current fare first. This upserts the complete vehicle and class configuration.",
        }}
      />
      <Notice>
        Marketplace settings have a documented write endpoint but no documented
        read endpoint. Obtain the current complete configuration before
        replacing it.
      </Notice>
      <ActionForm
        action={{
          title: "Replace marketplace settings",
          path: "/v1/marketplace/settings",
          method: "PUT",
          fields: [
            number(
              "food_service_charge_bps",
              "Food service charge (BPS)",
              0,
              5000,
            ),
            number(
              "ecommerce_service_charge_bps",
              "Ecommerce service charge (BPS)",
              0,
              5000,
            ),
            select("food_delivery_policy", ["separate", "service_charge"]),
            select("ecommerce_delivery_policy", ["separate", "service_charge"]),
            money("delivery_base_minor"),
            money("delivery_per_km_minor"),
            number("commission_bps", "Commission (BPS)", 0, 5000),
            number("max_radius_km", "Maximum radius (km)", 1, 200),
            bool("cash_enabled"),
          ],
        }}
      />
      <ResourcePanel
        title="Shipping batch capacity"
        path="/v1/admin/shipping/settings"
      />
      <ActionForm
        action={{
          title: "Update shipping capacity",
          path: "/v1/admin/shipping/settings",
          method: "PUT",
          fields: [
            {
              ...number(
                "max_batch_size",
                "Maximum simultaneous pickups per rider",
                1,
                5,
              ),
              default: 3,
            },
          ],
        }}
      />
    </div>
  );
}
export function CouponsPage() {
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-6">
      <Heading
        title="Coupons & signup rewards"
        description="Create budgeted campaigns, grant coupons, and review automatic signup issuance."
      />
      <Notice>
        The current service supports campaign creation and status changes, but
        does not expose a campaign list or detail read. Keep the campaign ID
        returned after creation.
      </Notice>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Campaigns define discounts; grants issue a coupon to one account and
        return its coupon ID. Custom promo-code generation is not available in
        this admin API. To generate a campaign-linked referral code,{" "}
        <Link
          to="/generated"
          className="font-medium text-primary underline underline-offset-4"
        >
          open Referral links
        </Link>
        .
      </p>
      <ActionForm
        action={{
          title: "Create campaign",
          path: "/v1/admin/coupons/campaigns",
          fields: [
            name,
            select("scope", [
              "all",
              "food",
              "ecommerce",
              "ride",
              "shipping",
              "courier",
            ]),
            number("basis_points", "Discount (basis points)", 1, 10000),
            money("max_discount_minor", "Maximum discount (minor units)", 1),
            money("budget_minor", "Budget (minor units)", 1),
            number("max_issuances", "Maximum issuances", 1, 1000000),
            {
              ...number("max_per_user", "Maximum per user", 1, 100),
              default: 1,
            },
            field("starts_at", "Starts at", { type: "datetime-local" }),
            field("ends_at", "Ends at", { type: "datetime-local" }),
            select(
              "valid_for_hours",
              ["0", "24", "48"],
              "Validity in hours (0 = campaign end)",
            ),
          ],
          description:
            "Use 24 or 48 hours for signup rewards. Keep the campaign ID returned after creation so you can add it to the signup pool.",
          body: (v) => {
            if (
              new Date(v.ends_at).getTime() <= Date.now() ||
              new Date(v.ends_at).getTime() <= new Date(v.starts_at).getTime()
            )
              throw new Error(
                "Campaign end must follow its start and be in the future.",
              );
            return { ...v, valid_for_hours: Number(v.valid_for_hours) };
          },
          success:
            "Campaign created. Keep its ID; add it to the signup pool to use it for automatic signup coupons.",
        }}
      />
      <ActionForm
        action={{
          title: "Change campaign availability",
          path: (v) => `/v1/admin/coupons/campaigns/${segment(v.id)}/status`,
          fields: [field("id", "Campaign ID"), bool("active")],
          body: withoutID,
        }}
      />
      <ActionForm
        action={{
          title: "Grant coupon",
          description:
            "Issue one coupon to an active account from an eligible campaign. The result is an issued coupon ID, not the campaign ID or a custom promo code.",
          path: "/v1/admin/coupons/grants",
          fields: [
            field("user_id", "Recipient account ID"),
            field("campaign_id", "Campaign ID"),
          ],
        }}
      />
      <SignupCouponSettings />
      <h2 className="text-lg font-semibold">Signup coupon jobs</h2>
      <DataList
        revision={revision}
        spec={{
          path: "/v1/admin/coupons/signup/jobs",
          key: "jobs",
          idKey: "user_id",
          paging: "after-cursor",
          filters: [
            select("status", ["pending", "fulfilled", "cancelled", "dead"]),
          ],
          columns: [
            ...cols(
              "user_id",
              "status",
              "attempts",
              "coupon_id",
              "available_at",
              "last_error_code",
            ),
            {
              key: "notices",
              label: "Notification work",
              render: (row) =>
                Array.isArray(row.notices) && row.notices.length ? (
                  <div className="min-w-56 space-y-3">
                    {row.notices.map(
                      (notice: Record<string, any>, index: number) => (
                        <div
                          key={`${notice.kind}-${index}`}
                          className="space-y-1"
                        >
                          <p className="font-medium">
                            {human(String(notice.kind))} ·{" "}
                            {human(String(notice.status))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notice.attempts} attempts
                          </p>
                          {notice.last_error_code && (
                            <p className="text-xs [overflow-wrap:anywhere]">
                              {notice.last_error_code}
                            </p>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  "—"
                ),
            },
          ],
          note: "Issuance and notification delivery are separate. A fulfilled job does not prove a push notification was delivered.",
        }}
      />
      <ActionForm
        action={{
          title: "Requeue dead signup work",
          path: (v) =>
            `/v1/admin/coupons/signup/jobs/${segment(v.user_id)}/requeue`,
          fields: [
            field("user_id", "Account ID"),
            select("queue", ["issuance", "waiting_notice", "issued_notice"]),
          ],
          body: ({ user_id, ...v }) => v,
          success:
            "Dead work requeued. This does not create a second signup entitlement.",
        }}
        onSuccess={() => setRevision((n) => n + 1)}
      />
      <SignupWalletBonus />
    </div>
  );
}
export function NotificationsPage() {
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-6">
      <Heading
        title="Broadcast notifications"
        description="Send an announcement to active accounts in the selected audience."
      />
      <ActionForm
        onSuccess={() => setRevision((value) => value + 1)}
        action={{
          title: "Queue broadcast",
          path: "/v1/admin/notifications/broadcasts",
          expectedStatus: 202,
          preserveRetry: true,
          fields: [
            {
              ...select("audience", ["", "rider", "customer", "all"]),
              optionLabels: {
                "": "Choose an audience",
                rider: "Riders",
                customer: "Customers",
                all: "All accounts",
              },
            },
            field("title", "Title", {
              maxLength: 160,
              help: "Maximum 160 UTF-8 bytes; emoji and accented characters use multiple bytes.",
            }),
            field("body", "Message", {
              type: "textarea",
              maxLength: 4000,
              help: "Maximum 4,000 UTF-8 bytes.",
            }),
          ],
          body: broadcastBody,
          validateResult: (result) => {
            if (!result.id || result.status !== "queued")
              throw new Error(
                "Notification acceptance could not be confirmed. Retry with the same details.",
              );
          },
          success: "Notification queued",
          renderResult: (result) => (
            <Link
              className="text-primary underline"
              to={`/general-notifications/${segment(result.id)}`}
            >
              View broadcast progress
            </Link>
          ),
        }}
      />
      <Notice>
        Delivery happens asynchronously and depends on eligible registered
        devices. Queuing does not confirm delivery to every account. Customer
        inbox entries use the existing notification inbox.
      </Notice>
      <BroadcastHistory revision={revision} />
    </div>
  );
}
export function ConfigPage() {
  const actions: Action[] = [
    {
      title: "Replace referral rewards",
      path: "/v1/admin/config/referrals",
      method: "PUT",
      fields: [
        bool("enabled"),
        field("campaign_id", "Campaign ID", { required: false }),
      ],
    },
  ];
  return (
    <div className="space-y-6">
      <Heading
        title="App configuration"
        description="Inspect current values before replacing a complete configuration. New settings affect future activity."
      />
      <MobileReleaseSettings />
      <ResourcePanel title="Published configuration" path="/v1/config" />
      <Link className="text-primary underline" to="/game-rules">
        Open Ten Seconds game rules
      </Link>
      {actions.map((action) => (
        <ActionForm key={action.title} action={action} />
      ))}
      <SignupWalletBonus />
    </div>
  );
}

const itemFields = [
  field("vendor_id", "Vendor account ID"),
  field("category_id", "Category ID"),
  field("name", "Name", { maxLength: 160 }),
  field("description", "Description", { type: "textarea", maxLength: 4000 }),
  field("asset_ids", "Item images", {
    type: "assets",
    imagesOnly: true,
    vendorOwned: true,
    required: false,
  }),
  bool("active"),
  rows("variants", "Variants", [
    field("id", "Existing variant ID", { required: false }),
    name,
    field("asset_ids", "Variant images", {
      type: "assets",
      imagesOnly: true,
      vendorOwned: true,
      required: false,
    }),
    money("price_minor", "Price (minor units)", 1),
    number("initial_stock", "Initial stock", 0, 1000000000),
    bool("active"),
  ]),
];
export function CataloguePage() {
  return (
    <div className="space-y-6">
      <Heading
        title="Marketplace catalogue"
        description="Browse visible items and manage categories. The list includes active items at approved, active vendors."
      />
      <DataList
        spec={{
          path: "/v1/marketplace/items",
          paging: "offset",
          columns: cols(
            "id",
            "name",
            "kind",
            "vendor_name",
            "active",
            "version",
          ),
          filters: [
            select("kind", ["food", "ecommerce"]),
            field("vendor_id", "Vendor account ID"),
            field("q", "Item name", { maxLength: 100 }),
          ],
          link: (r) => `/catalogue/${segment(r.id)}`,
        }}
      />
      <ActionForm
        action={{
          title: "Create catalogue item",
          path: "/v1/marketplace/items",
          fields: itemFields,
          body: (v) => ({
            ...v,
            expected_version: 0,
            variants: v.variants.map((r: Record<string, unknown>) => ({
              ...r,
              attributes: {},
            })),
          }),
        }}
      />
      <ResourcePanel
        title="Active categories"
        path="/v1/marketplace/categories"
      />
      <ActionForm
        action={{
          title: "Create category",
          path: "/v1/marketplace/categories",
          fields: [
            name,
            select("kind", ["food", "ecommerce"]),
            bool("active"),
            field("slug", "Slug"),
            field("image_asset_id", "Category image", {
              type: "asset",
              imagesOnly: true,
              ownAsset: true,
              required: false,
            }),
          ],
        }}
      />
      <ActionForm
        action={{
          title: "Update category",
          path: (v) => `/v1/marketplace/categories/${segment(v.id)}`,
          method: "PUT",
          fields: [
            id,
            name,
            select("kind", ["food", "ecommerce"]),
            bool("active"),
            field("slug", "Slug"),
            field("image_asset_id", "Category image", {
              type: "asset",
              imagesOnly: true,
              ownAsset: true,
              required: false,
            }),
          ],
          body: withoutID,
        }}
      />
    </div>
  );
}
export function CatalogueItemPage() {
  const { id = "" } = useParams();
  const r = useResource(`/v1/marketplace/items/${segment(id)}`);
  return (
    <div className="space-y-6">
      <Heading title="Catalogue item" description={id} />
      {r.error ? (
        <ErrorNotice error={r.error} retry={r.reload} />
      ) : r.loading ? (
        <RecordSkeleton label="Loading item…" />
      ) : (
        <>
          <RecordView data={r.data} />
          {r.data && (
            <>
              <ActionForm
                key={r.data.version}
                action={{
                  title: "Save item changes",
                  path: `/v1/marketplace/items/${segment(id)}`,
                  method: "PUT",
                  fields: itemFields,
                  initial: r.data,
                  description:
                    "Complete item replacement. Existing variant attributes are preserved; use stock adjustment for inventory changes.",
                  body: (v) => ({
                    ...v,
                    expected_version: r.data?.version,
                    variants: v.variants.map(
                      (row: Record<string, unknown>) => ({
                        ...row,
                        attributes:
                          r.data?.variants?.find(
                            (old: Record<string, unknown>) => old.id === row.id,
                          )?.attributes || {},
                      }),
                    ),
                  }),
                }}
                onSuccess={r.reload}
              />
              <ActionForm
                action={{
                  title: "Archive item",
                  path: `/v1/marketplace/items/${segment(id)}`,
                  method: "DELETE",
                  description:
                    "Removes this item from the active catalogue while retaining order history.",
                }}
                onSuccess={r.reload}
              />
              <ActionForm
                action={{
                  title: "Adjust variant stock",
                  path: (v) =>
                    `/v1/marketplace/variants/${segment(v.id)}/stock`,
                  fields: [
                    select(
                      "id",
                      r.data.variants?.map((v: { id: string }) => v.id) || [],
                      "Variant ID",
                    ),
                    number(
                      "delta",
                      "Stock adjustment",
                      -1000000000,
                      1000000000,
                    ),
                  ],
                  body: withoutID,
                  description:
                    "Enter a positive quantity to add stock, or a negative quantity to remove it.",
                }}
                onSuccess={r.reload}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
import { useCurrentUser } from "@/contexts/UserContext";
