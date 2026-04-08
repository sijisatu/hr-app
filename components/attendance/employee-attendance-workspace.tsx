"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Clock3, LoaderCircle, MapPinned, NotebookPen, PlusCircle, Stethoscope } from "lucide-react";
import {
  createLeaveRequest,
  createOvertimeRequest,
  formatLeaveStatus,
  formatLeaveType,
  getAttendanceHistory,
  getAttendanceOvertime,
  getEmployees,
  getLeaveHistory
} from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { useSession } from "@/components/providers/session-provider";

type ActionKey = "on-duty" | "sick" | "leave" | "half-day" | "overtime";

const actionCards: {
  key: ActionKey;
  label: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}[] = [
  { key: "on-duty", label: "On Duty Request", description: "Ajukan tugas dinas atau kerja lapangan.", icon: BriefcaseBusiness },
  { key: "sick", label: "Sick Submission", description: "Laporkan sakit dan submit kebutuhan approval.", icon: Stethoscope },
  { key: "leave", label: "Leave Request", description: "Ajukan cuti tahunan langsung dari attendance.", icon: NotebookPen },
  { key: "half-day", label: "Half Day Leave", description: "Submit izin setengah hari untuk kebutuhan singkat.", icon: Clock3 },
  { key: "overtime", label: "Submit Overtime", description: "Masukkan lembur manual untuk direview supervisor.", icon: PlusCircle }
];

const statusTone = {
  "on-time": "success",
  late: "danger",
  absent: "warning",
  "early-leave": "neutral"
} as const;

const statusLabel = {
  "on-time": "On Time",
  late: "Late",
  absent: "Absent",
  "early-leave": "Early Leave"
} as const;

const leaveTone = {
  "Awaiting HR": "warning",
  Approved: "success",
  Review: "danger",
  Rejected: "danger"
} as const;

function leaveTypeForAction(action: Exclude<ActionKey, "overtime">) {
  switch (action) {
    case "on-duty":
      return "On Duty Request" as const;
    case "sick":
      return "Sick Submission" as const;
    case "half-day":
      return "Half Day Leave" as const;
    case "leave":
    default:
      return "Leave Request" as const;
  }
}

