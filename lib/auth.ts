import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authCookieName,
  authProfileCookieName,
  decodeSessionProfile,
  defaultRouteForRole,
  findDemoUser,
  type SessionUser,
  type UserRole
} from "@/lib/auth-config";
import { verifyAndExtractSessionKey } from "@/lib/session-token";

const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ((process.env.NODE_ENV ?? "").toLowerCase() === "production" ? "https://localhost:4000" : "http://localhost:4000");

const getEmployeeSessionById = cache(async (employeeId: string): Promise<SessionUser | null> => {
  const response = await fetch(`${API_BASE}/api/auth/employee-session/${employeeId}`, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data: SessionUser };
  return payload.data ?? null;
});

export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const sessionKey = verifyAndExtractSessionKey(cookieStore.get(authCookieName)?.value);
  const cachedProfile = decodeSessionProfile(cookieStore.get(authProfileCookieName)?.value);
  if (cachedProfile && cachedProfile.sessionKey === sessionKey) {
    return cachedProfile;
  }
  const demoUser = findDemoUser(sessionKey);
  if (demoUser) {
    return demoUser;
  }
  if (sessionKey?.startsWith("employee:")) {
    return getEmployeeSessionById(sessionKey.replace("employee:", ""));
  }
  return null;
});

export async function requireSession(allowedRoles?: UserRole[]) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect(defaultRouteForRole(session.role));
  }
  return session;
}

export function canAccess(role: UserRole, allowedRoles?: UserRole[]) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }
  return allowedRoles.includes(role);
}
