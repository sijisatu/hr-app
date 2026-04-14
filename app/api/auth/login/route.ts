import { NextResponse } from "next/server";
import { authCookieName, authProfileCookieName, defaultRouteForRole, encodeSessionProfile, findDemoUser, type SessionUser } from "@/lib/auth-config";

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

function buildAuthResponse(user?: SessionUser, redirectTo?: string) {
  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid account" }, { status: 400 });
  }

  const response = redirectTo
    ? NextResponse.redirect(new URL(redirectTo, "http://127.0.0.1:3000"))
    : NextResponse.json({ success: true, data: { redirectTo: defaultRouteForRole(user.role), user }, error: null });

  response.cookies.set(authCookieName, user.sessionKey, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30
  });
  response.cookies.set(authProfileCookieName, encodeSessionProfile(user), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionKey = searchParams.get("sessionKey") ?? undefined;
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const user = findDemoUser(sessionKey);
  return buildAuthResponse(user ?? undefined, redirectTo);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { sessionKey?: string; username?: string; password?: string };

  if (payload.sessionKey) {
    const demoUser = findDemoUser(payload.sessionKey);
    return buildAuthResponse(demoUser ?? undefined);
  }

  const username = payload.username?.trim();
  const password = payload.password?.trim();
  if (!username || !password) {
    return NextResponse.json({ success: false, error: "Username dan password wajib diisi." }, { status: 400 });
  }

  const response = await fetch(`${API_BASE}/api/auth/employee-login`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    return NextResponse.json({ success: false, error: "Username atau password tidak valid." }, { status: 400 });
  }

  const employeePayload = (await response.json()) as { data: SessionUser };
  return buildAuthResponse(employeePayload.data);
}
