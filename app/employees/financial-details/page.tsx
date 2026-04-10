import { CompensationProfileWorkspace } from "@/components/employees/compensation-profile-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";
import { getCompensationProfiles } from "@/lib/api";

export default async function FinancialDetailsPage() {
  await requireSession(["admin", "hr"]);
  const profiles = await getCompensationProfiles();

  return (
    <AppShell
      title="Financial Setup"
      subtitle="Kelola master jabatan dan gaji pokok, allowance atau deduction, serta tax profile yang nanti dipilih saat add employee."
    >
      <CompensationProfileWorkspace initialProfiles={profiles} />
    </AppShell>
  );
}
