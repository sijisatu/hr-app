export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
};

export type LeaveBalance = {
  annual: number;
  annualCarryOver: number;
  annualCarryOverExpiresAt: string | null;
  religious: number;
  religiousCarryOver: number;
  religiousCarryOverExpiresAt: string | null;
  maternity: number;
  maternityCarryOver: number;
  maternityCarryOverExpiresAt: string | null;
  paternity: number;
  paternityCarryOver: number;
  paternityCarryOverExpiresAt: string | null;
  marriage: number;
  marriageCarryOver: number;
  marriageCarryOverExpiresAt: string | null;
  bereavement: number;
  bereavementCarryOver: number;
  bereavementCarryOverExpiresAt: string | null;
  sick: number;
  sickUsed: number;
  permission: number;
  permissionCarryOver: number;
  permissionCarryOverExpiresAt: string | null;
  balanceYear: number;
};

export type Gender = "male" | "female";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";
export type EducationRecord = {
  level: string;
  institution: string;
  major: string;
  startYear: string;
  endYear: string;
};

export type WorkExperienceRecord = {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type EmployeeDocumentType =
  | "ktp"
  | "ijazah"
  | "sertifikat"
  | "npwp"
  | "kk"
  | "kontrak-kerja"
  | "bpjs"
  | "lainnya";

export type EmployeeDocumentRecord = {
  id: string;
  employeeId: string;
  type: EmployeeDocumentType;
  title: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  notes: string;
};

export type CompensationProfileRecord = {
  id: string;
  position: string;
  baseSalary: number;
  active: boolean;
  notes: string;
};

export type TaxProfileRecord = {
  id: string;
  name: string;
  rate: number;
  active: boolean;
  description: string;
};

export type PayrollComponentType = "earning" | "deduction";
export type PayrollCalculationType = "fixed" | "percentage";
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

export type EmployeeRecord = {
  id: string;
  employeeNumber: string;
  nik: string;
  name: string;
  email: string;
  birthPlace: string;
  birthDate: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  marriageDate: string | null;
  address: string;
  idCardNumber: string;
  education: string;
  workExperience: string;
  educationHistory: EducationRecord[];
  workExperiences: WorkExperienceRecord[];
  department: string;
  position: string;
  role: "admin" | "hr" | "employee" | "manager";
  status: "active" | "inactive";
  phone: string;
  joinDate: string;
  workLocation: string;
  workType: "onsite" | "hybrid" | "remote";
  managerName: string;
  employmentType: "permanent" | "contract" | "intern";
  contractStatus: "permanent" | "contract" | "intern";
  contractStart: string;
  contractEnd: string | null;
  baseSalary: number;
  allowance: number;
  positionSalaryId: string | null;
  financialComponentIds: string[];
  taxProfileId: string | null;
  taxProfile: string;
  bankName: string;
  bankAccountMasked: string;
  appLoginEnabled: boolean;
  loginUsername: string | null;
  loginPassword: string | null;
  documents: EmployeeDocumentRecord[];
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
  status: "on-time" | "late" | "absent" | "early-leave";
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
  status: "pending" | "approved" | "rejected" | "paid";
};

export type LeaveType =
  | "Leave Request"
  | "Sick Submission"
  | "On Duty Request"
  | "Half Day Leave"
  | "Annual Leave"
  | "Religious Leave"
  | "Maternity Leave"
  | "Paternity Leave"
  | "Marriage Leave"
  | "Bereavement Leave"
  | "Sick Leave"
  | "Permission"
  | "Remote Work";

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

export type ReimbursementStatus = "draft" | "pending-manager" | "awaiting-hr" | "approved" | "rejected" | "processed";
export type ReimbursementCategory = "medical" | "glasses" | "maternity" | "transport" | "communication" | "wellness" | "other";

export type ReimbursementClaimTypeRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  category: ReimbursementCategory;
  claimType: string;
  subType: string;
  currency: string;
  annualLimit: number;
  remainingBalance: number;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ReimbursementRequestRecord = {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  designation: string;
  claimTypeId: string;
  claimType: string;
  subType: string;
  category: ReimbursementCategory;
  currency: string;
  amount: number;
  receiptDate: string;
  remarks: string;
  receiptFileName: string | null;
  receiptFileUrl: string | null;
  status: ReimbursementStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  approverFlow: string[];
  balanceSnapshot: number;
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
};

export type AttendanceSeriesItem = {
  label: string;
  present: number;
  absent: number;
};

export type ActivityItem = {
  id: string;
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
  let payload: ApiResponse<T> | null = null;
  let rawPayload: unknown = null;
  try {
    rawPayload = await response.json();
    payload = rawPayload as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const messageFromApi =
      (rawPayload && typeof rawPayload === "object" && rawPayload !== null && "message" in rawPayload
        ? String((rawPayload as { message?: unknown }).message ?? "")
        : "") ||
      (payload && typeof payload.error === "string" && payload.error.trim().length > 0 ? payload.error : "");
    throw new Error(messageFromApi || `API request failed with status ${response.status}`);
  }

  if (!payload) {
    throw new Error("API returned an unexpected empty response.");
  }
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

async function apiPatchJson<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function apiDelete<T>(pathname: string): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, { method: "DELETE" });
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

export async function createEmployee(payload: {
  nik: string;
  name: string;
  email: string;
  birthPlace: string;
  birthDate: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  marriageDate?: string | null;
  address: string;
  idCardNumber: string;
  education: string;
  workExperience: string;
  educationHistory: EducationRecord[];
  workExperiences: WorkExperienceRecord[];
  department: string;
  position: string;
  role: "admin" | "hr" | "employee" | "manager";
  status: "active" | "inactive";
  phone: string;
  workLocation: string;
  workType: "onsite" | "hybrid" | "remote";
  managerName: string;
  employmentType: "permanent" | "contract" | "intern";
  contractStatus: "permanent" | "contract" | "intern";
  contractStart: string;
  contractEnd?: string | null;
  baseSalary: number;
  allowance: number;
  positionSalaryId?: string | null;
  financialComponentIds: string[];
  taxProfileId?: string | null;
  taxProfile: string;
  bankName: string;
  bankAccountMasked: string;
  appLoginEnabled?: boolean;
  loginUsername?: string | null;
  loginPassword?: string | null;
}) {
  return apiPostJson<EmployeeRecord>("/api/employees", payload);
}

export async function updateEmployee(id: string, payload: Partial<Omit<EmployeeRecord, "id" | "employeeNumber">>) {
  return apiPatchJson<EmployeeRecord>(`/api/employees/${id}`, payload);
}

export async function deleteEmployee(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/employees/${id}`);
}

export async function getEmployeeDocuments(employeeId: string) {
  return apiFetch<EmployeeDocumentRecord[]>(`/api/employees/${employeeId}/documents`);
}

export async function uploadEmployeeDocument(payload: {
  employeeId: string;
  type: EmployeeDocumentType;
  title: string;
  notes?: string;
  file: File;
}) {
  const formData = new FormData();
  formData.set("type", payload.type);
  formData.set("title", payload.title);
  formData.set("notes", payload.notes ?? "");
  formData.set("file", payload.file);
  return apiPostForm<EmployeeDocumentRecord>(`/api/employees/${payload.employeeId}/documents`, formData);
}

export async function deleteEmployeeDocument(employeeId: string, documentId: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/employees/${employeeId}/documents/${documentId}`);
}

