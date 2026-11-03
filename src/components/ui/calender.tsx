"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      weekStartsOn={1}
      hideWeekdays={true}
      classNames={{
        months: "flex flex-col sm:flex-row sm:gap-4 gap-2",
        month: "space-y-4 text-center",
        caption: "flex justify-between pt-2 relative items-center px-12", // ← Increased px-12 for more side space
        caption_label: "text-sm font-medium flex-1 text-center", // Center label properly
        nav: "space-x-4 flex items-center absolute inset-x-0 top-0 justify-between px-2 py-4", // ← More space between chevrons
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 opacity-80 hover:opacity-100", // ← Slightly larger buttons for better click area & visual spacing
        ),
        table: "w-full border-collapse",
        head_row: "hidden",
        row: "flex w-full mt-3", // ← More top margin since no header
        cell: "h-9 w-9 p-0 mx-auto text-center text-sm",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-full aria-selected:opacity-100 hover:bg-muted",
        ),
        day_range_start: "rounded-l-full",
        day_range_end: "rounded-r-full",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        day_today:
          "bg-accent text-accent-foreground font-semibold rounded-full",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
