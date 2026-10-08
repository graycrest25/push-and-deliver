import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  IconHelpCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconRotateClockwise,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  tutorialForPath,
  tutorialForSection,
  type Tutorial,
} from "@/lib/tutorials";

const HelpContext = createContext<string | null>(null);

export function TutorialProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  return (
    <HelpContext.Provider value={pathname}>{children}</HelpContext.Provider>
  );
}

export function sectionTitleText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number")
        return String(child);
      if (isValidElement<{ children?: ReactNode }>(child))
        return sectionTitleText(child.props.children);
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function TutorialButton({
  tutorial,
  page = false,
}: {
  tutorial: Tutorial;
  page?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = tutorial.steps[index];
  const last = index === tutorial.steps.length - 1;

  useEffect(() => {
    if (!open || !playing) return;
    // Allow enough time to read each step; navigation always remains available.
    const duration = Math.max(
      10000,
      current.description.split(/\s+/).length * 350,
    );
    const timer = window.setTimeout(() => {
      if (last) setPlaying(false);
      else setIndex((value) => value + 1);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [open, playing, index, current.description, last]);

  function changeStep(next: number) {
    setPlaying(false);
    setIndex(next);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setPlaying(false);
        if (value) setIndex(0);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-current"
          aria-label={`Show ${tutorial.title} tutorial`}
          title={page ? "How this page works" : "How this section works"}
          onClick={(event) => event.stopPropagation()}
        >
          <IconHelpCircle className="size-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>{tutorial.title}</DialogTitle>
          <DialogDescription>
            Follow this walkthrough, then close it to use the section.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Step {index + 1} of {tutorial.steps.length}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={playing}
            onClick={() => {
              if (!playing && last) setIndex(0);
              setPlaying((value) => !value);
            }}
          >
            {playing ? (
              <IconPlayerPause aria-hidden="true" />
            ) : (
              <IconPlayerPlay aria-hidden="true" />
            )}
            {playing ? "Pause" : "Play steps"}
          </Button>
        </div>
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-label="Tutorial progress"
          aria-valuemin={0}
          aria-valuemax={tutorial.steps.length}
          aria-valuenow={index + 1}
        >
          {tutorial.steps.map((_, position) => (
            <span
              key={position}
              className={`h-1 flex-1 rounded-full ${position <= index ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <div
          className="min-h-40 space-y-3 py-3"
          aria-live="polite"
          aria-atomic="true"
        >
          <h3 className="text-lg font-semibold">{current.title}</h3>
          <p className="text-sm leading-7 text-muted-foreground">
            {current.description}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Play advances at a reading pace. Pause to take more time. This
          tutorial does not change any records.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => changeStep(0)}
          >
            <IconRotateClockwise aria-hidden="true" />
            Replay
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={index === 0}
              onClick={() => changeStep(index - 1)}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (last) {
                  setOpen(false);
                  setPlaying(false);
                } else changeStep(index + 1);
              }}
            >
              {last ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SectionHelp({ title }: { title: string }) {
  const pathname = useContext(HelpContext);
  const tutorial = pathname ? tutorialForSection(title, pathname) : undefined;
  return tutorial ? (
    <TutorialButton key={`${pathname}:${title}`} tutorial={tutorial} />
  ) : null;
}

export function useTutorialsEnabled() {
  return useContext(HelpContext) !== null;
}

export function PageHelp() {
  const pathname = useContext(HelpContext);
  const tutorial = pathname ? tutorialForPath(pathname) : undefined;
  return tutorial ? (
    <TutorialButton key={pathname} tutorial={tutorial} page />
  ) : null;
}
