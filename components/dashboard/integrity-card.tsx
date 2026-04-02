import { ShieldCheck } from "lucide-react";

export function IntegrityCard() {
  return (
    <div className="rounded-[30px] bg-[var(--primary)] p-6 text-white shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">System Integrity</p>
      <div className="mt-8 flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-semibold">Biometric scanners</p>
          <p className="mt-2 text-sm text-white/70">All 14 nodes synchronized with geofence policy.</p>
        </div>
      </div>
    </div>
  );
}
