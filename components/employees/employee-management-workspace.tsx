"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, WalletCards } from "lucide-react";
import { EmployeesTable } from "@/components/tables/employees-table";
import {
  createEmployee,
  deleteEmployee,
  getCompensationProfiles,
  getEmployees,
  getPayrollComponents,
  getTaxProfiles,
  updateEmployee,
  type CompensationProfileRecord,
  type EducationRecord,
  type EmployeeRecord,
  type WorkExperienceRecord
} from "@/lib/api";

type Props = {
  initialEmployees: EmployeeRecord[];
  initialCompensationProfiles: CompensationProfileRecord[];
};

type Mode = "create" | "edit" | "view" | null;
type TabKey = "personal" | "education" | "job" | "experience" | "financial";
type EducationForm = EducationRecord;
type ExperienceForm = WorkExperienceRecord;

type FormState = {
  id?: string;
  nik: string;
  name: string;
  email: string;
  birthPlace: string;
  birthDate: string;
  gender: "male" | "female";
  maritalStatus: "single" | "married" | "divorced" | "widowed";
  marriageDate: string;
  address: string;
  idCardNumber: string;
  educationSummary: string;
  workExperienceSummary: string;
  educationHistory: EducationForm[];
  workExperiences: ExperienceForm[];
  department: string;
  position: string;
  role: "admin" | "hr" | "employee" | "manager";
  status: "active" | "inactive";
  phone: string;
  workLocation: string;
  workType: "onsite" | "hybrid" | "remote";
  managerName: string;
  employmentType: "permanent" | "contract" | "intern";
  contractStatus: "permanent" | "contract" | "intern";
  contractStart: string;
  contractEnd: string;
  positionSalaryId: string;
  financialComponentIds: string[];
  taxProfileId: string;
  taxProfile: string;
  bankName: string;
  bankAccountMasked: string;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "personal", label: "Personal Info" },
  { key: "education", label: "Education" },
  { key: "job", label: "Job Details" },
  { key: "experience", label: "Work Experience" },
  { key: "financial", label: "Financial Details" }
];

function blankEducation(): EducationForm {
  return { level: "", institution: "", major: "", startYear: "", endYear: "" };
}

function blankExperience(): ExperienceForm {
  return { company: "", role: "", startDate: "", endDate: "", description: "" };
}

function blankForm(): FormState {
  return {
    nik: "",
    name: "",
    email: "",
    birthPlace: "",
    birthDate: "1995-01-01",
    gender: "male",
    maritalStatus: "single",
    marriageDate: "",
    address: "",
    idCardNumber: "",
    educationSummary: "",
    workExperienceSummary: "",
    educationHistory: [blankEducation()],
    workExperiences: [blankExperience()],
    department: "",
    position: "",
    role: "employee",
    status: "active",
    phone: "",
    workLocation: "Jakarta HQ",
    workType: "onsite",
    managerName: "",
    employmentType: "permanent",
    contractStatus: "permanent",
    contractStart: new Date().toISOString().slice(0, 10),
    contractEnd: "",
    positionSalaryId: "",
    financialComponentIds: [],
    taxProfileId: "",
    taxProfile: "",
    bankName: "BCA",
    bankAccountMasked: ""
  };
}

function mapEmployee(employee: EmployeeRecord): FormState {
  return {
    id: employee.id,
    nik: employee.nik,
    name: employee.name,
    email: employee.email,
    birthPlace: employee.birthPlace,
    birthDate: employee.birthDate,
    gender: employee.gender,
    maritalStatus: employee.maritalStatus,
    marriageDate: employee.marriageDate ?? "",
    address: employee.address,
    idCardNumber: employee.idCardNumber,
    educationSummary: employee.education,
    workExperienceSummary: employee.workExperience,
    educationHistory: employee.educationHistory.length > 0 ? employee.educationHistory : [blankEducation()],
    workExperiences: employee.workExperiences.length > 0 ? employee.workExperiences : [blankExperience()],
    department: employee.department,
    position: employee.position,
    role: employee.role,
    status: employee.status,
    phone: employee.phone,
    workLocation: employee.workLocation,
    workType: employee.workType,
    managerName: employee.managerName,
    employmentType: employee.employmentType,
    contractStatus: employee.contractStatus,
    contractStart: employee.contractStart,
    contractEnd: employee.contractEnd ?? "",
    positionSalaryId: employee.positionSalaryId ?? "",
    financialComponentIds: employee.financialComponentIds,
    taxProfileId: employee.taxProfileId ?? "",
    taxProfile: employee.taxProfile,
    bankName: employee.bankName,
    bankAccountMasked: employee.bankAccountMasked
  };
}

