import { api, ApiError, type RecordData } from "./api";

export const paymentErrors: Record<string, string> = {
  invalid_credentials: "Your session could not be verified. Sign in again.",
  recent_auth_required:
    "Sign in again to authorize this company payment action.",
  forbidden: "Check your administrator role, account type and verification.",
  account_name_mismatch:
    "The rider must use a bank account that matches their approved name.",
  company_bank_name_mismatch: "Use a bank account in the company’s legal name.",
  invalid_pin:
    "The PIN is incorrect or locked. Check the PIN before submitting again.",
  payout_onboarding_required:
    "Reload payout readiness and complete the outstanding setup.",
  withdrawal_quote_unavailable:
    "Check the current payout before requesting a new quote.",
  insufficient_funds:
    "Refresh the balance and include the withdrawal charge in the total.",
  provider_reconciliation_required: "The payout is pending provider review.",
  company_identity_required:
    "Complete the company’s legal profile before continuing.",
  company_funds_reserved:
    "Refresh the company balance to check how much is available to withdraw.",
  company_withdrawal_pending:
    "A company payout is already pending. Follow its status.",
  checkout_not_abandoned:
    "Keep the existing checkout and reconcile its status.",
  rate_limited: "Too many requests. Wait before trying again.",
  provider_unavailable:
    "The payment provider is temporarily unavailable. Retry the same request.",
  unavailable:
    "The service is temporarily unavailable. Retry the same request.",
};

export function retryAfterTime(error: unknown) {
  if (!(error instanceof ApiError)) return 0;
  const value = error.retryAfter;
  if (!value) return error.status === 429 ? Date.now() + 5000 : 0;
  const time = /^\d+$/.test(value)
    ? Date.now() + Number(value) * 1000
    : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export async function retryPaymentRequest<T>(
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      !["provider_unavailable", "unavailable"].includes(error.code)
    )
      throw error;
    const delay = Math.max(1000, retryAfterTime(error) - Date.now());
    if (delay > 5000 || error.status === 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (document.hidden || !navigator.onLine) throw error;
    return request();
  }
}

export function paymentCommand(path: string, options: RequestInit) {
  return retryPaymentRequest(() => api(path, options));
}

export function uncertainPayment(error: unknown) {
  return (
    !(error instanceof ApiError) ||
    error.status >= 500 ||
    [408, 429].includes(error.status) ||
    [
      "provider_unavailable",
      "unavailable",
      "invalid_credentials",
      "recent_auth_required",
      "provider_reconciliation_required",
      "company_withdrawal_pending",
    ].includes(error.code)
  );
}

export function payoutIsPending(
  data: RecordData,
  success: "completed" | "succeeded",
) {
  return (
    typeof data.status === "string" &&
    ![
      success,
      "failed",
      "cancelled",
      "canceled",
      "rejected",
      "reversed",
      "expired",
      "refunded",
    ].includes(data.status)
  );
}
