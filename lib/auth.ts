import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authCookieName, defaultRouteForRole, findDemoUser, type SessionUser, type UserRole } from "@/lib/auth-config";

export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionKey = cookieStore.get(authCookieName)?.value;
  return findDemoUser(sessionKey);
}

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
