import type { ComponentProps } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type RefreshButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "asChild"
> & {
  loading?: boolean;
};

// One secondary action treatment for refreshing records throughout the workspace.
export function RefreshButton({
  loading = false,
  disabled,
  children = "Refresh",
  size = "sm",
  type = "button",
  ...props
}: RefreshButtonProps) {
  return (
    <Button
      {...props}
      type={type}
      variant="outline"
      size={size}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      <IconRefresh
        aria-hidden="true"
        stroke={1.7}
        className={
          loading ? "animate-spin motion-reduce:animate-none" : undefined
        }
      />
      {children}
    </Button>
  );
}
