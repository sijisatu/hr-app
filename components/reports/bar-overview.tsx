import type { AttendanceSeriesItem } from "@/lib/api";

export function BarOverview({ series }: { series: AttendanceSeriesItem[] }) {
  const max = Math.max(...series.map((item) => item.present), 1);

  return (
    <div className="panel rounded-[30px] p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="section-title text-2xl font-semibold text-[var(--primary)]">
            Monthly Attendance Trend
          </p>
          <p className="mt-2 text-sm text-muted">Aggregate daily presence across the current fiscal cycle.</p>
        </div>
        <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          <span className="rounded-full bg-[var(--primary)] px-3 py-2 text-white">Present</span>
          <span className="rounded-full bg-[var(--panel-alt)] px-3 py-2">Absent</span>
        </div>
      </div>

      <div className="grid h-[320px] grid-cols-7 items-end gap-4">
        {series.map((item, index) => (
          <div key={item.label} className="flex h-full flex-col items-center justify-end gap-4">
            <div className="flex h-full w-full max-w-[66px] items-end justify-center rounded-[24px] bg-[var(--panel-alt)]/50 p-2">
              <div
                className="w-full rounded-[18px_18px_10px_10px] bg-[var(--primary)]"
                style={{ height: `${(item.present / max) * (78 + (index % 2) * 12)}%` }}
              />
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