export function EmployeeAttendanceWorkspace() {
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [activeAction, setActiveAction] = useState<ActionKey>("on-duty");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveReason, setLeaveReason] = useState("");
  const [halfDaySlot, setHalfDaySlot] = useState<"Morning" | "Afternoon">("Morning");
  const [overtimeDate, setOvertimeDate] = useState(today);
  const [overtimeMinutes, setOvertimeMinutes] = useState("120");
  const [overtimeReason, setOvertimeReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees });
  const attendanceQuery = useQuery({ queryKey: ["attendance-history"], queryFn: getAttendanceHistory });
  const leaveQuery = useQuery({ queryKey: ["leave-history"], queryFn: getLeaveHistory });
  const overtimeQuery = useQuery({ queryKey: ["attendance-overtime"], queryFn: getAttendanceOvertime });

  const employee = useMemo(
    () => employeesQuery.data?.find((item) => item.id === currentUser?.id) ?? null,
    [currentUser?.id, employeesQuery.data]
  );
  const attendanceLogs = useMemo(
    () => (attendanceQuery.data ?? []).filter((item) => item.userId === currentUser?.id),
    [attendanceQuery.data, currentUser?.id]
  );
  const leaveRequests = useMemo(
    () => (leaveQuery.data ?? []).filter((item) => item.userId === currentUser?.id),
    [leaveQuery.data, currentUser?.id]
  );
  const overtimeItems = useMemo(
    () => (overtimeQuery.data ?? []).filter((item) => item.userId === currentUser?.id),
    [overtimeQuery.data, currentUser?.id]
  );

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        throw new Error("Session employee tidak ditemukan.");
      }
      if (!leaveReason.trim()) {
        throw new Error("Reason wajib diisi.");
      }
      const type = leaveTypeForAction(activeAction as Exclude<ActionKey, "overtime">);
      const normalizedReason = activeAction === "half-day" ? `[${halfDaySlot}] ${leaveReason.trim()}` : leaveReason.trim();

      return createLeaveRequest({
        userId: currentUser.id,
        employeeName: currentUser.name,
        type,
        startDate,
        endDate: activeAction === "half-day" ? startDate : endDate,
        reason: normalizedReason
      });
    },
    onSuccess: async (result) => {
      setLeaveReason("");
      setMessage(`${formatLeaveType(result.type)} berhasil dikirim.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leave-history"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] })
      ]);
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const overtimeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        throw new Error("Session employee tidak ditemukan.");
      }
      if (!overtimeReason.trim()) {
        throw new Error("Reason wajib diisi.");
      }
      const minutes = Number(overtimeMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error("Durasi overtime harus lebih dari 0 menit.");
      }
      return createOvertimeRequest({
        userId: currentUser.id,
        employeeName: currentUser.name,
        department: currentUser.department,
        date: overtimeDate,
        minutes,
        reason: overtimeReason.trim()
      });
    },
    onSuccess: async () => {
      setOvertimeReason("");
      setMessage("Submit Overtime berhasil dikirim.");
      await queryClient.invalidateQueries({ queryKey: ["attendance-overtime"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const summary = {
    total: attendanceLogs.length,
    onTime: attendanceLogs.filter((item) => item.status === "on-time").length,
    late: attendanceLogs.filter((item) => item.status === "late").length,
    overtimeHours: Number((overtimeItems.reduce((sum, item) => sum + item.minutes, 0) / 60).toFixed(1))
  };

  const pendingRequests = leaveRequests.filter((item) => item.status !== "approved").length;

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">Employee Attendance</p>
            <h2 className="mt-4 text-[28px] font-semibold leading-tight">Semua request employee dipusatkan di satu modul.</h2>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
              Gunakan tombol di bawah untuk submit On Duty Request, Sick Submission, Leave Request, Half Day Leave, atau Submit Overtime.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] bg-white/10 px-4 py-4">
              <p className="text-[12px] text-white/64">Leave Balance</p>
              <p className="mt-2 text-[24px] font-semibold">{employee?.leaveBalances.annual ?? 0} days</p>
            </div>
            <div className="rounded-[14px] bg-white/10 px-4 py-4">
              <p className="text-[12px] text-white/64">Sick Balance</p>
              <p className="mt-2 text-[24px] font-semibold">{employee?.leaveBalances.sick ?? 0} days</p>
            </div>
            <div className="rounded-[14px] bg-white/10 px-4 py-4">
              <p className="text-[12px] text-white/64">Pending Request</p>
              <p className="mt-2 text-[24px] font-semibold">{pendingRequests}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {actionCards.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeAction;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveAction(item.key);
                  setMessage(null);
                }}
                className={`rounded-[16px] border px-5 py-5 text-left transition ${isActive ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]"}`}
              >
                <Icon className="h-5 w-5" />
                <p className="mt-4 text-[15px] font-semibold">{item.label}</p>
                <p className={`mt-2 text-[13px] leading-5 ${isActive ? "text-white/74" : "text-[var(--text-muted)]"}`}>{item.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="page-card p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">{actionCards.find((item) => item.key === activeAction)?.label}</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
              {activeAction === "overtime" ? "Form submit overtime manual untuk kebutuhan review supervisor." : "Form request employee aktif. Semua request leave sekarang masuk dari modul Employee Attendance."}
            </p>
          </div>
          {message ? <div className="rounded-[12px] border border-[var(--border)] bg-[var(--panel-alt)] px-4 py-3 text-[13px] text-[var(--text-muted)]">{message}</div> : null}
        </div>

        {activeAction === "overtime" ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)_auto]">
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Date</span>
              <input type="date" value={overtimeDate} onChange={(event) => setOvertimeDate(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Minutes</span>
              <input type="number" min="1" value={overtimeMinutes} onChange={(event) => setOvertimeMinutes(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Employee</p>
              <p className="mt-2 text-[15px] font-semibold text-[var(--primary)]">{currentUser?.name}</p>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">{currentUser?.department}</p>
            </div>
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Reason</span>
              <input value={overtimeReason} onChange={(event) => setOvertimeReason(event.target.value)} placeholder="Jelaskan kebutuhan lembur" className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <button type="button" onClick={() => overtimeMutation.mutate()} disabled={overtimeMutation.isPending} className="primary-button lg:self-end">
              {overtimeMutation.isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending...</> : "Submit"}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.3fr)_auto]">
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>{activeAction === "half-day" ? "Date" : "Start Date"}</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            {activeAction === "half-day" ? (
              <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
                <span>Slot</span>
                <select value={halfDaySlot} onChange={(event) => setHalfDaySlot(event.target.value as "Morning" | "Afternoon")} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]">
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                </select>
              </label>
            ) : (
              <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
                <span>End Date</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
              </label>
            )}
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Reason</span>
              <input value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} placeholder="Tulis alasan request" className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <button type="button" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} className="primary-button lg:self-end">
              {leaveMutation.isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending...</> : "Submit"}
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="page-card p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Attendance Records</p>
          <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{summary.total}</p>
          <p className="mt-3 text-[14px] text-[var(--text-muted)]">Total history attendance akun ini.</p>
        </div>
        <div className="page-card p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">On Time</p>
          <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{summary.onTime}</p>
          <p className="mt-3 text-[14px] text-[var(--text-muted)]">Presensi tepat waktu.</p>
        </div>
        <div className="page-card p-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Late Records</p>
          <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{summary.late}</p>
          <p className="mt-3 text-[14px] text-[var(--text-muted)]">Riwayat keterlambatan.</p>
        </div>
        <div className="page-card bg-[var(--primary)] p-5 text-white">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/72">Overtime Hours</p>
          <p className="mt-3 text-[30px] font-semibold leading-none">{summary.overtimeHours}</p>
          <p className="mt-3 text-[14px] text-white/74">Akumulasi dari queue overtime employee.</p>
        </div>
      </section>

      <section className="page-card overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Attendance Summary</p>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">History attendance personal employee ditampilkan langsung di bawah modul request.</p>
          </div>
          <div className="rounded-[12px] bg-[var(--panel-alt)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
            {attendanceQuery.isLoading ? "Loading attendance history..." : `${attendanceLogs.length} records loaded`}
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4 lg:px-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-4 pb-2">Date</th>
                <th className="px-4 pb-2">Shift</th>
                <th className="px-4 pb-2">Check In / Out</th>
                <th className="px-4 pb-2">Location</th>
                <th className="px-4 pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLogs.map((log) => (
                <tr key={log.id} className="bg-[var(--surface-muted)]">
                  <td className="rounded-l-[12px] px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">
                      {new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.department}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{log.shiftName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.scheduledStart} - {log.scheduledEnd}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">
                    <p>{log.checkIn} - {log.checkOut ?? "Open"}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.overtimeMinutes > 0 ? `${log.overtimeMinutes} overtime minutes` : "No overtime"}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">
                    <div className="flex items-center gap-2">
                      <MapPinned className="h-4 w-4" />
                      {log.location}
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.gpsValidated ? "GPS validated" : "GPS flagged"}</p>
                  </td>
                  <td className="rounded-r-[12px] px-4 py-4 align-top">
                    <StatusPill tone={statusTone[log.status]}>{statusLabel[log.status]}</StatusPill>
                  </td>
                </tr>
              ))}
              {attendanceLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="rounded-[12px] px-4 py-10 text-center text-[14px] text-[var(--text-muted)]">
                    Belum ada attendance history untuk employee ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="page-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Recent Request Status</p>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">Request terbaru dari modul attendance employee.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {leaveRequests.slice(0, 4).map((request) => {
            const label = formatLeaveStatus(request.status);
            return (
              <div key={request.id} className="panel-muted p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text)]">{formatLeaveType(request.type)}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`}</p>
                  </div>
                  <StatusPill tone={leaveTone[label as keyof typeof leaveTone]}>{label}</StatusPill>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{request.reason}</p>
              </div>
            );
          })}
          {leaveRequests.length === 0 ? (
            <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">Belum ada request leave dari akun employee ini.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
