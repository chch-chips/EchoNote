import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookie, sessionCookieHeader, verifyPassword } from "@/lib/auth";
import { consumeRateLimit, parseJsonBody, rateLimitResponse } from "@/lib/request-guards";

const loginSchema = z.object({
  password: z.string().max(256),
});

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit(request, { scope: "login", max: 12, windowMs: 5 * 60 * 1000 });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.retryAfter);

  const parsed = await parseJsonBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  if (!verifyPassword(parsed.data.password)) return NextResponse.json({ error: "密码不对。" }, { status: 401 });
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader(createSessionCookie()) } });
}
