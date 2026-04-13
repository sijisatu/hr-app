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
      subtitle={session.role === "hr" || session.role === "admin" ? "Kelola seluruh reimbursement karyawan sekaligus atur allocation claim type per employee." : "Submit reimbursement, cek entitlement, review draft, dan pantau status approval di satu tempat."}
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
