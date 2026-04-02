import { AppShell } from "@/components/layout/app-shell";
import { EmployeesTable } from "@/components/tables/employees-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { requireSession } from "@/lib/auth";
import { currency, getEmployees } from "@/lib/api";

export default async function EmployeesPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const allEmployees = await getEmployees();
  const employees = session.role === "employee" ? allEmployees.filter((item) => item.id === session.id) : allEmployees;
  const activeEmployees = employees.filter((item) => item.status === "active").length;
  const departments = new Set(employees.map((item) => item.department)).size;
  const contractAlerts = employees.filter((item) => item.contractStatus === "ending-soon" || item.contractStatus === "probation").length;
  const payrollBaseline = employees.reduce((sum, item) => sum + item.baseSalary + item.allowance, 0);

  const summary = [
    { label: session.role === "employee" ? "My Profile" : "Total Headcount", value: employees.length.toLocaleString("en-US"), note: `${activeEmployees} active employees`, tone: "neutral" },
    { label: "Departments", value: departments.toLocaleString("en-US"), note: `${contractAlerts} contract items need review`, tone: "success" },
    { label: "Payroll Baseline", value: currency(payrollBaseline), note: "Base salary + allowance preview", tone: "warning" }
  ] as const;

  return (
    <AppShell
      title={session.role === "employee" ? "My Employee Profile" : "Employee Management"}
      subtitle={session.role === "employee" ? "Lihat data profil, kontrak, dan baseline payroll milik akun kamu sendiri." : "Employee master, job structure, contract lifecycle, and payroll baseline for the white-label HRIS foundation."}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {summary.map((item) => (
            <MetricCard key={item.label} {...item} />
          ))}
        </div>
        <EmployeesTable employees={employees} />
      </div>
    </AppShell>
  );
}
