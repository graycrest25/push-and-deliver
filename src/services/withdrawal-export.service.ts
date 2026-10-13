import { format, isValid } from "date-fns";
import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";

export async function exportWithdrawalsCsv(
  status: "Pending" | "Successful" | "Failed" | "Reversed",
  startDate: Date,
  endDate: Date,
): Promise<void> {
  if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) {
    throw new Error("Select a valid date range before exporting.");
  }
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in to export accounts.");
  const token = await currentUser.getIdToken(true);
  if (auth.currentUser?.uid !== currentUser.uid) {
    throw new Error("Your session changed. Please try again.");
  }
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");
  const url = new URL(endpoints.exportWithdrawalsCsv);
  url.searchParams.set("status", status);
  url.searchParams.set("startDate", start);
  url.searchParams.set("endDate", end);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      (typeof error?.error === "string" && error.error) ||
      (typeof error?.message === "string" && error.message) ||
      "Failed to export withdrawals. Please try again.",
    );
  }
  const blob = await response.blob();
  if (auth.currentUser?.uid !== currentUser.uid) {
    throw new Error("Your session changed. Please try again.");
  }
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = downloadUrl;
    anchor.download = `withdrawals_${status.toLowerCase()}_${start}_${end}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Allow the browser to start the download before releasing the blob URL.
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }
}
