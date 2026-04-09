"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Search,
  Settings,
  UserRound,
  Users,
  WalletCards
} from "lucide-react";
import clsx from "clsx";
import { activeTenant } from "@/lib/tenant";
import { navItems } from "@/lib/data";
import { AttendanceQuickAction } from "@/components/layout/attendance-quick-action";
import { useSession } from "@/components/providers/session-provider";
import { LogoutButton } from "@/components/auth/logout-button";

const iconMap = {
  Dashboard: LayoutGrid,
  "Employee List": Users,
  "Employee Attendance": ClipboardList,
  Payroll: WalletCards,
  Profile: UserRound,
  Reports: ChartColumn,
  "Leave Flow": CalendarClock
};

export function AppShell({ title, subtitle, actions, children, compact = false }: { title: string; subtitle: string; actions?: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  const pathname = usePathname();
  const { currentUser } = useSession();
  const visibleNav = navItems.filter((item) => !item.roles || (currentUser ? item.roles.includes(currentUser.role) : false));

  return (
    <div className="app-shell lg:pl-[var(--sidebar-width)]">
      <aside className="app-sidebar lg:fixed lg:left-0 lg:top-0 lg:z-30 lg:h-screen lg:w-[var(--sidebar-width)] lg:px-6 lg:py-6">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-4 px-2 py-2">
            <div className="grid h-12 w-12 place-items-center rounded-[12px] bg-[var(--primary)] text-sm font-semibold text-white">
              {activeTenant.shortLabel}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-semibold text-[var(--primary)]">{activeTenant.productName}</p>
              <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{activeTenant.companyTagline}</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {visibleNav.map((item) => {
              const Icon = iconMap[item.label as keyof typeof iconMap];
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link key={item.href} href={item.href} className={clsx("nav-item", active && "nav-item-active")}>
                  <Icon className="h-5 w-5" />
                  <span className="truncate text-[15px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="space-y-5 border-t border-[var(--border)] pt-6">
            <AttendanceQuickAction label="Clock In" className="primary-button w-full" />

            <div className="space-y-1">
              <button className="nav-item w-full">
                <HelpCircle className="h-5 w-5" />
                <span className="text-[15px] font-medium">Help Center</span>
              </button>

              <Link href="/login" className="nav-item">
                <Users className="h-5 w-5" />
                <span className="text-[15px] font-medium">Switch Account</span>
              </Link>

              <LogoutButton className="nav-item !w-full !justify-start !px-4">
                <LogOut className="h-5 w-5" />
                <span className="text-[15px] font-medium">Sign Out</span>
              </LogoutButton>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-surface min-h-screen">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(243,245,249,0.92)] backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-6 py-3 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[var(--primary)]">{title}</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="topbar-control w-[240px] sm:w-[280px]">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" placeholder="Search..." />
              </label>

              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0">
                <Bell className="h-4 w-4" />
              </button>
              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0">
                <Settings className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-white px-2 py-1.5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white">
                  {currentUser?.name.split(" ").map((part) => part[0]).join("").slice(0, 2) ?? "AU"}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-[14px] font-semibold text-[var(--primary)]">{currentUser?.name ?? "Admin User"}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={clsx("px-6 py-6 lg:px-8", compact ? "lg:py-6" : "lg:py-8")}>
          <div className={clsx("flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", compact ? "mb-6" : "mb-8")}>
            <div className="min-w-0">
              <h1 className={clsx("section-title font-semibold leading-tight text-[var(--primary)]", compact ? "text-[32px] lg:text-[36px]" : "text-[36px] lg:text-[44px]")}>{title}</h1>
              <p className={clsx("mt-2 max-w-3xl text-[var(--text-muted)]", compact ? "text-[14px] leading-5" : "text-[15px] leading-6")}>{subtitle}</p>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}

