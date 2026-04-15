import { AppShell } from "@/components/layout/app-shell";
import { EmployeeProfileWorkspace } from "@/components/profile/employee-profile-workspace";
import { requireSession } from "@/lib/auth";
import { getEmployees, getLeaveHistory } from "@/lib/api";

export default async function ProfilePage() {
  const session = await requireSession(["manager", "employee"]);
  const [employees, leaveHistory] = await Promise.all([
    getEmployees(),
    getLeaveHistory()
  ]);
  const employee = employees.find((item) => item.id === session.id);
  const sickLeaveUsed = leaveHistory.filter((item) => item.userId === session.id && item.status === "approved" && (item.type === "Sick Submission" || item.type === "Sick Leave")).length;

  if (!employee) {
    return (
      <AppShell title="Profile" subtitle="Employee information for the current signed-in account.">
        <div className="page-card p-6 text-[14px] text-[var(--text-muted)]">Employee information is not available for this account.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile" subtitle="Employee information for the current signed-in account.">
      <EmployeeProfileWorkspace employee={employee} sickLeaveUsed={sickLeaveUsed} />
    </AppShell>
  );
}