export async function getCompensationProfiles() {
  return apiFetch<CompensationProfileRecord[]>("/api/compensation-profiles");
}

export async function createCompensationProfile(payload: Omit<CompensationProfileRecord, "id">) {
  return apiPostJson<CompensationProfileRecord>("/api/compensation-profiles", payload);
}

export async function updateCompensationProfile(id: string, payload: Partial<Omit<CompensationProfileRecord, "id">>) {
  return apiPatchJson<CompensationProfileRecord>(`/api/compensation-profiles/${id}`, payload);
}

export async function deleteCompensationProfile(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/compensation-profiles/${id}`);
}

export async function getTaxProfiles() {
  return apiFetch<TaxProfileRecord[]>("/api/tax-profiles");
}

export async function createTaxProfile(payload: Omit<TaxProfileRecord, "id">) {
  return apiPostJson<TaxProfileRecord>("/api/tax-profiles", payload);
}

export async function updateTaxProfile(id: string, payload: Partial<Omit<TaxProfileRecord, "id">>) {
  return apiPatchJson<TaxProfileRecord>(`/api/tax-profiles/${id}`, payload);
}

export async function deleteTaxProfile(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/tax-profiles/${id}`);
}

export async function getPayrollComponents() {
  return apiFetch<PayrollComponentRecord[]>("/api/payroll/components");
}

