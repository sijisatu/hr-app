import Link from "next/link";
import { FileText, Stethoscope, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LeaveReportTable } from "@/components/tables/leave-report-table";
import { requireSession } from "@/lib/auth";
import { getEmployees, getLeaveHistory } from "@/lib/api";

export default async function LeaveReportPage() {
  await requireSession(["admin", "hr"]);

  const [employees, leaveRequests] = await Promise.all([
    getEmployees(),
    getLeaveHistory()
  ]);

  const sickSubmissions = leaveRequests.filter((item) => item.type === "Sick Submission" || item.type === "Sick Leave");
  const withDocuments = sickSubmissions.filter((item) => item.supportingDocumentUrl).length;
  const pending = leaveRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;

  const reportCards = [
    {
      label: "Total Leave Requests",
      value: String(leaveRequests.length),
      note: "Complete organization-wide leave history"
    },
    {
      label: "Sick Submissions",
      value: String(sickSubmissions.length),
      note: `${withDocuments} include doctor letters`
    },
    {
      label: "Pending Review",
      value: String(pending),
      note: "Requests still waiting for approval flow"
    }
  ];

  return (
    <AppShell
      title="Leave Report"
      subtitle="Review leave activity, approval status, and supporting documents across the organization."
      actions={(
        <Link href="/attendance" className="secondary-button">
          Back to Attendance
        </Link>
      )}
    >
      <div className="space-y-6">
        <section className="rounded-[20px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">HR Leave Report</p>
          <h2 className="mt-4 text-[28px] font-semibold leading-tight">Track leave requests and supporting medical files in one place.</h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
            Use this report to review leave trends, pending approvals, and doctor letters attached to sick submissions.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {reportCards.map((item, index) => (
            <div key={item.label} className={index === 2 ? "page-card bg-[var(--primary)] p-5 text-white" : "page-card p-5"}>
              <p className={index === 2 ? "text-[12px] font-medium uppercase tracking-[0.08em] text-white/72" : "text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"}>{item.label}</p>
              <p className={index === 2 ? "mt-3 text-[30px] font-semibold leading-none" : "mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]"}>{item.value}</p>
              <p className={index === 2 ? "mt-3 text-[14px] text-white/74" : "mt-3 text-[14px] text-[var(--text-muted)]"}>{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Coverage</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">{employees.length} employees are included in this report.</p>
              </div>
            </div>
          </div>

          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Medical Files</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">{withDocuments} sick submissions already include an uploaded doctor letter.</p>
              </div>
            </div>
          </div>

          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Review Focus</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">Prioritize pending requests and sick submissions with missing supporting files.</p>
              </div>
            </div>
          </div>
        </section>

        <LeaveReportTable employees={employees} records={leaveRequests} />
      </div>
    </AppShell>
  );
}
