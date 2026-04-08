import { Download } from "lucide-react";
import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { AttendanceTable } from "@/components/tables/attendance-table";
import { requireSession } from "@/lib/auth";
import {
  formatOvertimeStatus,
  getAttendanceHistory,
  getAttendanceOverview,
  getAttendanceOvertime,
  getAttendanceShifts
} from "@/lib/api";

const shiftTone = {
  active: "success",
  scheduled: "neutral",
  maintenance: "warning"
} as const;

const overtimeTone = {
  approved: "success",
  pending: "warning",
  paid: "neutral"
} as const;

export default async function AttendancePage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const [logs, overview, shifts, overtime] = await Promise.all([
    getAttendanceHistory(),
    getAttendanceOverview(),
    getAttendanceShifts(),
    getAttendanceOvertime()
  ]);

  const scopedLogs = session.role === "employee" ? logs.filter((item) => item.userId === session.id) : logs;
  const scopedShifts = session.role === "employee" ? shifts.filter((item) => scopedLogs.some((log) => log.shiftName === item.name) || item.department === scopedLogs[0]?.department) : shifts;
  const scopedOvertime = session.role === "employee" ? overtime.filter((item) => item.userId === session.id) : overtime;
  const scopedOverview = session.role === "employee"
    ? {
        checkedInToday: scopedLogs.length,
        openCheckIns: scopedLogs.filter((item) => !item.checkOut).length,
        gpsValidated: scopedLogs.filter((item) => item.gpsValidated).length,
        selfieCaptured: scopedLogs.filter((item) => Boolean(item.photoUrl)).length,
        overtimeHours: Number((scopedOvertime.reduce((sum, item) => sum + item.minutes, 0) / 60).toFixed(1)),
        activeShifts: scopedShifts.filter((item) => item.status === "active").length,
        scheduledShifts: scopedShifts.filter((item) => item.status === "scheduled").length
      }
    : overview;

  const punctuality = scopedLogs.length === 0 ? 0 : (scopedLogs.filter((item) => item.status === "on-time").length / scopedLogs.length) * 100;

  if (session.role === "employee") {
    return (
      <AppShell
        title="Employee Attendance"
        subtitle="Semua kebutuhan attendance employee sekarang dipusatkan di satu modul, termasuk request dan history attendance."
      >
        <EmployeeAttendanceWorkspace />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Employee Attendance"
      subtitle="Track attendance records, shift coverage, and overtime in one operational workspace."
      actions={(
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button">
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button className="secondary-button">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      )}
    >
      <div className="space-y-6">
        <AttendanceTable logs={scopedLogs} punctuality={punctuality} overview={scopedOverview} />

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="page-card p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Shift Schedule</p>
                <p className="mt-1 text-[14px] text-[var(--text-muted)]">Working windows and assignment coverage.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {scopedShifts.map((shift) => (
                <div key={shift.id} className="panel-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[var(--text)]">{shift.name}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{shift.department}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${shiftTone[shift.status] === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : shiftTone[shift.status] === 'warning' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[#eef2f7] text-[var(--text-muted)]'}`}>{shift.status}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-[13px] text-[var(--text-muted)] sm:grid-cols-2">
                    <div><p className="font-medium text-[var(--text)]">Window</p><p className="mt-1">{shift.startTime} - {shift.endTime}</p></div>
                    <div><p className="font-medium text-[var(--text)]">Assigned</p><p className="mt-1">{shift.employeesAssigned} employees</p></div>
                    <div><p className="font-medium text-[var(--text)]">Location</p><p className="mt-1">{shift.workLocation}</p></div>
                    <div><p className="font-medium text-[var(--text)]">Days</p><p className="mt-1 break-words">{shift.workDays.join(", ")}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="page-card p-6">
            <div className="mb-5">
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Overtime Queue</p>
              <p className="mt-1 text-[14px] text-[var(--text-muted)]">Supervisor review and payout visibility.</p>
            </div>

            <div className="space-y-4">
              {scopedOvertime.map((item) => (
                <div key={item.id} className="panel-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.department}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${overtimeTone[item.status] === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : overtimeTone[item.status] === 'warning' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[#eef2f7] text-[var(--text-muted)]'}`}>{formatOvertimeStatus(item.status)}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-[13px] text-[var(--text-muted)]">
                    <div><p className="font-medium text-[var(--text)]">Date</p><p className="mt-1">{item.date}</p></div>
                    <div><p className="font-medium text-[var(--text)]">Duration</p><p className="mt-1">{item.minutes} minutes</p></div>
                  </div>
                  <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{item.reason}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