export async function createPayrollComponent(payload: {
  code: string;
  name: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  amount: number;
  percentage?: number | null;
  taxable: boolean;
  active: boolean;
  appliesToAll: boolean;
  employeeIds?: string[];
  description: string;
}) {
  return apiPostJson<PayrollComponentRecord>("/api/payroll/components", payload);
}

export async function updatePayrollComponent(id: string, payload: Partial<Omit<PayrollComponentRecord, "id">>) {
  return apiPatchJson<PayrollComponentRecord>(`/api/payroll/components/${id}`, payload);
}

export async function deletePayrollComponent(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/payroll/components/${id}`);
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


export async function getAttendanceOvertime() {
  return apiFetch<OvertimeRecord[]>("/api/attendance/overtime");
}

export async function createOvertimeRequest(payload: {
  userId: string;
  employeeName: string;
  department: string;
  date: string;
  minutes: number;
  reason: string;
}) {
  return apiPostJson<OvertimeRecord>("/api/attendance/overtime", payload);
}

export async function createCheckIn(payload: {
  userId: string;
  employeeName: string;
  department: string;
  location: string;
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
  status: "approved" | "rejected";
  actor: string;
}) {
  return apiPostJson<LeaveRecord>("/api/leave/approve", payload);
}

export async function getReimbursementClaimTypes() {
  return apiFetch<ReimbursementClaimTypeRecord[]>("/api/reimbursement/claims");
}

export async function createReimbursementClaimType(payload: Omit<ReimbursementClaimTypeRecord, "id" | "createdAt" | "updatedAt">) {
  return apiPostJson<ReimbursementClaimTypeRecord>("/api/reimbursement/claims", payload);
}

export async function updateReimbursementClaimType(id: string, payload: Partial<Omit<ReimbursementClaimTypeRecord, "id" | "createdAt" | "updatedAt">>) {
  return apiPatchJson<ReimbursementClaimTypeRecord>(`/api/reimbursement/claims/${id}`, payload);
}

export async function deleteReimbursementClaimType(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/reimbursement/claims/${id}`);
}

export async function getReimbursementRequests() {
  return apiFetch<ReimbursementRequestRecord[]>("/api/reimbursement/requests");
}

export async function createReimbursementRequest(payload: {
  userId: string;
  employeeName: string;
  department: string;
  designation: string;
  claimTypeId: string;
  currency: string;
  amount: number;
  receiptDate: string;
  remarks?: string;
  submit: boolean;
  receipt?: File | null;
}) {
  const formData = new FormData();
  formData.set("userId", payload.userId);
  formData.set("employeeName", payload.employeeName);
  formData.set("department", payload.department);
  formData.set("designation", payload.designation);
  formData.set("claimTypeId", payload.claimTypeId);
  formData.set("currency", payload.currency);
  formData.set("amount", String(payload.amount));
  formData.set("receiptDate", payload.receiptDate);
  formData.set("remarks", payload.remarks ?? "");
  formData.set("submit", String(payload.submit));
  if (payload.receipt) {
    formData.set("receipt", payload.receipt);
  }
  return apiPostForm<ReimbursementRequestRecord>("/api/reimbursement/requests", formData);
}

