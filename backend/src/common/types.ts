export type AttendanceStatus = "on-time" | "late" | "absent" | "early-leave";
export type LeaveStatus = "pending-manager" | "awaiting-hr" | "approved" | "rejected";
export type LeaveType =
  | "Leave Request"
  | "Sick Submission"
  | "On Duty Request"
  | "Half Day Leave"
  | "Annual Leave"
  | "Sick Leave"
  | "Permission"
  | "Remote Work";
export type EmploymentType = "permanent" | "contract" | "probation";
export type ContractStatus = "active" | "probation" | "ending-soon" | "expired";
export type OvertimeStatus = "pending" | "approved" | "rejected" | "paid";
export type PayrollComponentType = "earning" | "deduction";
export type PayrollCalculationType = "fixed" | "percentage";
export type PayRunStatus = "draft" | "published";
export type PayslipStatus = "draft" | "published";

export type LeaveBalance = {
  annual: number;
  sick: number;
  permission: number;
};

export type EmployeeRecord = {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: "admin" | "hr" | "employee" | "manager";
  status: "active" | "inactive";
  phone: string;
  joinDate: string;
  workLocation: string;
  workType: "onsite" | "hybrid" | "remote";
  managerName: string;
  employmentType: EmploymentType;
  contractStatus: ContractStatus;
  contractStart: string;
  contractEnd: string | null;
  baseSalary: number;
  allowance: number;
  taxProfile: string;
  bankName: string;
  bankAccountMasked: string;
  leaveBalances: LeaveBalance;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  timestamp: string;
  checkIn: string;
  checkOut: string | null;
  location: string;
  latitude: number;
  longitude: number;
  description: string;
  gpsValidated: boolean;
  gpsDistanceMeters: number;
  photoUrl: string | null;
  status: AttendanceStatus;
  overtimeMinutes: number;
};


export type OvertimeRecord = {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  date: string;
  minutes: number;
  reason: string;
  status: OvertimeStatus;
};

export type LeaveRecord = {
  id: string;
  userId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  approverFlow: string[];
  balanceLabel: string;
  requestedAt: string;
  daysRequested: number;
  autoApproved: boolean;
};

export type PayrollComponentRecord = {
  id: string;
  code: string;
  name: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  amount: number;
  percentage: number | null;
  taxable: boolean;
  active: boolean;
  appliesToAll: boolean;
  employeeIds: string[];
  description: string;
};

export type PayslipLineItem = {
  code: string;
  name: string;
  type: PayrollComponentType;
  amount: number;
  taxable: boolean;
  source: "base-salary" | "allowance" | "overtime" | "component" | "tax";
};

export type PayslipRecord = {
  id: string;
  payRunId: string;
  userId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  position: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayslipStatus;
  baseSalary: number;
  allowance: number;
  overtimePay: number;
  additionalEarnings: number;
  grossPay: number;
  taxDeduction: number;
  otherDeductions: number;
  netPay: number;
  bankName: string;
  bankAccountMasked: string;
  taxProfile: string;
  components: PayslipLineItem[];
  generatedFileUrl: string | null;
};

export type PayRunRecord = {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayRunStatus;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  employeeCount: number;
  createdAt: string;
  publishedAt: string | null;
};

export type DatabaseShape = {
  employees: EmployeeRecord[];
  attendanceLogs: AttendanceRecord[];
  overtimeRequests: OvertimeRecord[];
  leaveRequests: LeaveRecord[];
  payrollComponents: PayrollComponentRecord[];
  payRuns: PayRunRecord[];
  payslips: PayslipRecord[];
};



