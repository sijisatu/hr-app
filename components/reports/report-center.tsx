"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, LoaderCircle } from "lucide-react";
import type { AttendanceSeriesItem } from "@/lib/api";
import { BarOverview } from "@/components/reports/bar-overview";
import { money } from "@/lib/payroll";
import { exportReport, toAssetUrl, type ReportCenterOverview, type ReportSnapshotMetric } from "@/lib/reporting";

type ReportCenterProps = {
  overview: ReportCenterOverview;
  series: AttendanceSeriesItem[];
};

export function ReportCenter({ overview, series }: ReportCenterProps) {
  const [message, setMessage] = useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: (payload: { reportName: string; content: string }) => exportReport(payload),
    onSuccess: (result) => setMessage(`Report siap di-download: ${toAssetUrl(result.fileUrl)}`),
    onError: (error: Error) => setMessage(error.message)
  });

  const exportPayloads = useMemo(
    () => ({
      attendance: {
        reportName: "Attendance Report",
        content: [
          "Attendance Report",
          ...overview.attendance.metrics.map((item) => `${item.label}: ${item.value} (${item.note})`),
          ...overview.attendance.topDepartments.map((item) => `Department ${item.name}: ${item.value}%`)
        ].join("\n")
      },
      employees: {
        reportName: "Employee Report",
        content: [
          "Employee Report",
          ...overview.employees.metrics.map((item) => `${item.label}: ${item.value} (${item.note})`),
          ...overview.employees.departments.map((item) => `${item.name}: ${item.headcount} employees`)
        ].join("\n")
      },
      payroll: {
        reportName: "Payroll Report",
        content: [
          "Payroll Report",
          ...overview.payroll.metrics.map((item) => `${item.label}: ${item.value} (${item.note})`),
          ...overview.payroll.recentRuns.map((item) => `${item.periodLabel}: ${money(item.totalNet)} net for ${item.employeeCount} employees`)
        ].join("\n")
      }
    }),
    [overview]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <BarOverview series={series} />

          <ModuleSection
            title="Attendance Report"
            subtitle="Punctuality, GPS compliance, department performance, and operational anomalies."
            metrics={overview.attendance.metrics}
            action={<ExportButton pending={exportMutation.isPending} onClick={() => exportMutation.mutate(exportPayloads.attendance)} />}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <MetricListCard title="Top Departments">
                {overview.attendance.topDepartments.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="font-medium text-[var(--text)]">{item.name}</span>
                      <span className="text-[var(--text-muted)]">{item.value}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-[var(--surface-soft)]">
                      <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </MetricListCard>

              <MetricListCard title="Anomalies">
                {overview.attendance.anomalies.map((item) => (
                  <div key={item.title} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
                    <p className="text-[15px] font-semibold text-[var(--text)]">{item.title}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.note}</p>
                  </div>
                ))}
              </MetricListCard>
            </div>
          </ModuleSection>

          <ModuleSection
            title="Employee Report"
            subtitle="Org structure, contract monitoring, and headcount mix."
            metrics={overview.employees.metrics}
            action={<ExportButton pending={exportMutation.isPending} onClick={() => exportMutation.mutate(exportPayloads.employees)} />}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <MetricListCard title="Contract Alerts">
                {overview.employees.contractAlerts.map((item) => (
                  <div key={`${item.employeeName}-${item.status}`} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
                    <p className="text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.status} | {item.note}</p>
                  </div>
                ))}
              </MetricListCard>

              <MetricListCard title="Department Headcount">
                {overview.employees.departments.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-[12px] border border-[var(--border)] bg-white px-4 py-3">
                    <span className="text-[14px] font-medium text-[var(--text)]">{item.name}</span>
                    <span className="text-[14px] font-semibold text-[var(--primary)]">{item.headcount}</span>
                  </div>
                ))}
              </MetricListCard>
            </div>
          </ModuleSection>

          <ModuleSection
            title="Payroll Report"
            subtitle="Pay run monitoring, payout totals, and high-value payslip visibility."
            metrics={overview.payroll.metrics}
            action={<ExportButton pending={exportMutation.isPending} onClick={() => exportMutation.mutate(exportPayloads.payroll)} />}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <MetricListCard title="Recent Pay Runs">
                {overview.payroll.recentRuns.map((item) => (
                  <div key={item.periodLabel} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
                    <p className="text-[15px] font-semibold text-[var(--text)]">{item.periodLabel}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.status} | {item.employeeCount} employees | {money(item.totalNet)}</p>
                  </div>
                ))}
              </MetricListCard>

              <MetricListCard title="Top Net Pay">
                {overview.payroll.topEarners.map((item) => (
                  <div key={item.employeeName} className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.department}</p>
                    </div>
                    <span className="text-[14px] font-semibold text-[var(--primary)]">{money(item.netPay)}</span>
                  </div>
                ))}
              </MetricListCard>
            </div>
          </ModuleSection>
        </div>

        <aside className="space-y-6">
          <div className="page-card p-6">
            <p className="section-title text-[22px] font-semibold text-[var(--primary)]">Export Center</p>
            <div className="mt-5 space-y-4">
              {overview.exports.map((item) => (
                <div key={item.key} className="panel-muted p-4">
                  <p className="text-[15px] font-semibold text-[var(--text)]">{item.label}</p>
                  <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">{item.description}</p>
                  <button className="secondary-button mt-4 w-full" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate(exportPayloads[item.key])}>
                    {exportMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export Now
                  </button>
                </div>
              ))}
            </div>
          </div>

          {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}
        </aside>
      </div>
    </div>
  );
}

function ModuleSection({ title, subtitle, metrics, action, children }: { title: string; subtitle: string; metrics: ReportSnapshotMetric[]; action: ReactNode; children: ReactNode }) {
  return (
    <section className="page-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">{title}</p>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {metrics.map((item) => (
          <div key={item.label} className="panel-muted p-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.label}</p>
            <p className="mt-3 text-[24px] font-semibold text-[var(--primary)]">{item.value}</p>
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">{item.note}</p>
          </div>
        ))}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function MetricListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel-muted p-5">
      <p className="text-[18px] font-semibold text-[var(--primary)]">{title}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function ExportButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button className="secondary-button" onClick={onClick} disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Export Report
    </button>
  );
}
