import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "echonote_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  exp: number;
  scope: "owner";
};

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "echonote-local-dev-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionCookie() {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    scope: "owner",
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded + "." + sign(encoded);
}

export function verifySessionCookie(value?: string | null) {
  if (!value) return false;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeEqual(sign(encoded), signature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    return payload.scope === "owner" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function shouldBypassAuthInLocalDev() {
  return process.env.NODE_ENV !== "production" && !process.env.APP_PASSWORD;
}

export function isWebAuthenticated(request: NextRequest) {
  if (shouldBypassAuthInLocalDev()) return true;
  return verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
}

export function sessionCookieHeader(value: string) {
  return SESSION_COOKIE + "=" + value + cookieAttributes(SESSION_TTL_SECONDS);
}

export function expiredSessionCookieHeader() {
  return SESSION_COOKIE + "=" + cookieAttributes(0);
}

export function verifyPassword(password: string) {
  const configured = process.env.APP_PASSWORD;
  if (!configured && process.env.NODE_ENV !== "production") return password === "echonote";
  if (!configured) return false;
  return safeEqual(configured, password);
}

export function verifyCaptureToken(request: NextRequest) {
  const configured = process.env.CAPTURE_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!configured && process.env.NODE_ENV !== "production") return token === "dev-capture-token";
  return Boolean(configured && token && safeEqual(configured, token));
}

function cookieAttributes(maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + secure;
}
