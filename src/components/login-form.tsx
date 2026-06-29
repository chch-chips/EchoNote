"use client";

import { FormEvent, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "没有登录成功。");
      return;
    }

    window.location.href = "/";
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <label htmlFor="password" className="text-sm font-medium text-paper-muted">私人密码</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="min-h-12 rounded-2xl border border-line bg-black/18 px-4 text-base text-paper outline-none transition focus:border-amber/70 focus:ring-4 focus:ring-amber/15"
      />
      {error ? <p className="text-sm text-rose" role="alert">{error}</p> : null}
      <button
        type="submit"
        disabled={!password || loading}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-paper px-5 text-sm font-semibold text-ink transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber/30 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {loading ? <Loader2 className="animate-spin" size={17} aria-hidden /> : <LockKeyhole size={17} aria-hidden />}
        进入
      </button>
    </form>
  );
}
