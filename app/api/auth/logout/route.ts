import { NextResponse } from "next/server";
import { authCookieName, authProfileCookieName } from "@/lib/auth-config";

export async function POST() {
  const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
  const response = NextResponse.json({ success: true, data: { loggedOut: true }, error: null });
  response.cookies.set(authCookieName, "", {
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: isProduction,
    maxAge: 0
  });
  response.cookies.set(authProfileCookieName, "", {
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: isProduction,
    maxAge: 0
  });
  return response;
}
