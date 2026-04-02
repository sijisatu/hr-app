import { NextResponse } from "next/server";
import { authCookieName, defaultRouteForRole, findDemoUser } from "@/lib/auth-config";

export async function POST(request: Request) {
  const payload = (await request.json()) as { sessionKey?: string };
  const user = findDemoUser(payload.sessionKey);

  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid demo account" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true, data: { redirectTo: defaultRouteForRole(user.role), user }, error: null });
  response.cookies.set(authCookieName, user.sessionKey, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}
