import Link from "next/link";
import { Clock3 } from "lucide-react";
import { listNotes } from "@/lib/notes";

export async function RecentNotes() {
  const notes = await listNotes({ take: 6 }).catch(() => []);

  return (
    <section className="relative z-10 w-full max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-paper-muted">最近的回声</h2>
        <Link href="/history" className="text-sm text-amber transition hover:text-paper">查看历史</Link>
      </div>
      <div className="grid gap-3">
        {notes.length === 0 ? (
          <p className="rounded-2xl border border-line bg-paper/6 p-4 text-sm leading-7 text-paper-muted">还没有小记。先写下第一句，EchoNote 会从那里开始长出记忆。</p>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="rounded-2xl border border-line bg-paper/7 p-4 backdrop-blur-md">
              <p className="line-clamp-3 text-sm leading-7 text-paper">{note.content}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-paper-muted">
                <Clock3 size={14} aria-hidden />
                <time dateTime={note.createdAt.toISOString()}>{new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(note.createdAt)}</time>
                <span>{note.source.replaceAll("_", " ").toLowerCase()}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
