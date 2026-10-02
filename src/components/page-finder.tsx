import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconArrowUpRight, IconSearch } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCurrentUser } from "@/contexts/UserContext";
import { allowedNavigation } from "@/lib/navigation";

export function PageFinder() {
  const [open, setOpen] = useState(false);
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const items = user?.isAdmin ? allowedNavigation(user.adminType) : [];
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        className="page-finder-trigger"
        onClick={() => setOpen(true)}
        aria-label="Find a page"
        aria-haspopup="dialog"
      >
        <IconSearch size={17} />
        <span className="hidden sm:inline">Find a page…</span>
        <kbd className="hidden lg:inline-flex">⌘ / Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Find a page</DialogTitle>
          <DialogDescription className="sr-only">
            Search the pages available to your admin role. Use arrow keys to
            select a page and Enter to open it.
          </DialogDescription>
          <Command>
            <CommandInput
              placeholder="Where would you like to go?"
              aria-label="Search pages"
            />
            <CommandList className="max-h-[60vh] overflow-y-auto p-2">
              <CommandEmpty className="px-4 py-10 text-center text-sm text-muted-foreground">
                No pages match. Try “shipments”, “users”, or “settings”.
              </CommandEmpty>
              {Array.from(new Set(items.map((item) => item.group))).map(
                (group) => (
                  <CommandGroup
                    heading={group}
                    key={group}
                    className="page-finder-group"
                  >
                    {items
                      .filter((item) => item.group === group)
                      .map((item) => (
                        <CommandItem
                          key={item.url}
                          value={`${item.title} ${item.group} ${item.url}`}
                          className="page-finder-item"
                          onSelect={() => {
                            setOpen(false);
                            navigate(item.url);
                          }}
                        >
                          <item.icon size={19} stroke={1.7} />
                          <span>{item.title}</span>
                          <IconArrowUpRight
                            size={16}
                            className="ml-auto text-muted-foreground"
                          />
                        </CommandItem>
                      ))}
                  </CommandGroup>
                ),
              )}
            </CommandList>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Search pages · Use arrow keys to navigate · Esc to close
            </p>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
