import { AppShell } from "@/components/layout/app-shell";
import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { requireSession } from "@/lib/auth";
import { getPayRuns, getPayrollComponents, getPayrollOverview, getPayslips } from "@/lib/payroll";

export default async function PayrollPage() {
  const session = await requireSession(["admin", "hr", "employee"]);
  const [overview, components, runs, payslips] = await Promise.all([
    getPayrollOverview(),
    getPayrollComponents(),
    getPayRuns(),
    getPayslips(session.role === "employee" ? session.id : undefined)
  ]);

  return (
    <AppShell
      title="Payroll"
      subtitle={session.role === "employee" ? "Lihat payroll kamu sendiri dan generate slip gaji yang sudah dipublish." : "Kelola komponen gaji, hitung payroll otomatis, review draft, dan publish payslip ke employee self-service."}
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
