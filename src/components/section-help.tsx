import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ReactNode,
} from "react";
import { IconHelpCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-current"
          aria-label={`Help with ${tutorial.title}`}
          title={page ? "About this page" : "About this section"}
          onClick={(event) => event.stopPropagation()}
        >
          <IconHelpCircle className="size-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto"
        showCloseButton={false}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="text-left">
          <DialogTitle>{tutorial.title}</DialogTitle>
          <DialogDescription className="sr-only">
            About {tutorial.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1 text-sm leading-6">
          {tutorial.steps.map((item) => (
            <div key={item.title}>
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
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
