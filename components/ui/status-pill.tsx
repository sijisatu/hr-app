import clsx from "clsx";

const toneMap = {
  active: "bg-[rgba(87,215,199,0.18)] text-[var(--accent)]",
  inactive: "bg-slate-100 text-slate-400",
  success: "bg-[rgba(57,196,141,0.15)] text-[var(--success)]",
  danger: "bg-[rgba(243,99,99,0.14)] text-[var(--danger)]",
  warning: "bg-[rgba(255,182,79,0.15)] text-[var(--warning)]",
  neutral: "bg-[var(--primary-soft)] text-[var(--primary)]",
  live: "bg-[rgba(87,215,199,0.18)] text-[var(--accent)]",
  alert: "bg-[rgba(243,99,99,0.12)] text-[var(--danger)]"
} as const;

export function StatusPill({
  tone,
  children
}: {
  tone: keyof typeof toneMap;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        toneMap[tone]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
