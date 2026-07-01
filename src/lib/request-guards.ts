import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as unknown as {
  echoNoteRateLimits?: Map<string, RateLimitEntry>;
};

const rateLimits = globalForRateLimit.echoNoteRateLimits ?? new Map<string, RateLimitEntry>();
globalForRateLimit.echoNoteRateLimits = rateLimits;

export function jsonError(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: NextRequest,
  schema: TSchema,
): Promise<{ ok: true; data: z.infer<TSchema> } | { ok: false; response: NextResponse }> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError("Request body must be valid JSON.") };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, response: jsonError("Request body is invalid.") };
  }

  return { ok: true, data: result.data };
}

export function parseClientDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

export function consumeRateLimit(
  request: NextRequest,
  options: { scope: string; max: number; windowMs: number },
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const key = `${options.scope}:${requestIp(request)}`;
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + options.windowMs });
    cleanupExpiredRateLimits(now);
    return { ok: true };
  }

  if (current.count >= options.max) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { ok: true };
}

export function rateLimitResponse(retryAfter: number) {
  return jsonError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) });
}

export function isDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string; name?: string };
  return (
    maybeError.code === "P1001" ||
    maybeError.name === "DriverAdapterError" ||
    Boolean(maybeError.message?.includes("Can't reach database server"))
  );
}

function cleanupExpiredRateLimits(now: number) {
  if (rateLimits.size < 256) return;
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) rateLimits.delete(key);
  }
}
