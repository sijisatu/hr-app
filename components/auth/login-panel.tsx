"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { demoUsers, type SessionUser } from "@/lib/auth-config";
import { useSession } from "@/components/providers/session-provider";

export function LoginPanel() {
  const router = useRouter();
  const { setCurrentUser } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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

      const payload = (await response.json()) as { data: { redirectTo: string; user: SessionUser } };
      setCurrentUser(payload.data.user);
      router.replace(payload.data.redirectTo);
    });
  };

  const loginWithCredentials = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setError(payload?.error ?? "Gagal masuk dengan username dan password.");
        return;
      }

      const payload = (await response.json()) as { data: { redirectTo: string; user: SessionUser } };
      setCurrentUser(payload.data.user);
      router.replace(payload.data.redirectTo);
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
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Access</p>
            <h2 className="section-title mt-2 text-[30px] font-semibold text-[var(--primary)]">Sign in to the workspace</h2>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">HR bisa membuat akun employee dengan username dan password. Demo role tetap tersedia untuk testing cepat.</p>
          </div>

          <form
            className="mt-6 page-card border-[var(--border)] bg-[var(--surface-muted)] p-5 shadow-none"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending || !username.trim() || !password.trim()) {
                return;
              }
              loginWithCredentials();
            }}
          >
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Employee Login</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                <span>Username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} className="filter-control w-full" placeholder="Contoh: NIK employee" />
              </label>
              <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                <span>Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="filter-control w-full" placeholder="Password dari HR" />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="text-left text-[13px] font-medium text-[var(--primary)] underline-offset-4 hover:underline" onClick={() => setForgotPasswordOpen(true)}>
                Forgot password? Contact HR
              </button>
              <button type="submit" disabled={pending || !username.trim() || !password.trim()} className="primary-button">
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Sign In
              </button>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Demo Accounts</p>
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

      {forgotPasswordOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white shadow-2xl">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Lupa Password?</p>
              <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
                Silakan hubungi tim HR untuk reset password akun karyawan Anda. Saat lapor ke HR, sertakan NIK atau username akun supaya proses reset lebih cepat.
              </p>
            </div>
            <div className="px-6 py-5 text-[14px] text-[var(--text-muted)]">
              Setelah HR reset password, Anda bisa login kembali memakai password baru yang diberikan HR.
            </div>
            <div className="flex justify-end border-t border-[var(--border)] px-6 py-4">
              <button type="button" className="primary-button" onClick={() => setForgotPasswordOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
