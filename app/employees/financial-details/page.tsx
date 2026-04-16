import { CompensationProfileWorkspace } from "@/components/employees/compensation-profile-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function FinancialDetailsPage() {
  await requireSession(["admin", "hr"]);

  return (
    <AppShell
      title="Financial Setup"
      subtitle="Maintain allowance & deduction components and tax setup for employee onboarding."
    >
      <CompensationProfileWorkspace />
    </AppShell>
  );
}
