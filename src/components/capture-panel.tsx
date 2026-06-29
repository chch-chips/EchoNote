"use client";

import { FormEvent, useRef, useState } from "react";
import { Check, Loader2, Send, Sparkles } from "lucide-react";

export function CapturePanel() {
  const [content, setContent] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || state === "saving") return;

    setState("saving");
    setError("");

    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed, clientCreatedAt: new Date().toISOString() }),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "没有保存成功，请再试一次。");
      setState("error");
      return;
    }

    setContent("");
    setState("saved");
    textareaRef.current?.focus();
    window.setTimeout(() => setState("idle"), 1300);
  }

  return (
    <form onSubmit={submit} className="relative z-20 w-full max-w-3xl rounded-[1.75rem] border border-line bg-ink-soft/78 p-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-serif text-sm text-amber">EchoNote</p>
          <h1 className="text-xl font-semibold text-paper sm:text-2xl">把这一秒收下来</h1>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper/8 text-amber">
          <Sparkles size={19} aria-hidden />
        </div>
      </div>

      <label htmlFor="quick-note" className="sr-only">写一条小记</label>
      <textarea
        id="quick-note"
        ref={textareaRef}
        autoFocus
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submit();
        }}
        placeholder="一个念头、一句提醒、一束以后会回来找你的光..."
        className="min-h-48 w-full resize-none rounded-2xl border border-line bg-black/18 px-4 py-4 text-base leading-8 text-paper outline-none transition focus:border-amber/70 focus:ring-4 focus:ring-amber/15 sm:min-h-56 sm:text-lg"
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-6 text-sm text-paper-muted" aria-live="polite">
          {state === "saved" ? "已收下。它会在未来某个时刻回来。" : null}
          {state === "error" ? error : null}
          {state === "idle" ? "电脑端 Ctrl/⌘ + Enter 保存；微信端消息末尾加 #。" : null}
        </p>
        <button
          type="submit"
          disabled={!content.trim() || state === "saving"}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-paper px-5 text-sm font-semibold text-ink transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === "saving" ? <Loader2 className="animate-spin" size={17} aria-hidden /> : null}
          {state === "saved" ? <Check size={17} aria-hidden /> : null}
          {state !== "saving" && state !== "saved" ? <Send size={17} aria-hidden /> : null}
          保存
        </button>
      </div>
    </form>
  );
}

