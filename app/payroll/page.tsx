import { AppShell } from "@/components/layout/app-shell";
import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { requireSession } from "@/lib/auth";
import { getPayRuns, getPayrollComponents, getPayrollOverview, getPayslips } from "@/lib/payroll";

export default async function PayrollPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const [overview, components, runs, payslips] = await Promise.all([
    getPayrollOverview(),
    getPayrollComponents(),
    getPayRuns(),
    getPayslips(session.role === "admin" || session.role === "hr" ? undefined : session.id)
  ]);

  return (
    <AppShell
      title="Payroll"
      subtitle={session.role === "employee" || session.role === "manager" ? "Access published payslips and review your payroll history." : "Manage payroll components, generate pay runs, and publish employee payslips."}
    >
      <PayrollWorkspace
        role={session.role}
        userId={session.id}
        initialOverview={overview}
        initialComponents={components}
        initialRuns={runs}
        initialPayslips={payslips}
      />
    </AppShell>
  );
}

