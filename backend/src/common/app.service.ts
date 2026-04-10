import { Injectable, NotFoundException } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedData } from "../data/seed";
import {
  AttendanceRecord,
  CompensationProfileRecord,
  DatabaseShape,
  EducationRecord,
  EmployeeRecord,
  LeaveRecord,
  LeaveType,
  OvertimeRecord,
  PayRunRecord,
  PayslipLineItem,
  PayslipRecord,
  PayrollComponentRecord,
  TaxProfileRecord,
  WorkExperienceRecord
} from "./types";
import {
  CheckInDto,
  CheckOutDto,
  CreateCompensationProfileDto,
  CreateEmployeeDto,
  CreateExportDto,
  CreateOvertimeDto,
  CreatePayrollComponentDto,
  CreateTaxProfileDto,
  OvertimeApproveDto,
  ExportPayslipDto,
  GeneratePayrollRunDto,
  LeaveApproveDto,
  LeaveRequestDto,
  PublishPayrollRunDto,
  UpdateCompensationProfileDto,
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

@Injectable()
export class AppService {
  private readonly storageRoot = path.resolve(process.cwd(), "storage");
  private readonly dbPath = path.join(this.storageRoot, "data.json");
  private cache: DatabaseShape | null = null;

  async onModuleInit() {
    await mkdir(this.storageRoot, { recursive: true });
    await Promise.all([
      mkdir(path.join(this.storageRoot, "attendance-selfies"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "documents"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "exports"), { recursive: true })
    ]);

    if (!existsSync(this.dbPath)) {
      await writeFile(this.dbPath, JSON.stringify(seedData, null, 2), "utf8");
    }

    const current = await this.readDb();
    current.employees = current.employees.map((employee, index) => this.normalizeEmployee(employee, index));
    current.attendanceLogs = (current.attendanceLogs ?? []).map((attendance, index) => this.normalizeAttendance(attendance, current.employees, index));
    current.overtimeRequests = (current.overtimeRequests?.length ? current.overtimeRequests : seedData.overtimeRequests).map((record, index) => this.normalizeOvertime(record, index));
    current.leaveRequests = (current.leaveRequests ?? []).map((record, index) => this.normalizeLeave(record, current.employees, index));
    current.compensationProfiles = (current.compensationProfiles?.length ? current.compensationProfiles : seedData.compensationProfiles).map((profile, index) => this.normalizeCompensationProfile(profile, index));
    current.taxProfiles = (current.taxProfiles?.length ? current.taxProfiles : seedData.taxProfiles).map((profile, index) => this.normalizeTaxProfile(profile, index));
    current.payrollComponents = (current.payrollComponents?.length ? current.payrollComponents : seedData.payrollComponents).map((component, index) => this.normalizePayrollComponent(component, index));
    current.payRuns = (current.payRuns?.length ? current.payRuns : seedData.payRuns).map((run, index) => this.normalizePayRun(run, index));
    current.payslips = (current.payslips?.length ? current.payslips : seedData.payslips).map((slip, index) => this.normalizePayslip(slip, current.employees, index));
    await this.writeDb(current);
  }

  private normalizeEmployee(employee: Partial<EmployeeRecord> & Record<string, unknown>, index: number): EmployeeRecord {
    const padded = String(index + 1).padStart(3, "0");
    const leaveBalances = (employee.leaveBalances as EmployeeRecord["leaveBalances"] | undefined) ?? { annual: 12, sick: 10, permission: 4 };
    const educationHistory = Array.isArray(employee.educationHistory) ? employee.educationHistory as EducationRecord[] : [];
    const workExperiences = Array.isArray(employee.workExperiences) ? employee.workExperiences as WorkExperienceRecord[] : [];
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
      leaveBalances: {
        annual: Number(leaveBalances.annual ?? 12),
        sick: Number(leaveBalances.sick ?? 10),
        permission: Number(leaveBalances.permission ?? 4)
      }
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
    const type = (record.type as LeaveType | undefined) ?? "Leave Request";
    const daysRequested = Number(record.daysRequested ?? this.calculateLeaveDays(String(record.startDate ?? new Date().toISOString().slice(0, 10)), String(record.endDate ?? new Date().toISOString().slice(0, 10))));
    return {
      id: String(record.id ?? `leave-${String(index + 1).padStart(3, "0")}`),
      userId: String(record.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(record.employeeName ?? employee?.name ?? "Unknown Employee"),
      type,
      startDate: String(record.startDate ?? new Date().toISOString().slice(0, 10)),
      endDate: String(record.endDate ?? new Date().toISOString().slice(0, 10)),
      reason: String(record.reason ?? "Operational request"),
      status: (record.status as LeaveRecord["status"]) ?? "pending-manager",
      approverFlow: Array.isArray(record.approverFlow) ? record.approverFlow.map((entry) => String(entry)) : ["Manager Pending", "HR Pending"],
      balanceLabel: String(record.balanceLabel ?? this.describeBalance(employee, type, daysRequested)),
      requestedAt: String(record.requestedAt ?? new Date().toISOString()),
      daysRequested,
      autoApproved: Boolean(record.autoApproved ?? false)
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

  private async readDb() {
    if (this.cache) {
      return this.cache;
    }
    const raw = await readFile(this.dbPath, "utf8");
    this.cache = JSON.parse(raw) as DatabaseShape;
    return this.cache;
  }

  private async writeDb(next: DatabaseShape) {
    this.cache = next;
    await writeFile(this.dbPath, JSON.stringify(next, null, 2), "utf8");
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
  private describeBalance(employee: EmployeeRecord | undefined, type: LeaveType, daysRequested: number) {
    if (!employee) {
      return `${daysRequested} day request`;
    }
    switch (type) {
      case "Leave Request":
      case "Annual Leave":
        return `Annual leave ${employee.leaveBalances.annual} days, ${daysRequested} requested`;
      case "Sick Submission":
      case "Sick Leave":
        return `Sick submission recorded for ${daysRequested} day(s)`;
      case "Half Day Leave":
        return `Permission quota ${employee.leaveBalances.permission} half-day request`;
      case "Permission":
        return `Permission quota ${employee.leaveBalances.permission} days, ${daysRequested} requested`;
      default:
        return `Policy-based workflow, ${daysRequested} day request`;
    }
  }

  private applyLeaveBalance(employee: EmployeeRecord, type: LeaveType, daysRequested: number) {
    if (type === "Leave Request" || type === "Annual Leave") {
      employee.leaveBalances.annual = Math.max(0, employee.leaveBalances.annual - daysRequested);
    }
    if (type === "Permission") {
      employee.leaveBalances.permission = Math.max(0, employee.leaveBalances.permission - daysRequested);
    }
    if (type === "Half Day Leave") {
      employee.leaveBalances.permission = Math.max(0, employee.leaveBalances.permission - 0.5);
    }
  }

  private leaveBalanceLabelAfterApproval(employee: EmployeeRecord | undefined, type: LeaveType) {
    if (!employee) {
      return "Balance updated";
    }
    switch (type) {
      case "Leave Request":
      case "Annual Leave":
        return `${employee.leaveBalances.annual} annual leave days remaining`;
      case "Sick Submission":
      case "Sick Leave":
        return "Sick leave recorded without balance limit";
      case "Half Day Leave":
        return `${employee.leaveBalances.permission} permission days remaining after half-day request`;
      case "Permission":
        return `${employee.leaveBalances.permission} permission days remaining`;
      default:
        return "Policy-based confirmed";
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

  async health() {
    const db = await this.readDb();
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        api: "online",
        storage: this.storageRoot,
        employees: db.employees.length,
        attendanceLogs: db.attendanceLogs.length,
        overtimeRequests: db.overtimeRequests.length,
        leaveRequests: db.leaveRequests.length,
        payrollComponents: db.payrollComponents.length,
        payRuns: db.payRuns.length,
        payslips: db.payslips.length
      }
    };
  }

  async getDashboardSummary() {
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
      storageMode: "local-directory"
    };
  }

  async getEmployees() {
    const db = await this.readDb();
    return db.employees;
  }

  async createEmployee(payload: CreateEmployeeDto) {
    const db = await this.readDb();
    const sequence = String(db.employees.length + 1).padStart(3, "0");
    const compensationProfile = payload.positionSalaryId
      ? db.compensationProfiles.find((entry) => entry.id === payload.positionSalaryId)
      : null;
    const selectedComponents = db.payrollComponents.filter((entry) => (payload.financialComponentIds ?? []).includes(entry.id));
    const allowance = selectedComponents
      .filter((entry) => entry.type === "earning")
      .reduce((sum, entry) => sum + (entry.calculationType === "percentage" ? Math.round((compensationProfile?.baseSalary ?? payload.baseSalary) * ((entry.percentage ?? 0) / 100)) : entry.amount), 0);
    const selectedTaxProfile = payload.taxProfileId ? db.taxProfiles.find((entry) => entry.id === payload.taxProfileId) : null;
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
      leaveBalances: { annual: 12, sick: 10, permission: 4 }
    };
    db.employees.unshift(employee);
    await this.writeDb(db);
    return employee;
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
    await this.writeDb(db);
    return employee;
  }

  async deleteEmployee(id: string) {
    const db = await this.readDb();
    const nextEmployees = db.employees.filter((entry) => entry.id !== id);
    if (nextEmployees.length === db.employees.length) {
      throw new NotFoundException("Employee not found");
    }
    db.employees = nextEmployees;
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getCompensationProfiles() {
    const db = await this.readDb();
    return db.compensationProfiles;
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

  async getAttendanceHistory() {
    const db = await this.readDb();
    return db.attendanceLogs;
  }

  async getAttendanceToday() {
    const db = await this.readDb();
    const today = new Date().toISOString().slice(0, 10);
    return db.attendanceLogs.filter((entry) => entry.timestamp.slice(0, 10) === today);
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

  async approveOvertimeRequest(payload: OvertimeApproveDto) {
    const db = await this.readDb();
    const overtime = db.overtimeRequests.find((entry) => entry.id === payload.overtimeId);
    if (!overtime) {
      throw new NotFoundException("Overtime request not found");
    }
    overtime.status = payload.status;
    await this.writeDb(db);
    return overtime;
  }

  async getLeaveHistory() {
    const db = await this.readDb();
    return db.leaveRequests;
  }  async requestLeave(payload: LeaveRequestDto) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.userId);
    const daysRequested = this.calculateLeaveDays(payload.startDate, payload.endDate);
    const leave: LeaveRecord = {
      id: `leave-${randomUUID().slice(0, 8)}`,
      requestedAt: new Date().toISOString(),
      status: "pending-manager",
      approverFlow: ["Manager Pending"],
      balanceLabel: this.describeBalance(employee, payload.type, daysRequested),
      daysRequested,
      autoApproved: false,
      ...payload
    };

    db.leaveRequests.unshift(leave);
    await this.writeDb(db);
    return leave;
  }
  async approveLeave(payload: LeaveApproveDto) {
    const db = await this.readDb();
    const leave = db.leaveRequests.find((entry) => entry.id === payload.leaveId);
    if (!leave) {
      throw new NotFoundException("Leave request not found");
    }
    const employee = db.employees.find((entry) => entry.id === leave.userId);
    const wasApproved = leave.status === "approved";
    leave.status = payload.status;
    leave.approverFlow = [...leave.approverFlow, `${payload.actor} -> ${payload.status}`];

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
    return leave;
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
    return payRun;
  }

  async getPayslips(userId?: string) {
    const db = await this.readDb();
    const slips = userId ? db.payslips.filter((slip) => slip.userId === userId) : db.payslips;
    return [...slips].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  }

  async exportPayslip(payload: ExportPayslipDto) {
    const db = await this.readDb();
    const payslip = db.payslips.find((entry) => entry.id === payload.payslipId);
    if (!payslip) {
      throw new NotFoundException("Payslip not found");
    }
    const fileName = `${payslip.employeeNumber.toLowerCase()}-${payslip.periodLabel.replace(/\s+/g, "-").toLowerCase()}.txt`;
    const fullPath = path.join(this.storageRoot, "documents", fileName);
    await writeFile(fullPath, this.buildPayslipExportContent(payslip), "utf8");
    payslip.generatedFileUrl = `/storage/documents/${fileName}`;
    await this.writeDb(db);
    return { fileName, fileUrl: payslip.generatedFileUrl, payslipId: payslip.id };
  }

  async generateExport(payload: CreateExportDto) {
    const content = payload.content ?? "Generated from PulsePresence local export service.";
    const fileName = `${payload.reportName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.txt`;
    const fullPath = path.join(this.storageRoot, "exports", fileName);
    await writeFile(fullPath, content, "utf8");
    return { fileName, fileUrl: `/storage/exports/${fileName}` };
  }
}






























