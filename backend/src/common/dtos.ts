import { Type } from "class-transformer";
import { IsEmail, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  department!: string;

  @IsString()
  position!: string;

  @IsIn(["admin", "hr", "employee", "manager"])
  role!: "admin" | "hr" | "employee" | "manager";

  @IsIn(["active", "inactive"])
  status!: "active" | "inactive";

  @IsString()
  phone!: string;

  @IsString()
  workLocation!: string;

  @IsIn(["onsite", "hybrid", "remote"])
  workType!: "onsite" | "hybrid" | "remote";

  @IsString()
  managerName!: string;

  @IsIn(["permanent", "contract", "probation"])
  employmentType!: "permanent" | "contract" | "probation";

  @IsIn(["active", "probation", "ending-soon", "expired"])
  contractStatus!: "active" | "probation" | "ending-soon" | "expired";

  @IsString()
  contractStart!: string;

  @IsOptional()
  @IsString()
  contractEnd?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allowance!: number;

  @IsString()
  taxProfile!: string;

  @IsString()
  bankName!: string;

  @IsString()
  bankAccountMasked!: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsIn(["admin", "hr", "employee", "manager"])
  role?: "admin" | "hr" | "employee" | "manager";

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsIn(["onsite", "hybrid", "remote"])
  workType?: "onsite" | "hybrid" | "remote";

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsIn(["permanent", "contract", "probation"])
  employmentType?: "permanent" | "contract" | "probation";

  @IsOptional()
  @IsIn(["active", "probation", "ending-soon", "expired"])
  contractStatus?: "active" | "probation" | "ending-soon" | "expired";

  @IsOptional()
  @IsString()
  contractStart?: string;

  @IsOptional()
  @IsString()
  contractEnd?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allowance?: number;

  @IsOptional()
  @IsString()
  taxProfile?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountMasked?: string;
}

export class CheckInDto {
  @IsString()
  userId!: string;

  @IsString()
  employeeName!: string;

  @IsString()
  department!: string;

  @IsString()
  location!: string;

  @IsOptional()
  @IsString()
  shiftName?: string;

  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;
}

export class CheckOutDto {
  @IsString()
  attendanceId!: string;

  @IsOptional()
  @IsString()
  checkOut?: string;
}

export class CreateOvertimeDto {
  @IsString()
  userId!: string;

  @IsString()
  employeeName!: string;

  @IsString()
  department!: string;

  @IsString()
  date!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minutes!: number;

  @IsString()
  reason!: string;
}

export class LeaveRequestDto {
  @IsString()
  userId!: string;

  @IsString()
  employeeName!: string;

  @IsIn(["Annual Leave", "Sick Leave", "Permission", "Remote Work"])
  type!: "Annual Leave" | "Sick Leave" | "Permission" | "Remote Work";

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsString()
  reason!: string;
}

export class LeaveApproveDto {
  @IsString()
  leaveId!: string;

  @IsIn(["approved", "rejected", "awaiting-hr"])
  status!: "approved" | "rejected" | "awaiting-hr";

  @IsString()
  actor!: string;
}

export class CreateExportDto {
  @IsString()
  reportName!: string;

  @IsOptional()
  @IsString()
  content?: string;
}
