import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authCookieName, authProfileCookieName, decodeSessionProfile, defaultRouteForRole, findDemoUser, type SessionUser, type UserRole } from "@/lib/auth-config";

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

type EmployeeSessionRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  position: string;
  appLoginEnabled: boolean;
  status: "active" | "inactive";
};

async function getEmployeeSessionById(employeeId: string): Promise<SessionUser | null> {
  const response = await fetch(`${API_BASE}/api/employees`, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data: EmployeeSessionRecord[] };
  const employee = payload.data.find((item) => item.id === employeeId && item.appLoginEnabled && item.status === "active");
  if (!employee) {
    return null;
  }

  return {
    sessionKey: `employee:${employee.id}`,
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department,
    position: employee.position
  };
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionKey = cookieStore.get(authCookieName)?.value;
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