function money(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function EmployeeManagementWorkspace({ initialEmployees, initialCompensationProfiles }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [tab, setTab] = useState<TabKey>("personal");
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees, initialData: initialEmployees });
  const positionQuery = useQuery({ queryKey: ["compensation-profiles"], queryFn: getCompensationProfiles, initialData: initialCompensationProfiles });
  const componentQuery = useQuery({ queryKey: ["payroll-components"], queryFn: getPayrollComponents });
  const taxQuery = useQuery({ queryKey: ["tax-profiles"], queryFn: getTaxProfiles });

  const employees = employeesQuery.data ?? [];
  const positions = positionQuery.data ?? [];
  const components = componentQuery.data ?? [];
  const taxProfiles = taxQuery.data ?? [];

  const earnings = components.filter((item) => item.type === "earning");
  const deductions = components.filter((item) => item.type === "deduction");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["employees"] });
    await qc.invalidateQueries({ queryKey: ["compensation-profiles"] });
    await qc.invalidateQueries({ queryKey: ["payroll-components"] });
    await qc.invalidateQueries({ queryKey: ["tax-profiles"] });
  };

  const openModal = (next: Mode, employee?: EmployeeRecord) => {
    setMode(next);
    setTab("personal");
    setForm(employee ? mapEmployee(employee) : blankForm());
  };

  const applyPosition = (id: string) => {
    const position = positions.find((item) => item.id === id);
    setForm((prev) => ({
      ...prev,
      positionSalaryId: id,
      position: position?.position ?? prev.position
    }));
  };

  const toggleComponent = (componentId: string) => {
    setForm((prev) => ({
      ...prev,
      financialComponentIds: prev.financialComponentIds.includes(componentId)
        ? prev.financialComponentIds.filter((id) => id !== componentId)
        : [...prev.financialComponentIds, componentId]
    }));
  };

  const selectedPosition = positions.find((item) => item.id === form.positionSalaryId) ?? null;
  const selectedTaxProfile = taxProfiles.find((item) => item.id === form.taxProfileId) ?? null;
  const selectedFinancials = components.filter((item) => form.financialComponentIds.includes(item.id));
  const selectedAllowancePreview = selectedFinancials.filter((item) => item.type === "earning").reduce((sum, item) => sum + item.amount, 0);

  const savePayload = {
    nik: form.nik,
    name: form.name,
    email: form.email,
    birthPlace: form.birthPlace,
    birthDate: form.birthDate,
    gender: form.gender,
    maritalStatus: form.maritalStatus,
    marriageDate: form.maritalStatus === "married" ? form.marriageDate || null : null,
    address: form.address,
    idCardNumber: form.idCardNumber,
    education: form.educationSummary || form.educationHistory.map((item) => `${item.level} ${item.institution}`).join(", "),
    workExperience: form.workExperienceSummary || form.workExperiences.map((item) => `${item.company} - ${item.role}`).join(", "),
    educationHistory: form.educationHistory.filter((item) => item.level || item.institution || item.major),
    workExperiences: form.workExperiences.filter((item) => item.company || item.role || item.description),
    department: form.department,
    position: form.position,
    role: form.role,
    status: form.status,
    phone: form.phone,
    workLocation: form.workLocation,
    workType: form.workType,
    managerName: form.managerName,
    employmentType: form.contractStatus,
    contractStatus: form.contractStatus,
    contractStart: form.contractStart,
    contractEnd: form.contractStatus === "permanent" ? null : form.contractEnd || null,
    positionSalaryId: form.positionSalaryId || null,
    financialComponentIds: form.financialComponentIds,
    baseSalary: selectedPosition?.baseSalary ?? 0,
    allowance: selectedAllowancePreview,
    taxProfileId: form.taxProfileId || null,
    taxProfile: selectedTaxProfile?.name ?? form.taxProfile,
    bankName: form.bankName,
    bankAccountMasked: form.bankAccountMasked
  };

  const createMutation = useMutation({
    mutationFn: () => createEmployee(savePayload),
    onSuccess: async () => {
      setMessage("Data karyawan berhasil ditambahkan.");
      setMode(null);
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const updateMutation = useMutation({
    mutationFn: () => updateEmployee(form.id ?? "", savePayload),
    onSuccess: async () => {
      setMessage("Data karyawan berhasil diperbarui.");
      setMode(null);
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: async () => {
      setMessage("Data karyawan berhasil dihapus.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const readOnly = mode === "view";
  const busy = createMutation.isPending || updateMutation.isPending;

  const updateEducation = (index: number, key: keyof EducationForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      educationHistory: prev.educationHistory.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  };

  const updateExperience = (index: number, key: keyof ExperienceForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      workExperiences: prev.workExperiences.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/employees/financial-details" className="secondary-button"><WalletCards className="h-4 w-4" /> Financial Setup</Link>
        <button className="primary-button" onClick={() => openModal("create")}><Plus className="h-4 w-4" /> Add Employee</button>
      </div>

      <EmployeesTable employees={employees} onView={(employee) => openModal("view", employee)} onEdit={(employee) => openModal("edit", employee)} onDelete={(employee) => deleteMutation.mutate(employee.id)} />
      {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-title text-[28px] font-semibold text-[var(--primary)]">{mode === "create" ? "Add Employee" : mode === "edit" ? "Edit Employee" : "Employee Detail"}</p>
                  <p className="mt-2 text-[14px] text-[var(--text-muted)]">Input employee dipisah per bagian, dengan pendidikan dan pengalaman kerja yang bisa diisi lebih dari satu data.</p>
                </div>
                <button className="secondary-button" onClick={() => setMode(null)}>Close</button>
              </div>
            </div>
            <div className="border-b border-[var(--border)] px-6 pt-4">
              <div className="flex gap-1 overflow-x-auto">
                {tabs.map((item) => <button key={item.key} className={tab === item.key ? "rounded-t-[14px] border border-[var(--border)] border-b-white bg-white px-4 py-3 text-[14px] font-semibold text-[var(--primary)]" : "rounded-t-[14px] px-4 py-3 text-[14px] text-[var(--text-muted)]"} onClick={() => setTab(item.key)}>{item.label}</button>)}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
              {tab === "personal" ? <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nama" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} disabled={readOnly} />
                <Field label="NIK" value={form.nik} onChange={(value) => setForm((prev) => ({ ...prev, nik: value }))} disabled={readOnly} />
                <Field label="Email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} disabled={readOnly} />
                <Field label="Phone" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} disabled={readOnly} />
                <Field label="Tempat Lahir" value={form.birthPlace} onChange={(value) => setForm((prev) => ({ ...prev, birthPlace: value }))} disabled={readOnly} />
                <Field label="Tanggal Lahir" type="date" value={form.birthDate} onChange={(value) => setForm((prev) => ({ ...prev, birthDate: value }))} disabled={readOnly} />
                <Pick label="Gender" value={form.gender} onChange={(value) => setForm((prev) => ({ ...prev, gender: value as FormState["gender"] }))} options={[["male", "Male"], ["female", "Female"]]} disabled={readOnly} />
                <Pick label="Marital Status" value={form.maritalStatus} onChange={(value) => setForm((prev) => ({ ...prev, maritalStatus: value as FormState["maritalStatus"] }))} options={[["single", "Single"], ["married", "Married"], ["divorced", "Divorced"], ["widowed", "Widowed"]]} disabled={readOnly} />
                <Field label="Date of Marriage" type="date" value={form.marriageDate} onChange={(value) => setForm((prev) => ({ ...prev, marriageDate: value }))} disabled={readOnly || form.maritalStatus !== "married"} />
                <Field label="No KTP" value={form.idCardNumber} onChange={(value) => setForm((prev) => ({ ...prev, idCardNumber: value }))} disabled={readOnly} />
                <Area label="Alamat" value={form.address} onChange={(value) => setForm((prev) => ({ ...prev, address: value }))} disabled={readOnly} className="md:col-span-2" />
              </div> : null}

              {tab === "education" ? <div className="space-y-4">
                {form.educationHistory.map((item, index) => (
                  <div key={`edu-${index}`} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-[15px] font-semibold text-[var(--primary)]">Education #{index + 1}</p>
                      {!readOnly && form.educationHistory.length > 1 ? <button className="secondary-button" onClick={() => setForm((prev) => ({ ...prev, educationHistory: prev.educationHistory.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button> : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Level" value={item.level} onChange={(value) => updateEducation(index, "level", value)} disabled={readOnly} />
                      <Field label="Institution" value={item.institution} onChange={(value) => updateEducation(index, "institution", value)} disabled={readOnly} />
                      <Field label="Major" value={item.major} onChange={(value) => updateEducation(index, "major", value)} disabled={readOnly} />
                      <Field label="Start Year" value={item.startYear} onChange={(value) => updateEducation(index, "startYear", value)} disabled={readOnly} />
                      <Field label="End Year" value={item.endYear} onChange={(value) => updateEducation(index, "endYear", value)} disabled={readOnly} />
                    </div>
                  </div>
                ))}
                {!readOnly ? <button className="secondary-button" onClick={() => setForm((prev) => ({ ...prev, educationHistory: [...prev.educationHistory, blankEducation()] }))}><Plus className="h-4 w-4" /> Add Education</button> : null}
              </div> : null}

              {tab === "job" ? <div className="grid gap-4 md:grid-cols-2">
                <Field label="Departemen" value={form.department} onChange={(value) => setForm((prev) => ({ ...prev, department: value }))} disabled={readOnly} />
                <Pick label="Jabatan" value={form.positionSalaryId} onChange={applyPosition} options={[["", "Pilih Jabatan"], ...positions.map((item) => [item.id, item.position] as [string, string])]} disabled={readOnly} />
                <Pick label="Role" value={form.role} onChange={(value) => setForm((prev) => ({ ...prev, role: value as FormState["role"] }))} options={[["employee", "Employee"], ["manager", "Manager"], ["hr", "HR"], ["admin", "Admin"]]} disabled={readOnly} />
                <Pick label="Status" value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value as FormState["status"] }))} options={[["active", "Active"], ["inactive", "Inactive"]]} disabled={readOnly} />
                <Pick label="Contract Status" value={form.contractStatus} onChange={(value) => setForm((prev) => ({ ...prev, contractStatus: value as FormState["contractStatus"], employmentType: value as FormState["employmentType"], contractEnd: value === "permanent" ? "" : prev.contractEnd }))} options={[["permanent", "Permanent"], ["contract", "Contract"], ["intern", "Magang"]]} disabled={readOnly} />
                <Field label="Contract Start" type="date" value={form.contractStart} onChange={(value) => setForm((prev) => ({ ...prev, contractStart: value }))} disabled={readOnly} />
                <Field label="Contract End" type="date" value={form.contractEnd} onChange={(value) => setForm((prev) => ({ ...prev, contractEnd: value }))} disabled={readOnly || form.contractStatus === "permanent"} />
                <Field label="Manager" value={form.managerName} onChange={(value) => setForm((prev) => ({ ...prev, managerName: value }))} disabled={readOnly} />
                <Field label="Work Location" value={form.workLocation} onChange={(value) => setForm((prev) => ({ ...prev, workLocation: value }))} disabled={readOnly} />
                <Pick label="Work Type" value={form.workType} onChange={(value) => setForm((prev) => ({ ...prev, workType: value as FormState["workType"] }))} options={[["onsite", "Onsite"], ["hybrid", "Hybrid"], ["remote", "Remote"]]} disabled={readOnly} />
                <div className="panel-muted p-4 md:col-span-2 text-[14px] text-[var(--text-muted)]">
                  {selectedPosition ? `Jabatan ${selectedPosition.position} terhubung ke gaji pokok ${money(selectedPosition.baseSalary)}.` : "Pilih jabatan untuk menghubungkan employee ke master gaji pokok."}
                </div>
              </div> : null}

              {tab === "experience" ? <div className="space-y-4">
                {form.workExperiences.map((item, index) => (
                  <div key={`exp-${index}`} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-[15px] font-semibold text-[var(--primary)]">Experience #{index + 1}</p>
                      {!readOnly && form.workExperiences.length > 1 ? <button className="secondary-button" onClick={() => setForm((prev) => ({ ...prev, workExperiences: prev.workExperiences.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button> : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Company" value={item.company} onChange={(value) => updateExperience(index, "company", value)} disabled={readOnly} />
                      <Field label="Role" value={item.role} onChange={(value) => updateExperience(index, "role", value)} disabled={readOnly} />
                      <Field label="Start Date" type="date" value={item.startDate} onChange={(value) => updateExperience(index, "startDate", value)} disabled={readOnly} />
                      <Field label="End Date" type="date" value={item.endDate} onChange={(value) => updateExperience(index, "endDate", value)} disabled={readOnly} />
                      <Area label="Description" value={item.description} onChange={(value) => updateExperience(index, "description", value)} disabled={readOnly} className="md:col-span-2" />
                    </div>
                  </div>
                ))}
                {!readOnly ? <button className="secondary-button" onClick={() => setForm((prev) => ({ ...prev, workExperiences: [...prev.workExperiences, blankExperience()] }))}><Plus className="h-4 w-4" /> Add Work Experience</button> : null}
              </div> : null}

              {tab === "financial" ? <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Base Salary" value={selectedPosition ? money(selectedPosition.baseSalary) : "-"} onChange={() => undefined} disabled />
                  <Pick label="Tax Profile" value={form.taxProfileId} onChange={(value) => setForm((prev) => ({ ...prev, taxProfileId: value, taxProfile: taxProfiles.find((item) => item.id === value)?.name ?? "" }))} options={[["", "Pilih Tax Profile"], ...taxProfiles.map((item) => [item.id, `${item.name} • ${item.rate}%`] as [string, string])]} disabled={readOnly} />
                  <Field label="Bank" value={form.bankName} onChange={(value) => setForm((prev) => ({ ...prev, bankName: value }))} disabled={readOnly} />
                  <Field label="Bank Account" value={form.bankAccountMasked} onChange={(value) => setForm((prev) => ({ ...prev, bankAccountMasked: value }))} disabled={readOnly} />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="page-card p-5">
                    <p className="section-title text-[20px] font-semibold text-[var(--primary)]">Allowance Selection</p>
                    <div className="mt-4 space-y-3">
                      {earnings.map((item) => (
                        <label key={item.id} className="panel-muted flex items-start gap-3 p-4 text-[14px] text-[var(--text)]">
                          <input type="checkbox" checked={form.financialComponentIds.includes(item.id)} onChange={() => toggleComponent(item.id)} disabled={readOnly} />
                          <span>{item.name} ({item.calculationType === "percentage" ? `${item.percentage}%` : money(item.amount)})</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="page-card p-5">
                    <p className="section-title text-[20px] font-semibold text-[var(--primary)]">Deduction Selection</p>
                    <div className="mt-4 space-y-3">
                      {deductions.map((item) => (
                        <label key={item.id} className="panel-muted flex items-start gap-3 p-4 text-[14px] text-[var(--text)]">
                          <input type="checkbox" checked={form.financialComponentIds.includes(item.id)} onChange={() => toggleComponent(item.id)} disabled={readOnly} />
                          <span>{item.name} ({item.calculationType === "percentage" ? `${item.percentage}%` : money(item.amount)})</span>
                        </label>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <MiniCard label="Base Salary" value={selectedPosition ? money(selectedPosition.baseSalary) : "-"} note="Dari master jabatan" />
                  <MiniCard label="Selected Allowances" value={money(selectedAllowancePreview)} note={`${selectedFinancials.filter((item) => item.type === "earning").length} item terpilih`} />
                  <MiniCard label="Tax Profile" value={selectedTaxProfile?.name ?? "-"} note={selectedTaxProfile ? `${selectedTaxProfile.rate}% tax rate` : "Belum dipilih"} />
                </div>
              </div> : null}
            </div>

            <div className="border-t border-[var(--border)] px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] text-[var(--text-muted)]">{selectedPosition ? `Jabatan aktif: ${selectedPosition.position}` : "Belum memilih jabatan."}</p>
                <div className="flex gap-3">
                  <button className="secondary-button" onClick={() => setMode(null)}>Cancel</button>
                  {mode === "create" ? <button className="primary-button" onClick={() => createMutation.mutate()} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Save Employee</button> : null}
                  {mode === "edit" ? <button className="primary-button" onClick={() => updateMutation.mutate()} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Update Employee</button> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="filter-control w-full disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]" /></label>;
}

function Area({ label, value, onChange, disabled = false, className = "" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; className?: string }) {
  return <label className={`block space-y-2 text-[14px] font-medium text-[var(--text)] ${className}`}><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} rows={4} className="filter-control min-h-[120px] w-full resize-y disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]" /></label>;
}

function Pick({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="filter-control w-full disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]">{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}

function MiniCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="panel-muted p-4"><p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p><p className="mt-3 text-[28px] font-semibold text-[var(--primary)]">{value}</p><p className="mt-2 text-[13px] text-[var(--text-muted)]">{note}</p></div>;
}
