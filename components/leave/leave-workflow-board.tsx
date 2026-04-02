"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, FileSpreadsheet, LoaderCircle, Send, WalletCards } from "lucide-react";
import {
  approveLeaveRequest,
  createLeaveRequest,
  formatLeaveStatus,
  getEmployees,
  getLeaveHistory,
  type LeaveType
} from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";
import { StatusPill } from "@/components/ui/status-pill";

const toneMap = {
  "Awaiting HR": "warning",
  Approved: "success",
  Review: "danger",
  Rejected: "danger"
} as const;

const leaveTypes: LeaveType[] = ["Annual Leave", "Sick Leave", "Permission", "Remote Work"];

export function LeaveWorkflowBoard() {
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<LeaveType>("Annual Leave");
  const [startDate, setStartDate] = useState("2026-04-10");
  const [endDate, setEndDate] = useState("2026-04-10");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees });
  const leavesQuery = useQuery({ queryKey: ["leave-history"], queryFn: getLeaveHistory });

  const employees = employeesQuery.data ?? [];
  const leaveRequests = leavesQuery.data ?? [];
  const scopedEmployees = currentUser?.role === "employee" ? employees.filter((employee) => employee.id === currentUser.id) : employees;
  const visibleRequests = currentUser?.role === "employee" ? leaveRequests.filter((item) => item.userId === currentUser.id) : leaveRequests;
  const canApprove = currentUser?.role === "admin" || currentUser?.role === "hr" || currentUser?.role === "manager";

  useEffect(() => {
    if (!employeeId && scopedEmployees.length > 0) {
      setEmployeeId(scopedEmployees[0].id);
    }
  }, [employeeId, scopedEmployees]);

  const selectedEmployee = scopedEmployees.find((employee) => employee.id === employeeId) ?? null;
  const pendingCount = visibleRequests.filter((item) => item.status !== "approved").length;
  const autoApprovedCount = visibleRequests.filter((item) => item.autoApproved).length;

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) {
        throw new Error("Pilih employee dulu.");
      }
      if (!reason.trim()) {
        throw new Error("Reason wajib diisi.");
      }
      return createLeaveRequest({
        userId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        type,
        startDate,
        endDate,
        reason
      });
    },
    onSuccess: async (result) => {
      setMessage(`Request ${result.type} untuk ${result.employeeName} berhasil dibuat.`);
      setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leave-history"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] })
      ]);
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const approveMutation = useMutation({
    mutationFn: async (payload: { leaveId: string; status: "approved" | "rejected" | "awaiting-hr"; actor: string }) =>
      approveLeaveRequest(payload),
    onSuccess: async (result) => {
      setMessage(`Request ${result.employeeName} diupdate ke ${formatLeaveStatus(result.status)}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leave-history"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] })
      ]);
    },
    onError: (error: Error) => setMessage(error.message)
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <section className="rounded-[32px] bg-[var(--primary)] p-6 text-white shadow-soft sm:p-8">
          <div className="flex items-center gap-3 text-white/70">
            <WalletCards className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em]">Leave Balance</p>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-white/75">
            {currentUser?.role === "employee"
              ? "Ringkasan kuota cuti milik akun kamu. Ini yang paling penting buat dilihat sebelum bikin request baru."
              : "Ringkasan balance cuti aktif untuk bantu HR dan manager lihat kapasitas cuti tim sebelum approve request."}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {scopedEmployees.filter((employee) => employee.status === "active").map((employee) => (
              <div key={employee.id} className="rounded-[24px] bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-lg font-semibold text-white">{employee.name}</p>
                <p className="mt-2 text-sm text-white/65">{employee.position}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/60">Annual</p>
                    <p className="mt-2 text-2xl font-semibold">{employee.leaveBalances.annual}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/60">Sick</p>
                    <p className="mt-2 text-2xl font-semibold">{employee.leaveBalances.sick}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/60">Permission</p>
                    <p className="mt-2 text-2xl font-semibold">{employee.leaveBalances.permission}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[30px] p-6">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[var(--primary)]" />
            <p className="section-title text-2xl font-semibold text-[var(--primary)]">New Leave Request</p>
          </div>
          <p className="mt-3 text-sm text-muted">Bikin request cuti baru setelah cek balance di panel sebelah.</p>
          <div className="mt-5 space-y-4">
            <label className="block space-y-2 text-sm font-medium text-[var(--primary)]">
              Employee
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                disabled={currentUser?.role === "employee"}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
              >
                {scopedEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} - {employee.position}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium text-[var(--primary)]">
              Request Type
              <select value={type} onChange={(event) => setType(event.target.value as LeaveType)} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700">
                {leaveTypes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium text-[var(--primary)]">
                Start Date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700" />
              </label>
              <label className="block space-y-2 text-sm font-medium text-[var(--primary)]">
                End Date
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700" />
              </label>
            </div>
            <label className="block space-y-2 text-sm font-medium text-[var(--primary)]">
              Reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700" />
            </label>
            {message ? <div className="rounded-2xl border border-border bg-[var(--panel-alt)] px-4 py-3 text-sm text-muted">{message}</div> : null}
            <button onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || employeesQuery.isLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {requestMutation.isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Creating...</> : <>Create Request</>}
            </button>
          </div>
        </section>
      </div>

      <section className="panel rounded-[30px] p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="section-title text-2xl font-semibold text-[var(--primary)]">{currentUser?.role === "employee" ? "My Leave Queue" : "Approval Queue"}</p>
            <p className="mt-2 text-sm text-muted">{currentUser?.role === "employee" ? "Pantau request cuti milik akun kamu dan status approval terbaru." : `Queue approval aktif dengan ${pendingCount} request belum selesai dan ${autoApprovedCount} auto-approved.`}</p>
          </div>
          <button className="rounded-2xl bg-[var(--panel-alt)] px-4 py-3 text-sm font-semibold text-[var(--primary)]">Export Queue</button>
        </div>

        <div className="space-y-4">
          {visibleRequests.map((request) => {
            const statusLabel = formatLeaveStatus(request.status);
            const range = request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`;
            return (
              <div key={request.id} className="rounded-[28px] bg-[var(--panel-alt)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--primary)]">{request.employeeName}</p>
                    <p className="mt-1 text-sm text-muted">{request.type} | {range} | {request.daysRequested} day(s)</p>
                  </div>
                  <StatusPill tone={toneMap[statusLabel as keyof typeof toneMap]}>{statusLabel}</StatusPill>
                </div>
                <div className="mt-5 grid gap-4 text-sm text-muted md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">Approvers</p>
                    <p className="mt-2 font-medium text-slate-700">{request.approverFlow.join(" | ")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">Balance</p>
                    <p className="mt-2 font-medium text-slate-700">{request.balanceLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {canApprove && request.status !== "approved" ? (
                      <button
                        className="rounded-2xl bg-white px-4 py-3 font-semibold text-[var(--primary)]"
                        onClick={() => approveMutation.mutate({ leaveId: request.id, status: "awaiting-hr", actor: "Manager Review" })}
                        disabled={approveMutation.isPending}
                      >
                        Review
                      </button>
                    ) : null}
                    {canApprove && request.status !== "approved" ? (
                      <button
                        className="rounded-2xl bg-[var(--primary)] px-4 py-3 font-semibold text-white"
                        onClick={() => approveMutation.mutate({ leaveId: request.id, status: "approved", actor: "HR Lead" })}
                        disabled={approveMutation.isPending}
                      >
                        Approve
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel rounded-[30px] p-6">
        <p className="section-title text-2xl font-semibold text-[var(--primary)]">Workflow Rules</p>
        <div className="mt-5 space-y-4 text-sm text-muted">
          <div className="flex gap-3"><Clock3 className="mt-0.5 h-4 w-4 text-[var(--primary)]" /> Sick leave 1 hari dan permission 1 hari langsung auto-approved.</div>
          <div className="flex gap-3"><Check className="mt-0.5 h-4 w-4 text-[var(--accent)]" /> Annual leave masuk ke HR queue dan mengurangi balance saat approved.</div>
          <div className="flex gap-3"><FileSpreadsheet className="mt-0.5 h-4 w-4 text-[var(--primary)]" /> Queue sekarang live, role-aware, dan ngikut session login.</div>
        </div>
      </section>
    </div>
  );
}
