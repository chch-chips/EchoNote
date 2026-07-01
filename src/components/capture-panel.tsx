"use client";

import { FormEvent, useRef, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";

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
    window.setTimeout(() => setState("idle"), 1500);
  }

  const statusText = state === "saved" ? "已收下。" : state === "error" ? error : "";

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-3xl rounded-lg border border-line/80 bg-ink-soft/54 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-4"
    >
      <div className="rounded-lg border border-paper/8 bg-black/18 p-4 sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
          <div className="min-w-0">
            <p className="font-serif text-sm text-amber">EchoNote</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight text-paper sm:text-4xl">把这一秒收下来</h1>
          </div>
          <p className="hidden shrink-0 font-serif text-sm text-paper-muted/80 sm:block">回声笺</p>
        </div>

        <label htmlFor="quick-note" className="sr-only">
          写一条小记
        </label>
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
          className="min-h-56 w-full resize-none rounded-lg border border-transparent bg-paper/[0.045] px-4 py-4 text-base leading-8 text-paper outline-none transition placeholder:text-paper-muted/56 focus:border-amber/60 focus:bg-paper/[0.065] focus:ring-4 focus:ring-amber/12 sm:min-h-64 sm:px-5 sm:py-5 sm:text-lg"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-6 text-sm text-paper-muted" aria-live="polite">
            {statusText}
          </p>
          <button
            type="submit"
            disabled={!content.trim() || state === "saving"}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-paper px-5 text-sm font-semibold text-ink shadow-[0_12px_30px_rgba(248,244,234,0.16)] transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber/30 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state === "saving" ? <Loader2 className="animate-spin" size={17} aria-hidden /> : null}
            {state === "saved" ? <Check size={17} aria-hidden /> : null}
            {state !== "saving" && state !== "saved" ? <Send size={17} aria-hidden /> : null}
            保存
          </button>
        </div>
      </div>
    </form>
  );
}

