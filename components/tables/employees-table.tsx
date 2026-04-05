import { Building2, Eye, Landmark, MapPin, Pencil, ReceiptText, UserRoundCog } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, type EmployeeRecord } from "@/lib/api";

const contractToneMap = {
  active: "success",
  probation: "warning",
  "ending-soon": "danger",
  expired: "danger"
} as const;

const contractLabelMap = {
  active: "Active Contract",
  probation: "Probation",
  "ending-soon": "Ending Soon",
  expired: "Expired"
} as const;

export function EmployeesTable({ employees }: { employees: EmployeeRecord[] }) {
  return (
    <div className="page-card overflow-hidden p-0">
      <div className="border-b border-[var(--border)] px-6 py-5">
        <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Employee Directory</p>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">Profile, contract, and payroll baseline overview.</p>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {employees.map((employee) => (
          <div key={employee.id} className="px-6 py-5 hover:bg-[var(--surface-muted)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-[13px] font-semibold text-[var(--primary)]">
                  {employee.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[18px] font-semibold text-[var(--text)]">{employee.name}</p>
                    <StatusPill tone={employee.status}>{employee.status === "active" ? "Active" : "Inactive"}</StatusPill>
                    <StatusPill tone={contractToneMap[employee.contractStatus]}>{contractLabelMap[employee.contractStatus]}</StatusPill>
                  </div>
                  <p className="mt-1 break-words text-[14px] text-[var(--text-muted)]">{employee.employeeNumber} • {employee.email}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" />{employee.department}</span>
                    <span className="inline-flex items-center gap-2"><UserRoundCog className="h-4 w-4" />{employee.position}</span>
                    <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{employee.workLocation}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0"><Eye className="h-4 w-4" /></button>
                <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0"><Pencil className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoBlock label="Role & Manager" value={`${employee.role.toUpperCase()} • ${employee.managerName}`} helper={`${employee.workType} setup`} />
              <InfoBlock label="Contract Window" value={`${employee.contractStart} ? ${employee.contractEnd ?? "Open-ended"}`} helper={employee.employmentType} />
              <InfoBlock label="Payroll Baseline" value={currency(employee.baseSalary + employee.allowance)} helper={`${currency(employee.baseSalary)} + ${currency(employee.allowance)}`} />
              <InfoBlock label="Tax & Bank" value={`${employee.taxProfile} • ${employee.bankName}`} helper={employee.bankAccountMasked} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="panel-muted p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 break-words text-[14px] font-semibold leading-5 text-[var(--text)]">{value}</p>
      <div className="mt-3 inline-flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
        <ReceiptText className="h-4 w-4" />
        {helper}
      </div>
    </div>
  );
}

