export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
};

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
  employmentType: "permanent" | "contract" | "probation";
  contractStatus: "active" | "probation" | "ending-soon" | "expired";
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
  status: "on-time" | "late" | "absent" | "early-leave";
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
  status: "active" | "scheduled" | "maintenance";
};

export type OvertimeRecord = {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  date: string;
  minutes: number;
  reason: string;
  status: "pending" | "approved" | "paid";
};

export type LeaveType = "Annual Leave" | "Sick Leave" | "Permission" | "Remote Work";

export type LeaveRecord = {
  id: string;
  userId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending-manager" | "awaiting-hr" | "approved" | "rejected";
  approverFlow: string[];
  balanceLabel: string;
  requestedAt: string;
  daysRequested: number;
  autoApproved: boolean;
};

export type DashboardSummary = {
  employees: number;
  onTime: number;
  late: number;
  absent: number;
  leavePending: number;
  storageMode: string;
};

export type AttendanceOverview = {
  checkedInToday: number;
  openCheckIns: number;
  gpsValidated: number;
  selfieCaptured: number;
  overtimeHours: number;
  activeShifts: number;
  scheduledShifts: number;
};

export type AttendanceSeriesItem = {
  label: string;
  present: number;
  absent: number;
};

export type ActivityItem = {
  name: string;
  time: string;
  detail: string;
  status: "live" | "alert";
};

export type Performer = {
  name: string;
  role: string;
  score: string;
};

export type DepartmentHealth = {
  name: string;
  value: number;
  tone: "primary" | "danger";
};

export type Anomaly = {
  title: string;
  subtitle: string;
};

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

async function apiFetch<T>(pathname: string): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, { cache: "no-store" });
  return parseResponse<T>(response);
}

async function apiPostJson<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function apiPostForm<T>(pathname: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, { method: "POST", body });
  return parseResponse<T>(response);
}

export async function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/api/dashboard/summary");
}

export async function getEmployees() {
  return apiFetch<EmployeeRecord[]>("/api/employees");
}

export async function getAttendanceHistory() {
  return apiFetch<AttendanceRecord[]>("/api/attendance/history");
}

export async function getAttendanceToday() {
  return apiFetch<AttendanceRecord[]>("/api/attendance/today");
}

export async function getAttendanceOverview() {
  return apiFetch<AttendanceOverview>("/api/attendance/overview");
}

export async function getAttendanceShifts() {
  return apiFetch<ShiftRecord[]>("/api/attendance/shifts");
}

export async function getAttendanceOvertime() {
  return apiFetch<OvertimeRecord[]>("/api/attendance/overtime");
}

export async function createCheckIn(payload: {
  userId: string;
  employeeName: string;
  department: string;
  location: string;
  shiftName?: string;
  latitude: number;
  longitude: number;
  photo?: File | null;
}) {
  const formData = new FormData();
  formData.set("userId", payload.userId);
  formData.set("employeeName", payload.employeeName);
  formData.set("department", payload.department);
  formData.set("location", payload.location);
  formData.set("latitude", String(payload.latitude));
  formData.set("longitude", String(payload.longitude));
  if (payload.shiftName) {
    formData.set("shiftName", payload.shiftName);
  }
  if (payload.photo) {
    formData.set("photo", payload.photo);
  }
  return apiPostForm<AttendanceRecord>("/api/attendance/check-in", formData);
}

export async function createCheckOut(payload: { attendanceId: string; checkOut?: string }) {
  return apiPostJson<AttendanceRecord>("/api/attendance/check-out", payload);
}

export async function getLeaveHistory() {
  return apiFetch<LeaveRecord[]>("/api/leave/history");
}

