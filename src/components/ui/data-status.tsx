import {
  IconArrowRight,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCopy,
  IconInfoCircle,
  IconMinus,
} from "@tabler/icons-react";
import { Badge } from "./badge";
import { enumLabel } from "@/lib/enum-labels";
import { statusTone, type DataTone } from "@/lib/data-presentation";

export function DataStatus({
  value,
  label,
  field = "status",
  scope = "",
  tone,
}: {
  value: unknown;
  label?: string;
  field?: string;
  scope?: string;
  tone?: DataTone;
}) {
  const color = tone ?? statusTone(value, field, scope);
  const Icon = {
    positive: IconCircleCheck,
    attention: IconClock,
    danger: IconCircleX,
    info: IconArrowRight,
    accent: IconCopy,
    teal: IconInfoCircle,
    neutral: IconMinus,
  }[color];
  return (
    <Badge variant="secondary" data-tone={color} className="data-status-badge">
      <Icon size={14} stroke={1.8} aria-hidden="true" />
      {label ??
        enumLabel(field, value, scope) ??
        (value == null || value === "" ? "Unknown" : String(value))}
    </Badge>
  );
}
