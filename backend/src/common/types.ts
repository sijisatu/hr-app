export type AttendanceStatus = "on-time" | "late" | "absent" | "early-leave";
export type LeaveStatus = "pending-manager" | "awaiting-hr" | "approved" | "rejected";
export type LeaveType = "Annual Leave" | "Sick Leave" | "Permission" | "Remote Work";
export type EmploymentType = "permanent" | "contract" | "probation";
export type ContractStatus = "active" | "probation" | "ending-soon" | "expired";
export type ShiftStatus = "active" | "scheduled" | "maintenance";
export type OvertimeStatus = "pending" | "approved" | "paid";

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
  shiftName: string;
  scheduledStart: string;
  scheduledEnd: string;
  gpsValidated: boolean;
  gpsDistanceMeters: number;
  photoUrl: string | null;
  status: AttendanceStatus;
  overtimeMinutes: number;
};

export type ShiftRecord = {
  id: string;
  name: string;
  department: string;
  startTime: string;
  endTime: string;
  workDays: string[];
  workLocation: string;
  employeesAssigned: number;
  status: ShiftStatus;
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

export type DatabaseShape = {
  employees: EmployeeRecord[];
  attendanceLogs: AttendanceRecord[];
  shifts: ShiftRecord[];
  overtimeRequests: OvertimeRecord[];
  leaveRequests: LeaveRecord[];
};
