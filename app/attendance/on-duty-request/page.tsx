import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function OnDutyRequestPage() {
  await requireSession(["employee", "manager", "hr"]);

  return (
    <AppShell
      title="On Duty Request"
      subtitle="Submit and track on-duty or field activity requests from a dedicated workspace."
    >
      <EmployeeAttendanceWorkspace fixedAction="on-duty" />
    </AppShell>
  );
}
