import { Link, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { segment } from "@/lib/api";
import { DataList, Heading, Notice, field } from "./shared";

export function SupportClosures() {
  const { adminType } = useCurrentUser();
  const [search] = useSearchParams();
  if (adminType !== "super")
    return <Notice>Only super administrators can view closure history.</Notice>;
  return (
    <div className="space-y-6">
      <Heading
        title="Support closure history"
        description="Newest closures first. Reopening a ticket preserves its earlier closure records."
      />
      <Link to="/support-tickets" className="text-sm text-primary underline">
        Back to support tickets
      </Link>
      <DataList
        key={search.toString()}
        spec={{
          path: "/v1/admin/support/closures",
          key: "items",
          paging: "cursor",
          defaultPageSize: 25,
          pageSizes: [10, 25, 50, 100],
          initialFilters: {
            ticketId: search.get("ticketId") || "",
            closedByUid: search.get("closedByUid") || "",
          },
          filters: [
            field("ticketId", "Ticket ID", { required: false }),
            field("closedByUid", "Closed by staff UID", { required: false }),
          ],
          columns: [
            {
              key: "summary",
              render: (row) => row.summary || "No summary recorded",
            },
            {
              key: "ticketId",
              label: "Ticket",
              render: (row) =>
                row.ticketId ? (
                  <Link
                    className="text-primary underline"
                    to={`/support-tickets/${segment(row.ticketId)}`}
                  >
                    {row.ticketId}
                  </Link>
                ) : (
                  "Unavailable"
                ),
            },
            {
              key: "closedBy",
              label: "Closed by",
              render: (row) => (
                <div>
                  <p>
                    {row.closedBy?.name ||
                      row.closedBy?.email ||
                      row.closedBy?.uid ||
                      row.closedByUid ||
                      "Unknown staff"}
                  </p>
                  {row.closedBy?.name && row.closedBy?.email && (
                    <p className="text-xs text-muted-foreground">
                      {row.closedBy.email}
                    </p>
                  )}
                </div>
              ),
            },
            { key: "closedAt", label: "Closure date" },
          ],
        }}
      />
    </div>
  );
}
