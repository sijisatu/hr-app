import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function HalfDayRequestPage() {
  await requireSession(["employee", "manager"]);

  return (
    <AppShell
      title="Half Day Request"
      subtitle="Ajukan izin setengah hari dari halaman khusus Half Day Request."
    >
      <EmployeeAttendanceWorkspace fixedAction="half-day" />
    </AppShell>
  );
}

