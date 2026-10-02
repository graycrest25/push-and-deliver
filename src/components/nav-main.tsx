import { IconCirclePlusFilled, type Icon } from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { couponsService } from "@/services/coupons.service";
import { toast } from "sonner";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/contexts/UserContext";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
    group?: string;
  }[];
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useCurrentUser();
  const adminType = user?.adminType || "customercare";
  const isValidAdmin =
    user?.adminType === "super" || user?.adminType === "regular";

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            {adminType !== "customercare" && isValidAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Create Coupon"
                    className="mb-3 h-10 border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                  >
                    <IconCirclePlusFilled />
                    <span>Create Coupon</span>
                  </SidebarMenuButton>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Coupon</DialogTitle>
                    <DialogDescription>
                      Fill in the details below to create a new coupon.
                    </DialogDescription>
                  </DialogHeader>
                  <CouponForm onSuccess={() => setIsDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
        {Array.from(
          new Set(items.map((item) => item.group || "Workspace")),
        ).map((group) => (
          <div key={group} className="navigation-section">
            <SidebarGroupLabel className="px-3 text-xs font-medium text-sidebar-foreground/70">
              {group}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {items
                .filter((item) => (item.group || "Workspace") === group)
                .map((item) => {
                  const isActive =
                    location.pathname === item.url ||
                    location.pathname.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        asChild
                        className="nav-destination"
                      >
                        <Link
                          to={item.url}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          {item.icon && <item.icon stroke={1.7} />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CouponForm({ onSuccess }: { onSuccess: () => void }) {
  const [percentageDiscount, setPercentageDiscount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateCoupon = async () => {
    if (!percentageDiscount) {
      toast.error("Please enter a percentage discount");
      return;
    }

    const discount = parseFloat(percentageDiscount);
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      toast.error("Please enter a valid percentage (1-100)");
      return;
    }

    try {
      setLoading(true);
      await couponsService.createCoupon({
        percentageDiscount: discount,
        isActive: true,
      });
      toast.success("Coupon created successfully");
      setPercentageDiscount("");
      onSuccess();
    } catch (error) {
      console.error("Error creating coupon:", error);
      toast.error("Failed to create coupon");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="percentageDiscount">Percentage Discount (%)</Label>
        <Input
          id="percentageDiscount"
          type="number"
          placeholder="e.g. 50"
          value={percentageDiscount}
          onChange={(e) => setPercentageDiscount(e.target.value)}
        />
      </div>
      <Button onClick={handleCreateCoupon} disabled={loading}>
        {loading ? "Creating..." : "Create Coupon"}
      </Button>
    </div>
  );
}
