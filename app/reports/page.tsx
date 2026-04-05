import { CalendarDays, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ReportCenter } from "@/components/reports/report-center";
import { requireSession } from "@/lib/auth";
import { deriveAttendanceSeries, getAttendanceHistory } from "@/lib/api";
import { getReportCenterOverview } from "@/lib/reporting";

export default async function ReportsPage() {
  await requireSession(["admin", "hr", "manager"]);
  const [logs, overview] = await Promise.all([
    getAttendanceHistory(),
    getReportCenterOverview()
  ]);
  const series = deriveAttendanceSeries(logs);

  return (
    <AppShell
      title="Reports"
      subtitle="Attendance, employee, and payroll reporting center with local export generation."
      actions={
        <button className="secondary-button gap-3">
          <CalendarDays className="h-4 w-4" />
          <span>Current Period</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      }
    >
      <ReportCenter overview={overview} series={series} />
    </AppShell>
  );
}
