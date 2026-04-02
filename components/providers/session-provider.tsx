"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/auth-config";

type SessionContextValue = {
  currentUser: SessionUser | null;
};

const SessionContext = createContext<SessionContextValue>({ currentUser: null });

export function SessionProvider({ children, currentUser }: { children: ReactNode; currentUser: SessionUser | null }) {
  return <SessionContext.Provider value={{ currentUser }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
