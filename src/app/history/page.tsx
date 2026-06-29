import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { DeleteNoteButton } from "@/components/delete-note-button";
import { listNotes } from "@/lib/notes";
import { requirePageAuth } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageAuth();

  const params = await searchParams;
  const notes = await listNotes({ query: params.q, take: 250 }).catch(() => []);

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-line px-4 text-sm text-paper-muted transition hover:text-paper">
          <ArrowLeft size={16} aria-hidden /> 返回捕获台
        </Link>
        <header>
          <p className="font-serif text-sm text-amber">Archive</p>
          <h1 className="mt-2 text-3xl font-semibold text-paper sm:text-5xl">历史小记</h1>
        </header>
        <form className="flex items-center gap-3 rounded-2xl border border-line bg-paper/7 px-4 py-3">
          <Search size={18} className="text-paper-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">搜索小记</label>
          <input id="q" name="q" defaultValue={params.q ?? ""} placeholder="搜索曾经写下的一句话" className="h-11 flex-1 bg-transparent text-base text-paper outline-none placeholder:text-paper-muted" />
        </form>
        <div className="grid gap-3">
          {notes.map((note) => (
            <article key={note.id} className="rounded-2xl border border-line bg-ink-soft/70 p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-base leading-8 text-paper">{note.content}</p>
                <DeleteNoteButton noteId={note.id} preview={note.content} />
              </div>
              {note.analysis?.poeticFragment ? <p className="mt-3 border-l border-amber/50 pl-3 font-serif text-sm leading-7 text-paper-muted">{note.analysis.poeticFragment}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-paper-muted">
                <time dateTime={note.createdAt.toISOString()}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(note.createdAt)}</time>
                <span>{note.source.replaceAll("_", " ").toLowerCase()}</span>
                <span>{note.aiStatus.toLowerCase()}</span>
              </div>
            </article>
          ))}
          {notes.length === 0 ? <p className="rounded-2xl border border-line bg-paper/6 p-5 text-paper-muted">还没有找到小记。</p> : null}
        </div>
      </div>
    </main>
  );
}
