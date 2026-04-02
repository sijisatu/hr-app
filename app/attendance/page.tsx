import { Download } from "lucide-react";
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
  active: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-sky-50 text-sky-700",
  maintenance: "bg-amber-50 text-amber-700"
} as const;

const overtimeTone = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-slate-100 text-slate-700"
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

  return (
    <AppShell
      title={session.role === "employee" ? "My Attendance" : "Attendance Operations"}
      subtitle={session.role === "employee" ? "Pantau check-in, GPS compliance, shift kamu, dan overtime pribadi dari satu tempat." : "Track check-in accuracy, GPS compliance, shift coverage, and overtime movement from one operational command board."}
      actions={session.role === "employee" ? undefined : (
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-2xl bg-[var(--panel-alt)] px-4 py-3 text-sm font-semibold text-[var(--primary)]">
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button className="flex items-center gap-2 rounded-2xl bg-[var(--panel-alt)] px-4 py-3 text-sm font-semibold text-[var(--primary)]">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <AttendanceTable logs={scopedLogs} punctuality={punctuality} overview={scopedOverview} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="panel rounded-[30px] p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="section-title text-2xl font-semibold text-[var(--primary)]">{session.role === "employee" ? "My Shift Schedule" : "Shift And Schedule Management"}</p>
                <p className="mt-2 text-sm text-muted">{session.role === "employee" ? "Window kerja aktif dan rotasi shift yang terkait dengan akun kamu." : "Department rotations, operating windows, and upcoming shift maintenance."}</p>
              </div>
              <div className="rounded-2xl bg-[var(--panel-alt)] px-4 py-3 text-sm text-muted">{scopedOverview.activeShifts} active / {scopedOverview.scheduledShifts} queued</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {scopedShifts.map((shift) => (
                <div key={shift.id} className="rounded-[24px] border border-border bg-[var(--panel-alt)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--primary)]">{shift.name}</p>
                      <p className="mt-1 text-sm text-muted">{shift.department}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${shiftTone[shift.status]}`}>{shift.status}</span>
                  </div>
                  <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted">Window</p><p className="mt-2 font-semibold text-[var(--primary)]">{shift.startTime} - {shift.endTime}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted">Assigned</p><p className="mt-2 font-semibold text-[var(--primary)]">{shift.employeesAssigned} employees</p></div>
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted">Location</p><p className="mt-2 font-semibold text-[var(--primary)]">{shift.workLocation}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted">Workdays</p><p className="mt-2 font-semibold text-[var(--primary)]">{shift.workDays.join(", ")}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel rounded-[30px] p-6">
            <div className="mb-4">
              <p className="section-title text-2xl font-semibold text-[var(--primary)]">{session.role === "employee" ? "My Overtime" : "Overtime Queue"}</p>
              <p className="mt-2 text-sm text-muted">{session.role === "employee" ? "Ringkasan overtime dan status approval milik akun kamu." : "Supervisor review list and hours already flowing into payroll baseline."}</p>
            </div>
            <div className="space-y-4">
              {scopedOvertime.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-border bg-[var(--panel-alt)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--primary)]">{item.employeeName}</p>
                      <p className="mt-1 text-sm text-muted">{item.department}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${overtimeTone[item.status]}`}>{formatOvertimeStatus(item.status)}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted">Date</p><p className="mt-2 font-semibold text-[var(--primary)]">{item.date}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted">Duration</p><p className="mt-2 font-semibold text-[var(--primary)]">{item.minutes} minutes</p></div>
                  </div>
                  <p className="mt-4 text-sm text-muted">{item.reason}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
