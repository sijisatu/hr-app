import { NextResponse } from "next/server";
import { authCookieName, authProfileCookieName } from "@/lib/auth-config";

export async function POST() {
  const response = NextResponse.json({ success: true, data: { loggedOut: true }, error: null });
  response.cookies.set(authCookieName, "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 0
  });
  response.cookies.set(authProfileCookieName, "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 0
  });
  return response;
}
