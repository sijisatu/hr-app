import { getAttendanceHistory, getEmployees, getLeaveHistory, type EmployeeRecord, type LeaveRecord } from "@/lib/api";
import { getPayslips, type PayslipRecord } from "@/lib/payroll";

export type LeaveBalance = {
  annual: number;
  sick: number;
  permission: number;
};

export type EmployeeSelfServiceSummary = {
  employee: EmployeeRecord;
  attendance: {
    totalRecords: number;
    onTime: number;
    late: number;
    openSessions: number;
    overtimeHours: number;
    gpsComplianceRate: number;
  };
  leave: {
    balances: LeaveBalance;
    pendingRequests: number;
    approvedRequests: number;
    nextLeave: LeaveRecord | null;
  };
  payroll: {
    latestPayslip: PayslipRecord | null;
    publishedPayslips: number;
    ytdNetPay: number;
  };
};

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

export async function getEmployeeSelfServiceSummary(userId: string): Promise<EmployeeSelfServiceSummary> {
  const [employees, attendanceLogs, leaves, payslips] = await Promise.all([
    getEmployees(),
    getAttendanceHistory(),
    getLeaveHistory(),
    getPayslips(userId)
  ]);

  const employee = employees.find((entry) => entry.id === userId);
  if (!employee) {
    throw new Error("Employee not found");
  }

  const attendance = attendanceLogs.filter((entry) => entry.userId === userId);
  const leaveHistory = leaves.filter((entry) => entry.userId === userId);
  const publishedPayslips = payslips.filter((entry) => entry.status === "published");
  const currentYear = new Date().toISOString().slice(0, 4);

  return {
    employee,
    attendance: {
      totalRecords: attendance.length,
      onTime: attendance.filter((entry) => entry.status === "on-time").length,
      late: attendance.filter((entry) => entry.status === "late").length,
      openSessions: attendance.filter((entry) => !entry.checkOut).length,
      overtimeHours: Number((attendance.reduce((sum, entry) => sum + entry.overtimeMinutes, 0) / 60).toFixed(1)),
      gpsComplianceRate: attendance.length === 0 ? 0 : Math.round((attendance.filter((entry) => entry.gpsValidated).length / attendance.length) * 100)
    },
    leave: {
      balances: employee.leaveBalances,
      pendingRequests: leaveHistory.filter((entry) => entry.status === "pending-manager" || entry.status === "awaiting-hr").length,
      approvedRequests: leaveHistory.filter((entry) => entry.status === "approved").length,
      nextLeave: [...leaveHistory].filter((entry) => entry.startDate >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
    },
    payroll: {
      latestPayslip: publishedPayslips[0] ?? null,
      publishedPayslips: publishedPayslips.length,
      ytdNetPay: publishedPayslips.filter((entry) => entry.periodEnd.startsWith(currentYear)).reduce((sum, entry) => sum + entry.netPay, 0)
    }
  };
}

export function toAssetUrl(fileUrl: string | null) {
  if (!fileUrl) {
    return null;
  }
  return `${API_BASE}${fileUrl}`;
}
