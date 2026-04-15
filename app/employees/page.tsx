import { EmployeeManagementWorkspace } from "@/components/employees/employee-management-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";
import { getCompensationProfiles, getEmployees } from "@/lib/api";

export default async function EmployeesPage() {
  await requireSession(["admin", "hr", "manager"]);
  const [employees, profiles] = await Promise.all([getEmployees(), getCompensationProfiles()]);

  return (
    <AppShell
      title="Employee Management"
      subtitle="Manage employee records, compensation mapping, and payroll profile assignments."
    >
      <EmployeeManagementWorkspace initialEmployees={employees} initialCompensationProfiles={profiles} />
    </AppShell>
  );
}
