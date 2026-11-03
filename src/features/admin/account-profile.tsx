import { ProfileSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { queryPath, segment, type RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountRoleEditor } from "./native-dashboard";
import {
  Heading,
  Notice,
  ErrorNotice,
  display,
  useResource,
  verificationLabel,
} from "./shared";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 min-w-0">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
function Details({ rows }: { rows: [string, unknown][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-1 text-sm break-words">{display(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
function EditProfile({ data, riders }: { data: RecordData; riders: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: data.username || "",
    phone: data.phoneNumber || "",
    email: data.email || "",
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value)
          setDraft({
            name: data.username || "",
            phone: data.phoneNumber || "",
            email: data.email || "",
          });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          Edit {riders ? "rider" : "user"} information
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit personal information</DialogTitle>
          <DialogDescription>
            Review the account’s contact information. Changes cannot be saved
            yet.
          </DialogDescription>
        </DialogHeader>
        <Notice>
          Profile updates are not available yet. Anything entered here is an
          unsaved preview and will be discarded when you close this window.
        </Notice>
        {(
          [
            ["name", "Full name", "text"],
            ["phone", "Phone number", "tel"],
            ["email", "Email address", "email"],
          ] as const
        ).map(([key, label, type]) => (
          <div className="space-y-2" key={key}>
            <Label htmlFor={`edit-${key}`}>{label}</Label>
            <Input
              id={`edit-${key}`}
              type={type}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close preview
          </Button>
          <Button disabled>Save unavailable</Button>
        </div>
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
      <Link
        to={`/${type}`}
        className="text-sm text-primary underline underline-offset-4"
      >
        Back to {type}
      </Link>
      <Heading
        title={riders ? "Rider profile" : "User profile"}
        description="Review account information, verification and financial activity."
      >
        <RefreshButton onClick={resource.reload} loading={resource.loading}>
          Refresh profile
        </RefreshButton>
      </Heading>
      {resource.loading && <ProfileSkeleton riders={riders} />}
      {resource.error != null && (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      )}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold break-words">
                {data.username || "Name unavailable"}
              </h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {data.uid}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{riders ? "Rider" : "User"}</Badge>
                <Badge
                  variant={
                    data.verificationStatus === 2 ||
                    data.verificationStatus === "2"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {verificationLabel(data.verificationStatus)}
                </Badge>
                {data.disabled === true && (
                  <Badge variant="destructive">Disabled</Badge>
                )}
                {data.deleted === true && (
                  <Badge variant="destructive">Deleted</Badge>
                )}
              </div>
            </div>
            <EditProfile key={id} data={data} riders={riders} />
          </div>
          <nav
            aria-label="Profile sections"
            className="flex flex-wrap gap-x-5 gap-y-3"
          >
            {sections.map(([anchor, label]) => (
              <a
                key={anchor}
                href={`#${anchor}`}
                className="text-sm text-primary underline underline-offset-4"
              >
                {label}
              </a>
            ))}
          </nav>
          <Section id="personal-information" title="Personal information">
            <Details
              rows={[
                ["Full name", data.username],
                ["Email", data.email],
                ["Phone number", data.phoneNumber],
                ["Email verified", data.emailVerified],
                ["Identity available", data.identityExists],
                ["Created at", data.createdAt],
              ]}
            />
            {data.identityExists === false && (
              <Notice>
                This historical profile has no linked identity. Contact and
                sign-in details may be unavailable.
              </Notice>
            )}
          </Section>
          <Section id="verification" title="Verification">
            <Details
              rows={[
                [
                  "Verification status",
                  verificationLabel(data.verificationStatus),
                ],
                ["Account disabled", data.disabled],
                ["Account deleted", data.deleted],
              ]}
            />
            {riders && (
              <>
                <Notice>
                  Application details and review history are not available yet.
                  Approval and rejection will be available once application
                  review is connected.
                </Notice>
                <div className="flex flex-wrap gap-2">
                  <Button disabled>Approve rider</Button>
                  <Button disabled variant="outline">
                    Reject application
                  </Button>
                </div>
              </>
            )}
          </Section>
          {riders && (
            <Section id="vehicle-information" title="Vehicle & documents">
              <Notice>
                Vehicle information and verification documents are not available
                for this profile yet.
              </Notice>
              <Details
                rows={[
                  ["Vehicle type", null],
                  ["Make & model", null],
                  ["Colour", null],
                  ["Plate number", null],
                ]}
              />
              <Button variant="outline" disabled>
                Edit vehicle information
              </Button>
            </Section>
          )}
          <Section id="wallet" title="Wallet">
            <Details
              rows={[
                ["Available balance", "Unavailable"],
                ["Pending balance", "Unavailable"],
              ]}
            />
            <Notice>
              Wallet balances are not connected to account profiles yet. An
              unavailable balance does not mean zero.
            </Notice>
          </Section>
          <Section id="transactions" title="Transaction history">
            <Notice>
              Transaction history is not available yet. No financial activity
              can be confirmed from this profile.
            </Notice>
          </Section>
          {adminType === "super" && !riders && (
            <Section id="administrator-access" title="Administrator access">
              <AccountRoleEditor uid={data.uid || id} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
