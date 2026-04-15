import { AppShell } from "@/components/layout/app-shell";
import { ReimbursementWorkspace } from "@/components/reimbursement/reimbursement-workspace";
import { requireSession } from "@/lib/auth";
import { getEmployees, getReimbursementClaimTypes, getReimbursementRequests } from "@/lib/api";

export default async function ReimbursementPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const [employees, claimTypes, requests] = await Promise.all([
    getEmployees(),
    getReimbursementClaimTypes(),
    getReimbursementRequests()
  ]);

  return (
    <AppShell
      title="Reimbursement"
      subtitle={session.role === "hr" || session.role === "admin" ? "Review employee claims and manage claim type allocations in one workspace." : "Submit claims, check entitlements, and track approval progress."}
    >
      <ReimbursementWorkspace
        role={session.role}
        userId={session.id}
        initialEmployees={employees}
        initialClaimTypes={claimTypes}
        initialRequests={requests}
      />
    </AppShell>
  );
}
