import { Clock3 } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { ActivityItem } from "@/lib/api";

export function ActivityPanel({ entries }: { entries: ActivityItem[] }) {
  return (
    <div className="panel flex h-full flex-col rounded-[30px] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="section-title text-2xl font-semibold text-[var(--primary)]">Activity Stream</p>
          <p className="mt-2 text-sm text-muted">Live attendance events across active departments</p>
        </div>
        <StatusPill tone="live">Live</StatusPill>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={`${entry.name}-${entry.time}`} className="flex items-start gap-4 rounded-3xl bg-[var(--panel-alt)] p-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary)] text-sm font-bold text-white">
              {entry.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--primary)]">{entry.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Clock3 className="h-3.5 w-3.5" />
                  {entry.time}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted">{entry.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-6 rounded-2xl bg-[var(--panel-alt)] px-4 py-3 text-sm font-semibold text-[var(--primary)]">
        View Full Audit Log
      </button>
    </div>
  );
}