export async function createLeaveRequest(payload: {
  userId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  return apiPostJson<LeaveRecord>("/api/leave/request", payload);
}

export async function approveLeaveRequest(payload: {
  leaveId: string;
  status: "approved" | "rejected" | "awaiting-hr";
  actor: string;
}) {
  return apiPostJson<LeaveRecord>("/api/leave/approve", payload);
}

export function deriveAttendanceSeries(logs: AttendanceRecord[]): AttendanceSeriesItem[] {
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const seeded = weekdays.map((label) => ({ label, present: 0, absent: 0 }));

  for (const log of logs) {
    const date = new Date(log.timestamp);
    const day = (date.getUTCDay() + 6) % 7;
    if (log.status === "absent") {
      seeded[day].absent += 1;
    } else {
      seeded[day].present += 1;
    }
  }

  return seeded.map((item, index) => ({
    ...item,
    present: item.present || 3 + index,
    absent: item.absent || (index % 3 === 0 ? 1 : 0)
  }));
}

export function deriveActivityStream(logs: AttendanceRecord[]): ActivityItem[] {
  return logs.slice(0, 4).map((log) => ({
    name: log.employeeName,
    time: log.checkIn,
    detail: `${labelForStatus(log.status)} | ${log.department}`,
    status: log.status === "late" ? "alert" : "live"
  }));
}

export function derivePerformers(logs: AttendanceRecord[]): Performer[] {
  const scores = new Map<string, { role: string; score: number; count: number }>();

  for (const log of logs) {
    const existing = scores.get(log.employeeName) ?? { role: log.department, score: 0, count: 0 };
    existing.count += 1;
    existing.score += log.status === "on-time" ? 100 : log.status === "late" ? 78 : 70;
    scores.set(log.employeeName, existing);
  }

  return [...scores.entries()]
    .map(([name, value]) => ({
      name,
      role: value.role,
      score: `${Math.round(value.score / value.count)}%`
    }))
    .sort((a, b) => Number.parseInt(b.score, 10) - Number.parseInt(a.score, 10))
    .slice(0, 3);
}

export function deriveDepartmentHealth(logs: AttendanceRecord[]): DepartmentHealth[] {
  const bucket = new Map<string, { present: number; total: number }>();

  for (const log of logs) {
    const item = bucket.get(log.department) ?? { present: 0, total: 0 };
    item.total += 1;
    if (log.status !== "absent") {
      item.present += 1;
    }
    bucket.set(log.department, item);
  }

  return [...bucket.entries()].map(([name, value]) => {
    const score = Math.round((value.present / value.total) * 100);
    return { name, value: score, tone: score < 80 ? "danger" : "primary" };
  });
}

export function deriveAnomalies(logs: AttendanceRecord[], leaves: LeaveRecord[]): Anomaly[] {
  const late = logs.filter((log) => log.status === "late").length;
  const earlyLeave = logs.filter((log) => log.status === "early-leave").length;
  const pendingLeave = leaves.filter((leave) => leave.status !== "approved").length;

  return [
    { title: late > 0 ? "Late Arrival Spike" : "Stable Arrival Pattern", subtitle: `${late} late check-ins flagged this cycle` },
    { title: earlyLeave > 0 ? "Early Leave Pattern" : "Shift Completion Healthy", subtitle: `${earlyLeave} early leave records detected` },
    { title: pendingLeave > 0 ? "Pending Leave Queue" : "Leave Queue Clear", subtitle: `${pendingLeave} requests still need approval` }
  ];
}

export function labelForStatus(status: AttendanceRecord["status"]) {
  switch (status) {
    case "on-time":
      return "Checked in on time";
    case "late":
      return "Late check-in";
    case "absent":
      return "Absent";
    case "early-leave":
      return "Early leave";
    default:
      return status;
  }
}

export function formatLeaveStatus(status: LeaveRecord["status"]) {
  switch (status) {
    case "awaiting-hr":
      return "Awaiting HR";
    case "pending-manager":
      return "Review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function formatOvertimeStatus(status: OvertimeRecord["status"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "paid":
      return "Paid Out";
    case "pending":
      return "Pending Review";
    default:
      return status;
  }
}

export function currency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}
