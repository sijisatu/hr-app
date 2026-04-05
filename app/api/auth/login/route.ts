import { NextResponse } from "next/server";
import { authCookieName, defaultRouteForRole, findDemoUser } from "@/lib/auth-config";

function buildAuthResponse(sessionKey: string | undefined, redirectTo?: string) {
  const user = findDemoUser(sessionKey);

  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid demo account" }, { status: 400 });
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

  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionKey = searchParams.get("sessionKey") ?? undefined;
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  return buildAuthResponse(sessionKey, redirectTo);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { sessionKey?: string };
  return buildAuthResponse(payload.sessionKey);
}
