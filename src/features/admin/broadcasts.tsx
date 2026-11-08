import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, segment, type RecordData } from "@/lib/api";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import {
  ActionForm,
  DataList,
  ErrorNotice,
  Heading,
  InformationCard,
  Notice,
  display,
} from "./shared";

const broadcasts = "/v1/admin/notifications/broadcasts";
const active = new Set(["queued", "processing", "retrying"]);
const statuses = new Set([
  ...active,
  "processed",
  "failed",
  "expired",
  "unknown",
]);
const count = (value: unknown) =>
  typeof value === "number" ? value.toLocaleString() : "Not available";
function Status({ value }: { value: string }) {
  const status = statuses.has(value) ? value : "unknown";
  return (
    <Badge variant="secondary">
      {status[0].toUpperCase() + status.slice(1)}
    </Badge>
  );
}
export function BroadcastHistory({ revision }: { revision: number }) {
  return (
    <section className="space-y-3" aria-label="Broadcast history">
      <h2 className="text-lg font-semibold">Broadcast history</h2>
      <DataList
        revision={revision}
        spec={{
          path: broadcasts,
          key: "items",
          paging: "cursor",
          defaultPageSize: 25,
          idKey: "id",
          clickableRows: true,
          link: (row) => `/general-notifications/${segment(row.id)}`,
          columns: [
            {
              key: "title",
              label: "Title",
              render: (row) => (
                <Link
                  className="text-primary underline underline-offset-4"
                  to={`/general-notifications/${segment(row.id)}`}
                >
                  {row.title || "Untitled broadcast"}
                </Link>
              ),
            },
            { key: "audience" },
            { key: "status", render: (row) => <Status value={row.status} /> },
            {
              key: "processed",
              label: "Processed",
              render: (row) => count(row.recipients?.done),
            },
            {
              key: "failed",
              label: "Failed recipients",
              render: (row) => count(row.recipients?.failed),
            },
            {
              key: "providerAcceptedRecipients",
              label: "Accepted by push provider",
              render: (row) => count(row.providerAcceptedRecipients),
            },
            { key: "createdAt" },
          ],
          note: "Newest first. Processed includes skipped accounts. Push-provider acceptance does not confirm phone delivery or opening.",
        }}
      />
    </section>
  );
}

function Progress({
  title,
  values,
  discovery = false,
}: {
  title: string;
  values?: RecordData;
  discovery?: boolean;
}) {
  return (
    <InformationCard title={title}>
      {discovery && (
        <p className="mb-4 text-sm text-muted-foreground">
          These are recipient-discovery jobs, not people. Recipient totals can
          grow during expansion.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["total", "Total"],
          ["pending", "Pending"],
          ["processing", "Processing"],
          ["retryWait", "Waiting to retry"],
          ["done", discovery ? "Done" : "Processed"],
          ["failed", "Failed"],
        ].map(([key, label]) => (
          <div key={key}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">
              {count(values?.[key])}
            </dd>
          </div>
        ))}
      </dl>
      {!discovery && (
        <p className="mt-4 text-sm text-muted-foreground">
          Processed includes skipped accounts.
        </p>
      )}
    </InformationCard>
  );
}

export function BroadcastDetails() {
  const { id = "" } = useParams();
  const { adminType } = useCurrentUser();
  if (!canOperate(adminType))
    return (
      <Notice>
        Broadcasts are available to super and regular administrators.
      </Notice>
    );
  return <BroadcastDetail key={id} id={id} />;
}
function BroadcastDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let current: RecordData | null = null;
    async function load() {
      let retry = true;
      try {
        const result = await api(`${broadcasts}/${segment(id)}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        current = result;
        setData(result);
        setError(null);
        retry = active.has(result.status);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setError(failure);
        retry = !current || active.has(current.status);
        if (
          failure instanceof ApiError &&
          [401, 403, 404].includes(failure.status)
        ) {
          setData(null);
          retry = false;
        }
      }
      if (retry && !controller.signal.aborted)
        timer = setTimeout(() => void load(), 7000);
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, revision]);
  return (
    <div className="space-y-6">
      <Link
        className="text-sm text-primary underline"
        to="/general-notifications"
      >
        Back to broadcasts
      </Link>
      <Heading
        title="Broadcast details"
        description="Review saved content, progress and recorded push-provider acceptance."
      >
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh
        </Button>
      </Heading>
      {error != null && (
        <ErrorNotice
          error={error}
          retry={() => setRevision((value) => value + 1)}
        />
      )}
      {!data && !error && (
        <RecordSkeleton label="Loading broadcast…" fields={6} />
      )}
      {data && (
        <>
          <InformationCard title="Saved content">
            <div className="space-y-3">
              <Status value={data.status} />
              <h2 className="break-words text-xl font-semibold">
                {data.title}
              </h2>
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {data.body}
              </p>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {[
                  ["Audience", data.audience],
                  ["Created by", data.createdBy],
                  ["Created", display(data.createdAt, "createdAt")],
                  ["Expires", display(data.expiresAt, "expiresAt")],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd>{value ?? "Not available"}</dd>
                  </div>
                ))}
              </dl>
              {data.resendOf && (
                <p className="text-sm">
                  Resent from{" "}
                  <Link
                    className="text-primary underline"
                    to={`/general-notifications/${segment(data.resendOf)}`}
                  >
                    {data.resendOf}
                  </Link>
                </p>
              )}
              {active.has(data.status) && (
                <p className="text-sm text-muted-foreground">
                  Progress refreshes every 7 seconds.
                </p>
              )}
            </div>
          </InformationCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <Progress title="Recipients" values={data.recipients} />
            <Progress
              title="Recipient discovery"
              values={data.expansion}
              discovery
            />
          </div>
          <InformationCard title="Push-provider acceptance">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">
                  Accepted by push provider
                </dt>
                <dd className="font-semibold tabular-nums">
                  {count(data.providerAcceptedRecipients)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Accepted device submissions
                </dt>
                <dd className="font-semibold tabular-nums">
                  {count(data.providerAcceptedPushes)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              One account can have multiple devices. Provider acceptance does
              not confirm phone delivery or opening. Counts for older broadcasts
              may not be available.
            </p>
          </InformationCard>
          <section className="space-y-3" aria-label="Resend broadcast">
            <h2 className="text-lg font-semibold">Resend broadcast</h2>
            <ActionForm
              action={{
                title: "Confirm resend",
                description: `This sends the saved title and message above to currently eligible accounts in the same audience (${data.audience}), including previous recipients. Confirm only if you want to send a new broadcast.`,
                path: `${broadcasts}/${segment(id)}/resend`,
                body: () => ({}),
                expectedStatus: 202,
                preserveRetry: true,
                validateResult: (result) => {
                  if (
                    !result.id ||
                    result.id === id ||
                    result.status !== "queued"
                  )
                    throw new Error(
                      "Resend acceptance could not be confirmed. Retry using the same operation key.",
                    );
                },
                success: "New broadcast queued",
              }}
              onSuccess={(result) =>
                navigate(`/general-notifications/${segment(result.id)}`)
              }
            />
          </section>
        </>
      )}
    </div>
  );
}
