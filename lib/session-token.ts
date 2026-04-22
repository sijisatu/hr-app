import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const sessionSecret = process.env.APP_SESSION_SECRET?.trim() || "dev-session-secret-change-me";
const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

export function signSessionToken(sessionSubject: string) {
  const signature = createHmac("sha256", sessionSecret).update(sessionSubject).digest("base64url");
  return `${sessionSubject}.${signature}`;
}

export function verifyAndExtractSessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return isProduction ? null : token;
  }

  const sessionSubject = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = createHmac("sha256", sessionSecret).update(sessionSubject).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  return sessionSubject;
}

export const verifyAndExtractSessionKey = verifyAndExtractSessionToken;
