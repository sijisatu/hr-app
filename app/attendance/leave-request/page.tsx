import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function LeaveRequestPage() {
  await requireSession(["employee", "manager", "hr"]);

  return (
    <AppShell
      title="Leave Request"
      subtitle="Ajukan cuti dengan pilihan jenis leave dari halaman khusus Leave Request."
    >
      <EmployeeAttendanceWorkspace fixedAction="leave" />
    </AppShell>
  );
}
