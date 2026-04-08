import { AppShell } from "@/components/layout/app-shell";
import { EmployeesTable } from "@/components/tables/employees-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { requireSession } from "@/lib/auth";
import { currency, getEmployees } from "@/lib/api";

export default async function EmployeesPage() {
  await requireSession(["admin", "hr", "manager"]);
  const allEmployees = await getEmployees();
  const employees = allEmployees;
  const activeEmployees = employees.filter((item) => item.status === "active").length;
  const departments = new Set(employees.map((item) => item.department)).size;
  const contractAlerts = employees.filter((item) => item.contractStatus === "ending-soon" || item.contractStatus === "probation").length;
  const payrollBaseline = employees.reduce((sum, item) => sum + item.baseSalary + item.allowance, 0);

  const summary = [
    { label: "Headcount", value: employees.length.toLocaleString("en-US"), note: `${activeEmployees} active employees`, tone: "neutral" },
    { label: "Departments", value: departments.toLocaleString("en-US"), note: `${contractAlerts} contracts to review`, tone: "success" },
    { label: "Payroll Baseline", value: currency(payrollBaseline), note: "Base salary + allowance", tone: "warning" }
  ] as const;

  return (
    <AppShell
      title="Employee Management"
      subtitle="Employee master data, job structure, and contract overview."
    >
      <div className="space-y-6">
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
