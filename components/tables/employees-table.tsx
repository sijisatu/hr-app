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
    <div className="space-y-5">
      {employees.map((employee) => (
        <div key={employee.id} className="panel rounded-[30px] p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-sm font-bold text-white">
                {employee.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="section-title text-2xl font-semibold text-[var(--primary)]">{employee.name}</p>
                  <StatusPill tone={employee.status}>{employee.status === "active" ? "Active" : "Inactive"}</StatusPill>
                  <StatusPill tone={contractToneMap[employee.contractStatus]}>
                    {contractLabelMap[employee.contractStatus]}
                  </StatusPill>
                </div>
                <p className="mt-2 text-sm text-muted">{employee.employeeNumber} | {employee.email}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                  <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" />{employee.department}</span>
                  <span className="inline-flex items-center gap-2"><UserRoundCog className="h-4 w-4" />{employee.position}</span>
                  <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{employee.workLocation}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 text-muted">
              <button className="rounded-2xl bg-[var(--panel-alt)] p-3"><Eye className="h-4 w-4" /></button>
              <button className="rounded-2xl bg-[var(--panel-alt)] p-3"><Pencil className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoBlock label="Role & Manager" value={`${employee.role.toUpperCase()} | ${employee.managerName}`} helper={`${employee.workType} setup`} />
            <InfoBlock label="Contract Window" value={`${employee.contractStart} -> ${employee.contractEnd ?? "Open-ended"}`} helper={employee.employmentType} />
            <InfoBlock label="Payroll Baseline" value={currency(employee.baseSalary + employee.allowance)} helper={`${currency(employee.baseSalary)} salary + ${currency(employee.allowance)} allowance`} />
            <InfoBlock label="Tax & Bank" value={`${employee.taxProfile} | ${employee.bankName}`} helper={employee.bankAccountMasked} />
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoBlock({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[24px] bg-[var(--panel-alt)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-3 font-semibold text-[var(--primary)]">{value}</p>
      <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted">
        <ReceiptText className="h-4 w-4" />
        {helper}
      </div>
    </div>
  );
}
