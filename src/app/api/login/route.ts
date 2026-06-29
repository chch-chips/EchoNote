import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, sessionCookieHeader, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
  if (!verifyPassword(body.password ?? "")) return NextResponse.json({ error: "密码不对。" }, { status: 401 });
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader(createSessionCookie()) } });
}
