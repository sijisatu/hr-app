"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, LoaderCircle, WalletCards } from "lucide-react";
import { getEmployees, getLeaveHistory, type LeaveType } from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";

const leaveTypeRows: { type: LeaveType; label: string; key: "annual" | "religious" | "maternity" | "paternity" | "marriage" | "bereavement" }[] = [
  { type: "Annual Leave", label: "Annual Leave", key: "annual" },
  { type: "Religious Leave", label: "Religious Leave", key: "religious" },
  { type: "Maternity Leave", label: "Maternity Leave", key: "maternity" },
  { type: "Paternity Leave", label: "Paternity Leave", key: "paternity" },
  { type: "Marriage Leave", label: "Marriage Leave", key: "marriage" },
  { type: "Bereavement Leave", label: "Bereavement Leave", key: "bereavement" }
];

export function EmployeeLeaveBalanceView() {
  const { currentUser } = useSession();
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees });
  const leavesQuery = useQuery({ queryKey: ["leave-history"], queryFn: getLeaveHistory });

  const currentEmployee = useMemo(
    () => (employeesQuery.data ?? []).find((item) => item.id === currentUser?.id) ?? null,
    [currentUser?.id, employeesQuery.data]
  );

  const myLeaveRecords = useMemo(
    () => (leavesQuery.data ?? []).filter((item) => item.userId === currentUser?.id),
    [currentUser?.id, leavesQuery.data]
  );

  const rows = useMemo(() => {
    if (!currentEmployee) {
      return [];
    }
    const today = new Date().toISOString().slice(0, 10);

    return leaveTypeRows.map((item) => {
      const pending = myLeaveRecords
        .filter((record) => record.type === item.type && (record.status === "pending-manager" || record.status === "awaiting-hr"))
        .reduce((sum, record) => sum + record.daysRequested, 0);
      const approvedUpcoming = myLeaveRecords
        .filter((record) => record.type === item.type && record.status === "approved" && record.startDate > today)
        .reduce((sum, record) => sum + record.daysRequested, 0);
      const taken = myLeaveRecords
        .filter((record) => record.type === item.type && record.status === "approved" && record.startDate <= today)
        .reduce((sum, record) => sum + record.daysRequested, 0);

      const current = currentEmployee.leaveBalances[item.key];
      const carryOver = currentEmployee.leaveBalances[`${item.key}CarryOver`];
      const balance = Number((current + carryOver).toFixed(1));
      return {
        ...item,
        current,
        carryOver,
        pending: Number(pending.toFixed(1)),
        approvedUpcoming: Number(approvedUpcoming.toFixed(1)),
        taken: Number(taken.toFixed(1)),
        balance
      };
    });
  }, [currentEmployee, myLeaveRecords]);

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
        <div className="flex items-center gap-3 text-white/75">
          <WalletCards className="h-5 w-5" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]">Leave Balance</p>
        </div>
        <h2 className="mt-4 text-[28px] font-semibold leading-tight">Ringkasan sisa cuti kamu per jenis.</h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
          Lihat current allocation, carry over, request pending, sampai sisa cuti yang masih bisa dipakai.
        </p>
      </section>

      <section className="page-card overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Leave Balance Detail</p>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">Data ini otomatis sinkron dengan pengajuan leave dan approval manager.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--panel-alt)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
            <CalendarClock className="h-4 w-4" />
            Balance Year: {currentEmployee?.leaveBalances.balanceYear ?? "-"}
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4 lg:px-6">
          {employeesQuery.isLoading || leavesQuery.isLoading ? (
            <div className="panel-muted px-4 py-5 text-[14px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading leave balance...</span>
            </div>
          ) : null}

          {!employeesQuery.isLoading && !leavesQuery.isLoading ? (
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-4 pb-2">Leave Type</th>
                  <th className="px-4 pb-2">Unit</th>
                  <th className="px-4 pb-2">Current</th>
                  <th className="px-4 pb-2">Carry Over</th>
                  <th className="px-4 pb-2">Pending</th>
                  <th className="px-4 pb-2">Approved Upcoming</th>
                  <th className="px-4 pb-2">Taken</th>
                  <th className="px-4 pb-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.type} className="bg-[var(--surface-muted)]">
                    <td className="rounded-l-[12px] px-4 py-4 text-[14px] font-semibold text-[var(--text)]">{row.label}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text-muted)]">Days</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{row.current.toFixed(1)}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{row.carryOver.toFixed(1)}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{row.pending.toFixed(1)}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{row.approvedUpcoming.toFixed(1)}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{row.taken.toFixed(1)}</td>
                    <td className="rounded-r-[12px] px-4 py-4 text-[14px] font-semibold text-[var(--primary)]">{row.balance.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {!employeesQuery.isLoading && !leavesQuery.isLoading && rows.length === 0 ? (
            <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
              Data leave balance belum tersedia untuk akun ini.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
