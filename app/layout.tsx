import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { activeTenant } from "@/lib/tenant";
import { getCurrentSession } from "@/lib/auth";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: `${activeTenant.productName} | White-label HRIS Attendance`,
  description: activeTenant.description
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentSession();
  const themeVars = {
    "--primary": activeTenant.theme.primary,
    "--primary-soft": activeTenant.theme.primarySoft,
    "--accent": activeTenant.theme.accent,
    "--success": activeTenant.theme.success,
    "--danger": activeTenant.theme.danger,
    "--warning": activeTenant.theme.warning
  } as React.CSSProperties;

  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`} style={themeVars}>
        <AppProviders currentUser={currentUser}>{children}</AppProviders>
      </body>
    </html>
  );
}
