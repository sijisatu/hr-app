import type { AttendanceSeriesItem } from "@/lib/api";

export function AttendanceChart({ series }: { series: AttendanceSeriesItem[] }) {
  const maxValue = Math.max(...series.map((item) => item.present + item.absent), 1);

  return (
    <div className="panel rounded-[30px] p-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="section-title text-2xl font-semibold text-[var(--primary)]">
            Attendance Performance
          </p>
          <p className="mt-2 text-sm text-muted">Weekly aggregate of check-in efficiency</p>
        </div>
        <div className="rounded-2xl bg-[var(--panel-alt)] px-4 py-3 text-sm font-semibold text-muted">
          Last 7 Days
        </div>
      </div>

      <div className="grid h-[300px] grid-cols-7 items-end gap-4">
        {series.map((item) => {
          const presentHeight = (item.present / maxValue) * 100;
          const absentHeight = (item.absent / maxValue) * 100;

          return (
            <div key={item.label} className="flex h-full flex-col items-center justify-end gap-4">
              <div className="flex h-full w-full items-end justify-center gap-1 rounded-[24px] bg-[linear-gradient(180deg,rgba(237,242,251,0.4),rgba(237,242,251,0))] p-3">
                <div
                  className="w-full max-w-[30px] rounded-t-2xl bg-[var(--panel-alt)]"
                  style={{ height: `${absentHeight}%` }}
                />
                <div
                  className="w-full max-w-[30px] rounded-t-2xl bg-[var(--primary)] shadow-[0_16px_35px_rgba(18,48,98,0.22)]"
                  style={{ height: `${presentHeight}%` }}
                />
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
