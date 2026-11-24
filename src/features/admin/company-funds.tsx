import { useEffect, useRef, useState } from "react";
import { ApiError, segment, type RecordData } from "@/lib/api";
import {
  paymentCommand,
  payoutIsPending,
  retryAfterTime,
  uncertainPayment,
} from "@/lib/payment-operations";
import { useCurrentUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RefreshButton } from "@/components/ui/refresh-button";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import {
  ActionForm,
  ErrorNotice,
  Heading,
  InformationCard,
  Notice,
  RecordView,
  field,
  useResource,
} from "./shared";
import { moneyField } from "./workflow-fields";

const root = "/v1/admin/payments/company";
const withdrawals = root + "/withdrawals";
const pollCompanyPayout = (data: RecordData) =>
  payoutIsPending(data, "completed");

type CompanyQuote = {
  quoteId: string;
  amountMinor: number;
  providerFeeReserveMinor: number;
  reservedDebitMinor: number;
  feesPaidBy?: string;
  currency: string;
  expiresAt: string;
};
type Command = { quoteId: string; key: string; reasonHash: string };
type Tracking = { command?: Command; path?: string; retryAt?: number };

function statusPath(data?: RecordData): string | undefined {
  const entry = data?.withdrawal ?? data;
  const url = data?.statusUrl ?? entry?.statusUrl;
  if (
    typeof url === "string" &&
    /^\/v1\/admin\/payments\/company\/withdrawals\/[A-Za-z0-9._~-]+$/.test(
      url,
    ) &&
    !/\/\.{1,2}$/.test(url)
  )
    return url;
  const id = entry?.withdrawalId ?? entry?.existingWithdrawalId ?? entry?.id;
  if (typeof id === "string" && /^[A-Za-z0-9_-][A-Za-z0-9._~-]*$/.test(id))
    return withdrawals + "/" + segment(id);
}

function digestReason(reason: string) {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(reason))
    .then((hash) =>
      Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
    );
}

export function CompanyFunds() {
  const { user, adminType } = useCurrentUser();
  return user && adminType === "super" ? (
    <CompanyFundsWorkspace key={user.id} uid={user.id} />
  ) : null;
}

