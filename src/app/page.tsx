import Link from "next/link";
import { Library } from "lucide-react";
import { CapturePanel } from "@/components/capture-panel";
import { MemoryRain } from "@/components/memory-rain";
import { requirePageAuth } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requirePageAuth();

  return (
    <main className="relative isolate flex min-h-dvh overflow-hidden px-4 py-5 sm:px-6 sm:py-8">
      <MemoryRain />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-ink via-ink/72 to-transparent" />
      <Link
        href="/history"
        className="absolute right-4 top-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-ink-soft/62 px-4 text-sm font-medium text-paper-muted shadow-[0_16px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-paper/25 hover:text-paper focus:outline-none focus:ring-4 focus:ring-amber/20 sm:right-6 sm:top-6"
      >
        <Library size={16} aria-hidden />
        所有小记
      </Link>
      <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center py-10 sm:py-12">
        <CapturePanel />
      </div>
    </main>
  );
}