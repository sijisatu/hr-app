import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function LeaveRequestPage() {
  await requireSession(["employee", "manager", "hr"]);

  return (
    <AppShell
      title="Leave Request"
      subtitle="Submit and review leave requests from a dedicated workspace."
    >
      <EmployeeAttendanceWorkspace fixedAction="leave" />
    </AppShell>
  );
}
