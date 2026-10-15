import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AccountDetailsHeader({
  title,
  name,
  email,
  phone,
  image,
  backTo,
  status,
  actions,
  sections,
}: {
  title: string;
  name: string;
  email?: string;
  phone?: string;
  image?: string;
  backTo: string;
  status?: ReactNode;
  actions?: ReactNode;
  sections: { id: string; label: string }[];
}) {
  return (
    <header className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3 text-sm">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {title === "User details" ? "Users" : "Riders"}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 px-5 py-6 sm:px-6">
        <Avatar className="size-16 shrink-0 border">
          <AvatarImage src={image} alt="" />
          <AvatarFallback className="bg-secondary text-primary">
            <UserRound className="size-7" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 max-w-full break-words text-2xl font-semibold sm:text-3xl">
              {name}
            </h1>
            {status}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {email && (
              <a
                className="break-all hover:text-primary"
                href={`mailto:${email}`}
              >
                {email}
              </a>
            )}
            {phone && (
              <a className="hover:text-primary" href={`tel:${phone}`}>
                {phone}
              </a>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <nav
        aria-label={`${title} sections`}
        className="flex flex-wrap gap-1 border-t bg-muted/20 px-3 py-2"
      >
        {sections.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
