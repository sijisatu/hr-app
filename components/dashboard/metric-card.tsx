import clsx from "clsx";
import { StatusPill } from "@/components/ui/status-pill";

const toneStyles = {
  neutral: "border-white/50",
  success: "border-[rgba(57,196,141,0.2)]",
  danger: "border-[rgba(243,99,99,0.28)]",
  warning: "border-[rgba(255,182,79,0.28)]"
} as const;

export function MetricCard({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: keyof typeof toneStyles;
}) {
  return (
    <div className={clsx("panel metric-glow rounded-[26px] p-5", toneStyles[tone])}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{label}</p>
      <p className="section-title mt-3 text-4xl font-semibold text-[var(--primary)]">{value}</p>
      <div className="mt-3">
        <StatusPill tone={tone}>{note}</StatusPill>
      </div>
    </div>
  );
}
