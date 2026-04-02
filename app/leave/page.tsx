import { AppShell } from "@/components/layout/app-shell";
import { LeaveWorkflowBoard } from "@/components/leave/leave-workflow-board";
import { requireSession } from "@/lib/auth";

export default async function LeavePage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);

  return (
    <AppShell
      title={session.role === "employee" ? "My Leave Requests" : "Leave Workflow"}
      subtitle={session.role === "employee" ? "Ajukan cuti, lihat status approval, dan pantau balance cuti milik akun kamu." : "Multi-level approval board for annual leave, sick leave, permission flow, and auto-approval rules."}
    >
      <LeaveWorkflowBoard />
    </AppShell>
  );
}
