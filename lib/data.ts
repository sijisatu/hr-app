import type { UserRole } from "@/lib/auth-config";

export type NavItem = {
  href: string;
  label: string;
  roles?: UserRole[];
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/employees", label: "Employee List", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/attendance", label: "Attendance Logs", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/payroll", label: "Payroll", roles: ["admin", "hr", "employee"] },
  { href: "/self-service", label: "Self Service", roles: ["employee"] },
  { href: "/reports", label: "Reports", roles: ["admin", "hr", "manager"] },
  { href: "/leave", label: "Leave Flow", roles: ["admin", "hr", "manager", "employee"] }
];
