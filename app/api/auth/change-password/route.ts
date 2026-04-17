import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookieName, findDemoUser } from "@/lib/auth-config";
import { getCurrentSession } from "@/lib/auth";

const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (isProduction ? "https://localhost:4000" : "http://localhost:4000");

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Session tidak ditemukan." }, { status: 401 });
  }
  if (findDemoUser(session.sessionKey)) {
    return NextResponse.json({ success: false, error: "Password demo account tidak bisa diubah." }, { status: 400 });
  }

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword?.trim();
  const newPassword = body.newPassword?.trim();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: "Password saat ini dan password baru wajib diisi." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const signedSession = cookieStore.get(authCookieName)?.value;
  if (!signedSession) {
    return NextResponse.json({ success: false, error: "Session cookie tidak ditemukan." }, { status: 401 });
  }

  const response = await fetch(`${API_BASE}/api/auth/change-password`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${authCookieName}=${signedSession}`
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; error?: string; data?: unknown } | null;
  if (!response.ok) {
    return NextResponse.json({ success: false, error: payload?.error ?? "Gagal mengubah password." }, { status: response.status });
  }

  return NextResponse.json({ success: true, data: payload?.data ?? { success: true }, error: null });
}
