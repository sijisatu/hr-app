import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { Response } from "express";
import { AppService } from "./common/app.service";
import {
  AttendanceHistoryQueryDto,
  CheckInDto,
  CheckOutDto,
  CreateEmployeeDto,
  CreateCompensationProfileDto,
  CreateExportDto,
  EmployeeListQueryDto,
  ExportJobStatusQueryDto,
  CreateOvertimeDto,
  PayslipListQueryDto,
  ReimbursementRequestListQueryDto,
  CreateReimbursementClaimTypeDto,
  CreateReimbursementRequestDto,
  CreateTaxProfileDto,
  OvertimeApproveDto,
  CreatePayrollComponentDto,
  EmployeeLoginDto,
  ExportPayslipDto,
  GeneratePayrollRunDto,
  LeaveApproveDto,
  LeaveRequestDto,
  PublishPayrollRunDto,
  ReimbursementApproveDto,
  ReimbursementProcessDto,
  UploadEmployeeDocumentDto,
  UpdateEmployeeDto,
  UpdateCompensationProfileDto,
  UpdateReimbursementClaimTypeDto,
  UpdateReimbursementRequestDto,
  UpdateTaxProfileDto,
  UpdatePayrollComponentDto
} from "./common/dtos";

@Controller("api")
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  private setNoStore(res: Response) {
    res.setHeader("Cache-Control", "no-store");
  }

  private setShortCache(res: Response, maxAgeSeconds = 30) {
    res.setHeader("Cache-Control", `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`);
  }

  @Get("health")
  async health(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 15);
    return this.wrap(await this.appService.health());
  }

  @Get("dashboard/summary")
  async dashboardSummary(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 30);
    return this.wrap(await this.appService.getDashboardSummary());
  }

  @Get("employees")
  async employees(@Query() query: EmployeeListQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getEmployees(query));
  }

  @Post("auth/employee-login")
  async employeeLogin(@Body() body: EmployeeLoginDto) {
    return this.wrap(await this.appService.authenticateEmployee(body.username, body.password));
  }

  @Get("auth/employee-session/:id")
  async employeeSession(@Param("id") id: string) {
    return this.wrap(await this.appService.getEmployeeSession(id));
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

  @Get("employees/:id/documents")
  async employeeDocuments(@Param("id") id: string) {
    return this.wrap(await this.appService.getEmployeeDocuments(id));
  }

  @Post("employees/:id/documents")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (request, _, callback) => {
          const employeeId = String(request.params.id ?? "unknown-employee");
          const targetDir = path.resolve(process.cwd(), "storage", "documents", "employee-files", employeeId);
          mkdirSync(targetDir, { recursive: true });
          callback(null, targetDir);
        },
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".bin";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async uploadEmployeeDocument(
    @Param("id") id: string,
    @Body() body: UploadEmployeeDocumentDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const fileUrl = file ? `/storage/documents/employee-files/${id}/${file.filename}` : null;
    return this.wrap(await this.appService.uploadEmployeeDocument(id, body, file, fileUrl));
  }

  @Delete("employees/:id/documents/:documentId")
  async deleteEmployeeDocument(@Param("id") id: string, @Param("documentId") documentId: string) {
    return this.wrap(await this.appService.deleteEmployeeDocument(id, documentId));
  }

  @Get("compensation-profiles")
  async compensationProfiles() {
    return this.wrap(await this.appService.getCompensationProfiles());
  }

  @Post("compensation-profiles")
  async createCompensationProfile(@Body() body: CreateCompensationProfileDto) {
    return this.wrap(await this.appService.createCompensationProfile(body));
  }

  @Patch("compensation-profiles/:id")
  async updateCompensationProfile(@Param("id") id: string, @Body() body: UpdateCompensationProfileDto) {
    return this.wrap(await this.appService.updateCompensationProfile(id, body));
  }

  @Delete("compensation-profiles/:id")
  async deleteCompensationProfile(@Param("id") id: string) {
    return this.wrap(await this.appService.deleteCompensationProfile(id));
  }

  @Get("tax-profiles")
  async taxProfiles() {
    return this.wrap(await this.appService.getTaxProfiles());
  }

  @Post("tax-profiles")
  async createTaxProfile(@Body() body: CreateTaxProfileDto) {
    return this.wrap(await this.appService.createTaxProfile(body));
  }

  @Patch("tax-profiles/:id")
  async updateTaxProfile(@Param("id") id: string, @Body() body: UpdateTaxProfileDto) {
    return this.wrap(await this.appService.updateTaxProfile(id, body));
  }

  @Delete("tax-profiles/:id")
  async deleteTaxProfile(@Param("id") id: string) {
    return this.wrap(await this.appService.deleteTaxProfile(id));
  }

  @Get("attendance/history")
  async attendanceHistory(@Query() query: AttendanceHistoryQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getAttendanceHistory(query));
  }

  @Get("attendance/today")
  async attendanceToday(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 15);
    return this.wrap(await this.appService.getAttendanceToday());
  }

  @Get("attendance/overview")
  async attendanceOverview(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 20);
    return this.wrap(await this.appService.getAttendanceOverview());
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

  @Post("attendance/overtime/approve")
  async approveOvertime(@Body() body: OvertimeApproveDto) {
    return this.wrap(await this.appService.approveOvertimeRequest(body));
  }

  @Get("leave/history")
  async leaveHistory(@Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
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

  @Get("reimbursement/claims")
  async reimbursementClaimTypes() {
    return this.wrap(await this.appService.getReimbursementClaimTypes());
  }

  @Post("reimbursement/claims")
  async createReimbursementClaimType(@Body() body: CreateReimbursementClaimTypeDto) {
    return this.wrap(await this.appService.createReimbursementClaimType(body));
  }

  @Patch("reimbursement/claims/:id")
  async updateReimbursementClaimType(@Param("id") id: string, @Body() body: UpdateReimbursementClaimTypeDto) {
    return this.wrap(await this.appService.updateReimbursementClaimType(id, body));
  }

  @Delete("reimbursement/claims/:id")
  async deleteReimbursementClaimType(@Param("id") id: string) {
    return this.wrap(await this.appService.deleteReimbursementClaimType(id));
  }

  @Get("reimbursement/requests")
  async reimbursementRequests(@Query() query: ReimbursementRequestListQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getReimbursementRequests(query));
  }

  @Post("reimbursement/requests")
  @UseInterceptors(
    FileInterceptor("receipt", {
      storage: diskStorage({
        destination: path.resolve(process.cwd(), "storage", "reimbursements", "receipts"),
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".bin";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async createReimbursementRequest(@Body() body: CreateReimbursementRequestDto, @UploadedFile() file?: Express.Multer.File) {
    const receiptFileUrl = file ? `/storage/reimbursements/receipts/${file.filename}` : null;
    return this.wrap(await this.appService.createReimbursementRequest(body, file, receiptFileUrl));
  }

  @Patch("reimbursement/requests/:id")
  @UseInterceptors(
    FileInterceptor("receipt", {
      storage: diskStorage({
        destination: path.resolve(process.cwd(), "storage", "reimbursements", "receipts"),
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".bin";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async updateReimbursementRequest(
    @Param("id") id: string,
    @Body() body: UpdateReimbursementRequestDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const receiptFileUrl = file ? `/storage/reimbursements/receipts/${file.filename}` : null;
    return this.wrap(await this.appService.updateReimbursementRequest(id, body, file, receiptFileUrl));
  }

  @Post("reimbursement/requests/manager-approve")
  async managerApproveReimbursement(@Body() body: ReimbursementApproveDto) {
    return this.wrap(await this.appService.managerApproveReimbursement(body));
  }

  @Post("reimbursement/requests/hr-process")
  async hrProcessReimbursement(@Body() body: ReimbursementProcessDto) {
    return this.wrap(await this.appService.hrProcessReimbursement(body));
  }

  @Get("payroll/overview")
  async payrollOverview(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 45);
    return this.wrap(await this.appService.getPayrollOverview());
  }

  @Get("payroll/components")
  async payrollComponents() {
    return this.wrap(await this.appService.getPayrollComponents());
  }

  @Post("payroll/components")
  async createPayrollComponent(@Body() body: CreatePayrollComponentDto) {
    return this.wrap(await this.appService.createPayrollComponent(body));
  }

  @Patch("payroll/components/:id")
  async updatePayrollComponent(@Param("id") id: string, @Body() body: UpdatePayrollComponentDto) {
    return this.wrap(await this.appService.updatePayrollComponent(id, body));
  }

  @Delete("payroll/components/:id")
  async deletePayrollComponent(@Param("id") id: string) {
    return this.wrap(await this.appService.deletePayrollComponent(id));
  }

  @Get("payroll/runs")
  async payRuns(@Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getPayRuns());
  }

  @Post("payroll/runs")
  async generatePayrollRun(@Body() body: GeneratePayrollRunDto) {
    return this.wrap(await this.appService.generatePayrollRun(body));
  }

  @Post("payroll/runs/publish")
  async publishPayrollRun(@Body() body: PublishPayrollRunDto) {
    return this.wrap(await this.appService.publishPayrollRun(body));
  }

  @Get("payroll/payslips")
  async payslips(@Query() query: PayslipListQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getPayslips(query));
  }

  @Post("payroll/payslips/export")
  async exportPayslip(@Body() body: ExportPayslipDto) {
    return this.wrap(await this.appService.exportPayslip(body));
  }

  @Get("payroll/payslips/export/status")
  async exportPayslipStatus(@Query() query: ExportJobStatusQueryDto) {
    return this.wrap(await this.appService.getExportJobStatus(query.jobId));
  }

  @Post("reports/export")
  async exportReport(@Body() body: CreateExportDto) {
    return this.wrap(await this.appService.generateExport(body));
  }

  @Get("reports/export/status")
  async exportReportStatus(@Query() query: ExportJobStatusQueryDto) {
    return this.wrap(await this.appService.getExportJobStatus(query.jobId));
  }

  private wrap(data: unknown) {
    return {
      success: true,
      data,
      error: null
    };
  }
}













