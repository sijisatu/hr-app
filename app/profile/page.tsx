import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";
import { currency, getEmployees, getLeaveHistory } from "@/lib/api";

function InfoCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel-muted p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-[15px] font-semibold leading-6 text-[var(--text)]">{value}</p>
      {note ? <p className="mt-2 text-[13px] text-[var(--text-muted)]">{note}</p> : null}
    </div>
  );
}

export default async function ProfilePage() {
  const session = await requireSession(["manager", "employee"]);
  const [employees, leaveHistory] = await Promise.all([
    getEmployees(),
    getLeaveHistory()
  ]);
  const employee = employees.find((item) => item.id === session.id);
  const sickLeaveUsed = leaveHistory.filter((item) => item.userId === session.id && item.status === "approved" && (item.type === "Sick Submission" || item.type === "Sick Leave")).length;

  if (!employee) {
    return (
      <AppShell title="Profile" subtitle="Data karyawan untuk akun yang sedang login.">
        <div className="page-card p-6 text-[14px] text-[var(--text-muted)]">Data karyawan tidak ditemukan untuk akun ini.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile" subtitle="Data karyawan untuk akun yang sedang login.">
      <div className="space-y-6">
        <section className="page-card p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Employee Profile</p>
              <h2 className="mt-3 text-[30px] font-semibold leading-tight text-[var(--primary)]">{employee.name}</h2>
              <p className="mt-2 text-[15px] text-[var(--text-muted)]">{employee.position} - {employee.department}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <InfoCard label="Employee ID" value={employee.employeeNumber} />
              <InfoCard label="Status" value={`${employee.status} - ${employee.contractStatus}`} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="page-card p-6">
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Data Karyawan</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoCard label="Email" value={employee.email} />
              <InfoCard label="Phone" value={employee.phone} />
              <InfoCard label="Role" value={employee.role.toUpperCase()} note={employee.managerName} />
              <InfoCard label="Work Setup" value={`${employee.workType} - ${employee.workLocation}`} />
              <InfoCard label="Join Date" value={employee.joinDate} />
              <InfoCard label="Contract" value={`${employee.contractStart} - ${employee.contractEnd ?? "Open-ended"}`} note={employee.employmentType} />
            </div>
          </div>

          <div className="page-card p-6">
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Payroll Snapshot</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoCard label="Base Salary" value={currency(employee.baseSalary)} />
              <InfoCard label="Allowance" value={currency(employee.allowance)} />
              <InfoCard label="Bank" value={`${employee.bankName} ${employee.bankAccountMasked}`} />
              <InfoCard label="Tax Profile" value={employee.taxProfile} />
            </div>
          </div>
        </section>

        <section className="page-card p-6">
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Leave Overview</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InfoCard label="Annual Leave" value={`${employee.leaveBalances.annual} days`} />
            <InfoCard label="Sick Leave Used" value={`${sickLeaveUsed} times`} note="Sick leave is tracked as usage, not remaining balance." />
            <InfoCard label="Permission" value={`${employee.leaveBalances.permission} days`} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
