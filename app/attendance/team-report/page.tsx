import Link from "next/link";
import { Download, Users, UserCheck, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AttendanceTable } from "@/components/tables/attendance-table";
import { requireSession } from "@/lib/auth";
import { getAttendanceHistory, getAttendanceOverview, getAttendanceOvertime, getEmployees } from "@/lib/api";

export default async function TeamAttendanceReportPage() {
  await requireSession(["admin", "hr"]);

  const [employees, logs, overview, overtime] = await Promise.all([
    getEmployees(),
    getAttendanceHistory(),
    getAttendanceOverview(),
    getAttendanceOvertime()
  ]);

  const punctuality = logs.length === 0 ? 0 : (logs.filter((item) => item.status === "on-time").length / logs.length) * 100;
  const activeEmployees = employees.filter((item) => item.status === "active");
  const checkedInIds = new Set(logs.map((item) => item.userId));
  const lateCount = logs.filter((item) => item.status === "late").length;
  const pendingOvertime = overtime.filter((item) => item.status === "pending").length;
  const departmentCoverage = new Set(logs.map((item) => item.department)).size;

  const reportCards = [
    {
      label: "Active Employees",
      value: String(activeEmployees.length),
      note: `${checkedInIds.size} karyawan punya record attendance`
    },
    {
      label: "Departments Covered",
      value: String(departmentCoverage),
      note: "Departemen yang muncul di laporan attendance"
    },
    {
      label: "Late Records",
      value: String(lateCount),
      note: "Butuh follow-up HR atau leader"
    },
    {
      label: "Pending Overtime",
      value: String(pendingOvertime),
      note: "Queue lembur yang masih menunggu keputusan"
    }
  ];

  const topDepartments = [...new Set(logs.map((item) => item.department))]
    .map((department) => {
      const departmentLogs = logs.filter((item) => item.department === department);
      const onTime = departmentLogs.filter((item) => item.status === "on-time").length;

      return {
        department,
        records: departmentLogs.length,
        onTimeRate: departmentLogs.length === 0 ? 0 : Math.round((onTime / departmentLogs.length) * 100)
      };
    })
    .sort((a, b) => b.records - a.records)
    .slice(0, 4);

  return (
    <AppShell
      title="Attendance Report"
      subtitle="Report kehadiran seluruh karyawan untuk kebutuhan monitoring HRD, lengkap dengan rekap punctuality dan queue overtime."
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link href="/attendance" className="secondary-button">
            Kembali ke Attendance
          </Link>
          <button className="secondary-button">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      )}
    >
      <div className="space-y-6">
        <section className="rounded-[20px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">HR Attendance Report</p>
          <h2 className="mt-4 text-[28px] font-semibold leading-tight">Satu tempat untuk lihat kehadiran semua karyawan.</h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
            HRD bisa tetap pakai menu attendance seperti karyawan, lalu pindah ke report ini saat butuh rekap organisasi secara menyeluruh.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reportCards.map((item, index) => (
            <div key={item.label} className={index === 3 ? "page-card bg-[var(--primary)] p-5 text-white" : "page-card p-5"}>
              <p className={index === 3 ? "text-[12px] font-medium uppercase tracking-[0.08em] text-white/72" : "text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"}>{item.label}</p>
              <p className={index === 3 ? "mt-3 text-[30px] font-semibold leading-none" : "mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]"}>{item.value}</p>
              <p className={index === 3 ? "mt-3 text-[14px] text-white/74" : "mt-3 text-[14px] text-[var(--text-muted)]"}>{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Department Snapshot</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">Ringkasan coverage attendance dari departemen dengan volume record terbesar.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {topDepartments.map((item) => (
                <div key={item.department} className="panel-muted p-4">
                  <p className="text-[15px] font-semibold text-[var(--text)]">{item.department}</p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[28px] font-semibold leading-none text-[var(--primary)]">{item.records}</p>
                      <p className="mt-2 text-[13px] text-[var(--text-muted)]">attendance records</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-semibold text-[var(--text)]">{item.onTimeRate}%</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">on-time rate</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Monitoring Notes</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">Titik cepat yang biasanya dibutuhkan HRD saat review kehadiran.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="panel-muted flex gap-3 p-4 text-[14px] text-[var(--text-muted)]">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                <span>{lateCount} record keterlambatan muncul di laporan ini dan perlu dipantau follow-up-nya.</span>
              </div>
              <div className="panel-muted flex gap-3 p-4 text-[14px] text-[var(--text-muted)]">
                <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <span>{checkedInIds.size} karyawan sudah tercatat hadir dibanding {activeEmployees.length} karyawan aktif.</span>
              </div>
              <div className="panel-muted flex gap-3 p-4 text-[14px] text-[var(--text-muted)]">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <span>Punctuality organisasi saat ini berada di {punctuality.toFixed(1)}% dengan {overview.openCheckIns} sesi check-in yang masih terbuka.</span>
              </div>
            </div>
          </div>
        </section>

        <AttendanceTable logs={logs} punctuality={punctuality} overview={overview} />
      </div>
    </AppShell>
  );
}
