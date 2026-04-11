import { Clock3 } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { ActivityItem } from "@/lib/api";

export function ActivityPanel({
  entries,
  title = "Latest History Activity",
  subtitle = "Recent attendance events"
}: {
  entries: ActivityItem[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="page-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <div>
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">{title}</p>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <StatusPill tone="live">Live</StatusPill>
      </div>

      <div className="max-h-[520px] overflow-y-auto px-6">
        {entries.map((entry) => (
          <div key={`${entry.name}-${entry.time}`} className="flex items-start gap-4 border-b border-[var(--border)] py-5 last:border-b-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-[12px] font-semibold text-[var(--primary)]">
              {entry.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-[var(--text)]">{entry.name}</p>
                  <p className="mt-1 text-[14px] leading-5 text-[var(--text-muted)]">{entry.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[12px] text-[var(--text-muted)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {entry.time}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border)] px-6 py-4">
        <button className="secondary-button w-full">View Full Audit Log</button>
      </div>
    </div>
  );
}


