"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        })
      }
      disabled={pending}
      type="button"
    >
      <LogOut className="h-4 w-4" />
      {pending ? "Signing out..." : "Sign Out"}
    </button>
  );
}
