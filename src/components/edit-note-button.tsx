"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Edit3, Loader2, X } from "lucide-react";

export function EditNoteButton({ noteId, content }: { noteId: string; content: string }) {
  const router = useRouter();
  const textareaId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setDraft(content);
    setError(null);
    setIsOpen(true);
  }

  const closeEditor = useCallback(() => {
    if (isSaving) return;
    if (draft !== content && !window.confirm("放弃这次修改吗？")) return;
    setIsOpen(false);
    setError(null);
  }, [content, draft, isSaving]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeEditor();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeEditor, isOpen]);

  async function saveEdit() {
    const nextContent = draft.trim();
    if (!nextContent) {
      setError("小记内容不能为空。");
      return;
    }

    if (nextContent === content.trim()) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: nextContent }),
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "保存失败，请稍后再试。");
      }

      setIsOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败，请稍后再试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        aria-label="编辑这条小记"
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-line bg-paper/7 text-paper-muted transition hover:border-amber/60 hover:bg-amber/12 hover:text-paper focus:outline-none focus:ring-2 focus:ring-amber/45"
      >
        <Edit3 size={17} aria-hidden />
      </button>

      {isOpen
        ? createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 sm:items-center sm:px-6 sm:pb-0">
          <button type="button" aria-label="关闭编辑窗口" className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]" onClick={closeEditor} />
          <section className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col rounded-lg border border-paper/12 bg-ink-soft/95 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.58)] backdrop-blur-2xl sm:max-h-[min(760px,calc(100dvh-48px))] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-serif text-sm text-amber">Edit</p>
                <h2 className="mt-1 text-xl font-semibold text-paper">编辑小记</h2>
              </div>
              <button
                type="button"
                aria-label="关闭编辑窗口"
                onClick={closeEditor}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-paper/7 text-paper-muted transition hover:border-paper/30 hover:text-paper focus:outline-none focus:ring-4 focus:ring-amber/20"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <label htmlFor={textareaId} className="sr-only">
              小记内容
            </label>
            <textarea
              id={textareaId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
              disabled={isSaving}
              className="min-h-64 flex-1 resize-none rounded-lg border border-line bg-black/18 p-4 text-base leading-8 text-paper outline-none placeholder:text-paper-muted focus:border-amber/60 focus:ring-4 focus:ring-amber/15 disabled:opacity-70"
            />

            {error ? (
              <p role="alert" className="mt-3 rounded-lg border border-rose/35 bg-rose/10 p-3 text-sm leading-6 text-paper">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm text-paper-muted transition hover:border-paper/30 hover:text-paper focus:outline-none focus:ring-4 focus:ring-amber/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={isSaving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber/65 bg-amber/18 px-4 text-sm font-medium text-paper transition hover:bg-amber/25 focus:outline-none focus:ring-4 focus:ring-amber/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Check size={17} aria-hidden />}
                保存修改
              </button>
            </div>
          </section>
        </div>,
          document.body,
        )
        : null}
    </>
  );
}
