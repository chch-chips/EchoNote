"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteNoteButton({ noteId, preview }: { noteId: string; preview: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;

    const excerpt = preview.replace(/\s+/g, " ").trim().slice(0, 42);
    const confirmed = window.confirm(`确定删除这条小记吗？\n\n${excerpt}${preview.length > 42 ? "..." : ""}`);
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "删除失败，请稍后再试。");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败，请稍后再试。");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="删除这条小记"
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-rose/45 bg-rose/10 text-rose transition hover:border-rose hover:bg-rose/18 hover:text-paper focus:outline-none focus:ring-2 focus:ring-rose/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Trash2 size={17} aria-hidden />}
      </button>
      {error ? <p role="alert" className="max-w-52 text-right text-xs leading-5 text-rose">{error}</p> : null}
    </div>
  );
}