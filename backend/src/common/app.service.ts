import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { DatabaseService } from "./database.service";
import { EmployeeSessionPayload } from "./auth.types";
import type { AuthenticatedActor } from "./authz";
import { hashPassword, isPasswordHash, verifyPassword } from "./password.service";
import { seedData } from "../data/seed";
import {
  AttendanceRecord,
  CompensationProfileRecord,
  DepartmentRecord,
  DatabaseShape,
  EducationRecord,
  EmployeeDocumentRecord,
  EmployeeRecord,
  LeaveRecord,
  LeaveType,
  OvertimeRecord,
  PayRunRecord,
  PayslipLineItem,
  PayslipRecord,
  PayrollComponentRecord,
  ReimbursementClaimTypeRecord,
  ReimbursementRequestRecord,
  TaxProfileRecord,
  WorkExperienceRecord
} from "./types";
import {
  AttendanceHistoryQueryDto,
  CheckInDto,
  CheckOutDto,
  ChangePasswordDto,
  CreateCompensationProfileDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateExportDto,
  EmployeeListQueryDto,
  CreateOvertimeDto,
  PayslipListQueryDto,
  ReimbursementRequestListQueryDto,
  CreatePayrollComponentDto,
  CreateReimbursementClaimTypeDto,
  CreateReimbursementRequestDto,
  CreateTaxProfileDto,
  OvertimeApproveDto,
  ExportPayslipDto,
  GeneratePayrollRunDto,
  LeaveApproveDto,
  LeaveRequestDto,
  PublishPayrollRunDto,
  ReimbursementApproveDto,
  ReimbursementProcessDto,
  ResetEmployeePasswordDto,
  UploadEmployeeDocumentDto,
  UpdateCompensationProfileDto,
  UpdateDepartmentDto,
  UpdateReimbursementClaimTypeDto,
  UpdateReimbursementRequestDto,
  UpdateTaxProfileDto,
  UpdateEmployeeDto,
  UpdatePayrollComponentDto
} from "./dtos";

type SiteConfig = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

const siteDirectory: Record<string, SiteConfig> = {
  "Jakarta HQ": { latitude: -6.2, longitude: 106.816666, radiusMeters: 150 },
  "Bandung Hub": { latitude: -6.917464, longitude: 107.619123, radiusMeters: 150 },
  "Surabaya Office": { latitude: -7.257472, longitude: 112.752088, radiusMeters: 150 },
  "Remote - Yogyakarta": { latitude: -7.797068, longitude: 110.370529, radiusMeters: 500 }
};

const NON_SHIFT_START = "09:00";
const NON_SHIFT_END = "17:00";
const currentBalanceYear = new Date().getFullYear();
const carryOverTypes = ["annual", "religious", "maternity", "paternity", "marriage", "bereavement", "permission"] as const;
const defaultLeaveAllocations = {
  annual: 12,
  religious: 2,
  maternity: 90,
  paternity: 2,
  marriage: 3,
  bereavement: 2,
  permission: 4
} as const;

type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

type ExportJobStatus = "queued" | "processing" | "done" | "failed";
type ExportJobPayload = { type: "report"; payload: CreateExportDto } | { type: "payslip"; payload: ExportPayslipDto };
type ExportJobResult = { fileName: string; fileUrl: string; payslipId?: string };
type ExportJob = {
  id: string;
  status: ExportJobStatus;
  createdAt: string;
  updatedAt: string;
  payload: ExportJobPayload;
  result: ExportJobResult | null;
  error: string | null;
};

@Injectable()
export class AppService {
  private readonly storageRoot = path.resolve(process.cwd(), "storage");
  private readonly dbPath = path.join(this.storageRoot, "data.json");
  private readonly auditLogPath = path.join(this.storageRoot, "audit.log");
  private readonly isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
  private readonly useDemoSeedData =
    (process.env.BOOTSTRAP_DEMO_DATA ?? "").toLowerCase() === "true" ||
    (!this.isProduction && (process.env.BOOTSTRAP_DEMO_DATA ?? "").toLowerCase() !== "false");
  private cache: DatabaseShape | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private auditQueue: Promise<void> = Promise.resolve();
  private exportQueue: ExportJob[] = [];
  private activeExportJob = false;

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await mkdir(this.storageRoot, { recursive: true });
    await Promise.all([
      mkdir(path.join(this.storageRoot, "attendance-selfies"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "documents"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "documents", "employee-files"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "exports"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "leave"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "leave", "supporting-documents"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "reimbursements"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "reimbursements", "receipts"), { recursive: true })
    ]);

    if (!existsSync(this.dbPath)) {
      const initialSnapshot = this.useDemoSeedData ? seedData : this.createEmptyDatabaseSnapshot();
      await writeFile(this.dbPath, JSON.stringify(initialSnapshot, null, 2), "utf8");
    }

