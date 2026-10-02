import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { generalNotificationsService } from "@/services/general-notifications.service";
import type { GeneralNotification } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { MoreHorizontal, Plus, Send } from "lucide-react";
import { useCurrentUser } from "@/contexts/UserContext";

const USER_TYPE_LABELS: Record<GeneralNotification["userType"], string> = {
  users: "Users",
  riders: "Riders",
  restaurants: "Restaurants",
  merchants: "Merchants",
};

const USER_TYPE_COLORS: Record<GeneralNotification["userType"], string> = {
  users: "default",
  riders: "secondary",
  restaurants: "outline",
  merchants: "outline",
};

export default function GeneralNotificationsPage() {
  const pagination = useFirestorePagination();
  const { user } = useCurrentUser();
  const isAdminViewOnly =
    user?.adminType === "customercare" || user?.adminType === "verifier";

  const [notifications, setNotifications] = useState<GeneralNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState({
    title: "",
    body: "",
    userType: "" as GeneralNotification["userType"] | "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [pagination.options]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await generalNotificationsService.getAllNotifications(pagination.options);
      setNotifications(data);
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotification = async () => {
    if (!createValues.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!createValues.body.trim()) {
      toast.error("Please enter a message body");
      return;
    }
    if (!createValues.userType) {
      toast.error("Please select a user type");
      return;
    }

    try {
      setCreateLoading(true);
      await generalNotificationsService.createNotification({
        title: createValues.title.trim(),
        body: createValues.body.trim(),
        userType: createValues.userType as GeneralNotification["userType"],
        createdBy: user?.id || "unknown",
      });
      toast.success("Notification created successfully");
      setIsCreateOpen(false);
      setCreateValues({ title: "", body: "", userType: "" });
      await loadNotifications();
    } catch (error) {
      console.error("Error creating notification:", error);
      toast.error("Failed to create notification");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      setActionLoading(id);
      await generalNotificationsService.deleteNotification(id);
      toast.success("Notification deleted successfully");
      await loadNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            General Notifications
          </h1>
          <p className="text-muted-foreground">
            Broadcast notifications to users
          </p>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full mt-2" />
            <Skeleton className="h-8 w-full mt-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            General Notifications
          </h1>
          <p className="text-muted-foreground">
            Broadcast notifications to users, riders, restaurants, or merchants
          </p>
        </div>
        {!isAdminViewOnly && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="mr-2 h-4 w-4" />
                Send Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Send General Notification</DialogTitle>
                <DialogDescription>
                  Create a notification to broadcast to a specific user group.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-title">Title</Label>
                  <Input
                    id="create-title"
                    value={createValues.title}
                    onChange={(e) =>
                      setCreateValues({
                        ...createValues,
                        title: e.target.value,
                      })
                    }
                    placeholder="Notification title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-body">Message Body</Label>
                  <Textarea
                    id="create-body"
                    value={createValues.body}
                    onChange={(e) =>
                      setCreateValues({
                        ...createValues,
                        body: e.target.value,
                      })
                    }
                    placeholder="Enter your notification message..."
                    rows={4}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-userType">Target User Type</Label>
                  <Select
                    value={createValues.userType}
                    onValueChange={(value) =>
                      setCreateValues({
                        ...createValues,
                        userType: value as GeneralNotification["userType"],
                      })
                    }
                  >
                    <SelectTrigger id="create-userType">
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="riders">Riders</SelectItem>
                      <SelectItem value="restaurants">Restaurants</SelectItem>
                      <SelectItem value="merchants">Merchants</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateNotification}
                  disabled={createLoading}
                >
                  {createLoading ? "Sending..." : "Send Notification"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              To Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter((n) => n.userType === "users").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              To Riders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter((n) => n.userType === "riders").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              To Restaurants/Merchants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                notifications.filter(
                  (n) =>
                    n.userType === "restaurants" || n.userType === "merchants"
                ).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>
            View all sent general notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Title</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Date Sent</TableHead>
                  {!isAdminViewOnly && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdminViewOnly ? 4 : 5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No notifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((notification) => (
                    <TableRow
                      key={notification.id}
                      className="hover:bg-muted/50"
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {notification.title}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground">
                        {notification.body}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            USER_TYPE_COLORS[notification.userType] as
                              | "default"
                              | "secondary"
                              | "outline"
                          }
                        >
                          {USER_TYPE_LABELS[notification.userType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {notification.createdAt
                          ? format(
                              new Date(notification.createdAt as Date),
                              "dd-MM-yyyy HH:mm"
                            )
                          : "N/A"}
                      </TableCell>
                      {!isAdminViewOnly && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  notification.id &&
                                  handleDeleteNotification(notification.id)
                                }
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table><TablePagination pagination={pagination} loading={loading} /></>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
