import { AttendanceQuickAction } from "@/components/layout/attendance-quick-action";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AttendanceChart } from "@/components/dashboard/attendance-chart";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { IntegrityCard } from "@/components/dashboard/integrity-card";
import { EmployeeDashboardOverview } from "@/components/dashboard/employee-dashboard-overview";
import { HrDashboardInsights } from "@/components/dashboard/hr-dashboard-insights";
import { HrWorkforcePanels } from "@/components/dashboard/hr-workforce-panels";
import { requireSession } from "@/lib/auth";
import {
  deriveActivityStream,
  deriveAttendanceSeries,
  getAttendanceHistory,
  getDashboardSummary,
  getEmployees,
  getLeaveHistory
} from "@/lib/api";

export default async function DashboardPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const [summary, attendanceLogs, leaveRequests, employees] = await Promise.all([
    getDashboardSummary(),
    getAttendanceHistory(),
    getLeaveHistory(),
    getEmployees()
  ]);

  const isEmployeeView = session.role === "employee" || session.role === "manager";
  const isHrView = session.role === "hr";
  const scopedLogs = isEmployeeView ? attendanceLogs.filter((log) => log.userId === session.id) : attendanceLogs;
  const scopedLeaves = isEmployeeView ? leaveRequests.filter((leave) => leave.userId === session.id) : leaveRequests;

  const metrics = isEmployeeView
    ? [
        { label: "My Records", value: scopedLogs.length.toLocaleString("en-US"), note: `${scopedLeaves.length} leave requests`, tone: "neutral" },
        { label: "On-Time", value: scopedLogs.filter((item) => item.status === "on-time").length.toLocaleString("en-US"), note: "Personal attendance", tone: "success" },
        { label: "Late", value: scopedLogs.filter((item) => item.status === "late").length.toLocaleString("en-US"), note: "Needs follow-up", tone: "danger" },
        { label: "Open Sessions", value: scopedLogs.filter((item) => !item.checkOut).length.toLocaleString("en-US"), note: "Pending check-out", tone: "warning" }
      ] as const
    : [
        { label: "Employees", value: summary.employees.toLocaleString("en-US"), note: "Total employees in Company", tone: "neutral" },
        { label: "On-Time", value: summary.onTime.toLocaleString("en-US"), note: "Live attendance", tone: "success" },
        { label: "Late", value: summary.late.toLocaleString("en-US"), note: "Review required", tone: "danger" },
        { label: "Absent", value: summary.absent.toLocaleString("en-US"), note: `${summary.leavePending} leave pending`, tone: "warning" }
      ] as const;

  const series = deriveAttendanceSeries(scopedLogs);
  const activity = deriveActivityStream(scopedLogs);

  return (
    <AppShell
      title="Dashboard"
      subtitle={isEmployeeView ? "Track your attendance activity and current request summary." : "Monitor attendance activity and operational signals in one workspace."}
      actions={<AttendanceQuickAction compact label="Clock In" />}
    >
      <div className="space-y-6">
        <div className="kpi-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        {isEmployeeView ? (
          <EmployeeDashboardOverview logs={scopedLogs} leaves={scopedLeaves} />
        ) : isHrView ? (
          <div className="space-y-6">
            <HrDashboardInsights logs={scopedLogs} totalEmployees={summary.employees} />
            <HrWorkforcePanels employees={employees} leaves={leaveRequests} />
            <ActivityPanel
              entries={activity}
              title="Latest History Activity"
              subtitle="Latest attendance activity across the organization."
            />
          </div>
        ) : (
          <div className="content-grid">
            <div className="space-y-6">
              <AttendanceChart series={series} />
            </div>

            <div className="space-y-6">
              <ActivityPanel entries={activity} />
              <IntegrityCard />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
