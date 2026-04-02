import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppService } from "./common/app.service";
import {
  CheckInDto,
  CheckOutDto,
  CreateEmployeeDto,
  CreateExportDto,
  CreateOvertimeDto,
  LeaveApproveDto,
  LeaveRequestDto,
  UpdateEmployeeDto
} from "./common/dtos";

@Controller("api")
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  async health() {
    return this.wrap(await this.appService.health());
  }

  @Get("dashboard/summary")
  async dashboardSummary() {
    return this.wrap(await this.appService.getDashboardSummary());
  }

  @Get("employees")
  async employees() {
    return this.wrap(await this.appService.getEmployees());
  }

  @Post("employees")
  async createEmployee(@Body() body: CreateEmployeeDto) {
    return this.wrap(await this.appService.createEmployee(body));
  }

  @Patch("employees/:id")
  async updateEmployee(@Param("id") id: string, @Body() body: UpdateEmployeeDto) {
    return this.wrap(await this.appService.updateEmployee(id, body));
  }

  @Delete("employees/:id")
  async deleteEmployee(@Param("id") id: string) {
    return this.wrap(await this.appService.deleteEmployee(id));
  }

  @Get("attendance/history")
  async attendanceHistory() {
    return this.wrap(await this.appService.getAttendanceHistory());
  }

  @Get("attendance/today")
  async attendanceToday() {
    return this.wrap(await this.appService.getAttendanceToday());
  }

  @Get("attendance/overview")
  async attendanceOverview() {
    return this.wrap(await this.appService.getAttendanceOverview());
  }

  @Get("attendance/shifts")
  async attendanceShifts() {
    return this.wrap(await this.appService.getShifts());
  }

  @Get("attendance/overtime")
  async attendanceOvertime() {
    return this.wrap(await this.appService.getOvertimeRequests());
  }

  @Post("attendance/check-in")
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: diskStorage({
        destination: path.resolve(process.cwd(), "storage", "attendance-selfies"),
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".jpg";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async checkIn(@Body() body: CheckInDto, @UploadedFile() file?: Express.Multer.File) {
    const photoUrl = file ? `/storage/attendance-selfies/${file.filename}` : null;
    return this.wrap(await this.appService.checkIn(body, photoUrl));
  }

  @Post("attendance/check-out")
  async checkOut(@Body() body: CheckOutDto) {
    return this.wrap(await this.appService.checkOut(body));
  }

  @Post("attendance/overtime")
  async createOvertime(@Body() body: CreateOvertimeDto) {
    return this.wrap(await this.appService.createOvertimeRequest(body));
  }

  @Get("leave/history")
  async leaveHistory() {
    return this.wrap(await this.appService.getLeaveHistory());
  }

  @Post("leave/request")
  async requestLeave(@Body() body: LeaveRequestDto) {
    return this.wrap(await this.appService.requestLeave(body));
  }

  @Post("leave/approve")
  async approveLeave(@Body() body: LeaveApproveDto) {
    return this.wrap(await this.appService.approveLeave(body));
  }

  @Post("reports/export")
  async exportReport(@Body() body: CreateExportDto) {
    return this.wrap(await this.appService.generateExport(body));
  }

  private wrap(data: unknown) {
    return {
      success: true,
      data,
      error: null
    };
  }
}
