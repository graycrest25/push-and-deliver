import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usersService } from "@/services/users.service";
import { ridersService } from "@/services/riders.service";
import { transactionService } from "@/services/transaction.service";
import type { User, Rider } from "@/types";
import { toast } from "sonner";
import { useCurrentUser } from "@/contexts/UserContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactModal({ open, onOpenChange }: TransactModalProps) {
  const userPagination = useFirestorePagination();
  const riderPagination = useFirestorePagination();
  const { user: currentAdmin, refetchUser } = useCurrentUser();
  const [transactionMode, setTransactionMode] = useState<"credit" | "debit">(
    "credit",
  );
  const [recipientType, setRecipientType] = useState<"user" | "rider">("user");
  const [users, setUsers] = useState<User[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  // const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [riderSearchOpen, setRiderSearchOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const selectedRecipientId =
    recipientType === "user" ? selectedUserId : selectedRiderId;

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, userPagination.options, riderPagination.options]);

  useEffect(() => {
    // Auto-fill narration for riders
    if (recipientType === "rider" && !narration) {
      setNarration("Requested a rider");
    } else if (recipientType === "user" && narration === "Requested a rider") {
      setNarration("");
    }
  }, [recipientType]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [usersData, ridersData] = await Promise.all([
        usersService.getAllUsers(userPagination.options),
        ridersService.getAllRiders(riderPagination.options),
      ]);
      setUsers(usersData);
      setRiders(ridersData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load users and riders");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!selectedRecipientId) {
      toast.error("Please select a recipient");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Only check admin balance for credit (sending money)
    if (transactionMode === "credit") {
      if (
        !currentAdmin?.walletbalance ||
        currentAdmin.walletbalance < amountNum
      ) {
        toast.error("Insufficient wallet balance");
        return;
      }
    }

    if (!narration.trim()) {
      toast.error("Please enter a narration");
      return;
    }

    const selectedUser = users.find((u) => u.id === selectedRecipientId);
    const selectedRider = riders.find((r) => r.id === selectedRecipientId);

    try {
      setLoading(true);

      if (transactionMode === "credit") {
        await transactionService.transferMoney({
          senderId: currentAdmin.id!,
          senderType: "user", // Super admin uses Users collection
          recipientId: selectedRecipientId,
          recipientType: recipientType,
          amount: amountNum,
          narration: narration.trim(),
        });
      } else {
        await transactionService.debitMoney({
          targetId: selectedRecipientId,
          targetType: recipientType,
          amount: amountNum,
          narration: narration.trim(),
        });
      }

      toast.success(
        `${transactionMode === "credit" ? "Credit" : "Debit"} transaction completed successfully`,
      );

      // Refetch user data to update wallet balance
      await refetchUser();

      onOpenChange(false);

      // Reset form
      setTransactionMode("credit");
      setSelectedRiderId("");
      setSelectedUserId("");
      // setRecipientType("user");
      setAmount("");
      setNarration("");
    } catch (error: any) {
      console.error("Transaction error:", error);
      toast.error(error.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  console.log(selectedRecipientId);

  const adminBalance = currentAdmin?.walletbalance || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {transactionMode === "credit"
              ? "Send Money (Credit)"
              : "Take Money (Debit)"}
          </DialogTitle>
          <DialogDescription>
            {transactionMode === "credit"
              ? "Transfer funds from your wallet to a user or rider"
              : "Debit funds from a user or rider's wallet"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Transaction Mode Selection */}
          <Tabs
            value={transactionMode}
            onValueChange={(value) =>
              setTransactionMode(value as "credit" | "debit")
            }
            className="mb-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credit">Credit (Send)</TabsTrigger>
              <TabsTrigger value="debit">Debit (Take)</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Recipient Type Selection */}
          <Tabs
            value={recipientType}
            onValueChange={(value) =>
              setRecipientType(value as "user" | "rider")
            }
            className="mb-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user">User</TabsTrigger>
              <TabsTrigger value="rider">Rider</TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-select">Select User</Label>
                <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                  <PopoverTrigger asChild disabled={loadingData}>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={userSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedUserId
                        ? users.find((u) => u.id === selectedUserId)
                            ?.username ||
                          users.find((u) => u.id === selectedUserId)?.email ||
                          "Selected user"
                        : "Choose a user"}

                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    align="start"
                    className="w-75 p-0"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command>
                      {/* 🔥 search happens here */}
                      <CommandInput
                        placeholder="Search by username, email or ID..."
                        className="h-10"
                      />

                      <CommandEmpty>No user found.</CommandEmpty>

                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={`${user.username} ${user.email} ${user.id}`}
                            onSelect={() => {
                              setSelectedUserId(user.id!);
                              setUserSearchOpen(false);
                            }}
                            className="flex items-center gap-2 py-2"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedRecipientId === user.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />

                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {user.username || "Unnamed user"}
                              </span>

                              <span className="text-xs text-muted-foreground">
                                {user.email || user.id}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                    <TablePagination pagination={userPagination} loading={loadingData} />
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>

            <TabsContent value="rider" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rider-select">Select Rider</Label>
                <Popover
                  open={riderSearchOpen}
                  onOpenChange={setRiderSearchOpen}
                >
                  <PopoverTrigger asChild disabled={loadingData}>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={riderSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedRiderId
                        ? riders.find((r) => r.id === selectedRiderId)
                            ?.fullname || "Selected rider"
                        : "Choose a rider"}

                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    align="start"
                    className="w-75 p-0"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search by name or ID..."
                        className="h-10"
                      />

                      <CommandEmpty>No rider found.</CommandEmpty>

                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {riders.map((rider) => (
                          <CommandItem
                            key={rider.id}
                            value={`${rider.fullname} ${rider.id}`}
                            onSelect={() => {
                              setSelectedRiderId(rider.id!);
                              setRiderSearchOpen(false);
                            }}
                            className="flex items-center gap-2 py-2"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedRecipientId === rider.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />

                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {rider.fullname || "Unknown Rider"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {rider.id}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                    <TablePagination pagination={riderPagination} loading={loadingData} />
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-4">
            {/* Wallet Balance Display - Only show for credit mode */}
            {transactionMode === "credit" && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  Your Wallet Balance
                </p>
                <p className="text-2xl font-bold text-green-600">
                  ₦
                  {adminBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Narration Input */}
            <div className="space-y-2">
              <Label htmlFor="narration">Narration</Label>
              <Input
                id="narration"
                type="text"
                placeholder="Enter transaction description"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingData}>
              {loading ? "Sending..." : "Send Money"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
