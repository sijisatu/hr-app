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
      subtitle="Kelola data employee lengkap, hubungkan jabatan ke gaji pokok, lalu pilih allowance, deduction, dan tax profile per karyawan."
    >
      <EmployeeManagementWorkspace initialEmployees={employees} initialCompensationProfiles={profiles} />
    </AppShell>
  );
}
