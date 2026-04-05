"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { demoUsers, type SessionUser } from "@/lib/auth-config";

export function LoginPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loginAs = (user: SessionUser) => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: user.sessionKey })
      });

      if (!response.ok) {
        setError("Gagal masuk ke demo account.");
        return;
      }

      const payload = (await response.json()) as { data: { redirectTo: string } };
      router.push(payload.data.redirectTo);
      router.refresh();
    });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-10">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="page-card bg-[var(--primary)] p-8 text-white">
          <div className="flex items-center gap-3 text-white/76">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-[12px] font-medium uppercase tracking-[0.08em]">White-label Access</span>
          </div>
          <h1 className="section-title mt-6 text-[32px] font-semibold leading-tight">Sign in by role.</h1>
          <p className="mt-3 text-[14px] leading-6 text-white/76">Use the demo accounts to review the app from HR, manager, employee, and admin points of view.</p>
        </section>

        <section className="page-card p-6 lg:p-8">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Demo Accounts</p>
            <h2 className="section-title mt-2 text-[30px] font-semibold text-[var(--primary)]">Choose your session</h2>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">Select a role to test access and page restrictions.</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {demoUsers.map((user) => (
              <button
                key={user.sessionKey}
                type="button"
                onClick={() => loginAs(user)}
                disabled={pending}
                className="page-card p-5 text-left shadow-none hover:border-[var(--primary)]/25 hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-[var(--text)]">{user.name}</p>
                    <p className="mt-1 text-[14px] text-[var(--text-muted)]">{user.position}</p>
                    <p className="mt-3 break-words text-[13px] leading-5 text-[var(--text-muted)]">{user.department} • {user.email}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--primary)]">{user.role}</span>
                </div>
              </button>
            ))}
          </div>

          {error ? <div className="mt-4 rounded-[12px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-[14px] text-[var(--danger)]">{error}</div> : null}
          {pending ? <div className="mt-4 flex items-center gap-2 text-[14px] text-[var(--text-muted)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Preparing session...</div> : null}
        </section>
      </div>
    </div>
  );
}

