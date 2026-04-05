import { AppShell } from "@/components/layout/app-shell";
import { SelfServiceWorkspace } from "@/components/self-service/self-service-workspace";
import { requireSession } from "@/lib/auth";
import { getEmployeeSelfServiceSummary } from "@/lib/ess";
import { getPayslips } from "@/lib/payroll";

export default async function SelfServicePage() {
  const session = await requireSession(["employee"]);
  const [summary, payslips] = await Promise.all([
    getEmployeeSelfServiceSummary(session.id),
    getPayslips(session.id)
  ]);

  return (
    <AppShell
      title="Self Service"
      subtitle="Portal personal untuk lihat data karyawan sendiri, leave balance, attendance summary, dan download slip gaji."
    >
      <SelfServiceWorkspace summary={summary} payslips={payslips} />
    </AppShell>
  );
}