export async function updateReimbursementRequest(payload: {
  reimbursementId: string;
  claimTypeId?: string;
  currency?: string;
  amount?: number;
  receiptDate?: string;
  remarks?: string;
  submit?: boolean;
  receipt?: File | null;
}) {
  const formData = new FormData();
  if (payload.claimTypeId !== undefined) {
    formData.set("claimTypeId", payload.claimTypeId);
  }
  if (payload.currency !== undefined) {
    formData.set("currency", payload.currency);
  }
  if (payload.amount !== undefined) {
    formData.set("amount", String(payload.amount));
  }
  if (payload.receiptDate !== undefined) {
    formData.set("receiptDate", payload.receiptDate);
  }
  if (payload.remarks !== undefined) {
    formData.set("remarks", payload.remarks);
  }
  if (payload.submit !== undefined) {
    formData.set("submit", String(payload.submit));
  }
  if (payload.receipt) {
    formData.set("receipt", payload.receipt);
  }
  const response = await fetch(`${API_BASE}/api/reimbursement/requests/${payload.reimbursementId}`, {
    method: "PATCH",
    body: formData
  });
  return parseResponse<ReimbursementRequestRecord>(response);
}

export async function managerApproveReimbursement(payload: {
  reimbursementId: string;
  status: "approved" | "rejected";
  actor: string;
}) {
  return apiPostJson<ReimbursementRequestRecord>("/api/reimbursement/requests/manager-approve", payload);
}

export async function hrProcessReimbursement(payload: {
  reimbursementId: string;
  status: "approved" | "rejected" | "processed";
  actor: string;
}) {
  return apiPostJson<ReimbursementRequestRecord>("/api/reimbursement/requests/hr-process", payload);
}


export async function approveOvertimeRequest(payload: {
  overtimeId: string;
  status: "approved" | "rejected" | "paid";
  actor: string;
}) {
  return apiPostJson<OvertimeRecord>("/api/attendance/overtime/approve", payload);
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
    id: log.id,
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
    { title: earlyLeave > 0 ? "Early Leave Pattern" : "Attendance Completion Healthy", subtitle: `${earlyLeave} early leave records detected` },
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
      return "Pending Manager";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function formatLeaveType(type: LeaveType) {
  switch (type) {
    case "Leave Request":
      return "Annual Leave";
    case "Annual Leave":
      return "Annual Leave";
    case "Religious Leave":
      return "Religious Leave";
    case "Maternity Leave":
      return "Maternity Leave";
    case "Paternity Leave":
      return "Paternity Leave";
    case "Marriage Leave":
      return "Marriage Leave";
    case "Bereavement Leave":
      return "Bereavement Leave";
    case "Sick Leave":
      return "Sick Submission";
    case "Permission":
      return "Half Day Leave";
    case "Remote Work":
      return "On Duty Request";
    default:
      return type;
  }
}

export function formatOvertimeStatus(status: OvertimeRecord["status"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "paid":
      return "Paid Out";
    case "pending":
      return "Pending Manager";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function formatReimbursementStatus(status: ReimbursementStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending-manager":
      return "Pending Manager";
    case "awaiting-hr":
      return "Awaiting HR";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "processed":
      return "Processed";
    default:
      return status;
  }
}

export function formatReimbursementCategory(category: ReimbursementCategory) {
  switch (category) {
    case "medical":
      return "Medical";
    case "glasses":
      return "Glasses";
    case "maternity":
      return "Maternity";
    case "transport":
      return "Transport";
    case "communication":
      return "Communication";
    case "wellness":
      return "Wellness";
    case "other":
    default:
      return "Other";
  }
}

export function currency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}







