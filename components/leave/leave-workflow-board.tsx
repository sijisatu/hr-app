"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, LoaderCircle, Pencil, Plus, Search, WalletCards, X } from "lucide-react";
import { getEmployees, updateEmployee, type LeaveType } from "@/lib/api";

const managedLeaveTypes: { type: LeaveType; key: "annual" | "religious" | "maternity" | "paternity" | "marriage" | "bereavement" | "permission"; label: string }[] = [
  { type: "Annual Leave", key: "annual", label: "Annual Leave" },
  { type: "Religious Leave", key: "religious", label: "Religious Leave" },
  { type: "Maternity Leave", key: "maternity", label: "Maternity Leave" },
  { type: "Paternity Leave", key: "paternity", label: "Paternity Leave" },
  { type: "Marriage Leave", key: "marriage", label: "Marriage Leave" },
  { type: "Bereavement Leave", key: "bereavement", label: "Bereavement Leave" },
  { type: "Permission", key: "permission", label: "Permission" }
];

type Mode = "create" | "edit" | null;
type LeaveForm = {
  employeeId: string;
  sickUsed: string;
  annual: string;
  annualCarryOver: string;
  annualCarryOverExpiresAt: string;
  religious: string;
  religiousCarryOver: string;
  religiousCarryOverExpiresAt: string;
  maternity: string;
  maternityCarryOver: string;
  maternityCarryOverExpiresAt: string;
  paternity: string;
  paternityCarryOver: string;
  paternityCarryOverExpiresAt: string;
  marriage: string;
  marriageCarryOver: string;
  marriageCarryOverExpiresAt: string;
  bereavement: string;
  bereavementCarryOver: string;
  bereavementCarryOverExpiresAt: string;
  permission: string;
  permissionCarryOver: string;
  permissionCarryOverExpiresAt: string;
};

function blankForm(employeeId = ""): LeaveForm {
  return {
    employeeId,
    sickUsed: "0",
    annual: "0",
    annualCarryOver: "0",
    annualCarryOverExpiresAt: "",
    religious: "0",
    religiousCarryOver: "0",
    religiousCarryOverExpiresAt: "",
    maternity: "0",
    maternityCarryOver: "0",
    maternityCarryOverExpiresAt: "",
    paternity: "0",
    paternityCarryOver: "0",
    paternityCarryOverExpiresAt: "",
    marriage: "0",
    marriageCarryOver: "0",
    marriageCarryOverExpiresAt: "",
    bereavement: "0",
    bereavementCarryOver: "0",
    bereavementCarryOverExpiresAt: "",
    permission: "0",
    permissionCarryOver: "0",
    permissionCarryOverExpiresAt: ""
  };
}

function mapEmployeeToForm(employeeId: string, leaveBalances?: Record<string, unknown>): LeaveForm {
  const form = blankForm(employeeId);
  const source = leaveBalances ?? {};
  for (const item of managedLeaveTypes) {
    form[item.key] = String(source[item.key] ?? 0);
    form[`${item.key}CarryOver` as keyof LeaveForm] = String(source[`${item.key}CarryOver`] ?? 0);
    form[`${item.key}CarryOverExpiresAt` as keyof LeaveForm] = String(source[`${item.key}CarryOverExpiresAt`] ?? "");
  }
  form.sickUsed = String(source.sickUsed ?? 0);
  return form;
}

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLeaveBalances(raw: Record<string, unknown> | undefined) {
  const source = raw ?? {};
  return {
    annual: numberOrZero(String(source.annual ?? "0")),
    annualCarryOver: numberOrZero(String(source.annualCarryOver ?? "0")),
    religious: numberOrZero(String(source.religious ?? "0")),
    religiousCarryOver: numberOrZero(String(source.religiousCarryOver ?? "0")),
    maternity: numberOrZero(String(source.maternity ?? "0")),
    maternityCarryOver: numberOrZero(String(source.maternityCarryOver ?? "0")),
    paternity: numberOrZero(String(source.paternity ?? "0")),
    paternityCarryOver: numberOrZero(String(source.paternityCarryOver ?? "0")),
    marriage: numberOrZero(String(source.marriage ?? "0")),
    marriageCarryOver: numberOrZero(String(source.marriageCarryOver ?? "0")),
    bereavement: numberOrZero(String(source.bereavement ?? "0")),
    bereavementCarryOver: numberOrZero(String(source.bereavementCarryOver ?? "0")),
    permission: numberOrZero(String(source.permission ?? "0")),
    permissionCarryOver: numberOrZero(String(source.permissionCarryOver ?? "0")),
    sickUsed: numberOrZero(String(source.sickUsed ?? "0")),
    balanceYear: numberOrZero(String(source.balanceYear ?? new Date().getFullYear()))
  };
}

