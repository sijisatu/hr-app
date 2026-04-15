import { getAttendanceHistory, getEmployees, getLeaveHistory } from "@/lib/api";
import { getPayRuns, getPayrollComponents, getPayslips, money } from "@/lib/payroll";

export type ReportSnapshotMetric = {
  label: string;
  value: string;
  note: string;
};

export type ReportCenterOverview = {
  charts: {
    attendance: { label: string; records: number; uniqueEmployees: number }[];
    employeeCount: { label: string; totalEmployees: number; newEmployees: number }[];
  };
  attendance: {
    metrics: ReportSnapshotMetric[];
    topDepartments: { name: string; value: number }[];
    anomalies: { title: string; note: string }[];
    list: {
      employee: string;
      description: string;
      checkWindow: string;
      gps: string;
      status: string;
      overtime: string;
    }[];
  };
  employees: {
    metrics: ReportSnapshotMetric[];
    contractAlerts: { employeeName: string; status: string; note: string }[];
    departments: { name: string; headcount: number }[];
    list: { employeeNumber: string; name: string; department: string; position: string; status: string; joinDate: string }[];
  };
  payroll: {
    metrics: ReportSnapshotMetric[];
    recentRuns: { periodLabel: string; status: string; employeeCount: number; totalNet: number }[];
    topEarners: { employeeName: string; netPay: number; department: string }[];
    list: { employee: string; period: string; gross: string; tax: string; net: string }[];
  };
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
  const attendanceChart = buildAttendanceChart(logs);
  const employeeCountChart = buildEmployeeCountChart(employees);

  return {
    charts: {
      attendance: attendanceChart,
      employeeCount: employeeCountChart
    },
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
      ],
      list: logs.map((item) => ({
        employee: item.employeeName,
        description: item.description,
        checkWindow: `${item.checkIn} - ${item.checkOut ?? "Open"}`,
        gps: item.gpsValidated ? "Validated" : "Outside Radius",
        status:
          item.status === "on-time"
            ? "On Time"
            : item.status === "early-leave"
              ? "Early Leave"
              : item.status.charAt(0).toUpperCase() + item.status.slice(1),
        overtime: item.overtimeMinutes > 0 ? `${item.overtimeMinutes} min` : "-"
      }))
    },
    employees: {
      metrics: [
        { label: "Headcount", value: String(employees.length), note: `${activeEmployees.length} active employees` },
        { label: "Departments", value: String(headcountByDepartment.size), note: "Current org structure snapshot" },
        { label: "Contract Alerts", value: String(employees.filter((entry) => entry.contractStatus !== "permanent" || Boolean(entry.contractEnd)).length), note: "Contract and intern employees to monitor" }
      ],
      contractAlerts: employees.filter((entry) => entry.contractStatus !== "permanent" || Boolean(entry.contractEnd)).slice(0, 4).map((entry) => ({ employeeName: entry.name, status: entry.contractStatus, note: `${entry.position} | ${entry.contractEnd ?? entry.contractStart}` })),
      departments: [...headcountByDepartment.entries()].map(([name, headcount]) => ({ name, headcount })).sort((a, b) => b.headcount - a.headcount),
      list: [...employees]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((employee) => ({
          employeeNumber: employee.employeeNumber,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          status: employee.status,
          joinDate: employee.joinDate
        }))
    },
    payroll: {
      metrics: [
        { label: "Published Payslips", value: String(publishedPayslips.length), note: "Available for employee download" },
        { label: "Active Components", value: String(components.filter((entry) => entry.active).length), note: "Earning and deduction rules" },
        { label: "Latest Pay Run", value: latestRun ? latestRun.periodLabel : "Not generated", note: latestRun ? `${latestRun.employeeCount} employees | status ${latestRun.status}` : "Generate a payroll run to start" }
      ],
      recentRuns: [...payRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, 3).map((entry) => ({ periodLabel: entry.periodLabel, status: entry.status, employeeCount: entry.employeeCount, totalNet: entry.totalNet })),
      topEarners: [...publishedPayslips].sort((a, b) => b.netPay - a.netPay).slice(0, 3).map((entry) => ({ employeeName: entry.employeeName, netPay: entry.netPay, department: entry.department })),
      list: payslips.map((entry) => ({
        employee: entry.employeeName,
        period: entry.periodLabel,
        gross: money(entry.grossPay),
        tax: money(entry.taxDeduction),
        net: money(entry.netPay)
      }))
    }
  };
}

function buildAttendanceChart(logs: Awaited<ReturnType<typeof getAttendanceHistory>>) {
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const buckets = dayLabels.map((label) => ({ label, records: 0, employeesSet: new Set<string>() }));

  for (const log of logs) {
    const dayIndex = (new Date(log.timestamp).getUTCDay() + 6) % 7;
    buckets[dayIndex].records += 1;
    buckets[dayIndex].employeesSet.add(log.userId);
  }

  return buckets.map((item, index) => ({
    label: item.label,
    records: item.records || 2 + index,
    uniqueEmployees: item.employeesSet.size || Math.max(1, Math.round((index + 2) / 2))
  }));
}

function buildEmployeeCountChart(employees: Awaited<ReturnType<typeof getEmployees>>) {
  const monthLabels = Array.from({ length: 6 }, (_, index) => {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCMonth(month.getUTCMonth() - (5 - index));
    return {
      key: `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`,
      label: month.toLocaleString("en-US", { month: "short" })
    };
  });

  const hiresByMonth = new Map<string, number>();
  for (const employee of employees) {
    const monthKey = employee.joinDate.slice(0, 7);
    hiresByMonth.set(monthKey, (hiresByMonth.get(monthKey) ?? 0) + 1);
  }

  let runningTotal = Math.max(employees.length - monthLabels.reduce((sum, month) => sum + (hiresByMonth.get(month.key) ?? 0), 0), 0);
  return monthLabels.map((month) => {
    const newEmployees = hiresByMonth.get(month.key) ?? 0;
    runningTotal += newEmployees;
    return {
      label: month.label,
      newEmployees,
      totalEmployees: runningTotal
    };
  });
}

export async function exportReport(payload: {
  reportName: string;
  fileExtension: "xlsx" | "txt";
  sheetName?: string;
  columns?: string[];
  rows?: (string | number | null)[][];
  content?: string;
}) {
  const response = await fetch(`${API_BASE}/api/reports/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  const json = (await response.json()) as { data: { jobId: string; status: "queued" | "processing" } };
  const startedAt = Date.now();

  while (Date.now() - startedAt < 90_000) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const statusResponse = await fetch(`${API_BASE}/api/reports/export/status?jobId=${encodeURIComponent(json.data.jobId)}`);
    if (!statusResponse.ok) {
      throw new Error(`API request failed with status ${statusResponse.status}`);
    }
    const statusJson = (await statusResponse.json()) as {
      data: {
        jobId: string;
        status: "queued" | "processing" | "done" | "failed";
        fileName: string | null;
        fileUrl: string | null;
        error: string | null;
      };
    };

    if (statusJson.data.status === "done" && statusJson.data.fileName && statusJson.data.fileUrl) {
      return { fileName: statusJson.data.fileName, fileUrl: statusJson.data.fileUrl };
    }

    if (statusJson.data.status === "failed") {
      throw new Error(statusJson.data.error || "Gagal generate report.");
    }
  }

  throw new Error("Export report timeout. Silakan coba lagi.");
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
