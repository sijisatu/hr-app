import { AttendanceQuickAction } from "@/components/layout/attendance-quick-action";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AttendanceChart } from "@/components/dashboard/attendance-chart";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { IntegrityCard } from "@/components/dashboard/integrity-card";
import { requireSession } from "@/lib/auth";
import {
  deriveActivityStream,
  deriveAttendanceSeries,
  getAttendanceHistory,
  getDashboardSummary,
  getLeaveHistory
} from "@/lib/api";

export default async function DashboardPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const [summary, attendanceLogs, leaveRequests] = await Promise.all([
    getDashboardSummary(),
    getAttendanceHistory(),
    getLeaveHistory()
  ]);

  const scopedLogs = session.role === "employee" ? attendanceLogs.filter((log) => log.userId === session.id) : attendanceLogs;
  const scopedLeaves = session.role === "employee" ? leaveRequests.filter((leave) => leave.userId === session.id) : leaveRequests;

  const metrics = session.role === "employee"
    ? [
        { label: "My Records", value: scopedLogs.length.toLocaleString("en-US"), note: `${scopedLeaves.length} leave requests`, tone: "neutral" },
        { label: "On-Time", value: scopedLogs.filter((item) => item.status === "on-time").length.toLocaleString("en-US"), note: "Personal attendance", tone: "success" },
        { label: "Late", value: scopedLogs.filter((item) => item.status === "late").length.toLocaleString("en-US"), note: "Needs follow-up", tone: "danger" },
        { label: "Open Sessions", value: scopedLogs.filter((item) => !item.checkOut).length.toLocaleString("en-US"), note: "Pending check-out", tone: "warning" }
      ] as const
    : [
        { label: "Employees", value: summary.employees.toLocaleString("en-US"), note: `${summary.storageMode} storage`, tone: "neutral" },
        { label: "On-Time", value: summary.onTime.toLocaleString("en-US"), note: "Live attendance", tone: "success" },
        { label: "Late", value: summary.late.toLocaleString("en-US"), note: "Review required", tone: "danger" },
        { label: "Absent", value: summary.absent.toLocaleString("en-US"), note: `${summary.leavePending} leave pending`, tone: "warning" }
      ] as const;

  const series = deriveAttendanceSeries(scopedLogs);
  const activity = deriveActivityStream(scopedLogs);

  return (
    <AppShell
      title={session.role === "employee" ? "My Presence" : "Dashboard"}
      subtitle={session.role === "employee" ? "Personal attendance summary, leave status, and live check-in access for your own account." : "Attendance overview, activity feed, and operational signals in one workspace."}
      actions={<AttendanceQuickAction compact label="Clock In" />}
    >
      <div className="space-y-6">
        <div className="kpi-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="content-grid">
          <div className="space-y-6">
            <AttendanceChart series={series} />
          </div>

          <div className="space-y-6">
            <ActivityPanel entries={activity} />
            <IntegrityCard />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

