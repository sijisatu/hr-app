export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
};

export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

export type PayrollComponentType = "earning" | "deduction";
export type PayrollCalculationType = "fixed" | "percentage";
export type PayRunStatus = "draft" | "published";
export type PayslipStatus = "draft" | "published";

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

export type PayrollOverview = {
  latestRun: PayRunRecord | null;
  payrollComponents: number;
  activeEmployees: number;
  draftRuns: number;
  publishedPayslips: number;
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

function toQueryString(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) {
    return "";
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function apiPatchJson<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

export function getPayrollOverview() {
  return apiFetch<PayrollOverview>("/api/payroll/overview");
}

export function getPayrollComponents() {
  return apiFetch<PayrollComponentRecord[]>("/api/payroll/components");
}

export function createPayrollComponent(payload: {
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

export function updatePayrollComponent(id: string, payload: Partial<Omit<PayrollComponentRecord, "id" | "code">>) {
  return apiPatchJson<PayrollComponentRecord>(`/api/payroll/components/${id}`, payload);
}

export function getPayRuns() {
  return apiFetch<PayRunRecord[]>("/api/payroll/runs");
}

export function generatePayrollRun(payload: { periodLabel: string; periodStart: string; periodEnd: string; payDate: string }) {
  return apiPostJson<{ payRun: PayRunRecord; payslips: PayslipRecord[] }>("/api/payroll/runs", payload);
}

export function publishPayrollRun(payRunId: string) {
  return apiPostJson<PayRunRecord>("/api/payroll/runs/publish", { payRunId });
}

export function getPayslips(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return apiFetch<PayslipRecord[]>(`/api/payroll/payslips${query}`);
}

export function getPayslipsPage(query: { userId?: string; page?: number; pageSize?: number; search?: string; status?: PayslipStatus }) {
  return apiFetch<PaginatedList<PayslipRecord>>(`/api/payroll/payslips${toQueryString(query)}`);
}

export async function exportPayslip(payslipId: string) {
  const job = await apiPostJson<{ jobId: string; status: "queued" | "processing" }>("/api/payroll/payslips/export", { payslipId });
  const startedAt = Date.now();

  while (Date.now() - startedAt < 90_000) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const status = await apiFetch<{
      jobId: string;
      status: "queued" | "processing" | "done" | "failed";
      fileName: string | null;
      fileUrl: string | null;
      payslipId: string | null;
      error: string | null;
    }>(`/api/payroll/payslips/export/status?jobId=${encodeURIComponent(job.jobId)}`);

    if (status.status === "done" && status.fileName && status.fileUrl && status.payslipId) {
      return { fileName: status.fileName, fileUrl: status.fileUrl, payslipId: status.payslipId };
    }
    if (status.status === "failed") {
      throw new Error(status.error || "Gagal generate payslip export.");
    }
  }

  throw new Error("Export payslip timeout. Silakan coba lagi.");
}

export function money(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

export function toAssetUrl(fileUrl: string | null) {
  if (!fileUrl) {
    return null;
  }
  return `${API_BASE}${fileUrl}`;
}
