"use client";

import { useMemo, useState } from "react";
import { Camera, Clock3, MapPinned, MoreVertical, Search } from "lucide-react";
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

const pageSizeOptions = [10, 30, 50, 100] as const;

function getMonthKey(timestamp: string) {
  return timestamp.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function AttendanceTable({
  logs,
  punctuality,
  overview
}: {
  logs: AttendanceRecord[];
  punctuality: number;
  overview: AttendanceOverview;
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [month, setMonth] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState<number>(10);

  const metrics = [
    { label: "Checked In Today", value: `${overview.checkedInToday}`, detail: `${overview.openCheckIns} still open` },
    { label: "GPS Validated", value: `${overview.gpsValidated}`, detail: `${Math.max(overview.checkedInToday - overview.gpsValidated, 0)} flagged` },
    { label: "Selfie Captured", value: `${overview.selfieCaptured}`, detail: `${overview.checkedInToday === 0 ? 0 : Math.round((overview.selfieCaptured / overview.checkedInToday) * 100)}% coverage` },
    { label: "Overtime Hours", value: `${overview.overtimeHours}`, detail: "Accumulated from attendance check-out." }
  ];

  const departments = useMemo(
    () => [...new Set(logs.map((item) => item.department))].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const months = useMemo(
    () => [...new Set(logs.map((item) => getMonthKey(item.timestamp)))].sort((a, b) => b.localeCompare(a)),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch = normalizedSearch.length === 0 || log.employeeName.toLowerCase().includes(normalizedSearch);
      const matchesDepartment = department === "all" || log.department === department;
      const matchesMonth = month === "all" || getMonthKey(log.timestamp) === month;
      const matchesStatus = status === "all" || log.status === status;
      return matchesSearch && matchesDepartment && matchesMonth && matchesStatus;
    });
  }, [department, logs, month, search, status]);

  const visibleLogs = filteredLogs.slice(0, pageSize);

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
          <p className="mt-3 text-[14px] leading-5 text-white/75">Non-shift attendance mode is active for all employees.</p>
        </div>
      </div>

      <div className="page-card overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap">
              <label className="topbar-control min-w-[220px] lg:max-w-[280px]">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                  placeholder="Search by employee name..."
                />
              </label>

              <select value={department} onChange={(event) => setDepartment(event.target.value)} className="filter-control text-[14px]">
                <option value="all">All Departments</option>
                {departments.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <select value={month} onChange={(event) => setMonth(event.target.value)} className="filter-control text-[14px]">
                <option value="all">All Months</option>
                {months.map((item) => (
                  <option key={item} value={item}>{formatMonthLabel(item)}</option>
                ))}
              </select>

              <select value={status} onChange={(event) => setStatus(event.target.value)} className="filter-control text-[14px]">
                <option value="all">All Statuses</option>
                {Object.entries(labelMap).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))} className="filter-control text-[14px]">
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>Show {option}</option>
                ))}
              </select>
            </div>

            <div className="panel-muted max-w-[360px] px-4 py-3 text-[13px] leading-5 text-[var(--text-muted)]">
              GPS and selfie compliance are tracked at check-in time and stored in local directory mode.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--text-muted)]">
            <p>{filteredLogs.length} records match the current filters.</p>
            <p>Showing {Math.min(visibleLogs.length, pageSize)} of {filteredLogs.length} records.</p>
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4 lg:px-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-4 pb-2">Employee</th>
                <th className="px-4 pb-2">Description</th>
                <th className="px-4 pb-2">Check Window</th>
                <th className="px-4 pb-2">GPS</th>
                <th className="px-4 pb-2">Status</th>
                <th className="px-4 pb-2">Overtime</th>
                <th className="px-4 pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => (
                <tr key={log.id} className="rounded-[12px] bg-[var(--surface-muted)] hover:bg-[#edf2f7]">
                  <td className="rounded-l-[12px] px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{log.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.department}</p>
                    <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                      {new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{log.description}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.location}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                      <Clock3 className="h-4 w-4" />
                      {log.checkIn} - {log.checkOut ?? "Open"}
                    </div>
                    <p className="mt-2">{log.location}</p>
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

          {visibleLogs.length === 0 ? (
            <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
              No attendance records match the current filters.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
