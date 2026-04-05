import { Camera, Clock3, MapPinned, MoreVertical } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { AttendanceOverview, AttendanceRecord } from "@/lib/api";

const toneMap = {
  "on-time": "success",
  late: "danger",
  absent: "warning",
  "early-leave": "neutral"
} as const;

const labelMap = {
  "on-time": "On-time",
  late: "Late",
  absent: "Absent",
  "early-leave": "Early Leave"
} as const;

export function AttendanceTable({
  logs,
  punctuality,
  overview
}: {
  logs: AttendanceRecord[];
  punctuality: number;
  overview: AttendanceOverview;
}) {
  const metrics = [
    { label: "Checked In Today", value: `${overview.checkedInToday}`, detail: `${overview.openCheckIns} still open` },
    { label: "GPS Validated", value: `${overview.gpsValidated}`, detail: `${Math.max(overview.checkedInToday - overview.gpsValidated, 0)} flagged` },
    { label: "Selfie Captured", value: `${overview.selfieCaptured}`, detail: `${overview.checkedInToday === 0 ? 0 : Math.round((overview.selfieCaptured / overview.checkedInToday) * 100)}% coverage` },
    { label: "Overtime Hours", value: `${overview.overtimeHours}`, detail: `${overview.activeShifts} active shifts` }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="kpi-grid">
          {metrics.map((metric) => (
            <div key={metric.label} className="page-card p-5">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{metric.label}</p>
              <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{metric.value}</p>
              <p className="mt-3 text-[14px] text-[var(--text-muted)]">{metric.detail}</p>
            </div>
          ))}
        </div>

        <div className="page-card bg-[var(--primary)] p-5 text-white">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/72">Average Punctuality</p>
          <p className="mt-3 text-[30px] font-semibold leading-none">{punctuality.toFixed(1)}%</p>
          <p className="mt-3 text-[14px] leading-5 text-white/75">{overview.scheduledShifts} shifts are queued for the next rotation window.</p>
        </div>
      </div>

      <div className="page-card overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="filter-bar">
            <select className="filter-control text-[14px]">
              <option>All Departments</option>
            </select>
            <select className="filter-control text-[14px]">
              <option>Current Cycle</option>
            </select>
            <select className="filter-control text-[14px]">
              <option>All Statuses</option>
            </select>
          </div>
          <div className="panel-muted max-w-[360px] px-4 py-3 text-[13px] leading-5 text-[var(--text-muted)]">
            GPS and selfie compliance are tracked at check-in time and stored in local directory mode.
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4 lg:px-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-4 pb-2">Employee</th>
                <th className="px-4 pb-2">Shift</th>
                <th className="px-4 pb-2">Check Window</th>
                <th className="px-4 pb-2">GPS</th>
                <th className="px-4 pb-2">Status</th>
                <th className="px-4 pb-2">Overtime</th>
                <th className="px-4 pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="rounded-[12px] bg-[var(--surface-muted)] hover:bg-[#edf2f7]">
                  <td className="rounded-l-[12px] px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{log.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.department}</p>
                    <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                      {new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{log.shiftName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.location}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                      <Clock3 className="h-4 w-4" />
                      {log.checkIn} - {log.checkOut ?? "Open"}
                    </div>
                    <p className="mt-2">Planned {log.scheduledStart} - {log.scheduledEnd}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                      <MapPinned className="h-4 w-4" />
                      {log.gpsValidated ? "Validated" : "Outside Radius"}
                    </div>
                    <p className="mt-2">{log.gpsDistanceMeters}m from anchor</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      {log.photoUrl ? "Selfie captured" : "No selfie yet"}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusPill tone={toneMap[log.status]}>{labelMap[log.status]}</StatusPill>
                  </td>
                  <td className="px-4 py-4 align-top text-[14px] font-medium text-[var(--text)]">
                    {log.overtimeMinutes > 0 ? `${log.overtimeMinutes} min` : "-"}
                  </td>
                  <td className="rounded-r-[12px] px-4 py-4 text-right align-top">
                    <button className="secondary-button !min-h-9 !w-9 !rounded-full !p-0">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

