"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, Check, Clock3, LoaderCircle, MapPinned, NotebookPen, PlusCircle, Stethoscope, X } from "lucide-react";
import {
  approveLeaveRequest,
  approveOvertimeRequest,
  createLeaveRequest,
  createOvertimeRequest,
  formatLeaveStatus,
  formatLeaveType,
  formatOvertimeStatus,
  getAttendanceHistory,
  getAttendanceOvertime,
  getLeaveHistory
} from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { useSession } from "@/components/providers/session-provider";

export type ActionKey = "on-duty" | "sick" | "leave" | "half-day" | "overtime";

type EmployeeAttendanceWorkspaceProps = {
  fixedAction?: ActionKey;
  showActionCards?: boolean;
  backHref?: string;
};

type SummaryItem = {
  label: string;
  value: string;
  note: string;
  tone?: "primary";
};

export const actionCards: {
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

const actionHrefMap: Record<ActionKey, string> = {
  "on-duty": "/attendance/on-duty-request",
  sick: "/attendance/sick-submission",
  leave: "/attendance/leave-request",
  "half-day": "/attendance/half-day-request",
  overtime: "/attendance/submit-overtime"
};

export function getEmployeeActionHref(action: ActionKey) {
  return actionHrefMap[action];
}

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
  "Pending Manager": "warning",
  Approved: "success",
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

function leaveTypesForAction(action: Exclude<ActionKey, "overtime">) {
  switch (action) {
    case "on-duty":
      return ["On Duty Request", "Remote Work"] as const;
    case "sick":
      return ["Sick Submission", "Sick Leave"] as const;
    case "half-day":
      return ["Half Day Leave", "Permission"] as const;
    case "leave":
    default:
      return ["Leave Request", "Annual Leave"] as const;
  }
}

export function EmployeeAttendanceWorkspace({ fixedAction, showActionCards, backHref = "/attendance" }: EmployeeAttendanceWorkspaceProps) {
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [activeAction, setActiveAction] = useState<ActionKey>(fixedAction ?? "on-duty");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveReason, setLeaveReason] = useState("");
  const [halfDaySlot, setHalfDaySlot] = useState<"Morning" | "Afternoon">("Morning");
  const [overtimeDate, setOvertimeDate] = useState(today);
  const [overtimeMinutes, setOvertimeMinutes] = useState("120");
  const [overtimeReason, setOvertimeReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const shouldShowActionCards = showActionCards ?? !fixedAction;
  const canApprove = currentUser?.role === "manager" || currentUser?.role === "admin";

  useEffect(() => {
    if (fixedAction) {
      setActiveAction(fixedAction);
    }
  }, [fixedAction]);

  const attendanceQuery = useQuery({ queryKey: ["attendance-history"], queryFn: getAttendanceHistory });
  const leaveQuery = useQuery({ queryKey: ["leave-history"], queryFn: getLeaveHistory });
  const overtimeQuery = useQuery({ queryKey: ["attendance-overtime"], queryFn: getAttendanceOvertime });

  const allLeaveRequests = leaveQuery.data ?? [];
  const allOvertimeItems = overtimeQuery.data ?? [];

  const attendanceLogs = useMemo(
    () => (attendanceQuery.data ?? []).filter((item) => item.userId === currentUser?.id),
    [attendanceQuery.data, currentUser?.id]
  );
  const leaveRequests = useMemo(
    () => allLeaveRequests.filter((item) => item.userId === currentUser?.id),
    [allLeaveRequests, currentUser?.id]
  );
  const overtimeItems = useMemo(
    () => allOvertimeItems.filter((item) => item.userId === currentUser?.id),
    [allOvertimeItems, currentUser?.id]
  );

  const onDutyRequests = useMemo(
    () => leaveRequests.filter((item) => item.type === "On Duty Request" || item.type === "Remote Work"),
    [leaveRequests]
  );
  const sickRequests = useMemo(
    () => leaveRequests.filter((item) => item.type === "Sick Submission" || item.type === "Sick Leave"),
    [leaveRequests]
  );
  const annualLeaveRequests = useMemo(
    () => leaveRequests.filter((item) => item.type === "Leave Request" || item.type === "Annual Leave"),
    [leaveRequests]
  );
  const halfDayRequests = useMemo(
    () => leaveRequests.filter((item) => item.type === "Half Day Leave" || item.type === "Permission"),
    [leaveRequests]
  );

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        throw new Error("Session employee tidak ditemukan.");
      }
      if (!leaveReason.trim()) {
        throw new Error(activeAction === "on-duty" ? "Description wajib diisi." : "Reason wajib diisi.");
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
      await queryClient.invalidateQueries({ queryKey: ["leave-history"] });
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

  const approveLeaveMutation = useMutation({
    mutationFn: async (payload: { leaveId: string; status: "approved" | "rejected" }) =>
      approveLeaveRequest({ ...payload, actor: "Manager/Leader" }),
    onSuccess: async () => {
      setMessage("Leave request berhasil diupdate.");
      await queryClient.invalidateQueries({ queryKey: ["leave-history"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const approveOvertimeMutation = useMutation({
    mutationFn: async (payload: { overtimeId: string; status: "approved" | "rejected" }) =>
      approveOvertimeRequest({ ...payload, actor: "Manager/Leader" }),
    onSuccess: async () => {
      setMessage("Overtime request berhasil diupdate.");
      await queryClient.invalidateQueries({ queryKey: ["attendance-overtime"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const summaryCards = useMemo<SummaryItem[]>(() => {
    if (activeAction === "on-duty") {
      return [
        { label: "Attendance Records", value: String(attendanceLogs.length), note: "Total history attendance akun ini." },
        { label: "On Time", value: String(attendanceLogs.filter((item) => item.status === "on-time").length), note: "Presensi tepat waktu." },
        { label: "Late Records", value: String(attendanceLogs.filter((item) => item.status === "late").length), note: "Riwayat keterlambatan." },
        { label: "On Duty Requests", value: String(onDutyRequests.length), note: "Total request on duty yang pernah diajukan.", tone: "primary" }
      ];
    }

    if (activeAction === "sick") {
      const approved = sickRequests.filter((item) => item.status === "approved").length;
      const pending = sickRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;
      const days = sickRequests.reduce((sum, item) => sum + item.daysRequested, 0);
      return [
        { label: "Sick Submissions", value: String(sickRequests.length), note: "Total pengajuan sakit." },
        { label: "Approved", value: String(approved), note: "Sudah disetujui." },
        { label: "Pending", value: String(pending), note: "Menunggu keputusan manager." },
        { label: "Requested Days", value: String(days), note: "Total hari yang diajukan.", tone: "primary" }
      ];
    }

    if (activeAction === "leave") {
      const approved = annualLeaveRequests.filter((item) => item.status === "approved").length;
      const pending = annualLeaveRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;
      const days = annualLeaveRequests.reduce((sum, item) => sum + item.daysRequested, 0);
      return [
        { label: "Leave Requests", value: String(annualLeaveRequests.length), note: "Total request cuti." },
        { label: "Approved", value: String(approved), note: "Sudah disetujui." },
        { label: "Pending", value: String(pending), note: "Menunggu keputusan manager." },
        { label: "Requested Days", value: String(days), note: "Akumulasi hari cuti diajukan.", tone: "primary" }
      ];
    }

    if (activeAction === "half-day") {
      const approved = halfDayRequests.filter((item) => item.status === "approved").length;
      const pending = halfDayRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;
      const morning = halfDayRequests.filter((item) => item.reason.includes("[Morning]")).length;
      return [
        { label: "Half Day Requests", value: String(halfDayRequests.length), note: "Total request half day." },
        { label: "Approved", value: String(approved), note: "Sudah disetujui." },
        { label: "Pending", value: String(pending), note: "Menunggu keputusan manager." },
        { label: "Morning Slot", value: String(morning), note: "Jumlah request slot pagi.", tone: "primary" }
      ];
    }

    const approvedOrPaid = overtimeItems.filter((item) => item.status === "approved" || item.status === "paid").length;
    const pending = overtimeItems.filter((item) => item.status === "pending").length;
    const totalHours = Number((overtimeItems.reduce((sum, item) => sum + item.minutes, 0) / 60).toFixed(1));
    return [
      { label: "Overtime Submissions", value: String(overtimeItems.length), note: "Total submit overtime." },
      { label: "Approved/Paid", value: String(approvedOrPaid), note: "Sudah approved atau paid." },
      { label: "Pending", value: String(pending), note: "Menunggu keputusan manager." },
      { label: "Overtime Hours", value: String(totalHours), note: "Akumulasi jam overtime.", tone: "primary" }
    ];
  }, [activeAction, annualLeaveRequests, attendanceLogs, halfDayRequests, onDutyRequests, overtimeItems, sickRequests]);

  const leaveRecordsForAction = useMemo(() => {
    switch (activeAction) {
      case "on-duty":
        return onDutyRequests;
      case "sick":
        return sickRequests;
      case "leave":
        return annualLeaveRequests;
      case "half-day":
        return halfDayRequests;
      default:
        return [];
    }
  }, [activeAction, annualLeaveRequests, halfDayRequests, onDutyRequests, sickRequests]);

  const leaveApprovalQueue = useMemo(() => {
    if (activeAction === "overtime") {
      return [];
    }
    const typeSet = new Set<string>(leaveTypesForAction(activeAction as Exclude<ActionKey, "overtime">));
    return allLeaveRequests.filter((item) => typeSet.has(item.type) && item.status === "pending-manager");
  }, [activeAction, allLeaveRequests]);

  const overtimeApprovalQueue = useMemo(
    () => allOvertimeItems.filter((item) => item.status === "pending"),
    [allOvertimeItems]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">Employee Attendance</p>
        <h2 className="mt-4 text-[28px] font-semibold leading-tight">Semua request employee dipusatkan di satu modul.</h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
          Gunakan halaman ini untuk submit request sesuai menu yang dipilih dan cek record yang relevan.
        </p>
      </section>

      {shouldShowActionCards ? (
        <section className="page-card p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {actionCards.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={getEmployeeActionHref(item.key)}
                  className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5 text-left text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-white"
                >
                  <Icon className="h-5 w-5" />
                  <p className="mt-4 text-[15px] font-semibold">{item.label}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="page-card p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {fixedAction ? (
              <Link href={backHref} className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--primary)]">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke menu request
              </Link>
            ) : null}
            <p className="section-title mt-2 text-[24px] font-semibold text-[var(--primary)]">{actionCards.find((item) => item.key === activeAction)?.label}</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
              {activeAction === "overtime" ? "Form submit overtime manual untuk kebutuhan review supervisor." : "Form request employee aktif sesuai menu yang dipilih."}
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
              <span>{activeAction === "on-duty" ? "Description" : "Reason"}</span>
              <input value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} placeholder={activeAction === "on-duty" ? "Tulis deskripsi on duty" : "Tulis alasan request"} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <button type="button" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} className="primary-button lg:self-end">
              {leaveMutation.isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending...</> : "Submit"}
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((item) => (
          <div key={item.label} className={item.tone === "primary" ? "page-card bg-[var(--primary)] p-5 text-white" : "page-card p-5"}>
            <p className={item.tone === "primary" ? "text-[12px] font-medium uppercase tracking-[0.08em] text-white/72" : "text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"}>{item.label}</p>
            <p className={item.tone === "primary" ? "mt-3 text-[30px] font-semibold leading-none" : "mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]"}>{item.value}</p>
            <p className={item.tone === "primary" ? "mt-3 text-[14px] text-white/74" : "mt-3 text-[14px] text-[var(--text-muted)]"}>{item.note}</p>
          </div>
        ))}
      </section>

      {activeAction === "on-duty" ? (
        <section className="page-card overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Attendance Records</p>
              <p className="mt-2 text-[14px] text-[var(--text-muted)]">History absensi personal khusus On Duty Request.</p>
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
                  <th className="px-4 pb-2">Description</th>
                  <th className="px-4 pb-2">Check In / Out</th>
                  <th className="px-4 pb-2">Location</th>
                  <th className="px-4 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.map((log) => (
                  <tr key={log.id} className="bg-[var(--surface-muted)]">
                    <td className="rounded-l-[12px] px-4 py-4 align-top">
                      <p className="text-[14px] font-semibold text-[var(--text)]">{new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.department}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-[14px] font-semibold text-[var(--text)]">{log.description}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.location}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">
                      <p>{log.checkIn} - {log.checkOut ?? "Open"}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.overtimeMinutes > 0 ? `${log.overtimeMinutes} overtime minutes` : "No overtime"}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">
                      <div className="flex items-center gap-2"><MapPinned className="h-4 w-4" />{log.location}</div>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.gpsValidated ? "GPS validated" : "GPS flagged"}</p>
                    </td>
                    <td className="rounded-r-[12px] px-4 py-4 align-top"><StatusPill tone={statusTone[log.status]}>{statusLabel[log.status]}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeAction !== "on-duty" && activeAction !== "overtime" ? (
        <section className="page-card p-6">
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">{actionCards.find((item) => item.key === activeAction)?.label} Records</p>
          <p className="mt-2 text-[14px] text-[var(--text-muted)]">Record khusus untuk menu request yang sedang dibuka.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {leaveRecordsForAction.map((request) => {
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
          </div>
        </section>
      ) : null}

      {activeAction === "overtime" ? (
        <section className="page-card p-6">
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Overtime Records</p>
          <p className="mt-2 text-[14px] text-[var(--text-muted)]">Record khusus submit overtime employee ini.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-4 pb-2">Date</th><th className="px-4 pb-2">Minutes</th><th className="px-4 pb-2">Reason</th><th className="px-4 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {overtimeItems.map((item) => (
                  <tr key={item.id} className="bg-[var(--surface-muted)]">
                    <td className="rounded-l-[12px] px-4 py-4 text-[14px] text-[var(--text)]">{item.date}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{item.minutes}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{item.reason}</td>
                    <td className="rounded-r-[12px] px-4 py-4"><StatusPill tone={item.status === "pending" ? "warning" : item.status === "rejected" ? "danger" : "success"}>{formatOvertimeStatus(item.status)}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canApprove && activeAction !== "overtime" ? (
        <section className="page-card p-6">
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Approval Queue</p>
          <p className="mt-2 text-[14px] text-[var(--text-muted)]">Manager/leader approval untuk menu request ini.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {leaveApprovalQueue.map((request) => (
              <div key={request.id} className="panel-muted p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text)]">{request.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{formatLeaveType(request.type)} | {request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`}</p>
                  </div>
                  <StatusPill tone="warning">Pending Manager</StatusPill>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{request.reason}</p>
                <div className="mt-4 flex gap-2">
                  <button className="secondary-button !px-3 !py-2" onClick={() => approveLeaveMutation.mutate({ leaveId: request.id, status: "rejected" })} disabled={approveLeaveMutation.isPending}><X className="h-4 w-4" /> Reject</button>
                  <button className="primary-button !px-3 !py-2" onClick={() => approveLeaveMutation.mutate({ leaveId: request.id, status: "approved" })} disabled={approveLeaveMutation.isPending}><Check className="h-4 w-4" /> Approve</button>
                </div>
              </div>
            ))}
            {leaveApprovalQueue.length === 0 ? <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">Tidak ada request yang menunggu approval pada menu ini.</div> : null}
          </div>
        </section>
      ) : null}

      {canApprove && activeAction === "overtime" ? (
        <section className="page-card p-6">
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Approval Queue</p>
          <p className="mt-2 text-[14px] text-[var(--text-muted)]">Manager/leader approval untuk Submit Overtime.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {overtimeApprovalQueue.map((item) => (
              <div key={item.id} className="panel-muted p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.date} | {item.minutes} minutes</p>
                  </div>
                  <StatusPill tone="warning">Pending Manager</StatusPill>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{item.reason}</p>
                <div className="mt-4 flex gap-2">
                  <button className="secondary-button !px-3 !py-2" onClick={() => approveOvertimeMutation.mutate({ overtimeId: item.id, status: "rejected" })} disabled={approveOvertimeMutation.isPending}><X className="h-4 w-4" /> Reject</button>
                  <button className="primary-button !px-3 !py-2" onClick={() => approveOvertimeMutation.mutate({ overtimeId: item.id, status: "approved" })} disabled={approveOvertimeMutation.isPending}><Check className="h-4 w-4" /> Approve</button>
                </div>
              </div>
            ))}
            {overtimeApprovalQueue.length === 0 ? <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">Tidak ada overtime yang menunggu approval.</div> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}







