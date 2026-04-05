"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, LoaderCircle, UserRound } from "lucide-react";
import type { EmployeeSelfServiceSummary } from "@/lib/ess";
import { toAssetUrl } from "@/lib/ess";
import { exportPayslip, money, type PayslipRecord } from "@/lib/payroll";

type SelfServiceWorkspaceProps = {
  summary: EmployeeSelfServiceSummary;
  payslips: PayslipRecord[];
};

export function SelfServiceWorkspace({ summary, payslips }: SelfServiceWorkspaceProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(toAssetUrl(summary.payroll.latestPayslip?.generatedFileUrl ?? null));
  const [message, setMessage] = useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: (payslipId: string) => exportPayslip(payslipId),
    onSuccess: (result) => {
      setDownloadUrl(toAssetUrl(result.fileUrl));
      setMessage(`Slip gaji siap di-download: ${result.fileName}`);
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const latestPayslip = summary.payroll.latestPayslip;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="page-card p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)]">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Employee Self Service</p>
              <p className="mt-1 text-[14px] text-[var(--text-muted)]">Akses profil, kontrak kerja, leave balance, dan slip gaji milik akun kamu sendiri.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Attendance Records" value={String(summary.attendance.totalRecords)} note={`${summary.attendance.onTime} on-time check-ins`} />
            <MetricCard label="GPS Compliance" value={`${summary.attendance.gpsComplianceRate}%`} note={`${summary.attendance.overtimeHours} overtime hours`} />
            <MetricCard label="Pending Leave" value={String(summary.leave.pendingRequests)} note={`${summary.leave.approvedRequests} approved requests`} />
            <MetricCard label="YTD Net Pay" value={money(summary.payroll.ytdNetPay)} note={`${summary.payroll.publishedPayslips} published payslips`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="panel-muted p-5">
              <p className="text-[20px] font-semibold text-[var(--text)]">{summary.employee.name}</p>
              <p className="mt-1 text-[14px] text-[var(--text-muted)]">{summary.employee.position} | {summary.employee.department}</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoRow label="Employee Number" value={summary.employee.employeeNumber} />
                <InfoRow label="Employment" value={`${summary.employee.employmentType} | ${summary.employee.contractStatus}`} />
                <InfoRow label="Manager" value={summary.employee.managerName} />
                <InfoRow label="Work Mode" value={`${summary.employee.workType} | ${summary.employee.workLocation}`} />
                <InfoRow label="Contract Window" value={`${summary.employee.contractStart} - ${summary.employee.contractEnd ?? "Permanent"}`} />
                <InfoRow label="Bank / Tax" value={`${summary.employee.bankName} ${summary.employee.bankAccountMasked} | ${summary.employee.taxProfile}`} />
              </div>
            </div>

            <div className="page-card border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <p className="text-[18px] font-semibold text-[var(--primary)]">Leave Balance</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <BalanceCard label="Annual" value={summary.leave.balances.annual} />
                <BalanceCard label="Sick" value={summary.leave.balances.sick} />
                <BalanceCard label="Permission" value={summary.leave.balances.permission} />
              </div>
              {summary.leave.nextLeave ? (
                <div className="mt-4 rounded-[12px] border border-[var(--border)] bg-white p-4 text-[13px] text-[var(--text-muted)]">
                  <p className="font-semibold text-[var(--text)]">Next Leave Window</p>
                  <p className="mt-1">{summary.leave.nextLeave.type} | {summary.leave.nextLeave.startDate} - {summary.leave.nextLeave.endDate}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="page-card p-6">
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Latest Payslip</p>
          {latestPayslip ? (
            <>
              <div className="mt-5 panel-muted p-4">
                <p className="text-[18px] font-semibold text-[var(--text)]">{latestPayslip.periodLabel}</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">Pay date {latestPayslip.payDate}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SmallMetric label="Gross" value={money(latestPayslip.grossPay)} />
                  <SmallMetric label="Net" value={money(latestPayslip.netPay)} />
                  <SmallMetric label="Tax" value={money(latestPayslip.taxDeduction)} />
                  <SmallMetric label="Status" value={latestPayslip.status} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button className="primary-button" onClick={() => exportMutation.mutate(latestPayslip.id)} disabled={exportMutation.isPending}>
                  {exportMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Generate Slip
                </button>
                {downloadUrl ? (
                  <a className="secondary-button" href={downloadUrl} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" />
                    Download Slip
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-5 text-[14px] text-[var(--text-muted)]">Belum ada payslip published untuk akun ini.</p>
          )}

          <div className="mt-6 space-y-3 border-t border-[var(--border)] pt-5">
            <p className="text-[16px] font-semibold text-[var(--primary)]">Payslip History</p>
            {payslips.map((slip) => (
              <div key={slip.id} className="panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[var(--text)]">{slip.periodLabel}</p>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">{money(slip.netPay)} | {slip.status}</p>
                  </div>
                  {slip.generatedFileUrl ? (
                    <a className="secondary-button !min-h-9" href={toAssetUrl(slip.generatedFileUrl) ?? undefined} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel-muted p-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-[24px] font-semibold text-[var(--primary)]">{value}</p>
      <p className="mt-2 text-[13px] text-[var(--text-muted)]">{note}</p>
    </div>
  );
}

function BalanceCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-[28px] font-semibold text-[var(--primary)]">{value}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-[14px] font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-[14px] font-medium leading-6 text-[var(--text)]">{value}</p>
    </div>
  );
}
