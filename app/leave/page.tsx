import { AppShell } from "@/components/layout/app-shell";
import { LeaveWorkflowBoard } from "@/components/leave/leave-workflow-board";
import { requireSession } from "@/lib/auth";

export default async function LeavePage() {
  await requireSession(["admin", "hr", "manager"]);

  return (
    <AppShell
      title="Leave Workflow"
      subtitle="Multi-level approval board for employee request review and leave balance control."
    >
      <LeaveWorkflowBoard />
    </AppShell>
  );
}
