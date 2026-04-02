import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BarOverview } from "@/components/reports/bar-overview";
import { requireSession } from "@/lib/auth";
import {
  deriveAnomalies,
  deriveAttendanceSeries,
  deriveDepartmentHealth,
  derivePerformers,
  getAttendanceHistory,
  getLeaveHistory
} from "@/lib/api";

export default async function ReportsPage() {
  await requireSession(["admin", "hr", "manager"]);
  const [logs, leaves] = await Promise.all([getAttendanceHistory(), getLeaveHistory()]);
  const series = deriveAttendanceSeries(logs);
  const performers = derivePerformers(logs);
  const departmentHealth = deriveDepartmentHealth(logs);
  const anomalies = deriveAnomalies(logs, leaves);
  const compliance = logs.length === 0 ? 0 : (logs.filter((item) => item.status !== "late").length / logs.length) * 100;

  return (
    <AppShell
      title="Attendance Intelligence"
      subtitle="Review organizational efficiency, compliance signals, and workforce patterns for the current quarter."
      actions={
        <button className="flex items-center gap-2 rounded-2xl bg-[var(--panel-alt)] px-5 py-3 text-sm font-semibold text-[var(--primary)]">
          <CalendarDays className="h-4 w-4" />
          Current Cycle
        </button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <BarOverview series={series} />

        <div className="panel rounded-[30px] p-6">
          <p className="section-title text-2xl font-semibold text-[var(--primary)]">Top Performers</p>
          <div className="mt-6 space-y-4">
            {performers.map((person) => (
              <div key={person.name} className="flex items-center gap-4 rounded-3xl bg-[var(--panel-alt)] p-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary)] text-sm font-bold text-white">{person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--primary)]">{person.name}</p>
                  <p className="text-sm text-muted">{person.role}</p>
                </div>
                <span className="rounded-full bg-[rgba(87,215,199,0.18)] px-3 py-2 text-sm font-semibold text-[var(--accent)]">{person.score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[30px] p-6">
          <p className="section-title text-2xl font-semibold text-[var(--primary)]">Departmental Health</p>
          <div className="mt-6 space-y-5">
            {departmentHealth.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">{item.name}</span><span className="text-muted">{item.value}%</span></div>
                <div className="h-2 rounded-full bg-[var(--panel-alt)]"><div className={item.tone === "danger" ? "h-2 rounded-full bg-[var(--danger)]" : "h-2 rounded-full bg-[var(--primary)]"} style={{ width: `${item.value}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] bg-[var(--primary)] p-6 text-white shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Policy Compliance</p>
          <p className="mt-5 max-w-xs text-lg text-white/80">Current organization-wide compliance is derived from live attendance logs and approval queue state.</p>
          <p className="section-title mt-10 text-6xl font-semibold">{compliance.toFixed(1)}%</p>
          <p className="mt-3 text-sm font-semibold text-[var(--accent)]">Live from local attendance API</p>
        </div>

        <div className="panel rounded-[30px] p-6">
          <p className="section-title text-2xl font-semibold text-[var(--primary)]">Recent Anomalies</p>
          <div className="mt-6 space-y-5">
            {anomalies.map((item, index) => (
              <div key={item.title} className="flex gap-4">
                <span className={index === 0 ? "mt-1 h-2.5 w-2.5 rounded-full bg-[var(--danger)]" : "mt-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]"} />
                <div>
                  <p className="font-semibold text-[var(--primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
