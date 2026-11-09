import { FeatureTabs } from "./feature-tabs";
import { useState } from "react";
import { Link } from "react-router-dom";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { segment, type RecordData } from "@/lib/api";
import { promoterBody } from "@/lib/admin-contracts";
import { Button } from "@/components/ui/button";
import { DataStatus } from "@/components/ui/data-status";
import {
  ActionForm,
  DataList,
  Heading,
  Notice,
  display,
  field,
} from "./shared";

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setError("");
          } catch {
            setError("Copy failed. Select and copy the value directly.");
          }
        }}
      >
        {copied ? (
          <IconCheck size={15} aria-hidden="true" />
        ) : (
          <IconCopy size={15} aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
function ReturnedUrl({ value }: { value: string }) {
  let href: string | undefined;
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol)) href = value;
  } catch {
    /* Keep the returned value visible even when it is not a navigable URL. */
  }
  return (
    <div className="min-w-48 space-y-2">
      <p className="break-all">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </p>
      <CopyValue key={value} value={value} label="Copy promoter URL" />
    </div>
  );
}
function PromoterReceipt({ result }: { result: RecordData }) {
  return (
    <div className="space-y-4 rounded-lg border bg-secondary/40 p-4">
      <DataStatus
        value={
          result.pending ? "pending" : result.active ? "active" : "disabled"
        }
      />
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Returned promoter code</p>
        <p className="select-all break-all font-semibold">{result.code}</p>
        <CopyValue
          key={result.code}
          value={result.code}
          label="Copy returned promoter code"
        />
      </div>
      {result.shortUrl && <ReturnedUrl value={result.shortUrl} />}
      <p className="text-sm">
        Expires:{" "}
        {result.expiresAt
          ? display(result.expiresAt, "expiresAt")
          : "Not returned"}
      </p>
      <p className="text-sm">
        Referrals:{" "}
        {result.referralsCount == null
          ? "Unavailable"
          : display(result.referralsCount)}
      </p>
    </div>
  );
}
export function PromoterLinksPage() {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((current) => current + 1);
  return (
    <div className="space-y-6">
      <Heading
        title="Promoter referral links"
        description="Create or renew named promoter links and manage their availability. Share the code and URL returned by the service."
      >
        <Button variant="outline" asChild>
          <Link to="/referrals">View referral attribution</Link>
        </Button>
      </Heading>
      <FeatureTabs
        label="Promoter link sections"
        sections={[
          {
            id: "links",
            label: "Promoter links",
            content: (
              <div className="space-y-6">
                <DataList
                  revision={revision}
                  spec={{
                    title: "Promoter links",
                    path: "/v1/admin/referrals/links",
                    paging: "cursor",
                    key: "items",
                    idKey: "documentId",
                    columns: [
                      { key: "name", label: "Promoter name" },
                      {
                        key: "code",
                        label: "Code",
                        render: (row) => (
                          <div className="space-y-2">
                            <p className="select-all break-all font-semibold">
                              {row.code}
                            </p>
                            <CopyValue
                              key={row.code}
                              value={row.code}
                              label={`Copy code for ${row.name}`}
                            />
                          </div>
                        ),
                      },
                      {
                        key: "shortUrl",
                        label: "Share URL",
                        render: (row) =>
                          row.shortUrl ? (
                            <ReturnedUrl value={row.shortUrl} />
                          ) : (
                            "Not returned"
                          ),
                      },
                      {
                        key: "active",
                        label: "Availability",
                        render: (row) => (
                          <DataStatus
                            value={
                              row.pending
                                ? "pending"
                                : row.active
                                  ? "active"
                                  : "disabled"
                            }
                          />
                        ),
                      },
                      { key: "referralsCount", label: "Attributed referrals" },
                      { key: "expiresAt", label: "Expires" },
                      {
                        key: "actions",
                        label: "Manage",
                        render: (row) => (
                          <ActionForm
                            key={`${row.documentId}:${row.active}`}
                            action={{
                              title: row.active
                                ? "Disable promoter link"
                                : "Enable promoter link",
                              path: `/v1/admin/referrals/links/${segment(row.documentId)}/status`,
                              preserveRetry: true,
                              body: () => ({ active: !row.active }),
                              success:
                                "Availability updated. Existing counts and expiry are retained.",
                            }}
                            onSuccess={refresh}
                          />
                        ),
                      },
                    ],
                  }}
                />
                <Notice>
                  Successful activation lasts 30 days; the returned expiry is
                  shown above. Changing availability keeps the existing referral
                  count and expiry. These links track promoter attribution and
                  do not configure commissions or payments.
                </Notice>
              </div>
            ),
          },
          {
            id: "renew",
            label: "Create or renew",
            content: (
              <ActionForm
                action={{
                  title: "Create or renew promoter link",
                  path: "/v1/admin/referrals/links",
                  expectedStatus: 201,
                  preserveRetry: true,
                  fields: [
                    field("name", "Promoter name", {
                      maxLength: 100,
                      pattern: "[A-Za-z0-9]{1,100}",
                      help: "ASCII letters and digits only. No spaces or punctuation.",
                    }),
                  ],
                  body: promoterBody,
                  success: "Promoter link saved",
                  renderResult: (result) => <PromoterReceipt result={result} />,
                  validateResult: (result) => {
                    if (!result.documentId || typeof result.code !== "string")
                      throw new Error(
                        "The service did not return a promoter identifier and code. Retry with the same name.",
                      );
                  },
                }}
                onSuccess={refresh}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
