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
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(33,62,118,0.16),_transparent_38%),linear-gradient(180deg,_#f8fbff_0%,_#eef3fa_100%)] px-4 py-10">
      <div className="w-full max-w-5xl rounded-[40px] border border-white/70 bg-white/90 p-6 shadow-2xl backdrop-blur sm:p-8 lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
        <section className="rounded-[32px] bg-[var(--primary)] p-8 text-white">
          <div className="flex items-center gap-3 text-white/75">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">White-label Access</span>
          </div>
          <h1 className="section-title mt-8 text-4xl font-semibold leading-tight">Masuk sebagai HRD, manager, atau employee.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
            Demo auth ini dipakai buat ngetes role-based access dari sudut pandang yang berbeda. Tinggal pilih account, tanpa perlu setup password dulu.
          </p>
          <div className="mt-10 space-y-4 text-sm text-white/75">
            <div className="rounded-[24px] bg-white/10 p-4">`HRD` bisa review leave, lihat report, dan kelola data employee.</div>
            <div className="rounded-[24px] bg-white/10 p-4">`Employee` cuma lihat data sendiri, absensi sendiri, dan request cuti pribadi.</div>
            <div className="rounded-[24px] bg-white/10 p-4">`Manager` bisa lihat operasional tim dan bantu approval workflow.</div>
          </div>
        </section>

        <section className="mt-6 space-y-4 lg:mt-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Demo Accounts</p>
            <h2 className="section-title mt-3 text-3xl font-semibold text-[var(--primary)]">Choose your point of view</h2>
            <p className="mt-3 text-sm text-muted">Klik salah satu account di bawah untuk masuk ke aplikasi dengan permission yang sesuai role.</p>
          </div>

          <div className="space-y-4">
            {demoUsers.map((user) => (
              <button
                key={user.sessionKey}
                type="button"
                onClick={() => loginAs(user)}
                disabled={pending}
                className="w-full rounded-[28px] border border-border bg-[var(--panel-alt)] p-5 text-left transition hover:border-[var(--primary)]/20 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-[var(--primary)]">{user.name}</p>
                    <p className="mt-1 text-sm text-muted">{user.position}</p>
                    <p className="mt-3 text-sm text-slate-600">{user.department} | {user.email}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                    {user.role}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {pending ? <div className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> Menyiapkan session login...</div> : null}
        </section>
      </div>
    </div>
  );
}
