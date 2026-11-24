import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Textarea } from "@/components/ui/textarea";
import { apiResponse, ApiError, segment, type RecordData } from "@/lib/api";
import { InformationCard, useResource } from "./shared";

const statusLabels: Record<string, string> = {
  pending: "Queued",
  awaiting_provider: "Waiting for Bachs",
  review_required: "Needs review",
  completed: "Confirmed",
};
const pollWhileOpen = () => true;

type CorrectionSnapshot = { version: number; status: string | null };
type CorrectionRequest = {
  key: string;
  body: string;
  snapshot: CorrectionSnapshot;
};

function responseMissing(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    [408, 504].includes(error.status) ||
    error.code === "service_unavailable"
  );
}

function PayoutNames({ data }: { data: RecordData }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="min-w-0">
        <dt className="text-muted-foreground">Profile name</dt>
        <dd className="break-words font-medium">
          {data.profileName || "Unavailable"}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted-foreground">Approved payout name</dt>
        <dd className="break-words font-medium">
          {data.approvedPayoutName || "Unavailable"}
        </dd>
      </div>
    </dl>
  );
}

export function PayoutNameCorrection({
  riderId,
  refreshRevision,
}: {
  riderId: string;
  refreshRevision: number;
}) {
  const path = `/v1/admin/riders/${segment(riderId)}/payout-identity/correction`;
  const resource = useResource(path, pollWhileOpen, refreshRevision);
  const { data, error, loading } = resource;
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [reason, setReason] = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [workConflict, setWorkConflict] = useState<RecordData | null>(null);
  const [queuedAgainst, setQueuedAgainst] = useState<CorrectionSnapshot | null>(
    null,
  );
  const [retry, setRetry] = useState<CorrectionRequest | null>(null);
  const active = useRef<AbortController | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => () => active.current?.abort(), []);

  const queued =
    queuedAgainst &&
    (!data ||
      (data.version === queuedAgainst.version &&
        data.status === queuedAgainst.status));
  useEffect(() => {
    if (queuedAgainst && !queued) setQueuedAgainst(null);
  }, [queued, queuedAgainst]);
  const eligible = !loading && !error && data?.canRequestCorrection === true;
  const waitingForWork = workConflict && (!eligible || data === workConflict);
  const canRequest =
    eligible &&
    !waitingForWork &&
    !queued &&
    Number.isSafeInteger(data?.version);
  const verified = !!verifiedName && verifiedName === data?.profileName;
  const reasonLength = Array.from(reason.trim()).length;
  const valid =
    verified &&
    firstName.trim() &&
    lastName.trim() &&
    reasonLength >= 10 &&
    reasonLength <= 500;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    let request = retry;
    if (!request) {
      if (!data || !canRequest || !valid) return;
      request = {
        key: crypto.randomUUID(),
        body: JSON.stringify({
          expectedVersion: data.version,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          documentsVerified: true,
          reason: reason.trim(),
        }),
        snapshot: { version: data.version, status: data.status },
      };
    }
    const { key, body, snapshot } = request;
    const controller = new AbortController();
    active.current = controller;
    setSending(true);
    setFeedback("");

    function send() {
      return apiResponse(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body,
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30_000),
        ]),
      });
    }

    try {
      const response = await send().catch((failure) => {
        if (!controller.signal.aborted && responseMissing(failure))
          return send();
        throw failure;
      });
      if (controller.signal.aborted) return;
      if (response.status !== 202)
        throw new Error("Unexpected correction response.");
      setQueuedAgainst(snapshot);
      setRetry(null);
      setWorkConflict(null);
      setFirstName("");
      setLastName("");
      setReason("");
      setVerifiedName(null);
      setOpen(false);
      resource.reload();
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 409) {
        setRetry(null);
        setVerifiedName(null);
        const conflict = failure.details?.reason;
        if (conflict === "payout_work_in_progress") {
          setWorkConflict(data ?? {});
        } else {
          setFeedback(
            conflict === "version_conflict" || conflict === "stale_version"
              ? "The payout record changed. Review the refreshed names and confirm the documents again before resubmitting."
              : "The correction conflicted with the current payout record. Review the refreshed names before resubmitting.",
          );
        }
        resource.reload();
      } else if (
        responseMissing(failure) ||
        (failure instanceof ApiError && failure.status >= 500)
      ) {
        setRetry(request);
        setFeedback(
          "The correction result is unknown. Retry the same request to check whether it was accepted.",
        );
      } else {
        setRetry(null);
        setFeedback(
          "The correction was rejected. Refresh the payout names before trying again.",
        );
        resource.reload();
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setSending(false);
    }
  }

  const status = queued
    ? "Queued"
    : data &&
      (data.status === null
        ? "No correction on record"
        : Object.hasOwn(statusLabels, data.status)
          ? statusLabels[data.status]
          : "Status unavailable");
  const workMessage = waitingForWork
    ? "A payout operation is in progress. Wait for it to finish before requesting a correction."
    : "";

  return (
    <InformationCard
      title="Payout name"
      action={
        <RefreshButton loading={loading} onClick={resource.reload}>
          Refresh payout name
        </RefreshButton>
      }
    >
      <div className="space-y-4">
        {data && <PayoutNames data={data} />}
        {status && (
          <p role="status" className="text-sm">
            {status}
          </p>
        )}
        {Boolean(error) && (
          <p role="alert" className="text-sm text-destructive">
            Could not refresh the payout name and correction status.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Before requesting a correction, use Edit rider information to save the
          full name from the rider’s verified documents. Saving refreshes the
          payout name and correction status.
        </p>
        {workMessage && !open && (
          <p role="status" className="text-sm">
            {workMessage}
          </p>
        )}
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!sending) setOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" disabled={!canRequest && !retry}>
              {retry ? "Retry payout name correction" : "Correct payout name"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Correct payout name</DialogTitle>
              <DialogDescription>
                Enter the first and last names as shown on the verified
                documents.
              </DialogDescription>
            </DialogHeader>
            {data && <PayoutNames data={data} />}
            <form className="space-y-4" onSubmit={submit}>
              <fieldset className="space-y-4" disabled={sending || !!retry}>
                <div className="space-y-2">
                  <Label htmlFor="payout-correction-first-name">
                    First name
                  </Label>
                  <Input
                    id="payout-correction-first-name"
                    value={firstName}
                    required
                    autoComplete="off"
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout-correction-last-name">Last name</Label>
                  <Input
                    id="payout-correction-last-name"
                    value={lastName}
                    required
                    autoComplete="off"
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout-correction-reason">
                    Reason for correction
                  </Label>
                  <Textarea
                    id="payout-correction-reason"
                    value={reason}
                    required
                    aria-describedby="payout-correction-reason-length"
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <p
                    id="payout-correction-reason-length"
                    className="text-xs text-muted-foreground"
                  >
                    Enter 10–500 characters.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    className="mt-0.5 size-4"
                    type="checkbox"
                    checked={verified}
                    disabled={!canRequest}
                    required
                    onChange={(event) =>
                      setVerifiedName(
                        event.target.checked ? data?.profileName : null,
                      )
                    }
                  />
                  <span>
                    I checked the rider’s verified documents against the saved
                    profile name.
                  </span>
                </label>
              </fieldset>
              {(feedback || workMessage) && (
                <p role="status" className="text-sm">
                  {workMessage || feedback}
                </p>
              )}
              <Button
                type="submit"
                disabled={sending || (!retry && (!canRequest || !valid))}
              >
                {sending
                  ? "Submitting…"
                  : retry
                    ? "Retry same request"
                    : "Request correction"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </InformationCard>
  );
}
