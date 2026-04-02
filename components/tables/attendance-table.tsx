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
    {
      label: "Checked In Today",
      value: `${overview.checkedInToday}`,
      detail: `${overview.openCheckIns} still open`
    },
    {
      label: "GPS Validated",
      value: `${overview.gpsValidated}`,
      detail: `${Math.max(overview.checkedInToday - overview.gpsValidated, 0)} flagged`
    },
    {
      label: "Selfie Captured",
      value: `${overview.selfieCaptured}`,
      detail: `${overview.checkedInToday === 0 ? 0 : Math.round((overview.selfieCaptured / overview.checkedInToday) * 100)}% coverage`
    },
    {
      label: "Overtime Hours",
      value: `${overview.overtimeHours}`,
      detail: `${overview.activeShifts} active shifts`
    }
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="panel rounded-[28px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{metric.label}</p>
              <p className="mt-3 section-title text-4xl font-semibold text-[var(--primary)]">{metric.value}</p>
              <p className="mt-2 text-sm text-muted">{metric.detail}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[28px] bg-[var(--primary)] px-6 py-5 text-white shadow-soft">
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">Average punctuality</p>
          <p className="mt-2 section-title text-4xl font-semibold">{punctuality.toFixed(1)}%</p>
          <p className="mt-3 text-sm text-white/70">{overview.scheduledShifts} shifts are queued for the next rotation window.</p>
        </div>
      </div>

      <div className="panel rounded-[30px] p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
              <option>All Departments</option>
            </select>
            <select className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
              <option>Current Cycle</option>
            </select>
            <select className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
              <option>All Statuses</option>
            </select>
          </div>
          <div className="rounded-[24px] bg-[var(--panel-alt)] px-5 py-4 text-sm text-muted">
            GPS and selfie compliance are tracked at check-in time and stored in local directory mode.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-4">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                <th className="pb-2">Employee</th>
                <th className="pb-2">Shift</th>
                <th className="pb-2">Check Window</th>
                <th className="pb-2">GPS</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Overtime</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="bg-[var(--panel-alt)]">
                  <td className="rounded-l-[24px] px-4 py-4 align-top">
                    <p className="font-semibold text-[var(--primary)]">{log.employeeName}</p>
                    <p className="text-sm text-muted">{log.department}</p>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {new Date(log.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="font-semibold text-[var(--primary)]">{log.shiftName}</p>
                    <p className="text-sm text-muted">{log.location}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-slate-700">
                    <div className="flex items-center gap-2 font-semibold text-[var(--primary)]">
                      <Clock3 className="h-4 w-4" />
                      {log.checkIn} - {log.checkOut ?? "Open"}
                    </div>
                    <p className="mt-2 text-muted">Planned {log.scheduledStart} - {log.scheduledEnd}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-slate-700">
                    <div className="flex items-center gap-2 font-semibold text-[var(--primary)]">
                      <MapPinned className="h-4 w-4" />
                      {log.gpsValidated ? "Validated" : "Outside Radius"}
                    </div>
                    <p className="mt-2 text-muted">{log.gpsDistanceMeters}m from anchor</p>
                    <div className="mt-2 flex items-center gap-2 text-muted">
                      <Camera className="h-4 w-4" />
                      {log.photoUrl ? "Selfie captured" : "No selfie yet"}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusPill tone={toneMap[log.status]}>{labelMap[log.status]}</StatusPill>
                  </td>
                  <td className="px-4 py-4 align-top text-sm font-semibold text-[var(--primary)]">
                    {log.overtimeMinutes > 0 ? `${log.overtimeMinutes} min` : "-"}
                  </td>
                  <td className="rounded-r-[24px] px-4 py-4 text-right align-top">
                    <button className="rounded-2xl bg-white p-3 text-muted">
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
