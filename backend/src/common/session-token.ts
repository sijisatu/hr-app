import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECRET = process.env.APP_SESSION_SECRET?.trim() || "dev-session-secret-change-me";
const IS_PRODUCTION = (process.env.NODE_ENV || "").toLowerCase() === "production";

function toSignature(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

export function signSessionToken(sessionSubject: string) {
  const signature = toSignature(sessionSubject);
  return `${sessionSubject}.${signature}`;
}

export function verifyAndExtractSessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return IS_PRODUCTION ? null : token;
  }

  const sessionSubject = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = toSignature(sessionSubject);

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
