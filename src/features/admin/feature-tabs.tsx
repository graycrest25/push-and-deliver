import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Section = { id: string; label: string; content: ReactNode };
export function FeatureTabs({
  sections,
  label,
  queryKey = "tab",
  defaultTab = sections[0].id,
}: {
  sections: Section[];
  label: string;
  queryKey?: string;
  defaultTab?: string;
}) {
  const [params, setParams] = useSearchParams();
  const active = sections.some((section) => section.id === params.get(queryKey))
    ? params.get(queryKey)!
    : defaultTab;
  const selected = useRef(active);
  selected.current = active;
  const [visited, setVisited] = useState(() => new Set([active]));
  const tabBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setVisited((previous) =>
      previous.has(active) ? previous : new Set([...previous, active]),
    );
  }, [active]);
  useEffect(() => {
    const bar = tabBar.current;
    if (!bar) return;
    const showSelectedTab = () => {
      const tab = bar.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      );
      if (!tab) return;
      const bounds = bar.getBoundingClientRect();
      const selectedBounds = tab.getBoundingClientRect();
      if (selectedBounds.right > bounds.right)
        bar.scrollLeft += selectedBounds.right - bounds.right;
      else if (selectedBounds.left < bounds.left)
        bar.scrollLeft -= bounds.left - selectedBounds.left;
    };
    showSelectedTab();
    const observer = new ResizeObserver(showSelectedTab);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [active]);
  return (
    <Tabs
      value={active}
      onValueChange={(tab) => {
        // Pointer and focus events can select the same tab before React renders.
        if (selected.current === tab) return;
        selected.current = tab;
        const next = new URLSearchParams(params);
        next.set(queryKey, tab);
        setParams(next);
      }}
      className="gap-6"
    >
      <div ref={tabBar} className="overflow-x-auto border-b pb-3">
        <TabsList aria-label={label} className="h-auto min-w-max gap-1">
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="min-h-10 px-4"
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {sections.map((section) => (
        <TabsContent
          key={section.id}
          value={section.id}
          forceMount
          hidden={active !== section.id}
        >
          {(visited.has(section.id) || active === section.id) &&
            section.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