function CompanyFundsWorkspace({ uid }: { uid: string }) {
  // Keep the command reference across session recovery. The reason and bank details stay out of storage.
  const trackingKey = `company-payout-command:${uid}`;
  const quoteKey = `pnd-company-quote:${uid}`;
  const [tracking, setTracking] = useState<Tracking>({});
  const [quote, setQuote] = useState<CompanyQuote | null>(null);
  const [quoteRound, setQuoteRound] = useState(0);
  const [bankId, setBankId] = useState("");
  const [reason, setReason] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupPath, setLookupPath] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const locked = useRef(false);
  const balance = useResource(root + "/balance");
  const payoutPath = tracking.path ?? lookupPath;
  const payout = useResource(payoutPath ?? null, pollCompanyPayout);
  const terminal =
    !!payout.data &&
    typeof payout.data.status === "string" &&
    !pollCompanyPayout(payout.data);

  function readTracking(): Tracking {
    return JSON.parse(localStorage.getItem(trackingKey) || "{}");
  }

  function saveTracking(next: Tracking) {
    if (next.command || next.path || next.retryAt)
      localStorage.setItem(trackingKey, JSON.stringify(next));
    else localStorage.removeItem(trackingKey);
    setTracking(next);
  }

  function clearQuote() {
    sessionStorage.removeItem(quoteKey);
    setQuote(null);
    setQuoteRound((round) => round + 1);
  }

  useEffect(() => {
    function restore() {
      try {
        const current = readTracking();
        setTracking(current);
        setRetryAt(current.retryAt ?? 0);
        setQuote(JSON.parse(sessionStorage.getItem(quoteKey) || "null"));
      } catch (failure) {
        setError(failure);
      }
    }
    restore();
    window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, [trackingKey, quoteKey]);

  useEffect(() => {
    const expiry = Date.parse(quote?.expiresAt || "");
    const next = [expiry, retryAt]
      .filter((time) => time > now)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, next - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [quote, retryAt, now]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current || retryAt > Date.now()) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    const send = async () => {
      const current = readTracking();
      setTracking(current);
      if (current.retryAt && current.retryAt > Date.now()) {
        setNow(Date.now());
        setRetryAt(current.retryAt);
        throw new Error("Wait for the retry window before submitting again.");
      }
      if (current.path)
        throw new Error(
          "Follow the existing company payout before submitting another.",
        );
      const text = reason.trim();
      if (Array.from(text).length < 10 || Array.from(text).length > 500)
        throw new Error("Enter a reason of 10–500 characters.");
      const reasonHash = await digestReason(text);
      if (current.command && current.command.reasonHash !== reasonHash)
        throw new Error(
          "Enter the original reason to retry the same withdrawal.",
        );
      if (
        !current.command &&
        (!quote || !(Date.parse(quote.expiresAt) > Date.now()))
      )
        throw new Error("Request a new quote before submitting.");
      const command = current.command ?? {
        quoteId: quote!.quoteId,
        reasonHash,
        key: crypto.randomUUID(),
      };
      saveTracking({ command });
      try {
        const result = await paymentCommand(withdrawals, {
          method: "POST",
          headers: { "Idempotency-Key": command.key },
          body: JSON.stringify({ quoteId: command.quoteId, reason: text }),
        });
        const path = statusPath(result);
        if (!path)
          throw new Error(
            "The service returned no payout reference. Retry the same withdrawal to recover it.",
          );
        saveTracking({ path });
        clearQuote();
        setReason("");
        balance.reload();
      } catch (failure) {
        if (failure instanceof ApiError) {
          const reconcile = [
            "company_withdrawal_pending",
            "provider_reconciliation_required",
            "withdrawal_quote_unavailable",
          ].includes(failure.code);
          const path = reconcile ? statusPath(failure.details) : undefined;
          if (path) {
            saveTracking({ path });
            clearQuote();
          } else if (
            !uncertainPayment(failure) &&
            !(current.command && reconcile)
          ) {
            saveTracking({});
          }
          if (
            [
              "withdrawal_quote_unavailable",
              "company_funds_reserved",
              "insufficient_funds",
            ].includes(failure.code)
          ) {
            clearQuote();
            balance.reload();
          }
          const time = retryAfterTime(failure);
          if (time > Date.now()) {
            setNow(Date.now());
            setRetryAt(time);
            saveTracking({ ...readTracking(), retryAt: time });
          }
        }
        throw failure;
      }
    };
    try {
      if (navigator.locks) await navigator.locks.request(trackingKey, send);
      else await send();
    } catch (failure) {
      setError(failure);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const expired = !!quote && !(Date.parse(quote.expiresAt) > now);
  const funds = balance.data;
  return (
    <div className="space-y-6">
      <Heading
        title="Company funds"
        description="Review company balances and transfer eligible earnings to a verified company bank."
      />
      <InformationCard
        title="Company balance"
        action={
          <RefreshButton loading={balance.loading} onClick={balance.reload}>
            Refresh balance
          </RefreshButton>
        }
      >
        {balance.loading && <RecordSkeleton />}
        {balance.error != null && (
          <ErrorNotice error={balance.error} retry={balance.reload} />
        )}
        {funds && (
          <>
            <RecordView
              data={{
                currency: funds.currency,
                provider: funds.provider,
                availableCashMinor: funds.availableMinor,
                pendingCashMinor: funds.pendingMinor,
                nativeLiabilitiesMinor: funds.nativeLiabilitiesMinor,
                earnedCompanyFundsMinor: funds.earnedCompanyFundsMinor,
                withdrawableMinor: funds.withdrawableMinor,
                providerFeeReserveMinor: funds.providerFeeReserveMinor,
                reviewRequired: funds.reviewRequired,
              }}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Company cash can back customer wallets and outstanding
              obligations. The withdrawable balance shows how much is available
              to transfer.
            </p>
            {funds.reviewRequired === true && (
              <Notice>Company funds are pending review.</Notice>
            )}
          </>
        )}
      </InformationCard>
      {!tracking.path && !tracking.command && (
        <>
          <InformationCard title="Company bank">
            <ActionForm
              action={{
                title: "Register company bank",
                description: "Use an account in the company’s legal name.",
                path: root + "/banks",
                fields: [
                  field("bankCode", "Bank code", { maxLength: 32 }),
                  field("accountNumber", "Account number", {
                    pattern: "[0-9]{10}",
                    maxLength: 10,
                  }),
                ],
                retryPayment: true,
                preserveRetry: true,
                renderResult: (result) => (
                  <RecordView
                    data={{
                      bankAccountId: result.bankAccountId ?? result.id,
                      bankName: result.bankName,
                      accountName: result.accountName,
                      accountNumberMasked: result.accountNumberMasked,
                      status: result.status,
                    }}
                  />
                ),
              }}
              onSuccess={(result) =>
                setBankId(result.bankAccountId ?? result.id ?? "")
              }
            />
          </InformationCard>
          {!quote && funds && (
            <InformationCard title="Withdrawal quote">
              <ActionForm
                key={`${bankId}:${quoteRound}`}
                action={{
                  title: "Request quote",
                  path: root + "/withdrawal-quotes",
                  fields: [
                    field("bankAccountId", "Verified company bank ID"),
                    moneyField("amountMinor", "Withdrawal amount"),
                  ],
                  initial: { bankAccountId: bankId },
                  body: (values) => {
                    if (!values.bankAccountId.trim())
                      throw new Error("Enter a verified company bank ID.");
                    const amountMinor = values.amountMinor;
                    if (
                      !Number.isSafeInteger(amountMinor) ||
                      amountMinor <= 0 ||
                      amountMinor > funds.withdrawableMinor ||
                      !Number.isSafeInteger(funds.withdrawableMinor)
                    )
                      throw new Error(
                        "Enter a positive amount within the withdrawable balance.",
                      );
                    return {
                      bankAccountId: values.bankAccountId.trim(),
                      amountMinor,
                      currency: "NGN",
                    };
                  },
                  operationScope: String(quoteRound),
                  retryPayment: true,
                  preserveRetry: true,
                  validateResult: (result) => {
                    if (
                      typeof result?.quoteId !== "string" ||
                      !result.quoteId ||
                      !Number.isFinite(Date.parse(result.expiresAt))
                    )
                      throw new Error(
                        "The service returned an incomplete withdrawal quote.",
                      );
                  },
                }}
                onSuccess={(result) => {
                  const current: CompanyQuote = {
                    quoteId: result.quoteId,
                    amountMinor: result.amountMinor,
                    providerFeeReserveMinor: result.providerFeeReserveMinor,
                    reservedDebitMinor: result.reservedDebitMinor,
                    feesPaidBy: result.feesPaidBy,
                    currency: result.currency,
                    expiresAt: result.expiresAt,
                  };
                  sessionStorage.setItem(quoteKey, JSON.stringify(current));
                  setNow(Date.now());
                  setQuote(current);
                }}
              />
            </InformationCard>
          )}
        </>
      )}
      {!tracking.path && (quote || tracking.command) && (
        <InformationCard title="Confirm company withdrawal">
          {quote && (
            <RecordView
              data={{
                currency: quote.currency,
                amountMinor: quote.amountMinor,
                estimatedProviderFeeReserveMinor: quote.providerFeeReserveMinor,
                reservedDebitMinor: quote.reservedDebitMinor,
                feesPaidBy: quote.feesPaidBy,
                expiresAt: quote.expiresAt,
              }}
            />
          )}
          <p className="my-3 text-sm text-muted-foreground">
            The company pays the provider fee. The reserve is an estimate.
          </p>
          {tracking.command && (
            <Notice>
              A withdrawal was submitted without a confirmed outcome. Use the
              original reason to retry the same request.
            </Notice>
          )}
          {expired && !tracking.command ? (
            <Button variant="outline" onClick={clearQuote}>
              Request a new quote
            </Button>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <label className="block space-y-2 text-sm font-medium">
                <span>Withdrawal reason</span>
                <Textarea
                  required
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || retryAt > now} type="submit">
                  {busy
                    ? "Submitting…"
                    : tracking.command
                      ? "Retry same withdrawal"
                      : "Submit company withdrawal"}
                </Button>
                {!tracking.command && (
                  <Button
                    type="button"
                    disabled={busy}
                    variant="outline"
                    onClick={clearQuote}
                  >
                    Discard quote
                  </Button>
                )}
              </div>
            </form>
          )}
        </InformationCard>
      )}
      {error != null && <ErrorNotice error={error} />}
      <InformationCard
        title="Company withdrawal status"
        action={
          payoutPath && (
            <RefreshButton loading={payout.loading} onClick={payout.reload}>
              Refresh status
            </RefreshButton>
          )
        }
      >
        {!tracking.path && (
          <form
            className="mb-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setLookupPath(statusPath({ id: lookupId.trim() }));
            }}
          >
            <label className="space-y-2 text-sm font-medium">
              <span>Withdrawal ID</span>
              <Input
                required
                pattern="[A-Za-z0-9_\\-][A-Za-z0-9._~\\-]*"
                value={lookupId}
                onChange={(event) => setLookupId(event.target.value)}
              />
            </label>
            <Button type="submit" variant="outline">
              Look up withdrawal
            </Button>
          </form>
        )}
        {payout.loading && <RecordSkeleton />}
        {payout.error != null && (
          <ErrorNotice error={payout.error} retry={payout.reload} />
        )}
        {payout.data && (
          <RecordView
            data={{
              id: payout.data.withdrawalId ?? payout.data.id,
              status: payout.data.status,
              currency: payout.data.currency,
              amountMinor: payout.data.amountMinor,
              providerFeeMinor: payout.data.providerFeeMinor,
              reservedDebitMinor: payout.data.reservedDebitMinor,
              reviewRequired: payout.data.reviewRequired,
              createdAt: payout.data.createdAt,
              updatedAt: payout.data.updatedAt,
            }}
          />
        )}
        {payout.data?.reviewRequired === true && (
          <Notice>Provider review is pending.</Notice>
        )}
        {tracking.path && terminal && (
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              saveTracking({});
              setError(null);
              setLookupPath(undefined);
              balance.reload();
            }}
          >
            Close withdrawal status
          </Button>
        )}
      </InformationCard>
    </div>
  );
}
