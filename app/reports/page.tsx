import { CalendarDays, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ReportCenter } from "@/components/reports/report-center";
import { requireSession } from "@/lib/auth";
import { getReportCenterOverview } from "@/lib/reporting";

export default async function ReportsPage() {
  await requireSession(["admin", "hr", "manager"]);
  const overview = await getReportCenterOverview();

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
      <ReportCenter overview={overview} />
    </AppShell>
  );
}
