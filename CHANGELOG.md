# Changelog

## 2026-04-02
- Initial HR app prototype.

## 2026-04-05
- Complete HRIS foundation and reporting modules.
- Add README app previews.

## 2026-04-08
- Unify employee attendance workspace.

## 2026-04-09
- Implement attendance request hub and compact dashboard.
- Update roadmap.
- Add system flow diagram.
- Add HR attendance reporting workspace.

## 2026-04-10
- Refine HR attendance and employee management.
- Improve employee list module.

## 2026-04-11
- Improve employee auth and attendance quick action.
- Update roadmap notes.
- Implement leave, attendance, HR dashboard, and service control updates.
- Remove stray backend artifacts.

## 2026-04-12
- Stabilize service control and improve mobile responsiveness.
- Revamp HR reports export flow and XLSX generation.
- Update roadmap.

## 2026-04-13
- Add reimbursement module with approvals and claim allocations.

## 2026-04-14
- Migrate app storage to PostgreSQL.
- Improve HR form actions and roadmap notes.

## 2026-04-15
- Polish production UI and mobile responsiveness.

## 2026-04-16
- Complete pre-production performance hardening (`C1`-`C6`) and update audit checklist.
- Implement server-side pagination/filtering for employees, attendance history, reimbursement requests, and payslips.
- Optimize database snapshot persistence from row-by-row upsert to batched transaction writes.
- Add async export worker queue with status polling for HR reports and payslip export.
- Enable backend response compression and endpoint cache-control strategy.
- Add production query indexes via Prisma schema + migration.
- Improve report and payroll export flow with async polling and stable `.xlsx` output.
