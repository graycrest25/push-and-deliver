import { AdminAccountsList } from "./admin-accounts-list";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useState, useEffect } from "react";
import { usersService } from "@/services/users.service";
import {
  manageAdminStatus,
  type AdminStatus,
} from "@/services/admin-management.service";
import type { User } from "@/types";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { IconSearch, IconUserCircle } from "@tabler/icons-react";
import { useCurrentUser } from "@/contexts/UserContext";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserManagementPage() {
  const pagination = useFirestorePagination();
  const { user: currentUser, loading: authLoading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    if (
      authLoading ||
      currentUser?.adminType !== "super" ||
      activeTab !== "users"
    )
      return;
    let active = true;
    setLoading(true);
    usersService
      .getAllUsers(pagination.options)
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch((error) => {
        if (active)
          toast.error(
            error instanceof Error ? error.message : "Failed to load users",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    pagination.options,
    activeTab,
    authLoading,
    currentUser?.id,
    currentUser?.adminType,
  ]);

  const updateUserRole = async (uid: string, value: string) => {
    if (updatingUid) return null;
    const adminType = (value === "remove" ? "" : value) as AdminStatus;
    setUpdatingUid(uid);
    try {
      const result = await manageAdminStatus(uid, adminType);
      setUsers((previous) =>
        previous.map((user) =>
          user.id === uid
            ? { ...user, isAdmin: result.isAdmin, adminType: result.adminType }
            : user,
        ),
      );
      if (result.sessionRefreshRequired) {
        toast.warning(
          "Admin access updated. Sign in again to refresh your session.",
        );
      } else {
        toast.success(
          result.isAdmin ? "Admin access updated" : "Admin access removed",
          {
            description:
              "The affected account receives new claims when its session refreshes or it signs in again.",
          },
        );
      }
      return result;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update admin access",
      );
      return null;
    } finally {
      setUpdatingUid(null);
    }
  };

  if (authLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!currentUser || currentUser.adminType !== "super") {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = users.filter(
    (user) =>
      !searchTerm ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-4 space-y-6 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage users and their admin access
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" disabled={Boolean(updatingUid)}>
            Users
          </TabsTrigger>
          <TabsTrigger value="admins" disabled={Boolean(updatingUid)}>
            Admin Accounts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <IconSearch className="h-5 w-5 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Search this page by name or email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="border rounded-md bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-6 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-44" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-8"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.imageURL ? (
                            <img
                              src={user.imageURL}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <IconUserCircle className="size-8 text-muted-foreground" />
                          )}
                          <span>{user.username || "No Name"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value=""
                          onValueChange={(value) =>
                            void updateUserRole(user.id!, value)
                          }
                          disabled={
                            !user.id ||
                            user.id === currentUser.id ||
                            Boolean(updatingUid)
                          }
                        >
                          <SelectTrigger
                            className="w-48"
                            aria-label={`Set admin access for ${user.email || user.username || user.id}`}
                          >
                            <SelectValue
                              placeholder={
                                updatingUid === user.id
                                  ? "Updating access..."
                                  : "Set admin access"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super">Super Admin</SelectItem>
                            <SelectItem value="regular">
                              Regular Admin
                            </SelectItem>
                            <SelectItem value="customercare">
                              Customer Care
                            </SelectItem>
                            <SelectItem value="verifier">Verifier</SelectItem>
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
          <TablePagination
            pagination={pagination}
            loading={loading || Boolean(updatingUid)}
          />
        </TabsContent>
        <TabsContent value="admins" className="pt-4">
          <AdminAccountsList
            currentUid={currentUser.id!}
            updatingUid={updatingUid}
            onRoleChange={updateUserRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
