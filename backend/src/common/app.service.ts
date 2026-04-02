import { Injectable, NotFoundException } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedData } from "../data/seed";
import {
  AttendanceRecord,
  DatabaseShape,
  EmployeeRecord,
  LeaveRecord,
  LeaveType,
  OvertimeRecord,
  ShiftRecord
} from "./types";
import {
  CheckInDto,
  CheckOutDto,
  CreateEmployeeDto,
  CreateExportDto,
  CreateOvertimeDto,
  LeaveApproveDto,
  LeaveRequestDto,
  UpdateEmployeeDto
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
    current.attendanceLogs = (current.attendanceLogs ?? []).map((attendance, index) =>
      this.normalizeAttendance(attendance, current.employees, index)
    );
    current.shifts = (current.shifts?.length ? current.shifts : seedData.shifts).map((shift, index) =>
      this.normalizeShift(shift, index)
    );
    current.overtimeRequests = (current.overtimeRequests?.length ? current.overtimeRequests : seedData.overtimeRequests).map((record, index) =>
      this.normalizeOvertime(record, index)
    );
    current.leaveRequests = (current.leaveRequests ?? []).map((record, index) =>
      this.normalizeLeave(record, current.employees, index)
    );
    await this.writeDb(current);
  }

  private normalizeEmployee(employee: Partial<EmployeeRecord> & Record<string, unknown>, index: number): EmployeeRecord {
    const padded = String(index + 1).padStart(3, "0");
    const leaveBalances = (employee.leaveBalances as EmployeeRecord["leaveBalances"] | undefined) ?? {
      annual: 12,
      sick: 10,
      permission: 4
    };
    return {
      id: String(employee.id ?? `emp-${padded}`),
      employeeNumber: String(employee.employeeNumber ?? `EMP-2024-${padded}`),
      name: String(employee.name ?? "Unnamed Employee"),
      email: String(employee.email ?? `employee${padded}@praluxstd.com`),
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
      contractStatus: (employee.contractStatus as EmployeeRecord["contractStatus"]) ?? "active",
      contractStart: String(employee.contractStart ?? employee.joinDate ?? new Date().toISOString().slice(0, 10)),
      contractEnd: employee.contractEnd == null ? null : String(employee.contractEnd),
      baseSalary: Number(employee.baseSalary ?? 12000000),
      allowance: Number(employee.allowance ?? 1000000),
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

  private normalizeAttendance(
    attendance: Partial<AttendanceRecord> & Record<string, unknown>,
    employees: EmployeeRecord[],
    index: number
  ): AttendanceRecord {
    const employee = employees.find((entry) => entry.id === String(attendance.userId ?? ""));
    const location = String(attendance.location ?? employee?.workLocation ?? "Jakarta HQ");
    const shift = this.resolveShift(location, employee?.department);
    const latitude = Number(attendance.latitude ?? siteDirectory[location]?.latitude ?? -6.2);
    const longitude = Number(attendance.longitude ?? siteDirectory[location]?.longitude ?? 106.816666);
    const gpsDistanceMeters = Number(attendance.gpsDistanceMeters ?? this.measureDistanceMeters(location, latitude, longitude));
    return {
      id: String(attendance.id ?? `att-${String(index + 1).padStart(3, "0")}`),
      userId: String(attendance.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(attendance.employeeName ?? employee?.name ?? "Unknown Employee"),
      department: String(attendance.department ?? employee?.department ?? "General Operations"),
      timestamp: String(attendance.timestamp ?? new Date().toISOString()),
      checkIn: String(attendance.checkIn ?? shift.startTime),
      checkOut: attendance.checkOut == null ? null : String(attendance.checkOut),
      location,
      latitude,
      longitude,
      shiftName: String(attendance.shiftName ?? shift.name),
      scheduledStart: String(attendance.scheduledStart ?? shift.startTime),
      scheduledEnd: String(attendance.scheduledEnd ?? shift.endTime),
      gpsValidated: typeof attendance.gpsValidated === "boolean" ? attendance.gpsValidated : gpsDistanceMeters <= this.getRadius(location),
      gpsDistanceMeters,
      photoUrl: attendance.photoUrl == null ? null : String(attendance.photoUrl),
      status: (attendance.status as AttendanceRecord["status"]) ?? "on-time",
      overtimeMinutes: Number(attendance.overtimeMinutes ?? 0)
    };
  }

  private normalizeShift(shift: Partial<ShiftRecord> & Record<string, unknown>, index: number): ShiftRecord {
    return {
      id: String(shift.id ?? `shift-${String(index + 1).padStart(3, "0")}`),
      name: String(shift.name ?? `Shift ${index + 1}`),
      department: String(shift.department ?? "General Operations"),
      startTime: String(shift.startTime ?? "09:00"),
      endTime: String(shift.endTime ?? "17:00"),
      workDays: Array.isArray(shift.workDays) ? shift.workDays.map((entry) => String(entry)) : ["Mon", "Tue", "Wed", "Thu", "Fri"],
      workLocation: String(shift.workLocation ?? "Jakarta HQ"),
      employeesAssigned: Number(shift.employeesAssigned ?? 0),
      status: (shift.status as ShiftRecord["status"]) ?? "scheduled"
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

  private normalizeLeave(
    record: Partial<LeaveRecord> & Record<string, unknown>,
    employees: EmployeeRecord[],
    index: number
  ): LeaveRecord {
    const employee = employees.find((entry) => entry.id === String(record.userId ?? ""));
    const type = (record.type as LeaveType | undefined) ?? "Annual Leave";
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

  private resolveShift(location: string, department?: string) {
    const defaultShift = { name: "Core Shift", startTime: "09:00", endTime: "17:00" };
    const byLocation = seedData.shifts.find((shift) => shift.workLocation === location);
    const byDepartment = seedData.shifts.find((shift) => shift.department === department);
    return byLocation ?? byDepartment ?? defaultShift;
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

  private describeBalance(employee: EmployeeRecord | undefined, type: LeaveType, daysRequested: number) {
    if (!employee) {
      return `${daysRequested} day request`;
    }
    switch (type) {
      case "Annual Leave":
        return `Annual leave ${employee.leaveBalances.annual} days, ${daysRequested} requested`;
      case "Sick Leave":
        return `Sick leave ${employee.leaveBalances.sick} days, ${daysRequested} used`;
      case "Permission":
        return `Permission quota ${employee.leaveBalances.permission} days, ${daysRequested} requested`;
      default:
        return `Policy-based workflow, ${daysRequested} day request`;
    }
  }

  private shouldAutoApprove(type: LeaveType, daysRequested: number) {
    return (type === "Sick Leave" || type === "Permission") && daysRequested === 1;
  }

  private applyLeaveBalance(employee: EmployeeRecord, type: LeaveType, daysRequested: number) {
    if (type === "Annual Leave") {
      employee.leaveBalances.annual = Math.max(0, employee.leaveBalances.annual - daysRequested);
    }
    if (type === "Sick Leave") {
      employee.leaveBalances.sick = Math.max(0, employee.leaveBalances.sick - daysRequested);
    }
    if (type === "Permission") {
      employee.leaveBalances.permission = Math.max(0, employee.leaveBalances.permission - daysRequested);
    }
  }

  private leaveBalanceLabelAfterApproval(employee: EmployeeRecord | undefined, type: LeaveType) {
    if (!employee) {
      return "Balance updated";
    }
    switch (type) {
      case "Annual Leave":
        return `${employee.leaveBalances.annual} annual leave days remaining`;
      case "Sick Leave":
        return `${employee.leaveBalances.sick} sick leave days remaining`;
      case "Permission":
        return `${employee.leaveBalances.permission} permission days remaining`;
      default:
        return "Policy-based confirmed";
    }
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
        shifts: db.shifts.length,
        overtimeRequests: db.overtimeRequests.length,
        leaveRequests: db.leaveRequests.length
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
    const employee: EmployeeRecord = {
      id: `emp-${randomUUID().slice(0, 8)}`,
      employeeNumber: `EMP-2026-${sequence}`,
      joinDate: new Date().toISOString().slice(0, 10),
      ...payload,
      contractEnd: payload.contractEnd ?? null,
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
    Object.assign(employee, payload);
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
    const overtimeMinutes = db.overtimeRequests
      .filter((entry) => entry.status === "approved" || entry.status === "paid" || entry.status === "pending")
      .reduce((total, entry) => total + entry.minutes, 0);
    const activeShifts = db.shifts.filter((entry) => entry.status === "active").length;
    const scheduledShifts = db.shifts.filter((entry) => entry.status === "scheduled").length;
    return {
      checkedInToday: today.length,
      openCheckIns,
      gpsValidated,
      selfieCaptured,
      overtimeHours: Number((overtimeMinutes / 60).toFixed(1)),
      activeShifts,
      scheduledShifts
    };
  }

  async getShifts() {
    const db = await this.readDb();
    return db.shifts;
  }

  async getOvertimeRequests() {
    const db = await this.readDb();
    return db.overtimeRequests;
  }

  async checkIn(payload: CheckInDto, photoUrl: string | null) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.userId);
    const shift = db.shifts.find((entry) => entry.name === payload.shiftName) ?? this.resolveShift(payload.location, payload.department);
    const now = new Date();
    const schedule = this.parseClock(shift.startTime);
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
      shiftName: shift.name,
      scheduledStart: shift.startTime,
      scheduledEnd: shift.endTime,
      gpsValidated: gpsDistanceMeters <= this.getRadius(payload.location),
      gpsDistanceMeters,
      photoUrl,
      status: currentMinutes > scheduledMinutes ? "late" : "on-time",
      overtimeMinutes: 0
    };
    db.attendanceLogs.unshift(record);
    if (employee && !db.shifts.some((entry) => entry.name === shift.name && entry.department === employee.department)) {
      db.shifts.unshift({
        id: `shift-${randomUUID().slice(0, 8)}`,
        name: shift.name,
        department: employee.department,
        startTime: shift.startTime,
        endTime: shift.endTime,
        workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        workLocation: employee.workLocation,
        employeesAssigned: 1,
        status: "scheduled"
      });
    }
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

    const scheduled = this.parseClock(record.scheduledEnd);
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
        reason: `Auto captured from ${record.shiftName} check-out`,
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

  async getLeaveHistory() {
    const db = await this.readDb();
    return db.leaveRequests;
  }

  async requestLeave(payload: LeaveRequestDto) {
    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.userId);
    const daysRequested = this.calculateLeaveDays(payload.startDate, payload.endDate);
    const autoApproved = this.shouldAutoApprove(payload.type, daysRequested);
    const leave: LeaveRecord = {
      id: `leave-${randomUUID().slice(0, 8)}`,
      requestedAt: new Date().toISOString(),
      status: autoApproved ? "approved" : payload.type === "Annual Leave" ? "awaiting-hr" : "pending-manager",
      approverFlow: autoApproved
        ? ["Manager Auto-approved", "HR Confirmed"]
        : payload.type === "Annual Leave"
          ? ["Manager Approved", "HR Pending"]
          : ["Manager Pending", "HR Pending"],
      balanceLabel: this.describeBalance(employee, payload.type, daysRequested),
      daysRequested,
      autoApproved,
      ...payload
    };

    if (employee && autoApproved) {
      this.applyLeaveBalance(employee, payload.type, daysRequested);
      leave.balanceLabel = this.leaveBalanceLabelAfterApproval(employee, payload.type);
    }

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
    }

    await this.writeDb(db);
    return leave;
  }

  async generateExport(payload: CreateExportDto) {
    const content = payload.content ?? "Generated from PulsePresence local export service.";
    const fileName = `${payload.reportName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.txt`;
    const fullPath = path.join(this.storageRoot, "exports", fileName);
    await writeFile(fullPath, content, "utf8");
    return { fileName, fileUrl: `/storage/exports/${fileName}` };
  }
}
