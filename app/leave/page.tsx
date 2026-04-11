import { AppShell } from "@/components/layout/app-shell";
import { LeaveWorkflowBoard } from "@/components/leave/leave-workflow-board";
import { requireSession } from "@/lib/auth";

export default async function LeavePage() {
  await requireSession(["admin", "hr"]);

  return (
    <AppShell
      title="Leave System"
      subtitle="Kelola alokasi leave balance karyawan, carry over, dan expiration. Approval request tetap diproses manager."
    >
      <LeaveWorkflowBoard />
    </AppShell>
  );
}
