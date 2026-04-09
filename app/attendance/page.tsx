import { Download } from "lucide-react";
import { EmployeeAttendanceHub } from "@/components/attendance/employee-attendance-hub";
import { AppShell } from "@/components/layout/app-shell";
import { AttendanceTable } from "@/components/tables/attendance-table";
import { requireSession } from "@/lib/auth";
import {
  formatOvertimeStatus,
  getAttendanceHistory,
  getAttendanceOverview,
  getAttendanceOvertime
} from "@/lib/api";

const overtimeTone = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  paid: "neutral"
} as const;

export default async function AttendancePage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const [logs, overview, overtime] = await Promise.all([
    getAttendanceHistory(),
    getAttendanceOverview(),
    getAttendanceOvertime()
  ]);

  const scopedLogs = session.role === "employee" ? logs.filter((item) => item.userId === session.id) : logs;
  const scopedOvertime = session.role === "employee" ? overtime.filter((item) => item.userId === session.id) : overtime;
  const scopedOverview = session.role === "employee"
    ? {
        checkedInToday: scopedLogs.length,
        openCheckIns: scopedLogs.filter((item) => !item.checkOut).length,
        gpsValidated: scopedLogs.filter((item) => item.gpsValidated).length,
        selfieCaptured: scopedLogs.filter((item) => Boolean(item.photoUrl)).length,
        overtimeHours: Number((scopedOvertime.reduce((sum, item) => sum + item.minutes, 0) / 60).toFixed(1))
      }
    : overview;

  const punctuality = scopedLogs.length === 0 ? 0 : (scopedLogs.filter((item) => item.status === "on-time").length / scopedLogs.length) * 100;

  if (session.role === "employee" || session.role === "manager" || session.role === "hr") {
    return (
      <AppShell
        title="Employee Attendance"
        subtitle={session.role === "hr"
          ? "HRD memakai modul attendance yang sama seperti karyawan, dengan tambahan akses report kehadiran seluruh karyawan."
          : "Setiap request attendance dipisah ke halaman khusus. Manager juga bisa approve request di setiap halaman menu."}
      >
        <EmployeeAttendanceHub showAttendanceReport={session.role === "hr"} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Employee Attendance"
      subtitle="Track attendance records and overtime in one operational workspace."
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
                  <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${overtimeTone[item.status] === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : overtimeTone[item.status] === 'warning' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : overtimeTone[item.status] === 'danger' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[#eef2f7] text-[var(--text-muted)]'}`}>{formatOvertimeStatus(item.status)}</span>
                </div>
                <div className="mt-4 grid gap-3 text-[13px] text-[var(--text-muted)] sm:grid-cols-2">
                  <div><p className="font-medium text-[var(--text)]">Date</p><p className="mt-1">{item.date}</p></div>
                  <div><p className="font-medium text-[var(--text)]">Duration</p><p className="mt-1">{item.minutes} minutes</p></div>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
