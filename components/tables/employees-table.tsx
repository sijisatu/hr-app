import { Building2, Eye, MapPin, Pencil, ReceiptText, Trash2, UserRoundCog } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, type EmployeeRecord } from "@/lib/api";

const contractToneMap = {
  permanent: "success",
  contract: "warning",
  intern: "danger"
} as const;

const contractLabelMap = {
  permanent: "Permanent",
  contract: "Contract",
  intern: "Magang"
} as const;

export function EmployeesTable({
  employees,
  onView,
  onEdit,
  onDelete
}: {
  employees: EmployeeRecord[];
  onView?: (employee: EmployeeRecord) => void;
  onEdit?: (employee: EmployeeRecord) => void;
  onDelete?: (employee: EmployeeRecord) => void;
}) {
  return (
    <div className="page-card overflow-hidden p-0">
      <div className="border-b border-[var(--border)] px-6 py-5">
        <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Employee Directory</p>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">Data karyawan dibagi ke personal, education, job, work experience, dan financial details.</p>
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
                  <p className="mt-1 break-words text-[14px] text-[var(--text-muted)]">{employee.employeeNumber} • {employee.nik} • {employee.email}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" />{employee.department}</span>
                    <span className="inline-flex items-center gap-2"><UserRoundCog className="h-4 w-4" />{employee.position}</span>
                    <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{employee.workLocation}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => onView?.(employee)}><Eye className="h-4 w-4" /></button>
                <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => onEdit?.(employee)}><Pencil className="h-4 w-4" /></button>
                <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => onDelete?.(employee)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoBlock label="Personal Info" value={`${employee.birthPlace}, ${employee.birthDate}`} helper={`${employee.gender} • ${employee.maritalStatus}`} />
              <InfoBlock label="Education" value={employee.education} helper={employee.workExperience} />
              <InfoBlock label="Job Details" value={`${employee.role.toUpperCase()} • ${employee.managerName}`} helper={`${employee.employmentType} • ${employee.workType}`} />
              <InfoBlock label="Financial Details" value={currency(employee.baseSalary + employee.allowance)} helper={`${currency(employee.baseSalary)} + ${currency(employee.allowance)} allowance`} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoBlock label="Address & ID" value={employee.idCardNumber} helper={employee.address} />
              <InfoBlock label="Contract Window" value={`${employee.contractStart} - ${employee.contractEnd ?? "Open-ended"}`} helper={employee.status} />
              <InfoBlock label="Education & Experience" value={`${employee.educationHistory.length} education • ${employee.workExperiences.length} experiences`} helper={employee.taxProfile} />
              <InfoBlock label="Banking" value={`${employee.bankName} • ${employee.bankAccountMasked}`} helper={employee.positionSalaryId ?? "No position salary linked"} />
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
      <div className="mt-3 inline-flex items-start gap-2 text-[13px] text-[var(--text-muted)]">
        <ReceiptText className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{helper}</span>
      </div>
    </div>
  );
}
