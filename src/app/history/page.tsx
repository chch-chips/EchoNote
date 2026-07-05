import Link from "next/link";
import { ArrowLeft, Clock3, Search } from "lucide-react";
import { DeleteNoteButton } from "@/components/delete-note-button";
import { EditNoteButton } from "@/components/edit-note-button";
import { listNotes, type NoteSort } from "@/lib/notes";
import { requirePageAuth } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function buildSortHref(query: string | undefined, sort: NoteSort) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sort !== "created") params.set("sort", sort);
  const serialized = params.toString();
  return serialized ? `/history?${serialized}` : "/history";
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  await requirePageAuth();

  const params = await searchParams;
  const sort: NoteSort = params.sort === "updated" ? "updated" : "created";
  const notes = await listNotes({ query: params.q, sort, take: 250 }).catch(() => []);

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

        <div className="flex flex-col gap-3 rounded-lg border border-line bg-paper/7 p-3 sm:flex-row sm:items-center sm:justify-between">
          <form className="flex min-w-0 flex-1 items-center gap-3 px-1">
            <Search size={18} className="shrink-0 text-paper-muted" aria-hidden />
            <label htmlFor="q" className="sr-only">
              搜索小记
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="搜索曾经写下的一句话"
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-paper outline-none placeholder:text-paper-muted"
            />
            {sort !== "created" ? <input type="hidden" name="sort" value={sort} /> : null}
          </form>

          <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-black/12 p-1" aria-label="排序方式">
            <Link
              href={buildSortHref(params.q, "created")}
              aria-current={sort === "created" ? "page" : undefined}
              className={`inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm transition ${
                sort === "created" ? "bg-paper/12 text-paper" : "text-paper-muted hover:text-paper"
              }`}
            >
              创建时间
            </Link>
            <Link
              href={buildSortHref(params.q, "updated")}
              aria-current={sort === "updated" ? "page" : undefined}
              className={`inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm transition ${
                sort === "updated" ? "bg-paper/12 text-paper" : "text-paper-muted hover:text-paper"
              }`}
            >
              更新时间
            </Link>
          </div>
        </div>

        <div className="grid min-w-0 gap-3">
          {notes.map((note) => {
            const displayUpdatedAt = note.contentUpdatedAt ?? note.createdAt;

            return (
              <article key={note.id} className="min-w-0 overflow-hidden rounded-lg border border-line bg-ink-soft/70 p-4 backdrop-blur">
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-base leading-8 text-paper">{note.content}</p>
                  <div className="flex shrink-0 flex-col gap-2">
                    <EditNoteButton noteId={note.id} content={note.content} />
                    <DeleteNoteButton noteId={note.id} preview={note.content} />
                  </div>
                </div>

                {note.analysis?.poeticFragment ? <p className="mt-3 border-l border-amber/50 pl-3 font-serif text-sm leading-7 text-paper-muted">{note.analysis.poeticFragment}</p> : null}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs leading-5 text-paper-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={14} aria-hidden />
                    创建 <time dateTime={note.createdAt.toISOString()}>{formatDateTime(note.createdAt)}</time>
                  </span>
                  <span>
                    更新 <time dateTime={displayUpdatedAt.toISOString()}>{formatDateTime(displayUpdatedAt)}</time>
                  </span>
                  <span>{note.source.replaceAll("_", " ").toLowerCase()}</span>
                  <span>{note.aiStatus.toLowerCase()}</span>
                </div>
              </article>
            );
          })}

          {notes.length === 0 ? <p className="rounded-lg border border-line bg-paper/6 p-5 text-paper-muted">还没有找到小记。</p> : null}
        </div>
      </div>
    </main>
  );
}
