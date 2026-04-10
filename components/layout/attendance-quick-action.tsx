"use client";

import { Clock3 } from "lucide-react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { useAttendanceModal } from "@/components/providers/attendance-modal-provider";
import { useSession } from "@/components/providers/session-provider";
import { getAttendanceToday } from "@/lib/api";

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
  const { currentUser } = useSession();
  const attendanceTodayQuery = useQuery({
    queryKey: ["attendance-today"],
    queryFn: getAttendanceToday,
    staleTime: 15000,
    refetchOnWindowFocus: true,
    enabled: Boolean(currentUser?.id)
  });

  const hasOpenAttendance = Boolean(
    currentUser?.id &&
    (attendanceTodayQuery.data ?? []).some((record) => record.userId === currentUser.id && record.checkOut === null)
  );

  return (
    <button
      type="button"
      onClick={openModal}
      disabled={isOpen || attendanceTodayQuery.isLoading}
      className={clsx(
        compact ? "primary-button min-w-[140px]" : "primary-button",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      <Clock3 className="h-4 w-4" />
      {hasOpenAttendance ? "Clock Out" : label}
    </button>
  );
}
