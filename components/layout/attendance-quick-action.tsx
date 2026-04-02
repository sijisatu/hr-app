"use client";

import { ScanFace } from "lucide-react";
import clsx from "clsx";
import { useAttendanceModal } from "@/components/providers/attendance-modal-provider";

export function AttendanceQuickAction({
  className,
  compact = false,
  label = "Clock In"
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const { openModal, isOpen } = useAttendanceModal();

  return (
    <button
      type="button"
      onClick={openModal}
      disabled={isOpen}
      className={clsx(
        compact
          ? "flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-soft"
          : "flex w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 py-4 text-sm font-semibold text-white shadow-soft transition hover:translate-y-[-1px]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      <ScanFace className="h-4 w-4" />
      {label}
    </button>
  );
}
