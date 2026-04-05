"use client";

import { Clock3 } from "lucide-react";
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
        compact ? "primary-button min-w-[140px]" : "primary-button",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      <Clock3 className="h-4 w-4" />
      {label}
    </button>
  );
}

