import type { Withdrawal } from "@/types";

export function getUserTypeLabel(value: unknown): string {
  const type = typeof value === "string" ? value.trim().toLowerCase() : value;
  if (type === 0 || type === "0" || type === "vendor") return "Vendor";
  if (type === 1 || type === "1" || type === "rider") return "Rider";
  if (type === 2 || type === "2" || type === "ecommercemerchant" || type === "ecommerce merchant") return "Ecommerce Merchant";
  return "Unknown";
}

export function isUserTypeEqual(value: unknown, target: number): boolean {
  return (target === 0 || target === 1 || target === 2) &&
    getUserTypeLabel(value) === getUserTypeLabel(target);
}

export function withdrawalDate(value: unknown): Date | null {
  try {
    const candidate = value && typeof value === "object" && "toDate" in value &&
      typeof value.toDate === "function" ? value.toDate() : value;
    const date = candidate instanceof Date ? candidate :
      typeof candidate === "string" ? new Date(candidate) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

export function normalizeWithdrawal(id: string, data: Record<string, unknown>): Withdrawal {
  const text = (value: unknown) => typeof value === "string" ? value : null;
  return {
    id,
    amount: typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : null,
    bankname: text(data.bankname),
    accountname: text(data.accountname),
    accountnumber: typeof data.accountnumber === "number" || typeof data.accountnumber === "string" ? data.accountnumber : null,
    userID: text(data.userID),
    userType: typeof data.userType === "number" || typeof data.userType === "string" ? data.userType : null,
    transactionID: text(data.transactionID),
    status: typeof data.status === "number" || typeof data.status === "string" ? data.status : null,
    createdAt: withdrawalDate(data.createdAt),
    updatedAt: withdrawalDate(data.updatedAt),
    syncedAt: withdrawalDate(data.syncedAt),
  };
}

export function canEditWithdrawal(status: unknown): boolean {
  return status === 1 || status === "1" ||
    (typeof status === "string" && status.trim().toLowerCase() === "pending");
}
