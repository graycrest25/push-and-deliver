import { useState } from "react";
import { onlineLabel } from "./rider-filters";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ProfileSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/contexts/UserContext";
import { queryPath, segment, type RecordData } from "@/lib/api";
import { AccountRoleEditor, CurrentRecord } from "./native-dashboard";
import {
  ActionForm,
  DataList,
  ErrorNotice,
  Heading,
  InformationCard,
  Notice,
  RecordView,
  field,
  select,
  useResource,
  verificationLabel,
} from "./shared";
import {
  changed,
  reason,
  reasonField,
  requireChanges,
  version,
} from "./workflow-fields";

function EditProfile({
  data,
  riders,
  reload,
  vehicle = false,
}: {
  data: RecordData;
  riders: boolean;
  reload: () => void;
  vehicle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = vehicle
    ? `/v1/admin/riders/${segment(data.uid)}/vehicle`
    : queryPath(`/v1/admin/users/${segment(data.uid)}/profile`, {
        type: riders ? "riders" : "users",
      });
  const source = vehicle
    ? data.vehicle || {}
    : {
        ...data,
        ...data.profile,
        kinName: data.profile?.nextOfKin?.name || "",
        kinPhone: data.profile?.nextOfKin?.phoneNumber || "",
        kinAddress: data.profile?.nextOfKin?.address || "",
      };
  const keys = vehicle
    ? [
        "make",
        "model",
        "color",
        "plateNumber",
        "chassisNumber",
        "engineNumber",
        "condition",
      ]
    : [
        "username",
        "phoneNumber",
        "email",
        "dateOfBirth",
        "homeAddress",
        "stateOfOrigin",
        "localGovernment",
      ];
  const labels: Record<string, string> = {
    username: "Full name",
    phoneNumber: "Phone number",
    dateOfBirth: "Date of birth",
    homeAddress: "Home address",
    stateOfOrigin: "State of origin",
    localGovernment: "Local government",
    plateNumber: "Plate number",
    chassisNumber: "Chassis number",
    engineNumber: "Engine number",
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          {vehicle
            ? "Edit vehicle information"
            : `Edit ${riders ? "rider" : "user"} information`}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const trigger = [
              ...document.querySelectorAll<HTMLButtonElement>("button"),
            ].find(
              (button) =>
                button.textContent ===
                (vehicle
                  ? "Edit vehicle information"
                  : `Edit ${riders ? "rider" : "user"} information`),
            );
            trigger?.focus({ preventScroll: true });
          });
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {vehicle ? "Edit vehicle information" : "Edit personal information"}
          </DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Vehicle changes return the rider to pending review and take them offline."
              : "Email or primary phone changes revoke existing sessions. Email changes also require verification and remove linked social sign-in."}
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={{
            title: vehicle
              ? "Save vehicle information"
              : "Save personal information",
            method: "PUT",
            path,
            versionPath: queryPath(`/v1/admin/users/${segment(data.uid)}`, {
              type: riders ? "riders" : "users",
            }),
            refreshBeforeSubmit: vehicle,
            preserveRetry: true,
            initial: {
              ...source,
              ...(vehicle ? { type: String(source.type ?? "") } : {}),
            },
            fields: [
              ...keys.map((key) =>
                field(key, labels[key] || key[0].toUpperCase() + key.slice(1), {
                  required:
                    !vehicle &&
                    ["username", "phoneNumber", "email"].includes(key),
                  type:
                    key === "dateOfBirth"
                      ? "date"
                      : key === "email"
                        ? "email"
                        : "text",
                  ...(key === "phoneNumber"
                    ? {
                        pattern: "\\+[1-9][0-9]{7,14}",
                        help: "International format, for example +2348000000000.",
                      }
                    : {}),
                }),
              ),
              ...(vehicle
                ? [
                    {
                      ...select("type", ["", "0", "1", "2"], "Vehicle type"),
                      optionLabels: {
                        "": "Select a vehicle type",
                        "0": "Car",
                        "1": "Bicycle",
                        "2": "Motorbike",
                      },
                    },
                  ]
                : [
                    field("kinName", "Next of kin name", { required: false }),
                    field("kinPhone", "Next of kin phone", { required: false }),
                    field("kinAddress", "Next of kin address", {
                      required: false,
                    }),
                  ]),
              reasonField,
            ],
            body: (values) => {
              const changes = changed(values, source, keys);
              if (vehicle) {
                if (values.type !== "" && Number(values.type) !== source.type)
                  changes.type = Number(values.type);
              } else {
                const kin = changed(values, source, [
                  "kinName",
                  "kinPhone",
                  "kinAddress",
                ]);
                if (Object.keys(kin).length)
                  changes.nextOfKin = Object.fromEntries(
                    Object.entries(kin).map(([key, v]) => [
                      {
                        kinName: "name",
                        kinPhone: "phoneNumber",
                        kinAddress: "address",
                      }[key]!,
                      v,
                    ]),
                  );
              }
              return {
                expectedVersion: version(data),
                reason: reason(values.reason),
                changes: requireChanges(changes),
              };
            },
          }}
          onSuccess={(result) => {
            toast.success(
              result.sessionsRevoked
                ? "Saved. Existing account sessions were revoked."
                : "Account information saved.",
            );
            if (result.emailVerificationRequired)
              toast.info("The new email address requires verification.");
            setOpen(false);
            reload();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
export function AccountProfile({ riders = false }: { riders?: boolean }) {
  const { id = "" } = useParams();
  const { adminType } = useCurrentUser();
  const type = riders ? "riders" : "users";
  const resource = useResource(
    queryPath(`/v1/admin/users/${segment(id)}`, { type }),
  );
  const data = resource.data;
  const sections = [
    ["personal-information", "Personal information"],
    ["verification", "Verification"],
    ...(riders ? [["vehicle-information", "Vehicle & documents"]] : []),
    ["wallet", "Wallet"],
    ["transactions", "Transactions"],
    ...(adminType === "super" && !riders
      ? [["administrator-access", "Administrator access"]]
      : []),
  ];
  return (
    <div className="space-y-6">
      <Link to={`/${type}`} className="text-sm text-primary underline">
        Back to {type}
      </Link>
      <Heading
        title={riders ? "Rider profile" : "User profile"}
        description="Review contact information, verification and financial activity."
      >
        <RefreshButton loading={resource.loading} onClick={resource.reload}>
          Refresh profile
        </RefreshButton>
      </Heading>
      {resource.loading ? (
        <ProfileSkeleton riders={riders} />
      ) : resource.error ? (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      ) : (
        data && (
          <>
            <div className="flex flex-wrap justify-between items-center gap-4 border-b pb-5">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="size-20">
                  <AvatarImage
                    src={data.imageUrl || undefined}
                    alt={`${data.username || (riders ? "Rider" : "User")} profile photo`}
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {String(data.username || (riders ? "Rider" : "User"))
                      .trim()
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold break-words">
                    {data.username || "Name unavailable"}
                  </h2>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {data.uid}
                  </p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Badge variant="secondary">
                      {riders ? "Rider" : "User"}
                    </Badge>
                    <Badge variant="secondary">
                      {verificationLabel(data.verificationStatus)}
                    </Badge>
                    {data.disabled && (
                      <Badge variant="destructive">Disabled</Badge>
                    )}
                    {data.deleted && (
                      <Badge variant="destructive">Deleted</Badge>
                    )}
                  </div>
                </div>
              </div>
              <EditProfile
                data={data}
                riders={riders}
                reload={resource.reload}
              />
            </div>
            <nav
              aria-label="Profile sections"
              className="flex flex-wrap gap-x-5 gap-y-3"
            >
              {sections.map(([anchor, label]) => (
                <a
                  key={anchor}
                  href={`#${anchor}`}
                  className="text-sm text-primary underline"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div id="personal-information" className="scroll-mt-24">
              <InformationCard title="Personal information">
                <RecordView
                  data={{
                    fullName: data.username,
                    ...(riders ? { onlineStatusLabel: onlineLabel(data) } : {}),
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    emailVerified: data.emailVerified,
                    identityExists: data.identityExists,
                    createdAt: data.createdAt,
                    ...data.profile,
                  }}
                />
                {data.identityExists === false && (
                  <Notice>
                    This retained profile has no linked sign-in identity.
                  </Notice>
                )}
              </InformationCard>
            </div>
            <div id="verification" className="scroll-mt-24">
              <InformationCard title="Verification">
                <div className="space-y-4">
                  <RecordView
                    data={{
                      verificationStatus: verificationLabel(
                        data.verificationStatus,
                      ),
                      disabled: data.disabled,
                      deleted: data.deleted,
                    }}
                  />
                  {riders && (
                    <Button asChild variant="outline">
                      <Link to={`/rider-applications/${segment(id)}`}>
                        Inspect application and review history
                      </Link>
                    </Button>
                  )}
                </div>
              </InformationCard>
            </div>
            {riders && (
              <div id="vehicle-information" className="scroll-mt-24">
                <InformationCard title="Vehicle & documents">
                  <div className="space-y-4">
                    {data.vehicle ? (
                      <RecordView
                        data={{
                          ...data.vehicle,
                          type:
                            (
                              {
                                0: "Car",
                                1: "Bicycle",
                                2: "Motorbike",
                              } as Record<string, string>
                            )[data.vehicle.type] || "Unknown",
                        }}
                      />
                    ) : (
                      <Notice>No vehicle information is available.</Notice>
                    )}
                    <EditProfile
                      vehicle
                      data={data}
                      riders
                      reload={resource.reload}
                    />
                    {data.vehicle?.type == null && (
                      <ActionForm
                        onSuccess={() => {
                          toast.success(
                            "Vehicle type assigned. The rider requires review before approval.",
                          );
                          resource.reload();
                        }}
                        action={{
                          title: "Assign vehicle type",
                          description:
                            "Saving returns the rider to pending review; it does not approve them. Blocked-account restrictions still apply.",
                          method: "PUT",
                          path: `/v1/admin/riders/${segment(id)}/vehicle`,
                          versionPath: queryPath(
                            `/v1/admin/users/${segment(id)}`,
                            { type: "riders" },
                          ),
                          refreshBeforeSubmit: true,
                          preserveRetry: true,
                          fields: [
                            {
                              ...select(
                                "type",
                                ["", "0", "1", "2"],
                                "Vehicle type",
                              ),
                              optionLabels: {
                                "": "Select a vehicle type",
                                "0": "Car",
                                "1": "Bicycle",
                                "2": "Motorbike",
                              },
                            },
                            reasonField,
                          ],
                          body: (values) => ({
                            expectedVersion: version(data),
                            reason: reason(values.reason),
                            changes: { type: Number(values.type) },
                          }),
                        }}
                      />
                    )}
                  </div>
                </InformationCard>
              </div>
            )}
            <div id="wallet" className="scroll-mt-24">
              <InformationCard title="Wallet">
                <CurrentRecord
                  title="Current balances"
                  path={queryPath(`/v1/admin/users/${segment(id)}/wallet`, {
                    type,
                  })}
                >
                  {(wallet) => <RecordView data={wallet} />}
                </CurrentRecord>
              </InformationCard>
            </div>
            <div id="transactions" className="scroll-mt-24">
              <DataList
                spec={{
                  title: "Transaction history",
                  path: `/v1/admin/users/${segment(id)}/transactions`,
                  params: { type },
                  key: "items",
                  paging: "cursor",
                  columns: [
                    { key: "createdAt" },
                    { key: "direction" },
                    { key: "amountMinor" },
                    { key: "status" },
                    { key: "narration" },
                    { key: "reference" },
                    { key: "reversalOf" },
                    {
                      key: "relatedOrder",
                      label: "Related order",
                      render: (row) =>
                        row.relatedOrder ? (
                          <Link
                            className="text-primary underline"
                            to={`/${row.relatedOrder.type === "shipment" ? "shipment-orders" : "ride-hailing"}/${segment(row.relatedOrder.id)}`}
                          >
                            {row.relatedOrder.id}
                          </Link>
                        ) : (
                          "—"
                        ),
                    },
                  ],
                  note: "The ledger page does not represent a reconstructed wallet balance.",
                }}
              />
            </div>
            {riders && adminType === "super" && (
              <InformationCard title="Payout destination">
                <CurrentRecord
                  title="Masked bank details"
                  path={queryPath(
                    `/v1/admin/users/${segment(id)}/payout-destination`,
                    { type: "riders" },
                  )}
                >
                  {(destination) => <RecordView data={destination} />}
                </CurrentRecord>
              </InformationCard>
            )}
            {adminType === "super" && !riders && (
              <div id="administrator-access">
                <InformationCard title="Administrator access">
                  <AccountRoleEditor uid={data.uid} />
                </InformationCard>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
