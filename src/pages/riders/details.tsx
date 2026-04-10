"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ridersService } from "@/services/riders.service";
import type { Rider, Transaction } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db, storage, auth } from "@/lib/firebase";
import {
  ref,
  deleteObject,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/status-utils";
import { VerificationStatus } from "@/types";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/contexts/UserContext";
import { ImageUploadCard } from "@/components/ImageUploadCard";
import { MonoVerificationDialog } from "@/components/MonoVerificationDialog";
import { CardDescription } from "@/components/ui/card";

function formatISOToReadable(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getDate();
  const ordinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}${ordinalSuffix(day)} ${month} ${year}`;
}

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getVerificationStatusLabel = (status: number | undefined) => {
  switch (status) {
    case VerificationStatus.verified:
      return "Verified";
    case VerificationStatus.unverified:
      return "Unverified";
    case VerificationStatus.blocked:
      return "Blocked";
    default:
      return "Unverified";
  }
};

const getVerificationBadgeVariant = (status: number | undefined) => {
  switch (status) {
    case VerificationStatus.verified:
      return "default";
    case VerificationStatus.blocked:
      return "destructive";
    default:
      return "secondary";
  }
};

// ─── Edit Rider Profile Dialog ───────────────────────────────────────────────

interface EditableFields {
  name: string;
  phoneNumber: string;
  email: string;
}

interface EditRiderDialogProps {
  rider: Rider;
  onUpdateComplete: () => Promise<void>;
}

function EditRiderDialog({ rider, onUpdateComplete }: EditRiderDialogProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const getOriginalValues = (): EditableFields => ({
    name: rider.fullname || "",
    phoneNumber: rider.phonenumber || "",
    email: rider.email || "",
  });

  const [formValues, setFormValues] =
    useState<EditableFields>(getOriginalValues());

  const handleOpen = () => {
    setFormValues(getOriginalValues());
    setOpen(true);
  };

  const originalValues = getOriginalValues();

  const getChangedFields = (): Partial<EditableFields> => {
    const changed: Partial<EditableFields> = {};
    (Object.keys(formValues) as Array<keyof EditableFields>).forEach((key) => {
      const current = formValues[key].trim();
      const original = originalValues[key].trim();
      if (current !== original && current !== "") {
        changed[key] = current;
      }
    });
    return changed;
  };

  const changedFields = getChangedFields();
  const hasChanges = Object.keys(changedFields).length > 0;

  const handleUpdate = async () => {
    if (!hasChanges) {
      toast.info("No changes to save");
      return;
    }

    const url = import.meta.env.VITE_RIDER_PROFILE_UPDATE_URL;

    try {
      setUpdating(true);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: rider.id,
          ...changedFields,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || "Update failed");
      }

      toast.success("Rider profile updated successfully");
      setOpen(false);
      await onUpdateComplete();
    } catch (error: any) {
      console.error("Error updating rider: ", error);
      toast.error(error?.message || "Failed to update rider profile");
    } finally {
      setUpdating(false);
    }
  };

  const fieldLabels: Record<keyof EditableFields, string> = {
    name: "Full Name",
    phoneNumber: "Phone Number",
    email: "Email",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={handleOpen}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Rider
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Rider Profile</DialogTitle>
          <DialogDescription>
            Only fields you change will be sent to the server.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={formValues.name}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter full name"
            />
            {formValues.name.trim() !== originalValues.name.trim() && (
              <p className="text-xs text-muted-foreground">
                Changed from:{" "}
                <span className="font-medium">
                  {originalValues.name || "N/A"}
                </span>
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Phone Number</Label>
            <Input
              id="edit-phone"
              value={formValues.phoneNumber}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  phoneNumber: e.target.value,
                }))
              }
              placeholder="Enter phone number"
            />
            {formValues.phoneNumber.trim() !==
              originalValues.phoneNumber.trim() && (
              <p className="text-xs text-muted-foreground">
                Changed from:{" "}
                <span className="font-medium">
                  {originalValues.phoneNumber || "N/A"}
                </span>
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={formValues.email}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="Enter email address"
            />
            {formValues.email.trim() !== originalValues.email.trim() && (
              <p className="text-xs text-muted-foreground">
                Changed from:{" "}
                <span className="font-medium">
                  {originalValues.email || "N/A"}
                </span>
              </p>
            )}
          </div>
        </div>

        {hasChanges && (
          <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
            Will update:{" "}
            <span className="font-medium">
              {Object.keys(changedFields)
                .map((k) => fieldLabels[k as keyof EditableFields])
                .join(", ")}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={updating || !hasChanges}>
            {updating ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RiderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentAdmin } = useCurrentUser();
  const isSuperAdmin = currentAdmin?.adminType === "super";
  const canUploadDocuments =
    currentAdmin?.adminType === "super" ||
    currentAdmin?.adminType === "verifier";

  const [rider, setRider] = useState<Rider | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [plateDialogOpen, setPlateDialogOpen] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);

  const [newVerificationStatus, setNewVerificationStatus] =
    useState<VerificationStatus>(VerificationStatus.unverified);
  const [newChassisNo, setNewChassisNo] = useState("");
  const [newEngineNo, setNewEngineNo] = useState("");
  const [newStatusReport, setNewStatusReport] = useState<
    "good" | "bad" | "fair" | ""
  >("");
  const [updating, setUpdating] = useState(false);
  const [newPlateNumber, setNewPlateNumber] = useState("");
  const [isPlateNumberUpdating, setIsPlateNumberUpdating] = useState(false);
  const [newVehicleColor, setNewVehicleColor] = useState("");
  const [isColorUpdating, setIsColorUpdating] = useState(false);
  const [stateDialogOpen, setStateDialogOpen] = useState(false);
  const [lgaDialogOpen, setLgaDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);

  const [newStateOfOrigin, setNewStateOfOrigin] = useState("");
  const [newLocalGovt, setNewLocalGovt] = useState("");
  const [newHomeAddress, setNewHomeAddress] = useState("");

  const [isStateUpdating, setIsStateUpdating] = useState(false);
  const [isLgaUpdating, setIsLgaUpdating] = useState(false);
  const [isAddressUpdating, setIsAddressUpdating] = useState(false);

  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);

  const handleProfileImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!rider?.id) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only PNG or JPG images allowed");
      return;
    }

    try {
      setUploadingProfileImage(true);
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `profile_${Date.now()}.${ext}`;
      const storageRef = ref(storage, `riders/${rider.id}/profile/${filename}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        () => {},
        (error) => {
          console.error(error);
          toast.error("Upload failed");
          setUploadingProfileImage(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await ridersService.updateRider(rider.id!, { imageUrl: downloadURL });
          toast.success("Profile image updated");
          await loadRiderData();
          setUploadingProfileImage(false);
        },
      );
    } catch (err) {
      console.error(err);
      toast.error("Upload error");
      setUploadingProfileImage(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadRiderData();
      loadRiderTransactions();
    }
  }, [id]);

  const loadRiderData = async () => {
    try {
      setLoading(true);
      const riderData = await ridersService.getRiderById(id!);
      if (!riderData) {
        toast.error("Rider not found");
        navigate("/riders");
        return;
      }
      setRider(riderData);
    } catch (error) {
      console.error("Error loading rider:", error);
      toast.error("Failed to load rider data");
    } finally {
      setLoading(false);
    }
  };

  const loadRiderTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const transactionsRef = collection(db, "Riders", id!, "Transactions");
      const q = query(transactionsRef, orderBy("time", "desc"));
      const querySnapshot = await getDocs(q);
      const txns = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().time?.toDate?.(),
      })) as Transaction[];
      setTransactions(txns);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load rider transactions");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleEditClick = () => {
    setNewVerificationStatus(
      rider?.verificationStatus || VerificationStatus.unverified,
    );
    setNewChassisNo(rider?.chassisNo || "");
    setNewEngineNo(rider?.engineNo || "");
    setNewStatusReport(rider?.statusReport || "");
    setVerificationDialogOpen(true);
  };

  const handleUpdateVerificationStatus = async () => {
    if (!rider?.id) return;
    try {
      setUpdating(true);
      const updateData: Partial<Rider> = {
        verificationStatus: newVerificationStatus,
      };
      if (newChassisNo) updateData.chassisNo = newChassisNo;
      if (newEngineNo) updateData.engineNo = newEngineNo;
      if (newStatusReport) updateData.statusReport = newStatusReport;

      await ridersService.updateRider(rider.id, updateData);
      toast.success("Verification details updated successfully");
      setVerificationDialogOpen(false);
      await loadRiderData();
    } catch (error) {
      console.error("Error updating verification details:", error);
      toast.error("Failed to update verification details");
    } finally {
      setUpdating(false);
    }
  };

  const handlePlateNumberUpdate = async () => {
    if (!rider?.id) return;
    try {
      setIsPlateNumberUpdating(true);
      await ridersService.updateRider(rider.id, {
        plateNumber: newPlateNumber,
      });
      toast.success("Plate Number updated successfully");
      setPlateDialogOpen(false);
      setNewPlateNumber("");
      await loadRiderData();
    } catch (error) {
      console.error("Error updating plate number:", error);
      toast.error("Failed to update plate number");
    } finally {
      setIsPlateNumberUpdating(false);
    }
  };

  const handleColorUpdate = async () => {
    if (!rider?.id) return;
    try {
      setIsColorUpdating(true);
      await ridersService.updateRider(rider.id, {
        vehicleColor: newVehicleColor,
      });
      toast.success("Vehicle color updated successfully");
      setColorDialogOpen(false);
      setNewVehicleColor("");
      await loadRiderData();
    } catch (error) {
      console.error("Error updating vehicle color:", error);
      toast.error("Failed to update vehicle color");
    } finally {
      setIsColorUpdating(false);
    }
  };

  const handleFieldUpdate = async <K extends keyof Rider>(
    field: K,
    value: Rider[K],
    isUpdating: boolean,
    setIsUpdating: (isUpdating: boolean) => void,
    setDialogOpen: (isOpen: boolean) => void,
    loadRiderData: () => Promise<void>,
  ) => {
    if (!rider?.id) return;
    try {
      setIsUpdating(true);
      await ridersService.updateRider(rider.id, { [field]: value });
      toast.success(`${String(field)} updated successfully`);
      setDialogOpen(false);
      await loadRiderData();
    } catch (error) {
      console.error(`Error updating ${String(field)}:`, error);
      toast.error(`Failed to update ${String(field)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const getVehicleTypeLabel = (type: number | undefined) => {
    switch (type) {
      case 0:
        return "Car";
      case 1:
        return "Bicycle";
      case 2:
        return "Bike";
      default:
        return "N/A";
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!rider) return null;

  const isCarOrBike = rider.vehicleType === 0 || rider.vehicleType === 2;

  return (
    <div className="p-8 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/riders")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rider Details</h1>
          <p className="text-muted-foreground">
            Complete information for {rider.fullname || "rider"}
          </p>
        </div>

        {/* Edit Rider Button — only for super admins */}
        {isSuperAdmin && (
          <div className="ml-auto">
            <EditRiderDialog rider={rider} onUpdateComplete={loadRiderData} />
          </div>
        )}
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{rider.fullname || "N/A"}</p>
            </div>
            <div className="w-full max-w-xs">
              {" "}
              {/* optional: limit container width */}
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium truncate" title={rider.email}>
                {rider.email || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="font-medium">{rider.phonenumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date of birth</p>
              <p className="font-medium">
                {rider.dob ? formatISOToReadable(rider.dob) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">State of origin</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{rider.stateOfOrigin || "N/A"}</p>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewStateOfOrigin(rider.stateOfOrigin || "");
                      setStateDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <Dialog open={stateDialogOpen} onOpenChange={setStateDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit State of Origin</DialogTitle>
                  </DialogHeader>
                  <Input
                    value={newStateOfOrigin}
                    onChange={(e) => setNewStateOfOrigin(e.target.value)}
                    placeholder="Enter state of origin"
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setStateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isStateUpdating || !newStateOfOrigin}
                      onClick={() =>
                        handleFieldUpdate(
                          "stateOfOrigin",
                          newStateOfOrigin,
                          isStateUpdating,
                          setIsStateUpdating,
                          setStateDialogOpen,
                          loadRiderData,
                        )
                      }
                    >
                      {isStateUpdating ? "Updating..." : "Update"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Local Government</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{rider.localGovt || "N/A"}</p>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewLocalGovt(rider.localGovt || "");
                      setLgaDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <Dialog open={lgaDialogOpen} onOpenChange={setLgaDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Local Government</DialogTitle>
                  </DialogHeader>
                  <Input
                    value={newLocalGovt}
                    onChange={(e) => setNewLocalGovt(e.target.value)}
                    placeholder="Enter local government"
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setLgaDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isLgaUpdating || !newLocalGovt}
                      onClick={() =>
                        handleFieldUpdate(
                          "localGovt",
                          newLocalGovt,
                          isLgaUpdating,
                          setIsLgaUpdating,
                          setLgaDialogOpen,
                          loadRiderData,
                        )
                      }
                    >
                      {isLgaUpdating ? "Updating..." : "Update"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Next of kin</p>
              <p className="font-medium">{rider.nextOfKinAddress || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">NOK Phone Number</p>
              <p className="font-medium">
                {rider.nextOfKinPhonenumber || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">NOK Address</p>
              <p className="font-medium">{rider.nextOfKinAddress || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rider ID</p>
              <p className="font-mono text-sm">{rider.id || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Home Address</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{rider.homeAddress || "N/A"}</p>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewHomeAddress(rider.homeAddress || "");
                      setAddressDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <Dialog
                open={addressDialogOpen}
                onOpenChange={setAddressDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Home Address</DialogTitle>
                  </DialogHeader>
                  <Input
                    value={newHomeAddress}
                    onChange={(e) => setNewHomeAddress(e.target.value)}
                    placeholder="Enter home address"
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setAddressDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isAddressUpdating || !newHomeAddress}
                      onClick={() =>
                        handleFieldUpdate(
                          "homeAddress",
                          newHomeAddress,
                          isAddressUpdating,
                          setIsAddressUpdating,
                          setAddressDialogOpen,
                          loadRiderData,
                        )
                      }
                    >
                      {isAddressUpdating ? "Updating..." : "Update"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Verification Status
              </p>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    getVerificationBadgeVariant(rider.verificationStatus) as any
                  }
                >
                  {getVerificationStatusLabel(rider.verificationStatus)}
                </Badge>
                <Dialog
                  open={verificationDialogOpen}
                  onOpenChange={setVerificationDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditClick}
                      className="h-6 text-xs"
                    >
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Verification Status</DialogTitle>
                      <DialogDescription>
                        Update the verification status for{" "}
                        {rider.fullname || "this rider"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {isSuperAdmin === true && (
                        <div className="grid gap-2">
                          <Label htmlFor="status">Verification Status</Label>
                          <Select
                            value={String(newVerificationStatus)}
                            onValueChange={(value) =>
                              setNewVerificationStatus(
                                Number(value) as VerificationStatus,
                              )
                            }
                          >
                            <SelectTrigger id="status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value={String(VerificationStatus.verified)}
                              >
                                Verified
                              </SelectItem>
                              <SelectItem
                                value={String(VerificationStatus.unverified)}
                              >
                                Unverified
                              </SelectItem>
                              <SelectItem
                                value={String(VerificationStatus.blocked)}
                              >
                                Blocked
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label htmlFor="chassisNo">Chassis No</Label>
                        <Input
                          id="chassisNo"
                          value={newChassisNo}
                          onChange={(e) => setNewChassisNo(e.target.value)}
                          placeholder="Enter chassis number"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="engineNo">Engine No</Label>
                        <Input
                          id="engineNo"
                          value={newEngineNo}
                          onChange={(e) => setNewEngineNo(e.target.value)}
                          placeholder="Enter engine number"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="statusReport">Status Report</Label>
                        <Select
                          value={newStatusReport}
                          onValueChange={(value) =>
                            setNewStatusReport(value as "good" | "bad" | "fair")
                          }
                        >
                          <SelectTrigger id="statusReport">
                            <SelectValue placeholder="Select status report" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="bad">Bad</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setVerificationDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateVerificationStatus}
                        disabled={updating}
                      >
                        {updating ? "Updating..." : "Update Status"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Online Status</p>
              <Badge variant={rider.onlineStatus ? "default" : "secondary"}>
                {rider.onlineStatus ? "Online" : "Offline"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ongoing Order</p>
              <Badge variant={rider.ongoingOrder ? "default" : "secondary"}>
                {rider.ongoingOrder ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Referred By</p>
              <p className="font-medium">
                {rider.referredBy ? String(rider.referredBy).slice(-5) : "N/A"}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">Image</p>
              <div className="relative group">
                <div
                  style={{
                    backgroundImage: `url(${rider.imageUrl})`,
                    width: "200px",
                    height: "200px",
                    border: "1px solid black",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    borderRadius: "100%",
                  }}
                />
                {isSuperAdmin && (
                  <>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      id="profileImageInput"
                      className="hidden"
                      onChange={handleProfileImageChange}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="
                        absolute bottom-2 left-1/2 -translate-x-1/2
                        opacity-0 group-hover:opacity-100
                        transition-opacity duration-200
                        backdrop-blur-sm bg-white/80
                      "
                      disabled={uploadingProfileImage}
                      onClick={() =>
                        document.getElementById("profileImageInput")?.click()
                      }
                    >
                      {uploadingProfileImage ? "Uploading..." : "Edit"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Information */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Vehicle Type</p>
              <p className="font-medium capitalize">
                {rider.vehicleType !== undefined
                  ? getVehicleTypeLabel(Number(rider.vehicleType))
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Make</p>
              <p className="font-medium">{rider.vehicleMakename || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Model</p>
              <p className="font-medium">{rider.vehicleModelName || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Color</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{rider.vehicleColor || "N/A"}</p>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setColorDialogOpen(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Vehicle Color</DialogTitle>
                    <DialogDescription>
                      Update the vehicle color for{" "}
                      {rider.fullname || "this rider"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleColor">Vehicle Color</Label>
                      <Input
                        id="vehicleColor"
                        value={newVehicleColor}
                        onChange={(e) => setNewVehicleColor(e.target.value)}
                        placeholder="Enter vehicle color"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setColorDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleColorUpdate}
                      disabled={isColorUpdating || newVehicleColor === ""}
                    >
                      {isColorUpdating ? "Updating..." : "Update Color"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plate Number</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{rider.plateNumber || "N/A"}</p>
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPlateDialogOpen(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <Dialog open={plateDialogOpen} onOpenChange={setPlateDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Plate Number</DialogTitle>
                    <DialogDescription>
                      Update the plate number for{" "}
                      {rider.fullname || "this rider"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="plateNumber">Plate Number</Label>
                      <Input
                        id="plateNumber"
                        value={newPlateNumber}
                        onChange={(e) => setNewPlateNumber(e.target.value)}
                        placeholder="Enter plate number"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setPlateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePlateNumberUpdate}
                      disabled={isPlateNumberUpdating || newPlateNumber === ""}
                    >
                      {isPlateNumberUpdating
                        ? "Updating..."
                        : "Update Plate Number"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chassis No</p>
              <p className="font-medium">{rider.chassisNo || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Engine No</p>
              <p className="font-medium">{rider.engineNo || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status Report</p>
              <Badge
                variant={
                  rider.statusReport === "good"
                    ? "default"
                    : rider.statusReport === "fair"
                      ? "secondary"
                      : rider.statusReport === "bad"
                        ? "destructive"
                        : "outline"
                }
              >
                {rider.statusReport
                  ? rider.statusReport.charAt(0).toUpperCase() +
                    rider.statusReport.slice(1)
                  : "N/A"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Images */}
      {canUploadDocuments && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Verification Images</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <ImageUploadCard
              title={
                rider.vehicleType === 2
                  ? "Bike Picture"
                  : rider.vehicleType === 1
                    ? "Bicycle Image"
                    : "Car Picture"
              }
              description={`Upload a clear photo of the ${
                rider.vehicleType === 2
                  ? "Bike Picture"
                  : rider.vehicleType === 1
                    ? "Bicycle Image"
                    : "Car Picture"
              } of the rider `}
              imageUrl={rider.carPictureUrl}
              riderId={rider.id!}
              imageType="car"
              onUploadComplete={async (url) => {
                try {
                  await ridersService.updateCarPicture(rider.id!, url);
                  setRider({ ...rider, carPictureUrl: url });
                  toast.success("Car picture uploaded successfully");
                } catch (error) {
                  console.error("Error saving car picture:", error);
                  toast.error("Failed to save car picture");
                }
              }}
              onDeleteComplete={async () => {
                try {
                  if (rider.carPictureUrl) {
                    const storageRef = ref(storage, rider.carPictureUrl);
                    await deleteObject(storageRef);
                  }
                  await ridersService.deleteCarPicture(rider.id!);
                  setRider({ ...rider, carPictureUrl: null });
                  toast.success("Car picture deleted successfully");
                } catch (error) {
                  console.error("Error deleting car picture:", error);
                  toast.error("Failed to delete car picture");
                }
              }}
            />

            {isCarOrBike && (
              <ImageUploadCard
                title="Plate Number Picture"
                description="Upload a clear photo of the vehicle's plate number"
                imageUrl={rider.plateNumberPictureUrl}
                riderId={rider.id!}
                imageType="plateNumber"
                onUploadComplete={async (url) => {
                  try {
                    await ridersService.updatePlateNumberPicture(
                      rider.id!,
                      url,
                    );
                    setRider({ ...rider, plateNumberPictureUrl: url });
                    toast.success("Plate number picture uploaded successfully");
                  } catch (error) {
                    console.error("Error saving plate number picture:", error);
                    toast.error("Failed to save plate number picture");
                  }
                }}
                onDeleteComplete={async () => {
                  try {
                    if (rider.plateNumberPictureUrl) {
                      const storageRef = ref(
                        storage,
                        rider.plateNumberPictureUrl,
                      );
                      await deleteObject(storageRef);
                    }
                    await ridersService.deletePlateNumberPicture(rider.id!);
                    setRider({ ...rider, plateNumberPictureUrl: null });
                    toast.success("Plate number picture deleted successfully");
                  } catch (error) {
                    console.error(
                      "Error deleting plate number picture:",
                      error,
                    );
                    toast.error("Failed to delete plate number picture");
                  }
                }}
              />
            )}

            <ImageUploadCard
              title={
                rider.vehicleType === 0
                  ? "Driver's License"
                  : rider.vehicleType === 1
                    ? "NIN"
                    : "Rider Card"
              }
              description={`Upload a clear photo of the ${
                rider.vehicleType === 0
                  ? "Driver's License"
                  : rider.vehicleType === 1
                    ? "NIN"
                    : "Rider Card"
              } of the rider `}
              imageUrl={rider.driverLicensePictureUrl}
              riderId={rider.id!}
              imageType="driverLicense"
              onUploadComplete={async (url) => {
                try {
                  await ridersService.updateDriverLicensePicture(
                    rider.id!,
                    url,
                  );
                  setRider({ ...rider, driverLicensePictureUrl: url });
                  toast.success("Driver's license uploaded successfully");
                } catch (error) {
                  console.error("Error saving driver's license:", error);
                  toast.error("Failed to save driver's license");
                }
              }}
              onDeleteComplete={async () => {
                try {
                  if (rider.driverLicensePictureUrl) {
                    const storageRef = ref(
                      storage,
                      rider.driverLicensePictureUrl,
                    );
                    await deleteObject(storageRef);
                  }
                  await ridersService.deleteDriverLicensePicture(rider.id!);
                  setRider({ ...rider, driverLicensePictureUrl: null });
                  toast.success("Driver's license deleted successfully");
                } catch (error) {
                  console.error("Error deleting driver's license:", error);
                  toast.error("Failed to delete driver's license");
                }
              }}
            />

            {isCarOrBike && (
              <ImageUploadCard
                title="Vehicle License"
                description="Upload a clear photo of the rider's vehicle's license"
                imageUrl={rider.licensePictureUrl}
                riderId={rider.id!}
                imageType="vehicleLicense"
                onUploadComplete={async (url) => {
                  try {
                    await ridersService.updateVehicleLicensePicture(
                      rider.id!,
                      url,
                    );
                    setRider({ ...rider, licensePictureUrl: url });
                    toast.success("vehicle's license uploaded successfully");
                  } catch (error) {
                    console.error("Error saving vehicle's license:", error);
                    toast.error("Failed to save vehicle's license");
                  }
                }}
                onDeleteComplete={async () => {
                  try {
                    if (rider.licensePictureUrl) {
                      const storageRef = ref(storage, rider.licensePictureUrl);
                      await deleteObject(storageRef);
                    }
                    await ridersService.deleteVehicleLicensePicture(rider.id!);
                    setRider({ ...rider, licensePictureUrl: null });
                    toast.success("Vehicle's license deleted successfully");
                  } catch (error) {
                    console.error("Error deleting Vehicle's license:", error);
                    toast.error("Failed to delete Vehicle's license");
                  }
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Identity Verification */}
      {canUploadDocuments && (
        <Card>
          <CardHeader>
            <CardTitle>Identity Verification</CardTitle>
            <CardDescription>
              Verify rider identity using NIN or BVN via Mono
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {rider.ninVerified || rider.bvnVerified ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">
                      {rider.monoVerificationData?.type} Verified
                    </Badge>
                    {rider.monoVerificationData && (
                      <span className="text-sm text-muted-foreground">
                        {rider.monoVerificationData.firstName}{" "}
                        {rider.monoVerificationData.lastName}
                      </span>
                    )}
                  </div>
                ) : (
                  <Badge variant="secondary">Not Verified</Badge>
                )}
              </div>
              <MonoVerificationDialog
                riderId={rider.id!}
                riderName={rider.fullname}
                currentVerification={{
                  ninVerified: rider.ninVerified,
                  bvnVerified: rider.bvnVerified,
                  monoVerificationData: rider.monoVerificationData,
                }}
                onVerificationComplete={loadRiderData}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet & Bank Information */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet & Bank Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p
                className="text-2xl font-bold"
                style={{ color: "hsl(150, 35%, 42%)" }}
              >
                ₦{formatAmount(rider.walletbalance || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bank Name</p>
              <p className="font-medium">{rider.bankInfo?.bankName || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Name</p>
              <p className="font-medium">{rider.bankInfo?.acctName || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-medium">
                {rider.bankInfo?.acctNumber || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions found
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-sm">
                        {txn.time instanceof Date
                          ? txn.time.toLocaleString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            txn.transactionType === 0 ? "default" : "secondary"
                          }
                        >
                          {txn.transactionType === 0
                            ? "Credit"
                            : txn.transactionType === 1
                              ? "Debit"
                              : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        {txn.narration || "N/A"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium",
                          txn.transactionType === 0
                            ? "text-green-500"
                            : "text-red-500",
                        )}
                      >
                        ₦{formatAmount(txn.amount || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(txn.status) as any}
                        >
                          {getStatusLabel(txn.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {txn.trxref || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
