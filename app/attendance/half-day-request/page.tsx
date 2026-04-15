import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function HalfDayRequestPage() {
  await requireSession(["employee", "manager", "hr"]);

  return (
    <AppShell
      title="Half Day Request"
      subtitle="Submit and review half-day leave requests from a dedicated workspace."
    >
      <EmployeeAttendanceWorkspace fixedAction="half-day" />
    </AppShell>
  );
}
