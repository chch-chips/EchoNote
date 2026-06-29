import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, shouldBypassAuthInLocalDev, verifySessionCookie } from "@/lib/auth";

export async function requirePageAuth() {
  if (shouldBypassAuthInLocalDev()) return;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  if (!verifySessionCookie(session)) {
    redirect("/login");
  }
}

export async function redirectHomeIfAuthenticated() {
  if (shouldBypassAuthInLocalDev()) return;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  if (verifySessionCookie(session)) {
    redirect("/");
  }
}
