import { enumLabel } from "@/lib/enum-labels";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import { useState } from "react";
import { apiResponse, queryPath } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNotice, InformationCard } from "./shared";
export function WithdrawalExport() {
  const { adminType } = useCurrentUser();
  const [format, setFormat] = useState("csv"),
    [status, setStatus] = useState(""),
    [limit, setLimit] = useState("1000"),
    [cursor, setCursor] = useState(""),
    [count, setCount] = useState(0),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const reset = () => {
    setCursor("");
    setCount(0);
    setDone(false);
    setError(null);
  };
  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiResponse(
        queryPath("/v1/admin/reports/withdrawals", {
          format,
          status,
          limit,
          cursor,
        }),
        {
          headers: {
            Accept: format === "csv" ? "text/csv" : "application/json",
          },
        },
      );
      let blob: Blob,
        next = "";
      if (format === "json") {
        const body = await response.json();
        blob = new Blob([JSON.stringify(body, null, 2)], {
          type: "application/json",
        });
        next = body.data.nextCursor || "";
      } else {
        blob = await response.blob();
        next = response.headers.get("X-Next-Cursor") || "";
      }
      const href = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = href;
      a.download = `withdrawals-${status || "all"}-part-${count + 1}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setCount(count + 1);
      setCursor(next);
      setDone(!next);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  if (!canOperate(adminType)) return null;
  return (
    <InformationCard title="Export withdrawals">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Each file contains one page at the time it is read. Exports include no
          bank numbers and do not send money.
        </p>
        <fieldset
          disabled={busy || count > 0}
          className="grid gap-4 sm:grid-cols-3"
        >
          <div className="space-y-2">
            <Label htmlFor="withdrawal-export-format">Export format</Label>
            <select
              id="withdrawal-export-format"
              className="h-10 w-full rounded-md border bg-card px-3"
              value={format}
              onChange={(event) => {
                setFormat(event.target.value);
                reset();
              }}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-export-status">Export status</Label>
            <select
              id="withdrawal-export-status"
              className="h-10 w-full rounded-md border bg-card px-3"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                reset();
              }}
            >
              <option value="">All</option>
              {[
                "requested",
                "approved",
                "submitting",
                "pending",
                "otp",
                "succeeded",
                "failed",
                "reversed",
                "cancelled",
              ].map((value) => (
                <option key={value} value={value}>
                  {enumLabel("status", value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-export-limit">
              Records per file (1–2000)
            </Label>
            <Input
              id="withdrawal-export-limit"
              type="number"
              min={1}
              max={2000}
              value={limit}
              onChange={(event) => {
                setLimit(event.target.value);
                reset();
              }}
            />
          </div>
        </fieldset>
        {error != null && <ErrorNotice error={error} />}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={
              busy ||
              done ||
              !Number.isInteger(Number(limit)) ||
              Number(limit) < 1 ||
              Number(limit) > 2000
            }
            onClick={download}
          >
            {busy
              ? "Downloading…"
              : count
                ? "Download next withdrawal page"
                : "Download withdrawal report"}
          </Button>
          {count > 0 && (
            <Button variant="outline" disabled={busy} onClick={reset}>
              Start a new export
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {count
            ? `${count} file(s) downloaded${done ? " · Export complete" : " · More records available"}`
            : "Choose the status and format before downloading."}
        </p>
      </div>
    </InformationCard>
  );
}
