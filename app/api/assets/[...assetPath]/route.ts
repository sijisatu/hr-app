import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { authCookieName } from "@/lib/auth-config";
import { signSessionToken } from "@/lib/session-token";

const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (isProduction ? "https://localhost:4000" : "http://127.0.0.1:4000");

export async function GET(
  request: Request,
  context: { params: Promise<{ assetPath: string[] }> }
) {
  const { assetPath } = await context.params;
  const session = await getCurrentSession();
  const signedSession = session ? signSessionToken(session.sessionKey) : null;

  if (!signedSession) {
    return NextResponse.json({ success: false, error: "Session cookie not found." }, { status: 401 });
  }

  const targetUrl = new URL(`/api/assets/${assetPath.join("/")}`, API_BASE);
  const upstream = await fetch(targetUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      Cookie: `${authCookieName}=${signedSession}`,
      "X-Session-Key": signedSession
    }
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text().catch(() => "");
    return new NextResponse(errorBody || "Asset request failed.", {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8"
      }
    });
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "Content-Type",
    "Content-Length",
    "Content-Disposition",
    "Cache-Control",
    "Last-Modified",
    "ETag"
  ];

  for (const headerName of passthroughHeaders) {
    const value = upstream.headers.get(headerName);
    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
}
