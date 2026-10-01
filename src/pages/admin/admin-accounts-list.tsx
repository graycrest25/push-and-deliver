import { useCallback, useEffect, useRef, useState } from "react";
import { IconUserCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_SIZES } from "@/lib/firestore-pagination";
import {
  listAdminUsers,
  type ListAdminUsersResponse,
  type ManageAdminStatusResponse,
} from "@/services/admin-management.service";

const roleLabels = {
  super: "Super Admin",
  regular: "Regular Admin",
  customercare: "Customer Care",
  verifier: "Verifier",
};

export function AdminAccountsList({
  currentUid,
  updatingUid,
  onRoleChange,
}: {
  currentUid: string;
  updatingUid: string | null;
  onRoleChange: (
    uid: string,
    value: string,
  ) => Promise<ManageAdminStatusResponse | null>;
}) {
  const [result, setResult] = useState<ListAdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const tokens = useRef<Array<string | undefined>>([undefined]);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const requestedPage = useRef<{
    index: number;
    size: number;
    pageToken?: string;
  }>({ index: 0, size: 10 });

  const loadPage = useCallback(
    async (index: number, size: number, pageToken?: string) => {
      requestedPage.current = { index, size, pageToken };
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const version = ++revision.current;
      setLoading(true);
      setError(null);
      try {
        const data = await listAdminUsers({
          pageSize: size,
          pageToken,
          signal: controller.signal,
        });
        if (controller.signal.aborted || version !== revision.current) return;
        if (index === 0) tokens.current = [undefined];
        // Tokens refer to batches of Auth accounts, including batches with no admins.
        tokens.current[index + 1] = data.nextPageToken ?? undefined;
        setResult(data);
        setPageIndex(index);
        setPageSize(size);
      } catch (cause) {
        if (controller.signal.aborted || version !== revision.current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Failed to load admin accounts.",
        );
      } finally {
        if (!controller.signal.aborted && version === revision.current)
          setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadPage(0, 10);
    return () => {
      revision.current++;
      request.current?.abort();
    };
  }, [loadPage, currentUid]);

  const changeRole = async (uid: string, value: string) => {
    const updated = await onRoleChange(uid, value);
    if (!updated) return;
    setResult((previous) => {
      if (!previous) return previous;
      const users = previous.users.flatMap((user) => {
        if (user.userid !== uid) return [user];
        return updated.isAdmin && updated.adminType !== ""
          ? [{ ...user, isAdmin: true as const, adminType: updated.adminType }]
          : [];
      });
      return { ...previous, users, count: users.length };
    });
  };

  const filtered =
    result?.users.filter(
      (user) =>
        !searchTerm ||
        [user.name, user.email, user.userid].some((value) =>
          value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    ) ?? [];
  const busy = loading || Boolean(updatingUid);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          aria-label="Search admin accounts on this page"
          placeholder="Search this page by name, email, or ID..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadPage(0, pageSize)}
          disabled={busy}
        >
          Refresh list
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void loadPage(
                requestedPage.current.index,
                requestedPage.current.size,
                requestedPage.current.pageToken,
              )
            }
            disabled={busy}
          >
            Retry
          </Button>
        </div>
      )}
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Admin Type</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-44" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-44" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  {error && !result
                    ? "Admin accounts could not be loaded."
                    : searchTerm
                      ? "No admins match your search on this page."
                      : result?.nextPageToken
                        ? "No admins in this batch. Select Next to continue."
                        : "No admin accounts on this page."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.userid}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.imageurl ? (
                        <img
                          src={user.imageurl}
                          alt=""
                          className="size-8 rounded-full object-cover"
                        />
                      ) : (
                        <IconUserCircle className="size-8 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {user.name || "Unnamed admin"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.userid}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {roleLabels[user.adminType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value=""
                      onValueChange={(value) =>
                        void changeRole(user.userid, value)
                      }
                      disabled={busy || user.userid === currentUid}
                    >
                      <SelectTrigger
                        className="w-48"
                        aria-label={`Set admin access for ${user.email || user.name || user.userid}`}
                      >
                        <SelectValue
                          placeholder={
                            updatingUid === user.userid
                              ? "Updating access..."
                              : "Set admin access"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                        <SelectItem value="remove">
                          Remove admin access
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <nav
        aria-label="Admin accounts pagination"
        className="flex flex-wrap items-center justify-between gap-4 py-2"
      >
        <div className="flex items-center gap-2 text-sm">
          <span>Page size</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => void loadPage(0, Number(value))}
            disabled={busy}
          >
            <SelectTrigger
              aria-label="Admin accounts page size"
              className="w-20"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p role="status" className="text-sm tabular-nums">
          {result
            ? `Page ${pageIndex + 1} · ${result.count} admins · ${result.scannedCount} accounts checked`
            : loading
              ? "Loading admin accounts..."
              : "No page loaded"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void loadPage(
                pageIndex - 1,
                pageSize,
                tokens.current[pageIndex - 1],
              )
            }
            disabled={busy || pageIndex === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void loadPage(
                pageIndex + 1,
                pageSize,
                result?.nextPageToken ?? undefined,
              )
            }
            disabled={busy || !result?.nextPageToken}
          >
            Next
          </Button>
        </div>
      </nav>
    </div>
  );
}