export function LeaveWorkflowBoard() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<LeaveForm>(blankForm());

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees });
  const employees = employeesQuery.data ?? [];
  const activeEmployees = employees.filter((employee) => employee.status === "active");

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return activeEmployees;
    }
    return activeEmployees.filter((employee) =>
      employee.name.toLowerCase().includes(keyword) ||
      employee.nik.toLowerCase().includes(keyword) ||
      employee.department.toLowerCase().includes(keyword) ||
      employee.position.toLowerCase().includes(keyword)
    );
  }, [activeEmployees, search]);

  const openCreate = () => {
    const firstEmployee = activeEmployees[0];
    if (!firstEmployee) {
      setMessage("Belum ada karyawan aktif untuk setup leave.");
      return;
    }
    setMode("create");
    setEmployeePickerOpen(false);
    setEmployeeSearch(`${firstEmployee.name} - ${firstEmployee.nik}`);
    setForm(mapEmployeeToForm(firstEmployee.id, firstEmployee.leaveBalances as unknown as Record<string, unknown>));
  };

  const openEdit = (employeeId: string) => {
    const target = activeEmployees.find((employee) => employee.id === employeeId);
    if (!target) {
      return;
    }
    setMode("edit");
    setEmployeePickerOpen(false);
    setEmployeeSearch(`${target.name} - ${target.nik}`);
    setForm(mapEmployeeToForm(target.id, target.leaveBalances as unknown as Record<string, unknown>));
  };

  const employeeSearchOptions = useMemo(() => {
    const keyword = employeeSearch.trim().toLowerCase();
    if (!keyword) {
      return activeEmployees;
    }
    return activeEmployees.filter((employee) =>
      employee.name.toLowerCase().includes(keyword) ||
      employee.nik.toLowerCase().includes(keyword) ||
      employee.department.toLowerCase().includes(keyword) ||
      employee.position.toLowerCase().includes(keyword)
    );
  }, [activeEmployees, employeeSearch]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const employee = employees.find((item) => item.id === form.employeeId);
      if (!employee) {
        throw new Error("Pilih karyawan dulu.");
      }

      const nextLeaveBalances = {
        ...employee.leaveBalances,
        balanceYear: new Date().getFullYear(),
        sickUsed: numberOrZero(form.sickUsed)
      };

      for (const item of managedLeaveTypes) {
        nextLeaveBalances[item.key] = numberOrZero(form[item.key]);
        nextLeaveBalances[`${item.key}CarryOver` as const] = numberOrZero(form[`${item.key}CarryOver` as keyof LeaveForm] as string);
        nextLeaveBalances[`${item.key}CarryOverExpiresAt` as const] = (form[`${item.key}CarryOverExpiresAt` as keyof LeaveForm] as string) || null;
      }

      return updateEmployee(employee.id, { leaveBalances: nextLeaveBalances });
    },
    onSuccess: async (employee) => {
      setMessage(`Leave allocation ${employee.name} berhasil disimpan.`);
      setMode(null);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const onChangeForm = (key: keyof LeaveForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const formEmployee = activeEmployees.find((employee) => employee.id === form.employeeId) ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
        <div className="flex items-center gap-3 text-white/74">
          <WalletCards className="h-5 w-5" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em]">Leave System</p>
        </div>
        <p className="mt-6 max-w-4xl text-[15px] leading-[1.6] text-white/80">
          Manage leave balances, carry over, and expiration rules for active employees in one place.
        </p>
      </section>

      <section className="page-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="topbar-control w-full lg:max-w-md">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder="Search employee, ID, department, or role..."
            />
          </label>
          <button className="primary-button shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Leave Allocation
          </button>
        </div>
      </section>

      <section className="page-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Leave Allocation List</p>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">{filteredEmployees.length} active employees.</p>
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4 lg:px-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-4 pb-2">Employee</th>
                <th className="px-4 pb-2">Annual</th>
                <th className="px-4 pb-2">Religious</th>
                <th className="px-4 pb-2">Maternity</th>
                <th className="px-4 pb-2">Paternity</th>
                <th className="px-4 pb-2">Marriage</th>
                <th className="px-4 pb-2">Bereavement</th>
                <th className="px-4 pb-2">Permission</th>
                <th className="px-4 pb-2">Sick Used</th>
                <th className="px-4 pb-2">Year</th>
                <th className="px-4 pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const balances = normalizeLeaveBalances(employee.leaveBalances as unknown as Record<string, unknown> | undefined);
                return (
                <tr key={employee.id} className="bg-[var(--surface-muted)]">
                  <td className="rounded-l-[12px] px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{employee.name}</p>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">{employee.nik} | {employee.department}</p>
                  </td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{(balances.annual + balances.annualCarryOver).toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{(balances.religious + balances.religiousCarryOver).toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{(balances.maternity + balances.maternityCarryOver).toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{(balances.paternity + balances.paternityCarryOver).toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{(balances.marriage + balances.marriageCarryOver).toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{(balances.bereavement + balances.bereavementCarryOver).toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{(balances.permission + balances.permissionCarryOver).toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{balances.sickUsed.toFixed(1)}</td>
                  <td className="px-4 py-4 text-[14px] text-[var(--text)]">{balances.balanceYear}</td>
                  <td className="rounded-r-[12px] px-4 py-4 text-right">
                    <button className="secondary-button" onClick={() => openEdit(employee.id)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>

          {employeesQuery.isLoading ? (
            <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading leave allocation...</span>
            </div>
          ) : null}

          {!employeesQuery.isLoading && filteredEmployees.length === 0 ? (
            <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
              No employee records matched the current leave allocation filters.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel rounded-[14px] p-6">
        <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Leave Allocation Rules</p>
        <div className="mt-5 space-y-4 text-[14px] leading-[1.55] text-[var(--muted)]">
          <div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> <span>HR owns leave allocation, carry over, and expiry setup for active employees.</span></div>
          <div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> <span>New employees should receive leave allocation through <strong>Add Leave Allocation</strong>.</span></div>
          <div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> <span>Request approvals continue to run through the attendance workflow.</span></div>
        </div>
      </section>

      {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
              <div>
                <p className="section-title text-[28px] font-semibold text-[var(--primary)]">{mode === "create" ? "Add Leave Allocation" : "Edit Leave Allocation"}</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">Set leave allocation values for the selected employee.</p>
              </div>
              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => setMode(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto px-6 py-6">
              <div className="space-y-5">
                <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                  <span>Employee</span>
                  {mode === "edit" ? (
                    <input value={employeeSearch} disabled className="filter-control w-full disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]" />
                  ) : (
                    <div className="relative">
                      <label className="topbar-control w-full">
                        <Search className="h-4 w-4 text-[var(--text-muted)]" />
                        <input
                          value={employeeSearch}
                          onFocus={() => setEmployeePickerOpen(true)}
                          onChange={(event) => {
                            setEmployeeSearch(event.target.value);
                            setEmployeePickerOpen(true);
                          }}
                          className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                          placeholder="Search employee, ID, department, or role..."
                        />
                      </label>
                      {employeePickerOpen ? (
                        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-[12px] border border-[var(--border)] bg-white p-2 shadow-lg">
                          {employeeSearchOptions.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              className="w-full rounded-[10px] px-3 py-3 text-left hover:bg-[var(--surface-muted)]"
                              onClick={() => {
                                setEmployeeSearch(`${employee.name} - ${employee.nik}`);
                                setForm(mapEmployeeToForm(employee.id, employee.leaveBalances as unknown as Record<string, unknown>));
                                setEmployeePickerOpen(false);
                              }}
                            >
                              <p className="text-[14px] font-semibold text-[var(--text)]">{employee.name}</p>
                              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{employee.nik} | {employee.department} | {employee.position}</p>
                            </button>
                          ))}
                          {employeeSearchOptions.length === 0 ? (
                            <div className="px-3 py-3 text-[13px] text-[var(--text-muted)]">No employees found.</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </label>

                {formEmployee ? (
                  <div className="panel-muted p-4">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{formEmployee.name}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{formEmployee.department} | {formEmployee.position}</p>
                  </div>
                ) : null}

                <div className="grid gap-4">
                  {managedLeaveTypes.map((item) => (
                    <div key={item.key} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <p className="text-[14px] font-semibold text-[var(--primary)]">{item.label}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="block space-y-2 text-[13px] font-medium text-[var(--text)]">
                          <span>Current Year</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={form[item.key]}
                            onChange={(event) => onChangeForm(item.key, event.target.value)}
                            className="filter-control w-full"
                          />
                        </label>
                        <label className="block space-y-2 text-[13px] font-medium text-[var(--text)]">
                          <span>Carry Over</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={form[`${item.key}CarryOver` as keyof LeaveForm] as string}
                            onChange={(event) => onChangeForm(`${item.key}CarryOver` as keyof LeaveForm, event.target.value)}
                            className="filter-control w-full"
                          />
                        </label>
                        <label className="block space-y-2 text-[13px] font-medium text-[var(--text)]">
                          <span>Carry Over Expires</span>
                          <input
                            type="date"
                            value={form[`${item.key}CarryOverExpiresAt` as keyof LeaveForm] as string}
                            onChange={(event) => onChangeForm(`${item.key}CarryOverExpiresAt` as keyof LeaveForm, event.target.value)}
                            className="filter-control w-full"
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                    <span>Sick Leave Used</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.sickUsed}
                      onChange={(event) => onChangeForm("sickUsed", event.target.value)}
                      className="filter-control w-full"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-5">
              <button className="secondary-button" onClick={() => setMode(null)}>Cancel</button>
              <button className="primary-button" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending || !form.employeeId}>
                {upsertMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save Allocation
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