    const current = await this.readDb();
    current.departments = this.normalizeDepartments(current.departments, current.employees);
    current.employees = current.employees.map((employee, index) => this.normalizeEmployee(employee, index));
    current.attendanceLogs = (current.attendanceLogs ?? []).map((attendance, index) => this.normalizeAttendance(attendance, current.employees, index));
    current.overtimeRequests = (current.overtimeRequests?.length ? current.overtimeRequests : this.useDemoSeedData ? seedData.overtimeRequests : []).map((record, index) => this.normalizeOvertime(record, index));
    current.leaveRequests = (current.leaveRequests ?? []).map((record, index) => this.normalizeLeave(record, current.employees, index));
    current.reimbursementClaimTypes = (current.reimbursementClaimTypes?.length ? current.reimbursementClaimTypes : this.useDemoSeedData ? seedData.reimbursementClaimTypes : []).map((record, index) => this.normalizeReimbursementClaimType(record, current.employees, index));
    current.reimbursementRequests = (current.reimbursementRequests?.length ? current.reimbursementRequests : this.useDemoSeedData ? seedData.reimbursementRequests : []).map((record, index) => this.normalizeReimbursementRequest(record, current.employees, current.reimbursementClaimTypes, index));
    current.compensationProfiles = (current.compensationProfiles?.length ? current.compensationProfiles : this.useDemoSeedData ? seedData.compensationProfiles : []).map((profile, index) => this.normalizeCompensationProfile(profile, index));
    current.taxProfiles = (current.taxProfiles?.length ? current.taxProfiles : this.useDemoSeedData ? seedData.taxProfiles : []).map((profile, index) => this.normalizeTaxProfile(profile, index));
    current.payrollComponents = (current.payrollComponents?.length ? current.payrollComponents : this.useDemoSeedData ? seedData.payrollComponents : []).map((component, index) => this.normalizePayrollComponent(component, index));
    current.payRuns = (current.payRuns?.length ? current.payRuns : this.useDemoSeedData ? seedData.payRuns : []).map((run, index) => this.normalizePayRun(run, index));
    current.payslips = (current.payslips?.length ? current.payslips : this.useDemoSeedData ? seedData.payslips : []).map((slip, index) => this.normalizePayslip(slip, current.employees, index));
    await this.ensureEmployeePasswordsHashed(current);
    await this.writeDb(current);
  }

  private createEmptyDatabaseSnapshot(): DatabaseShape {
    return {
      departments: [],
      employees: [],
      attendanceLogs: [],
      overtimeRequests: [],
      leaveRequests: [],
      reimbursementClaimTypes: [],
      reimbursementRequests: [],
      compensationProfiles: [],
      taxProfiles: [],
      payrollComponents: [],
      payRuns: [],
      payslips: []
    };
  }

  private normalizeDepartment(
    record: Partial<DepartmentRecord> & Record<string, unknown>,
    index: number
  ): DepartmentRecord {
    return {
      id: String(record.id ?? `dept-${String(index + 1).padStart(3, "0")}`),
      name: String(record.name ?? `Department ${index + 1}`),
      active: Boolean(record.active ?? true),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? new Date().toISOString())
    };
  }

  private normalizeDepartments(rawDepartments: unknown, employees: EmployeeRecord[]) {
    const base = Array.isArray(rawDepartments)
      ? (rawDepartments as Array<Partial<DepartmentRecord> & Record<string, unknown>>)
      : [];
    const normalized = base.map((record, index) => this.normalizeDepartment(record, index));
    const names = new Set(normalized.map((entry) => entry.name.trim().toLowerCase()));
    const inferred = Array.from(new Set(
      employees
        .map((entry) => entry.department.trim())
        .filter((entry) => entry.length > 0)
    ));
    for (const name of inferred) {
      if (names.has(name.toLowerCase())) {
        continue;
      }
      normalized.push({
        id: `dept-${randomUUID().slice(0, 8)}`,
        name,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    return normalized.sort((a, b) => a.name.localeCompare(b.name));
  }

  private normalizeEmployee(employee: Partial<EmployeeRecord> & Record<string, unknown>, index: number): EmployeeRecord {
    const padded = String(index + 1).padStart(3, "0");
    const leaveBalances = this.normalizeLeaveBalances(employee.leaveBalances as Partial<EmployeeRecord["leaveBalances"]> | undefined);
    const educationHistory = Array.isArray(employee.educationHistory) ? employee.educationHistory as EducationRecord[] : [];
    const workExperiences = Array.isArray(employee.workExperiences) ? employee.workExperiences as WorkExperienceRecord[] : [];
    const documents = Array.isArray(employee.documents) ? employee.documents as EmployeeDocumentRecord[] : [];
    return {
      id: String(employee.id ?? `emp-${padded}`),
      employeeNumber: String(employee.employeeNumber ?? `EMP-2024-${padded}`),
      nik: String(employee.nik ?? `PRX-${padded}`),
      name: String(employee.name ?? "Unnamed Employee"),
      email: String(employee.email ?? `employee${padded}@praluxstd.com`),
      birthPlace: String(employee.birthPlace ?? "Jakarta"),
      birthDate: String(employee.birthDate ?? "1995-01-01"),
      gender: (employee.gender as EmployeeRecord["gender"]) ?? "male",
      maritalStatus: (employee.maritalStatus as EmployeeRecord["maritalStatus"]) ?? "single",
      marriageDate: employee.marriageDate == null ? null : String(employee.marriageDate),
      address: String(employee.address ?? "Alamat belum diisi"),
      idCardNumber: String(employee.idCardNumber ?? `3171${padded}0000000000`),
      education: String(employee.education ?? "Belum ada data pendidikan"),
      workExperience: String(employee.workExperience ?? "Belum ada data pengalaman kerja"),
      educationHistory: educationHistory.length > 0 ? educationHistory.map((entry) => ({
        level: String(entry.level ?? "Education"),
        institution: String(entry.institution ?? "-"),
        major: String(entry.major ?? "-"),
        startYear: String(entry.startYear ?? ""),
        endYear: String(entry.endYear ?? "")
      })) : [{ level: "Education", institution: String(employee.education ?? "-"), major: "-", startYear: "", endYear: "" }],
      workExperiences: workExperiences.length > 0 ? workExperiences.map((entry) => ({
        company: String(entry.company ?? "-"),
        role: String(entry.role ?? "-"),
        startDate: String(entry.startDate ?? ""),
        endDate: String(entry.endDate ?? ""),
        description: String(entry.description ?? "-")
      })) : [{ company: "-", role: String(employee.workExperience ?? "-"), startDate: "", endDate: "", description: String(employee.workExperience ?? "-") }],
      department: String(employee.department ?? "General Operations"),
      position: String(employee.position ?? "Staff"),
      role: (employee.role as EmployeeRecord["role"]) ?? "employee",
      status: (employee.status as EmployeeRecord["status"]) ?? "active",
      phone: String(employee.phone ?? "-"),
      joinDate: String(employee.joinDate ?? new Date().toISOString().slice(0, 10)),
      workLocation: String(employee.workLocation ?? "Jakarta HQ"),
      workType: (employee.workType as EmployeeRecord["workType"]) ?? "onsite",
      managerName: String(employee.managerName ?? "HR Lead"),
      employmentType: (employee.employmentType as EmployeeRecord["employmentType"]) ?? "permanent",
      contractStatus: (employee.contractStatus as EmployeeRecord["contractStatus"]) ?? "permanent",
      contractStart: String(employee.contractStart ?? employee.joinDate ?? new Date().toISOString().slice(0, 10)),
      contractEnd: employee.contractEnd == null ? null : String(employee.contractEnd),
      baseSalary: Number(employee.baseSalary ?? 12000000),
      allowance: Number(employee.allowance ?? 1000000),
      positionSalaryId: employee.positionSalaryId == null ? null : String(employee.positionSalaryId),
      financialComponentIds: Array.isArray(employee.financialComponentIds) ? employee.financialComponentIds.map((entry) => String(entry)) : [],
      taxProfileId: employee.taxProfileId == null ? null : String(employee.taxProfileId),
      taxProfile: String(employee.taxProfile ?? "PPh 21 TK/0"),
      bankName: String(employee.bankName ?? "BCA"),
      bankAccountMasked: String(employee.bankAccountMasked ?? "***0000"),
      appLoginEnabled: Boolean(employee.appLoginEnabled ?? true),
      loginUsername: employee.loginUsername == null ? String(employee.nik ?? `PRX-${padded}`) : String(employee.loginUsername),
      loginPassword: employee.loginPassword == null ? "employee123" : String(employee.loginPassword),
      documents: documents.map((entry, documentIndex) => ({
        id: String(entry.id ?? `doc-${padded}-${documentIndex + 1}`),
        employeeId: String(entry.employeeId ?? employee.id ?? `emp-${padded}`),
        type: (entry.type as EmployeeDocumentRecord["type"]) ?? "lainnya",
        title: String(entry.title ?? "Employee Document"),
        fileName: String(entry.fileName ?? "document.bin"),
        fileUrl: String(entry.fileUrl ?? `/storage/documents/employee-files/${employee.id ?? `emp-${padded}`}/document.bin`),
        uploadedAt: String(entry.uploadedAt ?? new Date().toISOString()),
        notes: String(entry.notes ?? "")
      })),
      leaveBalances
    };
  }

  private normalizeCompensationProfile(profile: Partial<CompensationProfileRecord> & Record<string, unknown>, index: number): CompensationProfileRecord {
    return {
      id: String(profile.id ?? `comp-${String(index + 1).padStart(3, "0")}`),
      position: String(profile.position ?? `Position ${index + 1}`),
      baseSalary: Number(profile.baseSalary ?? 0),
      active: Boolean(profile.active ?? true),
      notes: String(profile.notes ?? "Compensation profile")
    };
  }

  private normalizeTaxProfile(profile: Partial<TaxProfileRecord> & Record<string, unknown>, index: number): TaxProfileRecord {
    return {
      id: String(profile.id ?? `tax-${String(index + 1).padStart(3, "0")}`),
      name: String(profile.name ?? `Tax Profile ${index + 1}`),
      rate: Number(profile.rate ?? 5),
      active: Boolean(profile.active ?? true),
      description: String(profile.description ?? "Tax profile")
    };
  }

  private normalizeAttendance(attendance: Partial<AttendanceRecord> & Record<string, unknown>, employees: EmployeeRecord[], index: number): AttendanceRecord {
    const employee = employees.find((entry) => entry.id === String(attendance.userId ?? ""));
    const location = String(attendance.location ?? employee?.workLocation ?? "Jakarta HQ");
    
    const latitude = Number(attendance.latitude ?? siteDirectory[location]?.latitude ?? -6.2);
    const longitude = Number(attendance.longitude ?? siteDirectory[location]?.longitude ?? 106.816666);
    const gpsDistanceMeters = Number(attendance.gpsDistanceMeters ?? this.measureDistanceMeters(location, latitude, longitude));
    return {
      id: String(attendance.id ?? `att-${String(index + 1).padStart(3, "0")}`),
      userId: String(attendance.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(attendance.employeeName ?? employee?.name ?? "Unknown Employee"),
      department: String(attendance.department ?? employee?.department ?? "General Operations"),
      timestamp: String(attendance.timestamp ?? new Date().toISOString()),
      checkIn: String(attendance.checkIn ?? NON_SHIFT_START),
      checkOut: attendance.checkOut == null ? null : String(attendance.checkOut),
      location,
      latitude,
      longitude,
      description: String(attendance.description ?? "Regular attendance check-in"),
      gpsValidated: typeof attendance.gpsValidated === "boolean" ? attendance.gpsValidated : gpsDistanceMeters <= this.getRadius(location),
      gpsDistanceMeters,
      photoUrl: attendance.photoUrl == null ? null : String(attendance.photoUrl),
      status: (attendance.status as AttendanceRecord["status"]) ?? "on-time",
      overtimeMinutes: Number(attendance.overtimeMinutes ?? 0)
    };
  }

  private normalizeOvertime(record: Partial<OvertimeRecord> & Record<string, unknown>, index: number): OvertimeRecord {
    return {
      id: String(record.id ?? `ot-${String(index + 1).padStart(3, "0")}`),
      userId: String(record.userId ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(record.employeeName ?? "Unknown Employee"),
      department: String(record.department ?? "General Operations"),
      date: String(record.date ?? new Date().toISOString().slice(0, 10)),
      minutes: Number(record.minutes ?? 0),
      reason: String(record.reason ?? "Operational support"),
      status: (record.status as OvertimeRecord["status"]) ?? "pending"
    };
  }

  private normalizeLeave(record: Partial<LeaveRecord> & Record<string, unknown>, employees: EmployeeRecord[], index: number): LeaveRecord {
    const employee = employees.find((entry) => entry.id === String(record.userId ?? ""));
    const rawType = (record.type as LeaveType | undefined) ?? "Leave Request";
    const type: LeaveType = rawType === "Leave Request" ? "Annual Leave" : rawType;
    const startDate = String(record.startDate ?? new Date().toISOString().slice(0, 10));
    const endDate = String(record.endDate ?? new Date().toISOString().slice(0, 10));
    const daysRequested = Number(record.daysRequested ?? this.getRequestedDays(type, startDate, endDate));
    return {
      id: String(record.id ?? `leave-${String(index + 1).padStart(3, "0")}`),
      userId: String(record.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(record.employeeName ?? employee?.name ?? "Unknown Employee"),
      type,
      startDate,
      endDate,
      reason: String(record.reason ?? "Operational request"),
      status: (record.status as LeaveRecord["status"]) ?? "pending-manager",
      approverFlow: Array.isArray(record.approverFlow) ? record.approverFlow.map((entry) => String(entry)) : ["Manager Pending", "HR Pending"],
      balanceLabel: String(record.balanceLabel ?? this.describeBalance(employee, type, daysRequested)),
      requestedAt: String(record.requestedAt ?? new Date().toISOString()),
      daysRequested,
      autoApproved: Boolean(record.autoApproved ?? false),
      supportingDocumentName: record.supportingDocumentName == null ? null : String(record.supportingDocumentName),
      supportingDocumentUrl: record.supportingDocumentUrl == null ? null : String(record.supportingDocumentUrl)
    };
  }

  private normalizePayrollComponent(component: Partial<PayrollComponentRecord> & Record<string, unknown>, index: number): PayrollComponentRecord {
    return {
      id: String(component.id ?? `paycomp-${String(index + 1).padStart(3, "0")}`),
      code: String(component.code ?? `COMP-${String(index + 1).padStart(3, "0")}`),
      name: String(component.name ?? `Component ${index + 1}`),
      type: (component.type as PayrollComponentRecord["type"]) ?? "earning",
      calculationType: (component.calculationType as PayrollComponentRecord["calculationType"]) ?? "fixed",
      amount: Number(component.amount ?? 0),
      percentage: component.percentage == null ? null : Number(component.percentage),
      taxable: Boolean(component.taxable ?? true),
      active: Boolean(component.active ?? true),
      appliesToAll: Boolean(component.appliesToAll ?? true),
      employeeIds: Array.isArray(component.employeeIds) ? component.employeeIds.map((entry) => String(entry)) : [],
      description: String(component.description ?? "Payroll component")
    };
  }
  private normalizePayRun(run: Partial<PayRunRecord> & Record<string, unknown>, index: number): PayRunRecord {
    return {
      id: String(run.id ?? `payrun-${String(index + 1).padStart(3, "0")}`),
      periodLabel: String(run.periodLabel ?? `Payroll ${index + 1}`),
      periodStart: String(run.periodStart ?? new Date().toISOString().slice(0, 10)),
      periodEnd: String(run.periodEnd ?? new Date().toISOString().slice(0, 10)),
      payDate: String(run.payDate ?? new Date().toISOString().slice(0, 10)),
      status: (run.status as PayRunRecord["status"]) ?? "draft",
      totalGross: Number(run.totalGross ?? 0),
      totalNet: Number(run.totalNet ?? 0),
      totalTax: Number(run.totalTax ?? 0),
      employeeCount: Number(run.employeeCount ?? 0),
      createdAt: String(run.createdAt ?? new Date().toISOString()),
      publishedAt: run.publishedAt == null ? null : String(run.publishedAt)
    };
  }

  private normalizePayslip(slip: Partial<PayslipRecord> & Record<string, unknown>, employees: EmployeeRecord[], index: number): PayslipRecord {
    const employee = employees.find((entry) => entry.id === String(slip.userId ?? ""));
    return {
      id: String(slip.id ?? `payslip-${String(index + 1).padStart(3, "0")}`),
      payRunId: String(slip.payRunId ?? "payrun-seed"),
      userId: String(slip.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(slip.employeeName ?? employee?.name ?? "Unknown Employee"),
      employeeNumber: String(slip.employeeNumber ?? employee?.employeeNumber ?? `EMP-2024-${String(index + 1).padStart(3, "0")}`),
      department: String(slip.department ?? employee?.department ?? "General Operations"),
      position: String(slip.position ?? employee?.position ?? "Staff"),
      periodLabel: String(slip.periodLabel ?? "Current Payroll"),
      periodStart: String(slip.periodStart ?? new Date().toISOString().slice(0, 10)),
      periodEnd: String(slip.periodEnd ?? new Date().toISOString().slice(0, 10)),
      payDate: String(slip.payDate ?? new Date().toISOString().slice(0, 10)),
      status: (slip.status as PayslipRecord["status"]) ?? "draft",
      baseSalary: Number(slip.baseSalary ?? employee?.baseSalary ?? 0),
      allowance: Number(slip.allowance ?? employee?.allowance ?? 0),
      overtimePay: Number(slip.overtimePay ?? 0),
      additionalEarnings: Number(slip.additionalEarnings ?? 0),
      grossPay: Number(slip.grossPay ?? 0),
      taxDeduction: Number(slip.taxDeduction ?? 0),
      otherDeductions: Number(slip.otherDeductions ?? 0),
      netPay: Number(slip.netPay ?? 0),
      bankName: String(slip.bankName ?? employee?.bankName ?? "BCA"),
      bankAccountMasked: String(slip.bankAccountMasked ?? employee?.bankAccountMasked ?? "***0000"),
      taxProfile: String(slip.taxProfile ?? employee?.taxProfile ?? "PPh 21 TK/0"),
      components: Array.isArray(slip.components)
        ? slip.components.map((entry, componentIndex) => this.normalizePayslipLine(entry as Partial<PayslipLineItem> & Record<string, unknown>, componentIndex))
        : [],
      generatedFileUrl: slip.generatedFileUrl == null ? null : String(slip.generatedFileUrl)
    };
  }

  private normalizePayslipLine(line: Partial<PayslipLineItem> & Record<string, unknown>, index: number): PayslipLineItem {
    return {
      code: String(line.code ?? `LINE-${index + 1}`),
      name: String(line.name ?? `Line ${index + 1}`),
      type: (line.type as PayslipLineItem["type"]) ?? "earning",
      amount: Number(line.amount ?? 0),
      taxable: Boolean(line.taxable ?? true),
      source: (line.source as PayslipLineItem["source"]) ?? "component"
    };
  }

  private normalizeReimbursementClaimType(
    record: Partial<ReimbursementClaimTypeRecord> & Record<string, unknown>,
    employees: EmployeeRecord[],
    index: number
  ): ReimbursementClaimTypeRecord {
    const employee = employees.find((entry) => entry.id === String(record.employeeId ?? ""));
    const annualLimit = Number(record.annualLimit ?? 0);
    const remainingBalance = Number(record.remainingBalance ?? annualLimit);

    return {
      id: String(record.id ?? `claim-${String(index + 1).padStart(3, "0")}`),
      employeeId: String(record.employeeId ?? employee?.id ?? ""),
      employeeName: String(record.employeeName ?? employee?.name ?? "Unknown Employee"),
      department: String(record.department ?? employee?.department ?? "General Operations"),
      designation: String(record.designation ?? employee?.position ?? "Staff"),
      category: (record.category as ReimbursementClaimTypeRecord["category"]) ?? "other",
      claimType: String(record.claimType ?? "General Reimbursement"),
      subType: String(record.subType ?? "General"),
      currency: String(record.currency ?? "IDR"),
      annualLimit,
      remainingBalance,
      active: Boolean(record.active ?? true),
      notes: String(record.notes ?? ""),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString())
    };
  }

  private normalizeReimbursementRequest(
    record: Partial<ReimbursementRequestRecord> & Record<string, unknown>,
    employees: EmployeeRecord[],
    claimTypes: ReimbursementClaimTypeRecord[],
    index: number
  ): ReimbursementRequestRecord {
    const employee = employees.find((entry) => entry.id === String(record.userId ?? ""));
    const claimType = claimTypes.find((entry) => entry.id === String(record.claimTypeId ?? ""));

    return {
      id: String(record.id ?? `reimb-${String(index + 1).padStart(3, "0")}`),
      userId: String(record.userId ?? employee?.id ?? ""),
      employeeName: String(record.employeeName ?? employee?.name ?? "Unknown Employee"),
      department: String(record.department ?? employee?.department ?? "General Operations"),
      designation: String(record.designation ?? employee?.position ?? "Staff"),
      claimTypeId: String(record.claimTypeId ?? claimType?.id ?? ""),
      claimType: String(record.claimType ?? claimType?.claimType ?? "General Reimbursement"),
      subType: String(record.subType ?? claimType?.subType ?? "General"),
      category: (record.category as ReimbursementRequestRecord["category"]) ?? claimType?.category ?? "other",
      currency: String(record.currency ?? claimType?.currency ?? "IDR"),
      amount: Number(record.amount ?? 0),
      receiptDate: String(record.receiptDate ?? new Date().toISOString().slice(0, 10)),
      remarks: String(record.remarks ?? ""),
      receiptFileName: record.receiptFileName == null ? null : String(record.receiptFileName),
      receiptFileUrl: record.receiptFileUrl == null ? null : String(record.receiptFileUrl),
      status: (record.status as ReimbursementRequestRecord["status"]) ?? "draft",
      submittedAt: record.submittedAt == null ? null : String(record.submittedAt),
      approvedAt: record.approvedAt == null ? null : String(record.approvedAt),
      processedAt: record.processedAt == null ? null : String(record.processedAt),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
      approverFlow: Array.isArray(record.approverFlow) ? record.approverFlow.map((entry) => String(entry)) : [],
      balanceSnapshot: Number(record.balanceSnapshot ?? claimType?.remainingBalance ?? 0)
    };
  }

  private async readDb() {
    const prisma = this.getPrisma();
    if (!prisma && this.cache) {
      return this.cache;
    }
    if (prisma) {
      const [
        departments,
        employees,
        attendanceLogs,
        overtimeRequests,
        leaveRequests,
        reimbursementClaimTypes,
        reimbursementRequests,
        compensationProfiles,
        taxProfiles,
        payrollComponents,
        payRuns,
        payslips
      ] = await Promise.all([
        prisma.department.findMany({ orderBy: { name: "asc" } }),
        prisma.employee.findMany({ orderBy: { name: "asc" } }),
        prisma.attendanceLog.findMany({ orderBy: { timestamp: "desc" } }),
        prisma.overtimeRequest.findMany({ orderBy: { date: "desc" } }),
        prisma.leaveRequest.findMany({ orderBy: { requestedAt: "desc" } }),
        prisma.reimbursementClaimType.findMany({ orderBy: { updatedAt: "desc" } }),
        prisma.reimbursementRequest.findMany({ orderBy: { updatedAt: "desc" } }),
        prisma.compensationProfile.findMany({ orderBy: { position: "asc" } }),
        prisma.taxProfile.findMany({ orderBy: { name: "asc" } }),
        prisma.payrollComponent.findMany({ orderBy: { code: "asc" } }),
        prisma.payRun.findMany({ orderBy: { periodEnd: "desc" } }),
        prisma.payslip.findMany({ orderBy: { payDate: "desc" } })
      ]);

      this.cache = {
        departments: departments.map((record: any) => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
        employees: employees.map((employee: any) => ({
          ...employee,
          birthDate: this.toDateString(employee.birthDate),
          marriageDate: employee.marriageDate ? this.toDateString(employee.marriageDate) : null,
          joinDate: this.toDateString(employee.joinDate),
          contractStart: this.toDateString(employee.contractStart),
          contractEnd: employee.contractEnd ? this.toDateString(employee.contractEnd) : null,
          baseSalary: Number(employee.baseSalary),
          allowance: Number(employee.allowance),
          educationHistory: Array.isArray(employee.educationHistory) ? employee.educationHistory : [],
          workExperiences: Array.isArray(employee.workExperiences) ? employee.workExperiences : [],
          financialComponentIds: Array.isArray(employee.financialComponentIds) ? employee.financialComponentIds : [],
          documents: Array.isArray(employee.documents) ? employee.documents : [],
          leaveBalances: employee.leaveBalances ?? this.normalizeLeaveBalances()
        })),
        attendanceLogs: attendanceLogs.map((record: any) => ({
          ...record,
          timestamp: this.toIsoString(record.timestamp),
          latitude: Number(record.latitude),
          longitude: Number(record.longitude),
          gpsDistanceMeters: Number(record.gpsDistanceMeters)
        })),
        overtimeRequests: overtimeRequests.map((record: any) => ({
          ...record,
          date: this.toDateString(record.date),
          minutes: Number(record.minutes)
        })),
        leaveRequests: leaveRequests.map((record: any) => ({
          ...record,
          startDate: this.toDateString(record.startDate),
          endDate: this.toDateString(record.endDate),
          requestedAt: this.toIsoString(record.requestedAt),
          daysRequested: Number(record.daysRequested),
          supportingDocumentName: record.supportingDocumentName ?? null,
          supportingDocumentUrl: record.supportingDocumentUrl ?? null
        })),
        reimbursementClaimTypes: reimbursementClaimTypes.map((record: any) => ({
          ...record,
          annualLimit: Number(record.annualLimit),
          remainingBalance: Number(record.remainingBalance),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
        reimbursementRequests: reimbursementRequests.map((record: any) => ({
          ...record,
          receiptDate: this.toDateString(record.receiptDate),
          amount: Number(record.amount),
          balanceSnapshot: Number(record.balanceSnapshot),
          submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
          approvedAt: record.approvedAt ? record.approvedAt.toISOString() : null,
          processedAt: record.processedAt ? record.processedAt.toISOString() : null,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
        compensationProfiles: compensationProfiles.map((record: any) => ({
          ...record,
          baseSalary: Number(record.baseSalary)
        })),
        taxProfiles: taxProfiles.map((record: any) => ({
          ...record,
          rate: Number(record.rate)
        })),
        payrollComponents: payrollComponents.map((record: any) => ({
          ...record,
          amount: Number(record.amount),
          percentage: record.percentage == null ? null : Number(record.percentage)
        })),
        payRuns: payRuns.map((record: any) => ({
          ...record,
          periodStart: this.toDateString(record.periodStart),
          periodEnd: this.toDateString(record.periodEnd),
          payDate: this.toDateString(record.payDate),
          totalGross: Number(record.totalGross),
          totalNet: Number(record.totalNet),
          totalTax: Number(record.totalTax),
          createdAt: record.createdAt.toISOString(),
          publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null
        })),
        payslips: payslips.map((record: any) => ({
          ...record,
          periodStart: this.toDateString(record.periodStart),
          periodEnd: this.toDateString(record.periodEnd),
          payDate: this.toDateString(record.payDate),
          baseSalary: Number(record.baseSalary),
          allowance: Number(record.allowance),
          overtimePay: Number(record.overtimePay),
          additionalEarnings: Number(record.additionalEarnings),
          grossPay: Number(record.grossPay),
          taxDeduction: Number(record.taxDeduction),
          otherDeductions: Number(record.otherDeductions),
          netPay: Number(record.netPay),
          components: Array.isArray(record.components) ? record.components : []
        }))
      };

      return this.cache;
    }

    const raw = await readFile(this.dbPath, "utf8");
    this.cache = JSON.parse(raw) as DatabaseShape;
    return this.cache;
  }

  private async writeDb(next: DatabaseShape) {
    this.cache = next;
    const prisma = this.getPrisma();
    if (prisma) {
      const run = this.writeQueue
        .catch(() => undefined)
        .then(() => this.persistSnapshotToDatabase(next));
      this.writeQueue = run.then(() => undefined, () => undefined);
      await run;
      return;
    }

    await writeFile(this.dbPath, JSON.stringify(next, null, 2), "utf8");
  }

  private getPrisma() {
    return this.databaseService.getClient() as any;
  }

  private toDate(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDateOnly(value: string | null | undefined) {
    if (!value) {
      return null;
    }
    const normalized = value.trim();
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00:00.000Z` : normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDateString(value: Date | string | null | undefined) {
    if (!value) {
      return "";
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString().slice(0, 10);
  }

  private toIsoString(value: Date | string | null | undefined) {
    if (!value) {
      return "";
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString();
  }

  private toPageMeta(page?: number, pageSize?: number) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.max(1, Math.min(200, Number(pageSize) || 25));
    return {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      skip: (normalizedPage - 1) * normalizedPageSize
    };
  }

  private paginateArray<T>(items: T[], page?: number, pageSize?: number): PaginatedResult<T> {
    const meta = this.toPageMeta(page, pageSize);
    const total = items.length;
    const paged = items.slice(meta.skip, meta.skip + meta.pageSize);
    return {
      items: paged,
      total,
      page: meta.page,
      pageSize: meta.pageSize,
      hasNext: meta.skip + paged.length < total
    };
  }

  private async getEmployeeRows() {
    const db = await this.readDb();
    return db.employees.map((employee) => this.sanitizeEmployee(employee));
  }

  private sanitizeEmployee(employee: EmployeeRecord) {
    return {
      ...employee,
      documents: employee.documents.map((document) => this.toSafeEmployeeDocument(document)),
      loginPassword: null
    };
  }

  private toSafeEmployeeDocument(document: EmployeeDocumentRecord): EmployeeDocumentRecord {
    return {
      ...document,
      fileUrl: this.buildEmployeeDocumentAssetUrl(document.employeeId, document.id)
    };
  }

  private toSafeAttendanceRecord(record: AttendanceRecord): AttendanceRecord {
    return {
      ...record,
      photoUrl: record.photoUrl ? this.buildAttendanceSelfieAssetUrl(record.id) : null
    };
  }

  private toSafeReimbursementRequest(record: ReimbursementRequestRecord): ReimbursementRequestRecord {
    return {
      ...record,
      receiptFileUrl: record.receiptFileUrl ? this.buildReimbursementReceiptAssetUrl(record.id) : null
    };
  }

  private toSafeLeaveRecord(record: LeaveRecord): LeaveRecord {
    return {
      ...record,
      supportingDocumentUrl: record.supportingDocumentUrl ? this.buildLeaveSupportingDocumentAssetUrl(record.id) : null
    };
  }

  private buildEmployeeDocumentAssetUrl(employeeId: string, documentId: string) {
    return `/api/assets/employees/${employeeId}/documents/${documentId}`;
  }

  private buildAttendanceSelfieAssetUrl(attendanceId: string) {
    return `/api/assets/attendance/${attendanceId}/selfie`;
  }

  private buildReimbursementReceiptAssetUrl(reimbursementId: string) {
    return `/api/assets/reimbursements/${reimbursementId}/receipt`;
  }

  private buildLeaveSupportingDocumentAssetUrl(leaveId: string) {
    return `/api/assets/leave/${leaveId}/supporting-document`;
  }

  private resolveStoragePath(fileUrl: string) {
    return path.join(this.storageRoot, fileUrl.replace(/^\/storage\//, "").replace(/\//g, path.sep));
  }

  private assertSensitiveDocumentAccess(
    actor: AuthenticatedActor | undefined,
    employee: EmployeeRecord | undefined,
    contextLabel: string
  ) {
    if (!actor) {
      throw new ForbiddenException(`Session is required to access ${contextLabel}.`);
    }
    if (actor.role === "admin" || actor.role === "hr") {
      return;
    }
    if (!employee) {
      throw new NotFoundException("Employee not found for document access validation.");
    }
    if (actor.role === "employee" && actor.id === employee.id) {
      return;
    }
    if (actor.role === "manager") {
      this.assertManagerApprovalScope(actor, employee);
      return;
    }
    throw new ForbiddenException(`You are not allowed to access ${contextLabel}.`);
  }

  async getEmployeeDocumentAsset(employeeId: string, documentId: string, actor?: AuthenticatedActor) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    this.assertSensitiveDocumentAccess(actor, employee, "employee documents");

    const document = employee.documents.find((entry) => entry.id === documentId);
    if (!document) {
      throw new NotFoundException("Employee document not found");
    }
    const absolutePath = this.resolveStoragePath(document.fileUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored employee document file not found");
    }
    return {
      absolutePath,
      fileName: document.fileName
    };
  }

  async getAttendanceSelfieAsset(attendanceId: string, actor?: AuthenticatedActor) {
    const db = await this.readDb();
    const attendance = db.attendanceLogs.find((entry) => entry.id === attendanceId);
    if (!attendance) {
      throw new NotFoundException("Attendance record not found");
    }
    if (!attendance.photoUrl) {
      throw new NotFoundException("Attendance selfie not found");
    }
    const employee = db.employees.find((entry) => entry.id === attendance.userId);
    this.assertSensitiveDocumentAccess(actor, employee, "attendance selfie");

    const absolutePath = this.resolveStoragePath(attendance.photoUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored attendance selfie not found");
    }
    return {
      absolutePath,
      fileName: path.basename(absolutePath)
    };
  }

  async getReimbursementReceiptAsset(reimbursementId: string, actor?: AuthenticatedActor) {
    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === reimbursementId);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (!request.receiptFileUrl) {
      throw new NotFoundException("Reimbursement receipt not found");
    }
    const employee = db.employees.find((entry) => entry.id === request.userId);
    this.assertSensitiveDocumentAccess(actor, employee, "reimbursement receipt");

    const absolutePath = this.resolveStoragePath(request.receiptFileUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored reimbursement receipt not found");
    }
    return {
      absolutePath,
      fileName: request.receiptFileName ?? path.basename(absolutePath)
    };
  }

  async getLeaveSupportingDocumentAsset(leaveId: string, actor?: AuthenticatedActor) {
    const db = await this.readDb();
    const leave = db.leaveRequests.find((entry) => entry.id === leaveId);
    if (!leave) {
      throw new NotFoundException("Leave request not found");
    }
    if (!leave.supportingDocumentUrl) {
      throw new NotFoundException("Supporting document not found");
    }
    const employee = db.employees.find((entry) => entry.id === leave.userId);
    this.assertSensitiveDocumentAccess(actor, employee, "leave supporting documents");

    const absolutePath = this.resolveStoragePath(leave.supportingDocumentUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored leave supporting document not found");
    }
    return {
      absolutePath,
      fileName: leave.supportingDocumentName ?? path.basename(absolutePath)
    };
  }

  private assertEmployeeUniqueness(db: DatabaseShape, candidate: {
    nik: string;
    email: string;
    idCardNumber: string;
    appLoginEnabled: boolean;
    loginUsername: string | null;
  }, existingEmployeeId?: string) {
    const conflicts = db.employees.find((entry) => {
      if (existingEmployeeId && entry.id === existingEmployeeId) {
        return false;
      }
      if (entry.nik.trim().toLowerCase() === candidate.nik.trim().toLowerCase()) {
        return true;
      }
      if (entry.email.trim().toLowerCase() === candidate.email.trim().toLowerCase()) {
        return true;
      }
      if (entry.idCardNumber.trim() === candidate.idCardNumber.trim()) {
        return true;
      }
      if (
        candidate.appLoginEnabled &&
        candidate.loginUsername &&
        entry.appLoginEnabled &&
        entry.loginUsername &&
        entry.loginUsername.trim().toLowerCase() === candidate.loginUsername.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (!conflicts) {
      return;
    }

    if (conflicts.nik.trim().toLowerCase() === candidate.nik.trim().toLowerCase()) {
      throw new BadRequestException("NIK sudah dipakai oleh karyawan lain.");
    }
    if (conflicts.email.trim().toLowerCase() === candidate.email.trim().toLowerCase()) {
      throw new BadRequestException("Email sudah dipakai oleh karyawan lain.");
    }
    if (conflicts.idCardNumber.trim() === candidate.idCardNumber.trim()) {
      throw new BadRequestException("Nomor KTP sudah dipakai oleh karyawan lain.");
    }
    if (
      candidate.appLoginEnabled &&
      candidate.loginUsername &&
      conflicts.appLoginEnabled &&
      conflicts.loginUsername &&
      conflicts.loginUsername.trim().toLowerCase() === candidate.loginUsername.trim().toLowerCase()
    ) {
      throw new BadRequestException("Username login sudah dipakai oleh karyawan lain.");
    }
  }

  private assertDepartmentExistsAndActive(db: DatabaseShape, departmentName: string) {
    const normalized = departmentName.trim().toLowerCase();
    const department = db.departments.find((entry) => entry.name.trim().toLowerCase() === normalized);
    if (!department) {
      throw new BadRequestException("Department belum terdaftar di master.");
    }
    if (!department.active) {
      throw new BadRequestException("Department tidak aktif.");
    }
  }

  private assertManagerAssignment(
    db: DatabaseShape,
    payload: { department: string; managerName: string; employeeId?: string }
  ) {
    const managerName = payload.managerName.trim();
    if (!managerName) {
      return;
    }
    const manager = db.employees.find((entry) =>
      entry.name.trim().toLowerCase() === managerName.toLowerCase() &&
      entry.role === "manager" &&
      entry.status === "active"
    );
    if (!manager) {
      throw new BadRequestException("Manager approval tidak ditemukan atau tidak aktif.");
    }
    if (manager.department.trim().toLowerCase() !== payload.department.trim().toLowerCase()) {
      throw new BadRequestException("Manager approval harus berasal dari department yang sama.");
    }
    if (payload.employeeId && manager.id === payload.employeeId) {
      throw new BadRequestException("Manager approval tidak boleh memilih dirinya sendiri.");
    }
  }

  private assertManagerApprovalScope(actor: AuthenticatedActor | undefined, employee: EmployeeRecord | undefined) {
    if (!actor || actor.role !== "manager") {
      return;
    }
    if (!employee) {
      throw new NotFoundException("Employee not found for manager approval validation.");
    }
    if (employee.department.trim().toLowerCase() !== actor.department.trim().toLowerCase()) {
      throw new ForbiddenException("Manager can only approve requests within their own department.");
    }
    if (employee.managerName.trim().toLowerCase() !== actor.name.trim().toLowerCase()) {
      throw new ForbiddenException("Manager can only approve employees assigned to them.");
    }
  }

  private toEmployeeSessionPayload(employee: EmployeeRecord): EmployeeSessionPayload {
    return {
      sessionKey: `employee:${employee.id}`,
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      position: employee.position
    };
  }

  async resolveSessionActor(sessionKey: string): Promise<AuthenticatedActor | null> {
    const demoUsers: AuthenticatedActor[] = [
      {
        sessionKey: "global-admin",
        id: "admin-001",
        name: "Global Admin",
        email: "admin@praluxstd.com",
        role: "admin",
        department: "Enterprise HQ",
        position: "Platform Owner"
      },
      {
        sessionKey: "elena-hr",
        id: "emp-003",
        name: "Elena Rodriguez",
        email: "e.rodriguez@praluxstd.com",
        role: "hr",
        department: "Logistics & Supply Chain",
        position: "Operations Manager / HR"
      },
      {
        sessionKey: "sarah-manager",
        id: "emp-001",
        name: "Sarah Jenkins",
        email: "s.jenkins@praluxstd.com",
        role: "manager",
        department: "Brand Identity & Strategy",
        position: "Creative Director"
      },
      {
        sessionKey: "james-employee",
        id: "emp-004",
        name: "James Wilson",
        email: "j.wilson@praluxstd.com",
        role: "employee",
        department: "Consumer Insights",
        position: "Product Strategist"
      }
    ];

    const demo = demoUsers.find((entry) => entry.sessionKey === sessionKey);
    if (demo) {
      return demo;
    }

    if (!sessionKey.startsWith("employee:")) {
      return null;
    }

    const employeeId = sessionKey.replace("employee:", "");
    let session: EmployeeSessionPayload | null = null;
    try {
      session = await this.getEmployeeSession(employeeId);
    } catch {
      session = null;
    }
    if (!session) {
      return null;
    }

    return {
      ...session,
      role: session.role as AuthenticatedActor["role"]
    };
  }

  private async writeAuditLog(action: string, details: Record<string, unknown>) {
    this.auditQueue = this.auditQueue.then(async () => {
      let previousHash = "GENESIS";
      let sequence = 1;

      if (existsSync(this.auditLogPath)) {
        const content = await readFile(this.auditLogPath, "utf8");
        const lines = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const lastLine = lines.at(-1);
        sequence = lines.length + 1;
        if (lastLine) {
          try {
            const parsed = JSON.parse(lastLine) as { entryHash?: unknown };
            if (typeof parsed.entryHash === "string" && parsed.entryHash.trim().length > 0) {
              previousHash = parsed.entryHash;
            }
          } catch {
            previousHash = "LEGACY";
          }
        }
      }

      const timestamp = new Date().toISOString();
      const payload = {
        sequence,
        timestamp,
        action,
        details
      };
      const entryHash = createHash("sha256")
        .update(JSON.stringify({ previousHash, ...payload }))
        .digest("hex");
      const entry = {
        ...payload,
        previousHash,
        entryHash,
        immutable: true,
        hashAlgorithm: "sha256"
      };
      await appendFile(this.auditLogPath, `${JSON.stringify(entry)}\n`, "utf8");
    });
    await this.auditQueue;
  }

  private safeFileBaseName(input: string, fallback: string) {
    const normalized = input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    return normalized.length > 0 ? normalized : fallback;
  }

  private async ensureEmployeePasswordsHashed(db: DatabaseShape) {
    let changed = false;

    for (const employee of db.employees) {
      if (!employee.appLoginEnabled || !employee.loginPassword) {
        continue;
      }

      if (!isPasswordHash(employee.loginPassword)) {
        employee.loginPassword = await hashPassword(employee.loginPassword);
        changed = true;
      }
    }

    return changed;
  }

  private async persistSnapshotToDatabase(next: DatabaseShape) {
    const prisma = this.getPrisma();
    if (!prisma) {
      return;
    }

    const departmentRows = next.departments.map((department) => ({
      id: department.id,
      name: department.name,
      active: department.active,
      createdAt: this.toDate(department.createdAt) ?? new Date(),
      updatedAt: this.toDate(department.updatedAt) ?? new Date()
    }));

    const employeeRows = next.employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      nik: employee.nik,
      name: employee.name,
      email: employee.email,
      birthPlace: employee.birthPlace,
      birthDate: this.toDateOnly(employee.birthDate) ?? new Date(),
      gender: employee.gender,
      maritalStatus: employee.maritalStatus,
      marriageDate: this.toDateOnly(employee.marriageDate),
      address: employee.address,
      idCardNumber: employee.idCardNumber,
      education: employee.education,
      workExperience: employee.workExperience,
      educationHistory: employee.educationHistory,
      workExperiences: employee.workExperiences,
      department: employee.department,
      position: employee.position,
      role: employee.role,
      status: employee.status,
      phone: employee.phone,
      joinDate: this.toDateOnly(employee.joinDate) ?? new Date(),
      workLocation: employee.workLocation,
      workType: employee.workType,
      managerName: employee.managerName,
      employmentType: employee.employmentType,
      contractStatus: employee.contractStatus,
      contractStart: this.toDateOnly(employee.contractStart) ?? new Date(),
      contractEnd: this.toDateOnly(employee.contractEnd),
      baseSalary: employee.baseSalary,
      allowance: employee.allowance,
      positionSalaryId: employee.positionSalaryId,
      financialComponentIds: employee.financialComponentIds,
      taxProfileId: employee.taxProfileId,
      taxProfile: employee.taxProfile,
      bankName: employee.bankName,
      bankAccountMasked: employee.bankAccountMasked,
      appLoginEnabled: employee.appLoginEnabled,
      loginUsername: employee.loginUsername,
      loginPassword: employee.loginPassword,
      documents: employee.documents,
      leaveBalances: employee.leaveBalances
    }));

    const taxProfileRows = next.taxProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      rate: profile.rate,
      active: profile.active,
      description: profile.description
    }));

    const compensationProfileRows = next.compensationProfiles.map((profile) => ({
      id: profile.id,
      position: profile.position,
      baseSalary: profile.baseSalary,
      active: profile.active,
      notes: profile.notes
    }));

    const payrollComponentRows = next.payrollComponents.map((component) => ({
      id: component.id,
      code: component.code,
      name: component.name,
      type: component.type,
      calculationType: component.calculationType,
      amount: component.amount,
      percentage: component.percentage,
      taxable: component.taxable,
      active: component.active,
      appliesToAll: component.appliesToAll,
      employeeIds: component.employeeIds,
      description: component.description
    }));

    const payRunRows = next.payRuns.map((run) => ({
      id: run.id,
      periodLabel: run.periodLabel,
      periodStart: this.toDateOnly(run.periodStart) ?? new Date(),
      periodEnd: this.toDateOnly(run.periodEnd) ?? new Date(),
      payDate: this.toDateOnly(run.payDate) ?? new Date(),
      status: run.status,
      totalGross: run.totalGross,
      totalNet: run.totalNet,
      totalTax: run.totalTax,
      employeeCount: run.employeeCount,
      createdAt: this.toDate(run.createdAt) ?? new Date(),
      publishedAt: this.toDate(run.publishedAt)
    }));

    const reimbursementClaimTypeRows = next.reimbursementClaimTypes.map((claimType) => ({
      id: claimType.id,
      employeeId: claimType.employeeId,
      employeeName: claimType.employeeName,
      department: claimType.department,
      designation: claimType.designation,
      category: claimType.category,
      claimType: claimType.claimType,
      subType: claimType.subType,
      currency: claimType.currency,
      annualLimit: claimType.annualLimit,
      remainingBalance: claimType.remainingBalance,
      active: claimType.active,
      notes: claimType.notes,
      createdAt: this.toDate(claimType.createdAt) ?? new Date(),
      updatedAt: this.toDate(claimType.updatedAt) ?? new Date()
    }));

    const attendanceRows = next.attendanceLogs.map((record) => ({
      id: record.id,
      userId: record.userId,
      employeeName: record.employeeName,
      department: record.department,
      timestamp: this.toDate(record.timestamp) ?? new Date(),
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      location: record.location,
      latitude: record.latitude,
      longitude: record.longitude,
      description: record.description,
      gpsValidated: record.gpsValidated,
      gpsDistanceMeters: record.gpsDistanceMeters,
      photoUrl: record.photoUrl,
      status: record.status,
      overtimeMinutes: record.overtimeMinutes
    }));

    const overtimeRows = next.overtimeRequests.map((record) => ({
      id: record.id,
      userId: record.userId,
      employeeName: record.employeeName,
      department: record.department,
      date: this.toDateOnly(record.date) ?? new Date(),
      minutes: record.minutes,
      reason: record.reason,
      status: record.status
    }));

    const leaveRows = next.leaveRequests.map((record) => ({
      id: record.id,
      userId: record.userId,
      employeeName: record.employeeName,
      type: record.type,
      startDate: this.toDateOnly(record.startDate) ?? new Date(),
      endDate: this.toDateOnly(record.endDate) ?? new Date(),
      reason: record.reason,
      status: record.status,
      approverFlow: record.approverFlow,
      balanceLabel: record.balanceLabel,
      requestedAt: this.toDate(record.requestedAt) ?? new Date(),
      daysRequested: record.daysRequested,
      autoApproved: record.autoApproved,
      supportingDocumentName: record.supportingDocumentName,
      supportingDocumentUrl: record.supportingDocumentUrl
    }));

    const payslipRows = next.payslips.map((slip) => ({
      id: slip.id,
      payRunId: slip.payRunId,
      userId: slip.userId,
      employeeName: slip.employeeName,
      employeeNumber: slip.employeeNumber,
      department: slip.department,
      position: slip.position,
      periodLabel: slip.periodLabel,
      periodStart: this.toDateOnly(slip.periodStart) ?? new Date(),
      periodEnd: this.toDateOnly(slip.periodEnd) ?? new Date(),
      payDate: this.toDateOnly(slip.payDate) ?? new Date(),
      status: slip.status,
      baseSalary: slip.baseSalary,
      allowance: slip.allowance,
      overtimePay: slip.overtimePay,
      additionalEarnings: slip.additionalEarnings,
      grossPay: slip.grossPay,
      taxDeduction: slip.taxDeduction,
      otherDeductions: slip.otherDeductions,
      netPay: slip.netPay,
      bankName: slip.bankName,
      bankAccountMasked: slip.bankAccountMasked,
      taxProfile: slip.taxProfile,
      components: slip.components,
      generatedFileUrl: slip.generatedFileUrl
    }));

    const reimbursementRequestRows = next.reimbursementRequests.map((request) => ({
      id: request.id,
      userId: request.userId,
      employeeName: request.employeeName,
      department: request.department,
      designation: request.designation,
      claimTypeId: request.claimTypeId,
      claimType: request.claimType,
      subType: request.subType,
      category: request.category,
      currency: request.currency,
      amount: request.amount,
      receiptDate: this.toDateOnly(request.receiptDate) ?? new Date(),
      remarks: request.remarks,
      receiptFileName: request.receiptFileName,
      receiptFileUrl: request.receiptFileUrl,
      status: request.status,
      submittedAt: this.toDate(request.submittedAt),
      approvedAt: this.toDate(request.approvedAt),
      processedAt: this.toDate(request.processedAt),
      createdAt: this.toDate(request.createdAt) ?? new Date(),
      updatedAt: this.toDate(request.updatedAt) ?? new Date(),
      approverFlow: request.approverFlow,
      balanceSnapshot: request.balanceSnapshot
    }));

    const employeeIds = new Set(employeeRows.map((row) => String(row.id)));
    const payRunIds = new Set(payRunRows.map((row) => String(row.id)));
    const validAttendanceRows = attendanceRows.filter((row) => employeeIds.has(String(row.userId)));
    const validOvertimeRows = overtimeRows.filter((row) => employeeIds.has(String(row.userId)));
    const validLeaveRows = leaveRows.filter((row) => employeeIds.has(String(row.userId)));
    const validPayslipRows = payslipRows.filter(
      (row) => employeeIds.has(String(row.userId)) && payRunIds.has(String(row.payRunId))
    );
    const validReimbursementClaimTypeRows = reimbursementClaimTypeRows.filter((row) => employeeIds.has(String(row.employeeId)));
    const claimTypeIds = new Set(validReimbursementClaimTypeRows.map((row) => String(row.id)));
    const validReimbursementRequestRows = reimbursementRequestRows.filter(
      (row) => employeeIds.has(String(row.userId)) && claimTypeIds.has(String(row.claimTypeId))
    );

    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`
        TRUNCATE TABLE
          "ReimbursementRequest",
          "Payslip",
          "LeaveRequest",
          "OvertimeRequest",
          "AttendanceLog",
          "ReimbursementClaimType",
          "PayRun",
          "PayrollComponent",
          "CompensationProfile",
          "TaxProfile",
          "Employee",
          "Department"
        CASCADE
      `);

      if (departmentRows.length > 0) {
        await tx.department.createMany({ data: departmentRows });
      }
      if (employeeRows.length > 0) {
        await tx.employee.createMany({ data: employeeRows });
      }
      if (taxProfileRows.length > 0) {
        await tx.taxProfile.createMany({ data: taxProfileRows });
      }
      if (compensationProfileRows.length > 0) {
        await tx.compensationProfile.createMany({ data: compensationProfileRows });
      }
      if (payrollComponentRows.length > 0) {
        await tx.payrollComponent.createMany({ data: payrollComponentRows });
      }
      if (payRunRows.length > 0) {
        await tx.payRun.createMany({ data: payRunRows });
      }
      if (validReimbursementClaimTypeRows.length > 0) {
        await tx.reimbursementClaimType.createMany({ data: validReimbursementClaimTypeRows });
      }
      if (validAttendanceRows.length > 0) {
        await tx.attendanceLog.createMany({ data: validAttendanceRows });
      }
      if (validOvertimeRows.length > 0) {
        await tx.overtimeRequest.createMany({ data: validOvertimeRows });
      }
      if (validLeaveRows.length > 0) {
        await tx.leaveRequest.createMany({ data: validLeaveRows });
      }
      if (validPayslipRows.length > 0) {
        await tx.payslip.createMany({ data: validPayslipRows });
      }
      if (validReimbursementRequestRows.length > 0) {
        await tx.reimbursementRequest.createMany({ data: validReimbursementRequestRows });
      }
    });
  }

  private getRadius(location: string) {
    return siteDirectory[location]?.radiusMeters ?? 150;
  }

  private measureDistanceMeters(location: string, latitude: number, longitude: number) {
    const site = siteDirectory[location];
    if (!site) {
      return 999;
    }

    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(site.latitude - latitude);
    const dLon = toRadians(site.longitude - longitude);
    const lat1 = toRadians(latitude);
    const lat2 = toRadians(site.latitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadius * c);
  }

  private parseClock(time: string) {
    const [hour, minute] = time.split(":").map((item) => Number(item));
    return { hour, minute };
  }

  private formatClock(date: Date) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  private calculateLeaveDays(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    return Math.max(1, diff + 1);
  }

  private getRequestedDays(type: LeaveType, startDate: string, endDate: string) {
    if (type === "Half Day Leave") {
      return 0.5;
    }
    return this.calculateLeaveDays(startDate, endDate);
  }


  private buildOnDutyAttendanceRecords(employee: EmployeeRecord, leave: LeaveRecord, existing: AttendanceRecord[]) {
    const location = leave.type === "Remote Work" ? "Remote - Yogyakarta" : employee.workLocation;
    
    const site = siteDirectory[location] ?? siteDirectory["Jakarta HQ"];
    const records: AttendanceRecord[] = [];
    const start = new Date(`${leave.startDate}T00:00:00`);
    const end = new Date(`${leave.endDate}T00:00:00`);

    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;
      const alreadyExists = existing.some((entry) => entry.userId === employee.id && entry.timestamp.slice(0, 10) === dateKey);
      if (alreadyExists) {
        continue;
      }

      const timestamp = new Date(`${dateKey}T08:00:00.000Z`).toISOString();
      records.push({
        id: `att-${randomUUID().slice(0, 8)}`,
        userId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        timestamp,
        checkIn: NON_SHIFT_START,
        checkOut: NON_SHIFT_END,
        location,
        latitude: site.latitude,
        longitude: site.longitude,
        description: leave.reason,
        gpsValidated: true,
        gpsDistanceMeters: 0,
        photoUrl: null,
        status: "on-time",
        overtimeMinutes: 0
      });
    }

    return records;
  }

  private normalizeLeaveBalances(raw?: Partial<EmployeeRecord["leaveBalances"]>) {
    const balanceYear = Number(raw?.balanceYear ?? currentBalanceYear);
    const normalized: EmployeeRecord["leaveBalances"] = {
      annual: Number(raw?.annual ?? defaultLeaveAllocations.annual),
      annualCarryOver: Number(raw?.annualCarryOver ?? 0),
      annualCarryOverExpiresAt: raw?.annualCarryOverExpiresAt ?? null,
      religious: Number(raw?.religious ?? defaultLeaveAllocations.religious),
      religiousCarryOver: Number(raw?.religiousCarryOver ?? 0),
      religiousCarryOverExpiresAt: raw?.religiousCarryOverExpiresAt ?? null,
      maternity: Number(raw?.maternity ?? defaultLeaveAllocations.maternity),
      maternityCarryOver: Number(raw?.maternityCarryOver ?? 0),
      maternityCarryOverExpiresAt: raw?.maternityCarryOverExpiresAt ?? null,
      paternity: Number(raw?.paternity ?? defaultLeaveAllocations.paternity),
      paternityCarryOver: Number(raw?.paternityCarryOver ?? 0),
      paternityCarryOverExpiresAt: raw?.paternityCarryOverExpiresAt ?? null,
      marriage: Number(raw?.marriage ?? defaultLeaveAllocations.marriage),
      marriageCarryOver: Number(raw?.marriageCarryOver ?? 0),
      marriageCarryOverExpiresAt: raw?.marriageCarryOverExpiresAt ?? null,
      bereavement: Number(raw?.bereavement ?? defaultLeaveAllocations.bereavement),
      bereavementCarryOver: Number(raw?.bereavementCarryOver ?? 0),
      bereavementCarryOverExpiresAt: raw?.bereavementCarryOverExpiresAt ?? null,
      sick: Number(raw?.sick ?? 0),
      sickUsed: Number(raw?.sickUsed ?? 0),
      permission: Number(raw?.permission ?? defaultLeaveAllocations.permission),
      permissionCarryOver: Number(raw?.permissionCarryOver ?? 0),
      permissionCarryOverExpiresAt: raw?.permissionCarryOverExpiresAt ?? null,
      balanceYear
    };

    if (normalized.balanceYear < currentBalanceYear) {
      for (const leaveType of carryOverTypes) {
        normalized[`${leaveType}CarryOver` as const] = normalized.balanceYear === currentBalanceYear - 1 ? Number(normalized[leaveType] ?? 0) : 0;
        normalized[`${leaveType}CarryOverExpiresAt` as const] = normalized.balanceYear === currentBalanceYear - 1 ? `${currentBalanceYear}-12-31` : null;
        normalized[leaveType] = 0;
      }
      normalized.balanceYear = currentBalanceYear;
    }

    return normalized;
  }

  private leaveBalanceKeyForType(type: LeaveType): typeof carryOverTypes[number] | null {
    switch (type) {
      case "Leave Request":
      case "Annual Leave":
        return "annual";
      case "Religious Leave":
        return "religious";
      case "Maternity Leave":
        return "maternity";
      case "Paternity Leave":
        return "paternity";
      case "Marriage Leave":
        return "marriage";
      case "Bereavement Leave":
        return "bereavement";
      case "Half Day Leave":
        return "annual";
      case "Permission":
        return "permission";
      default:
        return null;
    }
  }

  private availableLeaveBalance(
    balances: EmployeeRecord["leaveBalances"],
    key: typeof carryOverTypes[number]
  ) {
    return Number((balances[key] + balances[`${key}CarryOver` as const]).toFixed(1));
  }

  private consumeLeaveBalance(
    balances: EmployeeRecord["leaveBalances"],
    key: typeof carryOverTypes[number],
    amount: number
  ) {
    const carryKey = `${key}CarryOver` as const;
    const availableCarry = Number(balances[carryKey] ?? 0);
    const remaining = Math.max(0, amount - availableCarry);
    balances[carryKey] = Math.max(0, Number((availableCarry - amount).toFixed(1)));
    balances[key] = Math.max(0, Number((balances[key] - remaining).toFixed(1)));
  }

  private describeBalance(employee: EmployeeRecord | undefined, type: LeaveType, daysRequested: number) {
    if (!employee) {
      return `${daysRequested} day request`;
    }
    const leaveKey = this.leaveBalanceKeyForType(type);
    const available = leaveKey ? this.availableLeaveBalance(employee.leaveBalances, leaveKey) : 0;
    switch (type) {
      case "Leave Request":
      case "Annual Leave":
        return `Annual leave ${available} days available, ${daysRequested} requested`;
      case "Religious Leave":
        return `Religious leave ${available} days available, ${daysRequested} requested`;
      case "Maternity Leave":
        return `Maternity leave ${available} days available, ${daysRequested} requested`;
      case "Paternity Leave":
        return `Paternity leave ${available} days available, ${daysRequested} requested`;
      case "Marriage Leave":
        return `Marriage leave ${available} days available, ${daysRequested} requested`;
      case "Bereavement Leave":
        return `Bereavement leave ${available} days available, ${daysRequested} requested`;
      case "Sick Submission":
      case "Sick Leave":
        return `Sick submission recorded for ${daysRequested} day(s)`;
      case "Half Day Leave":
        return `Annual leave ${this.availableLeaveBalance(employee.leaveBalances, "annual")} days available, 0.5 requested`;
      case "Permission":
        return `Permission quota ${this.availableLeaveBalance(employee.leaveBalances, "permission")} days available, ${daysRequested} requested`;
      default:
        return `Policy-based workflow, ${daysRequested} day request`;
    }
  }

  private applyLeaveBalance(employee: EmployeeRecord, type: LeaveType, daysRequested: number) {
    const leaveKey = this.leaveBalanceKeyForType(type);
    if (leaveKey) {
      this.consumeLeaveBalance(employee.leaveBalances, leaveKey, daysRequested);
    }
    if (type === "Sick Submission" || type === "Sick Leave") {
      employee.leaveBalances.sickUsed = Number((employee.leaveBalances.sickUsed + daysRequested).toFixed(1));
    }
  }

  private leaveBalanceLabelAfterApproval(employee: EmployeeRecord | undefined, type: LeaveType) {
    if (!employee) {
      return "Balance updated";
    }
    const leaveKey = this.leaveBalanceKeyForType(type);
    switch (type) {
      case "Leave Request":
      case "Annual Leave":
        return `${this.availableLeaveBalance(employee.leaveBalances, "annual")} annual leave days remaining`;
      case "Religious Leave":
        return `${this.availableLeaveBalance(employee.leaveBalances, "religious")} religious leave days remaining`;
      case "Maternity Leave":
        return `${this.availableLeaveBalance(employee.leaveBalances, "maternity")} maternity leave days remaining`;
      case "Paternity Leave":
        return `${this.availableLeaveBalance(employee.leaveBalances, "paternity")} paternity leave days remaining`;
      case "Marriage Leave":
        return `${this.availableLeaveBalance(employee.leaveBalances, "marriage")} marriage leave days remaining`;
      case "Bereavement Leave":
        return `${this.availableLeaveBalance(employee.leaveBalances, "bereavement")} bereavement leave days remaining`;
      case "Sick Submission":
      case "Sick Leave":
        return `${employee.leaveBalances.sickUsed} sick leave use(s) recorded`;
      case "Half Day Leave":
        return `${this.availableLeaveBalance(employee.leaveBalances, "annual")} annual leave days remaining after half-day request`;
      case "Permission":
        return `${this.availableLeaveBalance(employee.leaveBalances, "permission")} permission days remaining`;
      default:
        return leaveKey ? `${this.availableLeaveBalance(employee.leaveBalances, leaveKey)} days remaining` : "Policy-based confirmed";
    }
  }

  private getTaxRate(profile: string, taxProfiles: TaxProfileRecord[], taxProfileId?: string | null) {
    const selectedProfile = taxProfileId ? taxProfiles.find((entry) => entry.id === taxProfileId) : null;
    if (selectedProfile) {
      return selectedProfile.rate / 100;
    }
    const normalized = profile.toUpperCase();
    if (normalized.includes("K/0")) {
      return 0.06;
    }
    if (normalized.includes("TK/1")) {
      return 0.045;
    }
    if (normalized.includes("TK/0")) {
      return 0.05;
    }
    return 0.05;
  }

  private calculateOvertimePay(baseSalary: number, minutes: number) {
    const hourlyRate = baseSalary / 173;
    const minuteRate = hourlyRate / 60;
    return Math.round(minuteRate * minutes * 1.5);
  }

  private resolvePayrollComponents(components: PayrollComponentRecord[], employeeId: string) {
    return components.filter((component) => component.active && (component.appliesToAll || component.employeeIds.includes(employeeId)));
  }
  private buildPayslip(employee: EmployeeRecord, db: DatabaseShape, payload: GeneratePayrollRunDto, payRunId: string): PayslipRecord {
    const overtimeMinutes = db.overtimeRequests
      .filter((entry) => entry.userId === employee.id && ["approved", "paid"].includes(entry.status) && entry.date >= payload.periodStart && entry.date <= payload.periodEnd)
      .reduce((total, entry) => total + entry.minutes, 0);
    const overtimePay = this.calculateOvertimePay(employee.baseSalary, overtimeMinutes);
    const components = employee.financialComponentIds.length > 0
      ? db.payrollComponents.filter((component) => component.active && employee.financialComponentIds.includes(component.id))
      : this.resolvePayrollComponents(db.payrollComponents, employee.id);

    const lineItems: PayslipLineItem[] = [
      { code: "BASE", name: "Base Salary", type: "earning", amount: employee.baseSalary, taxable: true, source: "base-salary" }
    ];

    if (overtimePay > 0) {
      lineItems.push({ code: "OVERTIME", name: "Overtime Pay", type: "earning", amount: overtimePay, taxable: true, source: "overtime" });
    }

    for (const component of components) {
      const amount = component.calculationType === "percentage"
        ? Math.round(employee.baseSalary * ((component.percentage ?? 0) / 100))
        : component.amount;
      lineItems.push({
        code: component.code,
        name: component.name,
        type: component.type,
        amount,
        taxable: component.taxable,
        source: "component"
      });
    }

    const earningLines = lineItems.filter((entry) => entry.type === "earning");
    const deductionLines = lineItems.filter((entry) => entry.type === "deduction");
    const grossPay = earningLines.reduce((sum, entry) => sum + entry.amount, 0);
    const taxableBase = lineItems.filter((entry) => entry.taxable && entry.type === "earning").reduce((sum, entry) => sum + entry.amount, 0);
      const taxDeduction = Math.round(taxableBase * this.getTaxRate(employee.taxProfile, db.taxProfiles, employee.taxProfileId));
      const otherDeductions = deductionLines.reduce((sum, entry) => sum + entry.amount, 0);
      const additionalEarnings = Math.max(0, grossPay - employee.baseSalary - overtimePay);
      const netPay = grossPay - otherDeductions - taxDeduction;
      lineItems.push({ code: "PPH21", name: "PPh 21", type: "deduction", amount: taxDeduction, taxable: false, source: "tax" });

    return {
      id: `payslip-${randomUUID().slice(0, 8)}`,
      payRunId,
      userId: employee.id,
      employeeName: employee.name,
      employeeNumber: employee.employeeNumber,
      department: employee.department,
      position: employee.position,
      periodLabel: payload.periodLabel,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      payDate: payload.payDate,
      status: "draft",
      baseSalary: employee.baseSalary,
      allowance: lineItems.filter((entry) => entry.source === "component" && entry.type === "earning").reduce((sum, entry) => sum + entry.amount, 0),
      overtimePay,
      additionalEarnings,
      grossPay,
      taxDeduction,
      otherDeductions,
      netPay,
      bankName: employee.bankName,
      bankAccountMasked: employee.bankAccountMasked,
      taxProfile: employee.taxProfile,
      components: lineItems,
      generatedFileUrl: null
    };
  }

  private buildPayslipExportContent(payslip: PayslipRecord) {
    const lines = [
      `Payslip: ${payslip.periodLabel}`,
      `Employee: ${payslip.employeeName} (${payslip.employeeNumber})`,
      `Department: ${payslip.department}`,
      `Position: ${payslip.position}`,
      `Pay Date: ${payslip.payDate}`,
      `Bank: ${payslip.bankName} ${payslip.bankAccountMasked}`,
      "",
      "Components:"
    ];

    for (const line of payslip.components) {
      lines.push(`- ${line.name} [${line.type}]: ${line.amount}`);
    }

    lines.push("");
    lines.push(`Gross: ${payslip.grossPay}`);
    lines.push(`Tax: ${payslip.taxDeduction}`);
    lines.push(`Other Deductions: ${payslip.otherDeductions}`);
    lines.push(`Net: ${payslip.netPay}`);
    return lines.join("\n");
  }

  private findReimbursementClaimType(db: DatabaseShape, claimTypeId: string) {
    return db.reimbursementClaimTypes.find((entry) => entry.id === claimTypeId && entry.active);
  }

  private removeStoredFile(fileUrl: string | null) {
    if (!fileUrl) {
      return;
    }
    const fullPath = path.join(this.storageRoot, fileUrl.replace(/^\/storage\//, "").replace(/\//g, path.sep));
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  private applyReimbursementClaimDetails(
    request: ReimbursementRequestRecord,
    claimType: ReimbursementClaimTypeRecord,
    amount: number,
    receiptDate: string,
    currency: string,
    remarks: string
  ) {
    request.claimTypeId = claimType.id;
    request.claimType = claimType.claimType;
    request.subType = claimType.subType;
    request.category = claimType.category;
    request.currency = currency;
    request.amount = amount;
    request.receiptDate = receiptDate;
    request.remarks = remarks;
    request.balanceSnapshot = claimType.remainingBalance;
  }

  private parseBooleanFlag(value: unknown) {
    if (value === true || value === 1 || value === "1") {
      return true;
    }
    if (typeof value === "string") {
      return value.trim().toLowerCase() === "true";
    }
    return false;
  }

  async health() {
    const database = await this.databaseService.healthcheck();
    const prisma = this.getPrisma();
    const db = prisma
      ? await Promise.all([
          prisma.employee.count(),
          prisma.attendanceLog.count(),
          prisma.overtimeRequest.count(),
          prisma.leaveRequest.count(),
          prisma.reimbursementClaimType.count(),
          prisma.reimbursementRequest.count(),
          prisma.payrollComponent.count(),
          prisma.payRun.count(),
          prisma.payslip.count()
        ])
      : null;

    const localDb = db ? null : await this.readDb();
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        api: "online",
        database,
        storage: this.storageRoot,
        employees: db ? db[0] : localDb!.employees.length,
        attendanceLogs: db ? db[1] : localDb!.attendanceLogs.length,
        overtimeRequests: db ? db[2] : localDb!.overtimeRequests.length,
        leaveRequests: db ? db[3] : localDb!.leaveRequests.length,
        reimbursementClaimTypes: db ? db[4] : localDb!.reimbursementClaimTypes.length,
        reimbursementRequests: db ? db[5] : localDb!.reimbursementRequests.length,
        payrollComponents: db ? db[6] : localDb!.payrollComponents.length,
        payRuns: db ? db[7] : localDb!.payRuns.length,
        payslips: db ? db[8] : localDb!.payslips.length
      }
    };
  }

  getExportQueueMetrics() {
    const queued = this.exportQueue.filter((entry) => entry.status === "queued").length;
    const processing = this.exportQueue.filter((entry) => entry.status === "processing").length;
    const failed = this.exportQueue.filter((entry) => entry.status === "failed").length;
    const done = this.exportQueue.filter((entry) => entry.status === "done").length;
    return {
      total: this.exportQueue.length,
      queued,
      processing,
      failed,
      done,
      activeWorker: this.activeExportJob
    };
  }

  async getDashboardSummary() {
    const prisma = this.getPrisma();

    if (prisma) {
      const [employees, onTime, late, absent, leavePending] = await Promise.all([
        prisma.employee.count(),
        prisma.attendanceLog.count({ where: { status: "on-time" } }),
        prisma.attendanceLog.count({ where: { status: "late" } }),
        prisma.attendanceLog.count({ where: { status: "absent" } }),
        prisma.leaveRequest.count({ where: { status: { not: "approved" } } })
      ]);

      return {
        employees,
        onTime,
        late,
        absent,
        leavePending,
        storageMode: this.databaseService.getModeLabel()
      };
    }

    const db = await this.readDb();
    const onTime = db.attendanceLogs.filter((log) => log.status === "on-time").length;
    const late = db.attendanceLogs.filter((log) => log.status === "late").length;
    const absent = db.attendanceLogs.filter((log) => log.status === "absent").length;
    return {
      employees: db.employees.length,
      onTime,
      late,
      absent,
      leavePending: db.leaveRequests.filter((leave) => leave.status !== "approved").length,
      storageMode: this.databaseService.getModeLabel()
    };
  }

  async getEmployees(query?: EmployeeListQueryDto) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.department || query?.role || query?.status);
    const prisma = this.getPrisma();

    if (prisma && shouldPaginate) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.department ? { department: query.department } : {}),
        ...(query?.role ? { role: query.role } : {}),
        ...(query?.status ? { status: query.status } : {})
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { employeeNumber: { contains: search, mode: "insensitive" } },
          { department: { contains: search, mode: "insensitive" } },
          { position: { contains: search, mode: "insensitive" } }
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.employee.count({ where }),
        prisma.employee.findMany({
          where,
          orderBy: { name: "asc" },
          skip: meta.skip,
          take: meta.pageSize
        })
      ]);

      const employees = rows.map((employee: any) => this.sanitizeEmployee({
        ...employee,
        baseSalary: Number(employee.baseSalary),
        allowance: Number(employee.allowance),
        educationHistory: Array.isArray(employee.educationHistory) ? employee.educationHistory : [],
        workExperiences: Array.isArray(employee.workExperiences) ? employee.workExperiences : [],
        financialComponentIds: Array.isArray(employee.financialComponentIds) ? employee.financialComponentIds : [],
        documents: Array.isArray(employee.documents) ? employee.documents : [],
        leaveBalances: employee.leaveBalances ?? this.normalizeLeaveBalances()
      } as EmployeeRecord));

      return {
        items: employees,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + employees.length < total
      } satisfies PaginatedResult<EmployeeRecord>;
    }

    const employees = await this.getEmployeeRows();
    if (!shouldPaginate) {
      return employees;
    }

    return this.paginateArray(employees, query?.page, query?.pageSize);
  }

  async authenticateEmployee(username: string, password: string) {
    const db = await this.readDb();
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    const employee = db.employees.find((item) =>
      item.status === "active" &&
      item.appLoginEnabled &&
      item.loginUsername === normalizedUsername
    );

    if (!employee) {
      throw new NotFoundException("Username atau password tidak valid.");
    }

    const passwordMatches = await verifyPassword(normalizedPassword, employee.loginPassword);
    if (!passwordMatches) {
      throw new NotFoundException("Username atau password tidak valid.");
    }

    if (employee.loginPassword && !isPasswordHash(employee.loginPassword)) {
      employee.loginPassword = await hashPassword(normalizedPassword);
      await this.writeDb(db);
    }

    return this.toEmployeeSessionPayload(employee);
  }

  async getEmployeeSession(employeeId: string) {
    const db = await this.readDb();
    const employee = db.employees.find((item) => item.id === employeeId && item.appLoginEnabled && item.status === "active");
    if (!employee) {
      throw new NotFoundException("Employee session not found");
    }

    return this.toEmployeeSessionPayload(employee);
  }

  async changeOwnPassword(payload: ChangePasswordDto, actor?: AuthenticatedActor) {
    if (!actor?.id || actor.sessionKey === "global-admin" || !actor.sessionKey.startsWith("employee:")) {
      throw new ForbiddenException("Password hanya bisa diubah dari akun karyawan yang valid.");
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === actor.id && entry.appLoginEnabled && entry.status === "active");
    if (!employee || !employee.loginPassword) {
      throw new NotFoundException("Akun employee tidak ditemukan atau belum aktif.");
    }

    const currentPassword = payload.currentPassword.trim();
    const newPassword = payload.newPassword.trim();
    if (newPassword.length < 8) {
      throw new BadRequestException("Password baru minimal 8 karakter.");
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("Password baru harus berbeda dari password saat ini.");
    }

    const passwordMatches = await verifyPassword(currentPassword, employee.loginPassword);
    if (!passwordMatches) {
      throw new BadRequestException("Password saat ini tidak valid.");
    }

    employee.loginPassword = await hashPassword(newPassword);
    await this.writeDb(db);
    await this.writeAuditLog("auth.change-password", { employeeId: employee.id, actor: actor.name });
    return { success: true, message: "Password berhasil diperbarui." };
  }

  async resetEmployeePassword(payload: ResetEmployeePasswordDto, actor?: AuthenticatedActor) {
    if (!actor || (actor.role !== "hr" && actor.role !== "admin")) {
      throw new ForbiddenException("Hanya HR atau admin yang bisa reset password employee.");
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.employeeId);
    if (!employee) {
      throw new NotFoundException("Employee tidak ditemukan.");
    }
    if (!employee.appLoginEnabled) {
      throw new BadRequestException("Akun aplikasi employee belum aktif.");
    }

    const newPassword = payload.newPassword.trim();
    if (newPassword.length < 8) {
      throw new BadRequestException("Password baru minimal 8 karakter.");
    }

    employee.loginPassword = await hashPassword(newPassword);
    await this.writeDb(db);
    await this.writeAuditLog("auth.reset-password", {
      employeeId: employee.id,
      actor: actor.name,
      actorRole: actor.role
    });
    return {
      success: true,
      message: `Password akun ${employee.name} berhasil di-reset.`
    };
  }

  async createEmployee(payload: CreateEmployeeDto) {
    const db = await this.readDb();
    this.assertDepartmentExistsAndActive(db, payload.department);
    this.assertManagerAssignment(db, { department: payload.department, managerName: payload.managerName });
    const sequence = String(db.employees.length + 1).padStart(3, "0");
    const compensationProfile = payload.positionSalaryId
      ? db.compensationProfiles.find((entry) => entry.id === payload.positionSalaryId)
      : null;
    const selectedComponents = db.payrollComponents.filter((entry) => (payload.financialComponentIds ?? []).includes(entry.id));
    const allowance = selectedComponents
      .filter((entry) => entry.type === "earning")
      .reduce((sum, entry) => sum + (entry.calculationType === "percentage" ? Math.round((compensationProfile?.baseSalary ?? payload.baseSalary) * ((entry.percentage ?? 0) / 100)) : entry.amount), 0);
    const selectedTaxProfile = payload.taxProfileId ? db.taxProfiles.find((entry) => entry.id === payload.taxProfileId) : null;
    const employeePassword = payload.appLoginEnabled === false ? null : (payload.loginPassword?.trim() || "employee123");
    this.assertEmployeeUniqueness(db, {
      nik: payload.nik,
      email: payload.email,
      idCardNumber: payload.idCardNumber,
      appLoginEnabled: payload.appLoginEnabled ?? true,
      loginUsername: payload.appLoginEnabled === false ? null : (payload.loginUsername?.trim() || payload.nik)
    });
    const employee: EmployeeRecord = {
      id: `emp-${randomUUID().slice(0, 8)}`,
      employeeNumber: `EMP-2026-${sequence}`,
      joinDate: new Date().toISOString().slice(0, 10),
      ...payload,
      educationHistory: Array.isArray(payload.educationHistory) ? payload.educationHistory as EducationRecord[] : [],
      workExperiences: Array.isArray(payload.workExperiences) ? payload.workExperiences as WorkExperienceRecord[] : [],
      position: compensationProfile?.position ?? payload.position,
      baseSalary: compensationProfile?.baseSalary ?? payload.baseSalary,
      allowance,
      positionSalaryId: payload.positionSalaryId ?? null,
      financialComponentIds: payload.financialComponentIds ?? [],
      taxProfileId: payload.taxProfileId ?? null,
      taxProfile: selectedTaxProfile?.name ?? payload.taxProfile,
      contractEnd: payload.contractEnd ?? null,
      marriageDate: payload.marriageDate ?? null,
      appLoginEnabled: payload.appLoginEnabled ?? true,
      loginUsername: payload.appLoginEnabled === false ? null : (payload.loginUsername?.trim() || payload.nik),
      loginPassword: employeePassword ? await hashPassword(employeePassword) : null,
      documents: [],
      leaveBalances: this.normalizeLeaveBalances(payload.leaveBalances as Partial<EmployeeRecord["leaveBalances"]> | undefined)
    };
    db.employees.unshift(employee);
    await this.writeDb(db);
    await this.writeAuditLog("employee.create", { employeeId: employee.id, role: employee.role, department: employee.department });
    return this.sanitizeEmployee(employee);
  }

  async updateEmployee(id: string, payload: UpdateEmployeeDto) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === id);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    const compensationProfile = payload.positionSalaryId
      ? db.compensationProfiles.find((entry) => entry.id === payload.positionSalaryId)
      : null;
    Object.assign(employee, payload, payload.positionSalaryId === null ? { positionSalaryId: null } : {});
    if (compensationProfile) {
      employee.position = compensationProfile.position;
      employee.baseSalary = compensationProfile.baseSalary;
      employee.positionSalaryId = compensationProfile.id;
    }
    if (payload.financialComponentIds) {
      employee.financialComponentIds = payload.financialComponentIds;
      const selectedComponents = db.payrollComponents.filter((entry) => employee.financialComponentIds.includes(entry.id));
      employee.allowance = selectedComponents
        .filter((entry) => entry.type === "earning")
        .reduce((sum, entry) => sum + (entry.calculationType === "percentage" ? Math.round(employee.baseSalary * ((entry.percentage ?? 0) / 100)) : entry.amount), 0);
    }
    if (payload.taxProfileId !== undefined) {
      employee.taxProfileId = payload.taxProfileId ?? null;
      const selectedTaxProfile = employee.taxProfileId ? db.taxProfiles.find((entry) => entry.id === employee.taxProfileId) : null;
      if (selectedTaxProfile) {
        employee.taxProfile = selectedTaxProfile.name;
      }
    }
    if (payload.appLoginEnabled !== undefined) {
      employee.appLoginEnabled = payload.appLoginEnabled;
      if (!payload.appLoginEnabled) {
        employee.loginUsername = null;
        employee.loginPassword = null;
      }
    }
    if (payload.loginUsername !== undefined) {
      employee.loginUsername = payload.loginUsername?.trim() || null;
    }
    if (payload.loginPassword !== undefined) {
      const nextPassword = payload.loginPassword?.trim() || null;
      if (nextPassword) {
        employee.loginPassword = await hashPassword(nextPassword);
      } else if (payload.appLoginEnabled === false) {
        employee.loginPassword = null;
      }
    }
    if (payload.leaveBalances !== undefined) {
      employee.leaveBalances = this.normalizeLeaveBalances(payload.leaveBalances as Partial<EmployeeRecord["leaveBalances"]>);
    }
    this.assertDepartmentExistsAndActive(db, employee.department);
    this.assertManagerAssignment(db, { department: employee.department, managerName: employee.managerName, employeeId: employee.id });
    this.assertEmployeeUniqueness(db, {
      nik: employee.nik,
      email: employee.email,
      idCardNumber: employee.idCardNumber,
      appLoginEnabled: employee.appLoginEnabled,
      loginUsername: employee.loginUsername
    }, employee.id);
    await this.writeDb(db);
    await this.writeAuditLog("employee.update", { employeeId: id, fields: Object.keys(payload) });
    return this.sanitizeEmployee(employee);
  }

  async deleteEmployee(id: string) {
    const db = await this.readDb();
    const nextEmployees = db.employees.filter((entry) => entry.id !== id);
    if (nextEmployees.length === db.employees.length) {
      throw new NotFoundException("Employee not found");
    }
    db.employees = nextEmployees;
    await this.writeDb(db);
    await this.writeAuditLog("employee.delete", { employeeId: id });
    return { deleted: true, id };
  }

  async getEmployeeDocuments(employeeId: string) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    return employee.documents.map((document) => this.toSafeEmployeeDocument(document));
  }

  async uploadEmployeeDocument(
    employeeId: string,
    payload: UploadEmployeeDocumentDto,
    file?: Express.Multer.File,
    fileUrl?: string | null
  ) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    if (!file || !fileUrl) {
      throw new NotFoundException("Document file is required");
    }

    const document: EmployeeDocumentRecord = {
      id: `doc-${randomUUID().slice(0, 8)}`,
      employeeId,
      type: payload.type,
      title: payload.title,
      fileName: file.originalname,
      fileUrl,
      uploadedAt: new Date().toISOString(),
      notes: payload.notes ?? ""
    };

    employee.documents.unshift(document);
    await this.writeDb(db);
    return document;
  }

  async deleteEmployeeDocument(employeeId: string, documentId: string) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const document = employee.documents.find((entry) => entry.id === documentId);
    if (!document) {
      throw new NotFoundException("Employee document not found");
    }

    employee.documents = employee.documents.filter((entry) => entry.id !== documentId);
    const fullPath = this.resolveStoragePath(document.fileUrl);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
    await this.writeDb(db);
    return { deleted: true, id: documentId };
  }

  async getCompensationProfiles() {
    const db = await this.readDb();
    return db.compensationProfiles;
  }

  async getDepartments() {
    const db = await this.readDb();
    return [...db.departments].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createDepartment(payload: CreateDepartmentDto) {
    const db = await this.readDb();
    const name = payload.name.trim();
    if (!name) {
      throw new BadRequestException("Department name is required.");
    }
    const exists = db.departments.some((entry) => entry.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      throw new BadRequestException("Department sudah ada.");
    }
    const now = new Date().toISOString();
    const department: DepartmentRecord = {
      id: `dept-${randomUUID().slice(0, 8)}`,
      name,
      active: payload.active,
      createdAt: now,
      updatedAt: now
    };
    db.departments.push(department);
    db.departments.sort((a, b) => a.name.localeCompare(b.name));
    await this.writeDb(db);
    await this.writeAuditLog("department.create", { departmentId: department.id, name: department.name, active: department.active });
    return department;
  }

  async updateDepartment(id: string, payload: UpdateDepartmentDto) {
    const db = await this.readDb();
    const department = db.departments.find((entry) => entry.id === id);
    if (!department) {
      throw new NotFoundException("Department not found");
    }

    const nextName = payload.name?.trim();
    if (nextName && nextName.toLowerCase() !== department.name.trim().toLowerCase()) {
      const duplicate = db.departments.some((entry) => entry.id !== id && entry.name.trim().toLowerCase() === nextName.toLowerCase());
      if (duplicate) {
        throw new BadRequestException("Department sudah ada.");
      }
      const previousName = department.name;
      department.name = nextName;
      db.employees = db.employees.map((employee) =>
        employee.department.trim().toLowerCase() === previousName.trim().toLowerCase()
          ? { ...employee, department: nextName }
          : employee
      );
    }

    if (payload.active !== undefined) {
      department.active = payload.active;
    }
    department.updatedAt = new Date().toISOString();
    await this.writeDb(db);
    await this.writeAuditLog("department.update", { departmentId: id, fields: Object.keys(payload) });
    return department;
  }

  async deleteDepartment(id: string) {
    const db = await this.readDb();
    const department = db.departments.find((entry) => entry.id === id);
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    const isUsed = db.employees.some((entry) => entry.department.trim().toLowerCase() === department.name.trim().toLowerCase());
    if (isUsed) {
      throw new BadRequestException("Department masih dipakai employee aktif, tidak bisa dihapus.");
    }
    db.departments = db.departments.filter((entry) => entry.id !== id);
    await this.writeDb(db);
    await this.writeAuditLog("department.delete", { departmentId: id, name: department.name });
    return { deleted: true, id };
  }

  async createCompensationProfile(payload: CreateCompensationProfileDto) {
    const db = await this.readDb();
    const profile: CompensationProfileRecord = {
      id: `comp-${randomUUID().slice(0, 8)}`,
      ...payload
    };
    db.compensationProfiles.unshift(profile);
    await this.writeDb(db);
    return profile;
  }

  async updateCompensationProfile(id: string, payload: UpdateCompensationProfileDto) {
    const db = await this.readDb();
    const profile = db.compensationProfiles.find((entry) => entry.id === id);
    if (!profile) {
      throw new NotFoundException("Compensation profile not found");
    }

    const previousPosition = profile.position;
    Object.assign(profile, payload);
    db.employees = db.employees.map((employee) => (
      employee.positionSalaryId === id
        ? {
            ...employee,
            position: profile.position || previousPosition,
            baseSalary: profile.baseSalary
          }
        : employee
    ));

    await this.writeDb(db);
    return profile;
  }

  async deleteCompensationProfile(id: string) {
    const db = await this.readDb();
    const exists = db.compensationProfiles.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Compensation profile not found");
    }

    db.compensationProfiles = db.compensationProfiles.filter((entry) => entry.id !== id);
    db.employees = db.employees.map((employee) => employee.positionSalaryId === id ? { ...employee, positionSalaryId: null } : employee);
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getTaxProfiles() {
    const db = await this.readDb();
    return db.taxProfiles;
  }

  async createTaxProfile(payload: CreateTaxProfileDto) {
    const db = await this.readDb();
    const profile: TaxProfileRecord = { id: `tax-${randomUUID().slice(0, 8)}`, ...payload };
    db.taxProfiles.unshift(profile);
    await this.writeDb(db);
    return profile;
  }

  async updateTaxProfile(id: string, payload: UpdateTaxProfileDto) {
    const db = await this.readDb();
    const profile = db.taxProfiles.find((entry) => entry.id === id);
    if (!profile) {
      throw new NotFoundException("Tax profile not found");
    }
    Object.assign(profile, payload);
    db.employees = db.employees.map((employee) => employee.taxProfileId === id ? { ...employee, taxProfile: profile.name } : employee);
    await this.writeDb(db);
    return profile;
  }

  async deleteTaxProfile(id: string) {
    const db = await this.readDb();
    const exists = db.taxProfiles.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Tax profile not found");
    }
    db.taxProfiles = db.taxProfiles.filter((entry) => entry.id !== id);
    db.employees = db.employees.map((employee) => employee.taxProfileId === id ? { ...employee, taxProfileId: null } : employee);
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getAttendanceHistory(query?: AttendanceHistoryQueryDto) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.department || query?.status || query?.userId);
    const prisma = this.getPrisma();

    if (prisma && shouldPaginate) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.department ? { department: query.department } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.userId ? { userId: query.userId } : {})
      };

      if (search) {
        where.OR = [
          { employeeName: { contains: search, mode: "insensitive" } },
          { department: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } }
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.attendanceLog.count({ where }),
        prisma.attendanceLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip: meta.skip,
          take: meta.pageSize
        })
      ]);

      const items = rows.map((record: any) => this.toSafeAttendanceRecord({
        ...record,
        latitude: Number(record.latitude),
        longitude: Number(record.longitude),
        gpsDistanceMeters: Number(record.gpsDistanceMeters)
      }));

      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<AttendanceRecord>;
    }

    const db = await this.readDb();
    let records = db.attendanceLogs;
    if (query?.userId) {
      records = records.filter((entry) => entry.userId === query.userId);
    }
    if (query?.department) {
      records = records.filter((entry) => entry.department === query.department);
    }
    if (query?.status) {
      records = records.filter((entry) => entry.status === query.status);
    }
    if (query?.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      records = records.filter((entry) =>
        [entry.employeeName, entry.department, entry.description, entry.location].some((value) =>
          value.toLowerCase().includes(search)
        )
      );
    }
    if (!shouldPaginate) {
      return records.map((record) => this.toSafeAttendanceRecord(record));
    }
    const paginated = this.paginateArray(records, query?.page, query?.pageSize);
    return {
      ...paginated,
      items: paginated.items.map((record) => this.toSafeAttendanceRecord(record))
    };
  }

  async getAttendanceToday() {
    const db = await this.readDb();
    const today = new Date().toISOString().slice(0, 10);
    return db.attendanceLogs
      .filter((entry) => entry.timestamp.slice(0, 10) === today)
      .map((entry) => this.toSafeAttendanceRecord(entry));
  }

  async getAttendanceOverview() {
    const db = await this.readDb();
    const today = await this.getAttendanceToday();
    const openCheckIns = today.filter((entry) => !entry.checkOut).length;
    const gpsValidated = today.filter((entry) => entry.gpsValidated).length;
    const selfieCaptured = today.filter((entry) => Boolean(entry.photoUrl)).length;
    const overtimeMinutes = db.overtimeRequests.filter((entry) => ["approved", "paid", "pending"].includes(entry.status)).reduce((total, entry) => total + entry.minutes, 0);
    return {
      checkedInToday: today.length,
      openCheckIns,
      gpsValidated,
      selfieCaptured,
      overtimeHours: Number((overtimeMinutes / 60).toFixed(1))
    };
  }

  async getOvertimeRequests() {
    const db = await this.readDb();
    return db.overtimeRequests;
  }
  async checkIn(payload: CheckInDto, photoUrl: string | null) {
    const db = await this.readDb();
    const now = new Date();
    const schedule = this.parseClock(NON_SHIFT_START);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const scheduledMinutes = schedule.hour * 60 + schedule.minute;
    const gpsDistanceMeters = this.measureDistanceMeters(payload.location, payload.latitude, payload.longitude);
    const record: AttendanceRecord = {
      id: `att-${randomUUID().slice(0, 8)}`,
      userId: payload.userId,
      employeeName: payload.employeeName,
      department: payload.department,
      timestamp: now.toISOString(),
      checkIn: this.formatClock(now),
      checkOut: null,
      location: payload.location,
      latitude: payload.latitude,
      longitude: payload.longitude,
      description: "Regular attendance check-in",
      gpsValidated: gpsDistanceMeters <= this.getRadius(payload.location),
      gpsDistanceMeters,
      photoUrl,
      status: currentMinutes > scheduledMinutes ? "late" : "on-time",
      overtimeMinutes: 0
    };
    db.attendanceLogs.unshift(record);
    await this.writeDb(db);
    return record;
  }

  async checkOut(payload: CheckOutDto) {
    const db = await this.readDb();
    const record = db.attendanceLogs.find((entry) => entry.id === payload.attendanceId);
    if (!record) {
      throw new NotFoundException("Attendance record not found");
    }
    const now = new Date();
    const checkOutTime = payload.checkOut ?? this.formatClock(now);
    record.checkOut = checkOutTime;

    const scheduled = this.parseClock(NON_SHIFT_END);
    const actual = payload.checkOut ? this.parseClock(payload.checkOut.replace(/\s?(AM|PM)$/i, "").trim()) : { hour: now.getHours(), minute: now.getMinutes() };
    const overtimeMinutes = Math.max(0, actual.hour * 60 + actual.minute - (scheduled.hour * 60 + scheduled.minute));
    record.overtimeMinutes = overtimeMinutes;

    if (overtimeMinutes > 0) {
      db.overtimeRequests.unshift({
        id: `ot-${randomUUID().slice(0, 8)}`,
        userId: record.userId,
        employeeName: record.employeeName,
        department: record.department,
        date: record.timestamp.slice(0, 10),
        minutes: overtimeMinutes,
        reason: "Auto captured from attendance check-out",
        status: "pending"
      });
    }

    await this.writeDb(db);
    return record;
  }

  async createOvertimeRequest(payload: CreateOvertimeDto) {
    const db = await this.readDb();
    const record: OvertimeRecord = { id: `ot-${randomUUID().slice(0, 8)}`, ...payload, status: "pending" };
    db.overtimeRequests.unshift(record);
    await this.writeDb(db);
    return record;
  }

  async approveOvertimeRequest(payload: OvertimeApproveDto, actor?: AuthenticatedActor) {
    const db = await this.readDb();
    const overtime = db.overtimeRequests.find((entry) => entry.id === payload.overtimeId);
    if (!overtime) {
      throw new NotFoundException("Overtime request not found");
    }
    const employee = db.employees.find((entry) => entry.id === overtime.userId);
    this.assertManagerApprovalScope(actor, employee);
    overtime.status = payload.status;
    await this.writeDb(db);
    await this.writeAuditLog("overtime.approve", { overtimeId: overtime.id, status: payload.status, actor: actor?.name ?? payload.actor });
    return overtime;
  }

  async getLeaveHistory() {
    const db = await this.readDb();
    return db.leaveRequests.map((record) => this.toSafeLeaveRecord(record));
  }  async requestLeave(payload: LeaveRequestDto, file?: Express.Multer.File, supportingDocumentUrl?: string | null) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.userId);
    const daysRequested = this.getRequestedDays(payload.type, payload.startDate, payload.endDate);
    const leave: LeaveRecord = {
      id: `leave-${randomUUID().slice(0, 8)}`,
      requestedAt: new Date().toISOString(),
      status: "pending-manager",
      approverFlow: ["Manager Pending"],
      balanceLabel: this.describeBalance(employee, payload.type, daysRequested),
      daysRequested,
      autoApproved: false,
      supportingDocumentName: file?.originalname ?? null,
      supportingDocumentUrl: supportingDocumentUrl ?? null,
      ...payload
    };

    db.leaveRequests.unshift(leave);
    await this.writeDb(db);
    await this.writeAuditLog("leave.request", {
      leaveId: leave.id,
      userId: leave.userId,
      type: leave.type,
      hasSupportingDocument: Boolean(leave.supportingDocumentUrl)
    });
    return this.toSafeLeaveRecord(leave);
  }
  async approveLeave(payload: LeaveApproveDto, actor?: AuthenticatedActor) {
    const db = await this.readDb();
    const leave = db.leaveRequests.find((entry) => entry.id === payload.leaveId);
    if (!leave) {
      throw new NotFoundException("Leave request not found");
    }
    const employee = db.employees.find((entry) => entry.id === leave.userId);
    this.assertManagerApprovalScope(actor, employee);
    const wasApproved = leave.status === "approved";
    leave.status = payload.status;
    leave.approverFlow = [...leave.approverFlow, `${actor?.name ?? payload.actor} -> ${payload.status}`];

    if (payload.status === "approved" && employee && !wasApproved) {
      this.applyLeaveBalance(employee, leave.type, leave.daysRequested);
      leave.balanceLabel = this.leaveBalanceLabelAfterApproval(employee, leave.type);

      if (leave.type === "On Duty Request" || leave.type === "Remote Work") {
        const generated = this.buildOnDutyAttendanceRecords(employee, leave, db.attendanceLogs);
        if (generated.length > 0) {
          db.attendanceLogs = [...generated.reverse(), ...db.attendanceLogs];
        }
      }
    }

    await this.writeDb(db);
    await this.writeAuditLog("leave.approve", { leaveId: leave.id, status: payload.status, actor: actor?.name ?? payload.actor });
    return this.toSafeLeaveRecord(leave);
  }

  async getReimbursementClaimTypes() {
    const db = await this.readDb();
    return db.reimbursementClaimTypes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createReimbursementClaimType(payload: CreateReimbursementClaimTypeDto) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.employeeId);
    const now = new Date().toISOString();
    const claimType: ReimbursementClaimTypeRecord = {
      id: `claim-${randomUUID().slice(0, 8)}`,
      employeeId: payload.employeeId,
      employeeName: employee?.name ?? payload.employeeName,
      department: employee?.department ?? payload.department,
      designation: employee?.position ?? payload.designation,
      category: payload.category,
      claimType: payload.claimType,
      subType: payload.subType,
      currency: payload.currency,
      annualLimit: payload.annualLimit,
      remainingBalance: Math.min(payload.remainingBalance, payload.annualLimit),
      active: payload.active,
      notes: payload.notes ?? "",
      createdAt: now,
      updatedAt: now
    };
    db.reimbursementClaimTypes.unshift(claimType);
    await this.writeDb(db);
    return claimType;
  }

  async updateReimbursementClaimType(id: string, payload: UpdateReimbursementClaimTypeDto) {
    const db = await this.readDb();
    const claimType = db.reimbursementClaimTypes.find((entry) => entry.id === id);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }

    const employee = payload.employeeId ? db.employees.find((entry) => entry.id === payload.employeeId) : null;
    Object.assign(claimType, payload);
    if (employee) {
      claimType.employeeId = employee.id;
      claimType.employeeName = employee.name;
      claimType.department = employee.department;
      claimType.designation = employee.position;
    }
    if (payload.annualLimit !== undefined && claimType.remainingBalance > payload.annualLimit) {
      claimType.remainingBalance = payload.annualLimit;
    }
    claimType.updatedAt = new Date().toISOString();
    await this.writeDb(db);
    return claimType;
  }

  async deleteReimbursementClaimType(id: string) {
    const db = await this.readDb();
    const exists = db.reimbursementClaimTypes.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Reimbursement claim type not found");
    }
    db.reimbursementClaimTypes = db.reimbursementClaimTypes.filter((entry) => entry.id !== id);
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getReimbursementRequests(query?: ReimbursementRequestListQueryDto) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.department || query?.status || query?.userId);
    const prisma = this.getPrisma();

    if (prisma && shouldPaginate) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.department ? { department: query.department } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.userId ? { userId: query.userId } : {})
      };

      if (search) {
        where.OR = [
          { employeeName: { contains: search, mode: "insensitive" } },
          { claimType: { contains: search, mode: "insensitive" } },
          { subType: { contains: search, mode: "insensitive" } },
          { remarks: { contains: search, mode: "insensitive" } }
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.reimbursementRequest.count({ where }),
        prisma.reimbursementRequest.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: meta.skip,
          take: meta.pageSize
        })
      ]);

      const items = rows.map((record: any) => this.toSafeReimbursementRequest({
        ...record,
        amount: Number(record.amount),
        balanceSnapshot: Number(record.balanceSnapshot),
        submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
        approvedAt: record.approvedAt ? record.approvedAt.toISOString() : null,
        processedAt: record.processedAt ? record.processedAt.toISOString() : null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      }));

      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<ReimbursementRequestRecord>;
    }

    const db = await this.readDb();
    let records = [...db.reimbursementRequests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (query?.userId) {
      records = records.filter((entry) => entry.userId === query.userId);
    }
    if (query?.department) {
      records = records.filter((entry) => entry.department === query.department);
    }
    if (query?.status) {
      records = records.filter((entry) => entry.status === query.status);
    }
    if (query?.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      records = records.filter((entry) =>
        [entry.employeeName, entry.claimType, entry.subType, entry.remarks].some((value) =>
          value.toLowerCase().includes(search)
        )
      );
    }
    if (!shouldPaginate) {
      return records.map((record) => this.toSafeReimbursementRequest(record));
    }
    const paginated = this.paginateArray(records, query?.page, query?.pageSize);
    return {
      ...paginated,
      items: paginated.items.map((record) => this.toSafeReimbursementRequest(record))
    };
  }

  async createReimbursementRequest(
    payload: CreateReimbursementRequestDto,
    file?: Express.Multer.File,
    receiptFileUrl?: string | null
  ) {
    const db = await this.readDb();
    const claimType = this.findReimbursementClaimType(db, payload.claimTypeId);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }
    if (claimType.employeeId !== payload.userId) {
      throw new NotFoundException("Claim type is not available for this employee");
    }

    const now = new Date().toISOString();
    const amount = Number(payload.amount);
    const shouldSubmit = this.parseBooleanFlag((payload as { submit?: unknown }).submit);
    if (shouldSubmit && !file) {
      throw new NotFoundException("Receipt file is required before submitting reimbursement");
    }
    if (shouldSubmit && amount > claimType.remainingBalance) {
      throw new NotFoundException("Requested amount exceeds remaining reimbursement balance");
    }

    const request: ReimbursementRequestRecord = {
      id: `reimb-${randomUUID().slice(0, 8)}`,
      userId: payload.userId,
      employeeName: payload.employeeName,
      department: payload.department,
      designation: payload.designation,
      claimTypeId: claimType.id,
      claimType: claimType.claimType,
      subType: claimType.subType,
      category: claimType.category,
      currency: payload.currency,
      amount,
      receiptDate: payload.receiptDate,
      remarks: payload.remarks ?? "",
      receiptFileName: file?.originalname ?? null,
      receiptFileUrl: receiptFileUrl ?? null,
      status: shouldSubmit ? "pending-manager" : "draft",
      submittedAt: shouldSubmit ? now : null,
      approvedAt: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
      approverFlow: shouldSubmit ? ["Employee submitted reimbursement", "Manager pending"] : ["Saved as draft"],
      balanceSnapshot: claimType.remainingBalance
    };

    db.reimbursementRequests.unshift(request);
    await this.writeDb(db);
    return this.toSafeReimbursementRequest(request);
  }

  async updateReimbursementRequest(
    id: string,
    payload: UpdateReimbursementRequestDto,
    file?: Express.Multer.File,
    receiptFileUrl?: string | null
  ) {
    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === id);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (!["draft", "pending-manager"].includes(request.status)) {
      throw new NotFoundException("Only draft or pending manager requests can be updated");
    }

    const claimType = this.findReimbursementClaimType(db, payload.claimTypeId ?? request.claimTypeId);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }

    const amount = payload.amount !== undefined ? Number(payload.amount) : request.amount;
    const receiptDate = payload.receiptDate ?? request.receiptDate;
    const currency = payload.currency ?? request.currency;
    const remarks = payload.remarks ?? request.remarks;
    const shouldSubmit = this.parseBooleanFlag((payload as { submit?: unknown }).submit);
    const nextReceiptFileUrl = receiptFileUrl ?? request.receiptFileUrl;

    if (shouldSubmit && !nextReceiptFileUrl) {
      throw new NotFoundException("Receipt file is required before submitting reimbursement");
    }
    if (shouldSubmit && amount > claimType.remainingBalance) {
      throw new NotFoundException("Requested amount exceeds remaining reimbursement balance");
    }

    if (file && request.receiptFileUrl) {
      this.removeStoredFile(request.receiptFileUrl);
    }

    this.applyReimbursementClaimDetails(request, claimType, amount, receiptDate, currency, remarks);
    request.receiptFileName = file?.originalname ?? request.receiptFileName;
    request.receiptFileUrl = nextReceiptFileUrl;
    request.updatedAt = new Date().toISOString();

    if (shouldSubmit) {
      request.status = "pending-manager";
      request.submittedAt = request.submittedAt ?? request.updatedAt;
      request.approverFlow = [...request.approverFlow.filter((entry) => entry !== "Saved as draft"), "Submitted to manager"];
    } else if (request.status === "draft") {
      request.approverFlow = ["Saved as draft"];
    }

    await this.writeDb(db);
    return this.toSafeReimbursementRequest(request);
  }

  async managerApproveReimbursement(payload: ReimbursementApproveDto) {
    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === payload.reimbursementId);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (request.status !== "pending-manager") {
      throw new NotFoundException("Reimbursement is not waiting for manager approval");
    }

    request.status = payload.status === "approved" ? "awaiting-hr" : "rejected";
    request.approvedAt = payload.status === "approved" ? new Date().toISOString() : null;
    request.updatedAt = new Date().toISOString();
    request.approverFlow = [
      ...request.approverFlow,
      payload.status === "approved" ? `${payload.actor} approved, HR pending` : `${payload.actor} rejected`
    ];
    await this.writeDb(db);
    await this.writeAuditLog("reimbursement.manager-approve", {
      reimbursementId: request.id,
      status: payload.status,
      actor: payload.actor
    });
    return this.toSafeReimbursementRequest(request);
  }

  async hrProcessReimbursement(payload: ReimbursementProcessDto) {
    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === payload.reimbursementId);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (!["awaiting-hr", "approved"].includes(request.status)) {
      throw new NotFoundException("Reimbursement is not ready for HR processing");
    }

    const claimType = db.reimbursementClaimTypes.find((entry) => entry.id === request.claimTypeId);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }

    if (payload.status === "rejected") {
      request.status = "rejected";
      request.updatedAt = new Date().toISOString();
      request.approverFlow = [...request.approverFlow, `${payload.actor} rejected`];
      await this.writeDb(db);
      await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor });
      return this.toSafeReimbursementRequest(request);
    }

    if (payload.status === "approved") {
      request.status = "approved";
      request.approvedAt = request.approvedAt ?? new Date().toISOString();
      request.updatedAt = new Date().toISOString();
      request.approverFlow = [...request.approverFlow, `${payload.actor} approved for payout`];
      await this.writeDb(db);
      await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor });
      return this.toSafeReimbursementRequest(request);
    }

    if (request.amount > claimType.remainingBalance) {
      throw new NotFoundException("Remaining balance is insufficient to process this reimbursement");
    }

    claimType.remainingBalance = Number((claimType.remainingBalance - request.amount).toFixed(2));
    claimType.updatedAt = new Date().toISOString();
    request.status = "processed";
    request.approvedAt = request.approvedAt ?? new Date().toISOString();
    request.processedAt = new Date().toISOString();
    request.updatedAt = request.processedAt;
    request.approverFlow = [...request.approverFlow, `${payload.actor} processed reimbursement`];
    await this.writeDb(db);
    await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor });
    return this.toSafeReimbursementRequest(request);
  }

  async getPayrollOverview() {
    const db = await this.readDb();
    const latestRun = [...db.payRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
    const draftCount = db.payRuns.filter((run) => run.status === "draft").length;
    const publishedCount = db.payslips.filter((slip) => slip.status === "published").length;
    return {
      latestRun,
      payrollComponents: db.payrollComponents.length,
      activeEmployees: db.employees.filter((employee) => employee.status === "active").length,
      draftRuns: draftCount,
      publishedPayslips: publishedCount
    };
  }

  async getPayrollComponents() {
    const db = await this.readDb();
    return db.payrollComponents;
  }

  async createPayrollComponent(payload: CreatePayrollComponentDto) {
    const db = await this.readDb();
    const component: PayrollComponentRecord = {
      id: `paycomp-${randomUUID().slice(0, 8)}`,
      code: payload.code.toUpperCase(),
      name: payload.name,
      type: payload.type,
      calculationType: payload.calculationType,
      amount: payload.amount,
      percentage: payload.percentage ?? null,
      taxable: payload.taxable,
      active: payload.active,
      appliesToAll: payload.appliesToAll,
      employeeIds: payload.employeeIds ?? [],
      description: payload.description
    };
    db.payrollComponents.unshift(component);
    await this.writeDb(db);
    return component;
  }

  async updatePayrollComponent(id: string, payload: UpdatePayrollComponentDto) {
    const db = await this.readDb();
    const component = db.payrollComponents.find((entry) => entry.id === id);
    if (!component) {
      throw new NotFoundException("Payroll component not found");
    }
    Object.assign(component, payload, payload.code ? { code: payload.code.toUpperCase() } : {}, payload.employeeIds ? { employeeIds: payload.employeeIds } : {});
    await this.writeDb(db);
    return component;
  }

  async deletePayrollComponent(id: string) {
    const db = await this.readDb();
    const exists = db.payrollComponents.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Payroll component not found");
    }
    db.payrollComponents = db.payrollComponents.filter((entry) => entry.id !== id);
    db.employees = db.employees.map((employee) => ({
      ...employee,
      financialComponentIds: employee.financialComponentIds.filter((componentId) => componentId !== id)
    }));
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getPayRuns() {
    const db = await this.readDb();
    return [...db.payRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  }

  async generatePayrollRun(payload: GeneratePayrollRunDto) {
    const db = await this.readDb();
    const activeEmployees = db.employees.filter((employee) => employee.status === "active");
    const payRunId = `payrun-${randomUUID().slice(0, 8)}`;
    const slips = activeEmployees.map((employee) => this.buildPayslip(employee, db, payload, payRunId));
    const payRun: PayRunRecord = {
      id: payRunId,
      periodLabel: payload.periodLabel,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      payDate: payload.payDate,
      status: "draft",
      totalGross: slips.reduce((sum, slip) => sum + slip.grossPay, 0),
      totalNet: slips.reduce((sum, slip) => sum + slip.netPay, 0),
      totalTax: slips.reduce((sum, slip) => sum + slip.taxDeduction, 0),
      employeeCount: slips.length,
      createdAt: new Date().toISOString(),
      publishedAt: null
    };
    db.payRuns.unshift(payRun);
    db.payslips = [...slips, ...db.payslips.filter((slip) => slip.payRunId !== payRunId)];
    await this.writeDb(db);
    await this.writeAuditLog("payroll.generate-run", { payRunId, periodLabel: payload.periodLabel, employeeCount: slips.length });
    return { payRun, payslips: slips };
  }

  async publishPayrollRun(payload: PublishPayrollRunDto) {
    const db = await this.readDb();
    const payRun = db.payRuns.find((entry) => entry.id === payload.payRunId);
    if (!payRun) {
      throw new NotFoundException("Pay run not found");
    }
    payRun.status = "published";
    payRun.publishedAt = new Date().toISOString();
    db.payslips = db.payslips.map((slip) => slip.payRunId === payRun.id ? { ...slip, status: "published" } : slip);
    await this.writeDb(db);
    await this.writeAuditLog("payroll.publish-run", { payRunId: payRun.id, periodLabel: payRun.periodLabel });
    return payRun;
  }

  async getPayslips(query?: PayslipListQueryDto) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.status || query?.userId);
    const prisma = this.getPrisma();

    if (prisma && shouldPaginate) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.userId ? { userId: query.userId } : {}),
        ...(query?.status ? { status: query.status } : {})
      };

      if (search) {
        where.OR = [
          { employeeName: { contains: search, mode: "insensitive" } },
          { employeeNumber: { contains: search, mode: "insensitive" } },
          { periodLabel: { contains: search, mode: "insensitive" } },
          { department: { contains: search, mode: "insensitive" } }
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.payslip.count({ where }),
        prisma.payslip.findMany({
          where,
          orderBy: { payDate: "desc" },
          skip: meta.skip,
          take: meta.pageSize
        })
      ]);

      const items = rows.map((record: any) => ({
        ...record,
        baseSalary: Number(record.baseSalary),
        allowance: Number(record.allowance),
        overtimePay: Number(record.overtimePay),
        additionalEarnings: Number(record.additionalEarnings),
        grossPay: Number(record.grossPay),
        taxDeduction: Number(record.taxDeduction),
        otherDeductions: Number(record.otherDeductions),
        netPay: Number(record.netPay),
        components: Array.isArray(record.components) ? record.components : []
      }));

      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<PayslipRecord>;
    }

    const db = await this.readDb();
    let slips = query?.userId ? db.payslips.filter((slip) => slip.userId === query.userId) : db.payslips;
    if (query?.status) {
      slips = slips.filter((slip) => slip.status === query.status);
    }
    if (query?.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      slips = slips.filter((slip) =>
        [slip.employeeName, slip.employeeNumber, slip.periodLabel, slip.department].some((value) =>
          value.toLowerCase().includes(search)
        )
      );
    }
    const sorted = [...slips].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
    if (!shouldPaginate) {
      return sorted;
    }
    return this.paginateArray(sorted, query?.page, query?.pageSize);
  }

  async exportPayslip(payload: ExportPayslipDto) {
    return this.enqueueExportJob({ type: "payslip", payload });
  }

  async generateExport(payload: CreateExportDto) {
    return this.enqueueExportJob({ type: "report", payload });
  }

  async getExportJobStatus(jobId: string) {
    const job = this.exportQueue.find((entry) => entry.id === jobId);
    if (!job) {
      throw new NotFoundException("Export job not found");
    }

    return {
      jobId: job.id,
      status: job.status,
      fileName: job.result?.fileName ?? null,
      fileUrl: job.result?.fileUrl ?? null,
      payslipId: job.result?.payslipId ?? null,
      error: job.error
    };
  }

  private enqueueExportJob(payload: ExportJobPayload) {
    const now = new Date().toISOString();
    const job: ExportJob = {
      id: `exp-${randomUUID().slice(0, 10)}`,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      payload,
      result: null,
      error: null
    };

    this.exportQueue.unshift(job);
    if (this.exportQueue.length > 100) {
      this.exportQueue = this.exportQueue.slice(0, 100);
    }
    this.processExportQueue().catch(() => undefined);
    return { jobId: job.id, status: job.status };
  }

  private async processExportQueue() {
    if (this.activeExportJob) {
      return;
    }

    this.activeExportJob = true;
    try {
      while (true) {
        const nextJob = this.exportQueue.find((entry) => entry.status === "queued");
        if (!nextJob) {
          break;
        }

        nextJob.status = "processing";
        nextJob.updatedAt = new Date().toISOString();
        try {
          nextJob.result = nextJob.payload.type === "report"
            ? await this.performReportExport(nextJob.payload.payload)
            : await this.performPayslipExport(nextJob.payload.payload);
          nextJob.status = "done";
          nextJob.error = null;
        } catch (error) {
          nextJob.status = "failed";
          nextJob.error = error instanceof Error ? error.message : "Export job failed";
        } finally {
          nextJob.updatedAt = new Date().toISOString();
        }
      }
    } finally {
      this.activeExportJob = false;
    }
  }

  private async performPayslipExport(payload: ExportPayslipDto) {
    const db = await this.readDb();
    const payslip = db.payslips.find((entry) => entry.id === payload.payslipId);
    if (!payslip) {
      throw new NotFoundException("Payslip not found");
    }
    const fileName = `${this.safeFileBaseName(payslip.employeeNumber, "employee")}-${this.safeFileBaseName(payslip.periodLabel, "payslip")}.xlsx`;
    const fullPath = path.join(this.storageRoot, "documents", fileName);

    const rows = [
      ["Employee Name", payslip.employeeName],
      ["Employee Number", payslip.employeeNumber],
      ["Department", payslip.department],
      ["Position", payslip.position],
      ["Period", payslip.periodLabel],
      ["Pay Date", payslip.payDate],
      [""],
      ["Earnings", "Amount"],
      ["Base Salary", payslip.baseSalary],
      ["Allowance", payslip.allowance],
      ["Overtime", payslip.overtimePay],
      ["Additional Earnings", payslip.additionalEarnings],
      [""],
      ["Deductions", "Amount"],
      ["Tax Deduction", payslip.taxDeduction],
      ["Other Deductions", payslip.otherDeductions],
      [""],
      ["Net Pay", payslip.netPay]
    ];

    await this.writeWorkbookFromRows(fullPath, "Payslip", rows);

    payslip.generatedFileUrl = `/storage/documents/${fileName}`;
    await this.writeDb(db);
    return { fileName, fileUrl: payslip.generatedFileUrl, payslipId: payslip.id };
  }

  private async performReportExport(payload: CreateExportDto) {
    const extension = (payload.fileExtension ?? (Array.isArray(payload.columns) || Array.isArray(payload.rows) ? "xlsx" : "txt"))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "txt";

    const reportSlug = this.safeFileBaseName(payload.reportName, "report");
    const fileName = `${reportSlug}-${Date.now()}.${extension}`;
    const fullPath = path.join(this.storageRoot, "exports", fileName);

    if (extension === "xlsx") {
      const columns = Array.isArray(payload.columns) ? payload.columns.map((item) => String(item)) : [];
      const rows = Array.isArray(payload.rows)
        ? payload.rows
            .filter((entry): entry is unknown[] => Array.isArray(entry))
            .map((row) => row.map((cell) => (cell == null ? "" : String(cell))))
        : [];
      const workbookRows = columns.length > 0 ? [columns, ...rows] : rows;
      await this.writeWorkbookFromRows(fullPath, (payload.sheetName?.trim() || "Report").slice(0, 31), workbookRows);
      return { fileName, fileUrl: `/storage/exports/${fileName}` };
    }

    const content = payload.content ?? "Generated from PulsePresence local export service.";
    await writeFile(fullPath, content, "utf8");
    return { fileName, fileUrl: `/storage/exports/${fileName}` };
  }

  private async writeWorkbookFromRows(filePath: string, sheetName: string, rows: Array<Array<string | number>>) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName || "Sheet1");
    for (const row of rows) {
      worksheet.addRow(row);
    }

    if (rows.length > 0) {
      const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
      worksheet.columns = Array.from({ length: maxColumns }, (_, index) => {
        const maxLength = rows.reduce((longest, row) => {
          const value = row[index];
          const text = value == null ? "" : String(value);
          return Math.max(longest, text.length);
        }, 0);
        return { width: Math.min(Math.max(maxLength + 2, 12), 40) };
      });
    }

    await workbook.xlsx.writeFile(filePath);
  }
}






























