import { FormSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import {
  ActionForm,
  nairaField,
  ErrorNotice,
  Notice,
  RecordView,
  bool,
  field,
  useResource,
} from "./shared";

export function SignupCouponSettings() {
  const current = useResource("/v1/admin/coupons/signup/settings");
  const [saved, setSaved] = useState(false);
  return (
    <section
      aria-labelledby="signup-pool-title"
      className="space-y-4 border-y py-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="signup-pool-title" className="text-lg font-semibold">
          Automatic signup coupons
        </h2>
        <RefreshButton
          type="button"
          size="sm"
          loading={current.loading}
          onClick={current.reload}
        >
          Reload signup settings
        </RefreshButton>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Create a campaign with a 24- or 48-hour validity, then add its ID to
        this pool. Eligible verified signups receive a coupon through the
        background worker when an enabled campaign has capacity and funding.
      </p>
      {saved && (
        <p role="status" className="text-sm font-medium text-primary">
          Signup coupon settings saved. Eligible jobs are processed in the
          background.
        </p>
      )}
      {current.error ? (
        <ErrorNotice error={current.error} retry={current.reload} />
      ) : current.loading ? (
        <FormSkeleton label="Loading signup coupon settings…" />
      ) : (
        current.data && (
          <>
            <RecordView data={current.data} />
            <ActionForm
              action={{
                title: "Save signup coupon settings",
                path: "/v1/admin/coupons/signup/settings",
                method: "PUT",
                initial: current.data,
                fields: [
                  bool("enabled", "Enable signup coupons"),
                  field("campaign_ids", "Campaign IDs", {
                    type: "list",
                    required: false,
                    help: "Up to 100 distinct IDs, separated by commas. Each campaign must use a 24- or 48-hour validity. An empty pool waits for campaigns or funding.",
                  }),
                ],
                body: (value) => {
                  const ids: string[] = value.campaign_ids;
                  if (
                    ids.length > 100 ||
                    new Set(ids).size !== ids.length ||
                    ids.some(
                      (id) =>
                        !id.trim() ||
                        id !== id.trim() ||
                        id.includes("\0") ||
                        new TextEncoder().encode(id).length > 128,
                    )
                  )
                    throw new Error(
                      "Use at most 100 distinct campaign IDs, each at most 128 UTF-8 bytes.",
                    );
                  return value;
                },
              }}
              onSuccess={() => {
                setSaved(true);
                current.reload();
              }}
            />
          </>
        )
      )}
    </section>
  );
}
export function SignupWalletBonus() {
  const { adminType } = useCurrentUser();
  return adminType === "super" ? <WalletBonusSettings /> : null;
}
function WalletBonusSettings() {
  const current = useResource("/v1/config");
  const [saved, setSaved] = useState(false);
  const amount = current.data?.signup_bonus_minor;
  const knownAmount =
    typeof amount === "number" &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= 1000000;
  return (
    <section
      aria-labelledby="signup-wallet-title"
      className="space-y-4 border-t pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="signup-wallet-title" className="text-lg font-semibold">
          Signup wallet bonus
        </h2>
        <RefreshButton
          type="button"
          size="sm"
          loading={current.loading}
          onClick={current.reload}
        >
          Reload bonus amount
        </RefreshButton>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Super admins set the cash bonus for future eligible verified customer
        and rider signups. The backend credits each eligible wallet once when
        its verification event is processed and sufficient funding is available.
        Setting the amount to zero disables cash rewards.
      </p>
      <Notice>
        Set the funding budget before enabling a cash bonus. Accounts processed
        with a disabled or unfunded bonus are not paid retroactively when
        settings change. Coupon rewards have a separate campaign budget.
      </Notice>
      {saved && (
        <p role="status" className="text-sm font-medium text-primary">
          Signup cash bonus saved for future eligible signups.
        </p>
      )}
      {current.error ? (
        <ErrorNotice error={current.error} retry={current.reload} />
      ) : current.loading ? (
        <FormSkeleton label="Loading signup bonus amount…" />
      ) : (
        <>
          {knownAmount ? (
            <p className="text-sm">
              Current bonus:{" "}
              <strong>
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                }).format(amount / 100)}
              </strong>{" "}
              per eligible signup.
            </p>
          ) : (
            <Notice>
              The current bonus amount was not returned. Enter the intended
              amount explicitly.
            </Notice>
          )}
          <ActionForm
            action={{
              title: "Set signup cash bonus",
              path: "/v1/admin/config/signup_bonus_minor",
              method: "PUT",
              initial: { amount: knownAmount ? amount : "" },
              fields: [nairaField("amount", "Bonus", 0, 1000000)],
              body: (value) => value.amount,
            }}
            onSuccess={() => {
              setSaved(true);
              current.reload();
            }}
          />
        </>
      )}
      <Notice>
        The API does not return the funding budget, spent amount or remaining
        balance. Confirm the current values with the backend operator before
        replacing the total budget; it cannot be lower than the amount already
        spent.
      </Notice>
      <ActionForm
        action={{
          title: "Set signup bonus budget",
          path: "/v1/admin/config/signup_bonus_budget_minor",
          method: "PUT",
          fields: [
            {
              ...nairaField(
                "amount",
                "Total budget (minor units)",
                0,
                1000000000000,
              ),
              default: "",
              help: "Replaces the total budget; this is not an incremental top-up. Enter the total in naira.",
            },
          ],
          body: (value) => value.amount,
          success:
            "Signup bonus budget saved. This does not credit existing accounts or confirm the remaining balance.",
        }}
      />
    </section>
  );
}
