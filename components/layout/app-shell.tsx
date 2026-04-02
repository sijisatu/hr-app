"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  ChartColumn,
  ChevronDown,
  ClipboardList,
  LayoutGrid,
  Search,
  Settings,
  Shield,
  Users
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
  "Attendance Logs": ClipboardList,
  Reports: ChartColumn,
  "Leave Flow": CalendarClock
};

export function AppShell({
  title,
  subtitle,
  actions,
  children
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { currentUser } = useSession();
  const visibleNav = navItems.filter((item) => !item.roles || (currentUser ? item.roles.includes(currentUser.role) : false));

  return (
    <div className="app-shell lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="panel border-x-0 border-b lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-4 px-6 py-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary)] text-sm font-bold text-white">
            {activeTenant.shortLabel}
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-[var(--primary)]">{activeTenant.productName}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">{activeTenant.companyTagline}</p>
          </div>
        </div>

        <div className="px-4">
          <div className="rounded-[24px] bg-[var(--panel-alt)] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Signed in as</p>
            <p className="mt-2 font-semibold text-[var(--primary)]">{currentUser?.name ?? "Guest"}</p>
            <p className="mt-1 text-sm text-muted">{currentUser ? `${currentUser.role} | ${currentUser.position}` : "No session"}</p>
          </div>
        </div>

        <nav className="space-y-2 px-4 py-5">
          {visibleNav.map((item) => {
            const Icon = iconMap[item.label as keyof typeof iconMap];
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  active ? "bg-white text-[var(--primary)] shadow-soft" : "text-muted hover:bg-white/70 hover:text-[var(--primary)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-5 px-4 pb-6 pt-10">
          <AttendanceQuickAction label="Clock In" />
          <div className="space-y-2 text-sm text-muted">
            <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-white/70">
              <Shield className="h-4 w-4" />
              Help Center
            </button>
            <Link href="/login" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-white/70">
              <ChevronDown className="h-4 w-4" />
              Switch Account
            </Link>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="px-4 py-4 sm:px-6 lg:px-8">
        <header className="panel mb-6 flex flex-col gap-4 rounded-[28px] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <div className="hidden rounded-2xl bg-[var(--panel-alt)] p-3 text-[var(--primary)] lg:block">
              <Search className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Executive Presence</p>
              <h1 className="section-title mt-1 text-3xl font-semibold text-[var(--primary)] sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actions}
            <button className="rounded-2xl bg-[var(--panel-alt)] p-3 text-muted">
              <Bell className="h-4 w-4" />
            </button>
            <button className="rounded-2xl bg-[var(--panel-alt)] p-3 text-muted">
              <Settings className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--primary)] text-sm font-bold text-white">
                {currentUser?.name.split(" ").map((part) => part[0]).join("").slice(0, 2) ?? "AU"}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-[var(--primary)]">{currentUser?.name ?? "Admin User"}</p>
                <p className="text-xs text-muted">{currentUser ? `${currentUser.role} | ${activeTenant.companyName}` : activeTenant.companyName}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-muted sm:block" />
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
