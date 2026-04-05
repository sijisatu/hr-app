import { getAttendanceHistory, getEmployees, getLeaveHistory } from "@/lib/api";
import { getPayRuns, getPayrollComponents, getPayslips, money } from "@/lib/payroll";

export type ReportSnapshotMetric = {
  label: string;
  value: string;
  note: string;
};

export type ReportCenterOverview = {
  attendance: {
    metrics: ReportSnapshotMetric[];
    topDepartments: { name: string; value: number }[];
    anomalies: { title: string; note: string }[];
  };
  employees: {
    metrics: ReportSnapshotMetric[];
    contractAlerts: { employeeName: string; status: string; note: string }[];
    departments: { name: string; headcount: number }[];
  };
  payroll: {
    metrics: ReportSnapshotMetric[];
    recentRuns: { periodLabel: string; status: string; employeeCount: number; totalNet: number }[];
    topEarners: { employeeName: string; netPay: number; department: string }[];
  };
  exports: { key: "attendance" | "employees" | "payroll"; label: string; description: string }[];
};

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

export async function getReportCenterOverview(): Promise<ReportCenterOverview> {
  const [employees, logs, leaves, payRuns, components, payslips] = await Promise.all([
    getEmployees(),
    getAttendanceHistory(),
    getLeaveHistory(),
    getPayRuns(),
    getPayrollComponents(),
    getPayslips()
  ]);

  const attendanceByDepartment = new Map<string, { present: number; total: number }>();
  const headcountByDepartment = new Map<string, number>();

  for (const employee of employees) {
    headcountByDepartment.set(employee.department, (headcountByDepartment.get(employee.department) ?? 0) + 1);
  }

  for (const log of logs) {
    const bucket = attendanceByDepartment.get(log.department) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (log.status !== "absent") {
      bucket.present += 1;
    }
    attendanceByDepartment.set(log.department, bucket);
  }

  const lateRecords = logs.filter((entry) => entry.status === "late").length;
  const gpsExceptions = logs.filter((entry) => !entry.gpsValidated).length;
  const activeEmployees = employees.filter((entry) => entry.status === "active");
  const publishedPayslips = payslips.filter((entry) => entry.status === "published");
  const latestRun = [...payRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;

  return {
    attendance: {
      metrics: [
        { label: "Attendance Logs", value: String(logs.length), note: "Records across all active teams" },
        { label: "On-Time Rate", value: `${logs.length === 0 ? 0 : Math.round((logs.filter((entry) => entry.status === "on-time").length / logs.length) * 100)}%`, note: `${lateRecords} late arrivals need review` },
        { label: "GPS Compliance", value: `${logs.length === 0 ? 0 : Math.round((logs.filter((entry) => entry.gpsValidated).length / logs.length) * 100)}%`, note: `${gpsExceptions} exceptions captured` }
      ],
      topDepartments: [...attendanceByDepartment.entries()].map(([name, value]) => ({ name, value: Math.round((value.present / value.total) * 100) })).sort((a, b) => b.value - a.value).slice(0, 4),
      anomalies: [
        { title: lateRecords > 0 ? "Late arrival pattern" : "Arrival pattern stable", note: `${lateRecords} late check-ins in the current dataset` },
        { title: gpsExceptions > 0 ? "GPS exception review" : "GPS validation healthy", note: `${gpsExceptions} records outside the approved radius` },
        { title: "Pending leave approvals", note: `${leaves.filter((entry) => entry.status !== "approved").length} requests still in queue` }
      ]
    },
    employees: {
      metrics: [
        { label: "Headcount", value: String(employees.length), note: `${activeEmployees.length} active employees` },
        { label: "Departments", value: String(headcountByDepartment.size), note: "Current org structure snapshot" },
        { label: "Contract Alerts", value: String(employees.filter((entry) => ["probation", "ending-soon", "expired"].includes(entry.contractStatus)).length), note: "Probation, ending soon, or expired" }
      ],
      contractAlerts: employees.filter((entry) => ["probation", "ending-soon", "expired"].includes(entry.contractStatus)).slice(0, 4).map((entry) => ({ employeeName: entry.name, status: entry.contractStatus, note: `${entry.position} | ${entry.contractEnd ?? entry.contractStart}` })),
      departments: [...headcountByDepartment.entries()].map(([name, headcount]) => ({ name, headcount })).sort((a, b) => b.headcount - a.headcount)
    },
    payroll: {
      metrics: [
        { label: "Published Payslips", value: String(publishedPayslips.length), note: "Available to employee self-service" },
        { label: "Active Components", value: String(components.filter((entry) => entry.active).length), note: "Earning and deduction rules" },
        { label: "Latest Pay Run", value: latestRun ? latestRun.periodLabel : "Not generated", note: latestRun ? `${latestRun.employeeCount} employees | status ${latestRun.status}` : "Generate a payroll run to start" }
      ],
      recentRuns: [...payRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, 3).map((entry) => ({ periodLabel: entry.periodLabel, status: entry.status, employeeCount: entry.employeeCount, totalNet: entry.totalNet })),
      topEarners: [...publishedPayslips].sort((a, b) => b.netPay - a.netPay).slice(0, 3).map((entry) => ({ employeeName: entry.employeeName, netPay: entry.netPay, department: entry.department }))
    },
    exports: [
      { key: "attendance", label: "Attendance Report", description: "Export attendance logs, punctuality, and GPS compliance snapshot." },
      { key: "employees", label: "Employee Report", description: "Export employee master data, department mix, and contract monitoring list." },
      { key: "payroll", label: "Payroll Report", description: "Export payroll run totals, published payslips, and top compensation lines." }
    ]
  };
}

export async function exportReport(payload: { reportName: string; content: string }) {
  const response = await fetch(`${API_BASE}/api/reports/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  const json = (await response.json()) as { data: { fileName: string; fileUrl: string } };
  return json.data;
}

export function toAssetUrl(fileUrl: string | null) {
  if (!fileUrl) {
    return null;
  }
  return `${API_BASE}${fileUrl}`;
}

export function formatNetPay(value: number) {
  return money(value);
}
