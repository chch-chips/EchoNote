import { Suspense } from "react";
import { CapturePanel } from "@/components/capture-panel";
import { MemoryRain } from "@/components/memory-rain";
import { RecentNotes } from "@/components/recent-notes";
import { requirePageAuth } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requirePageAuth();

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4 py-5 sm:px-6 sm:py-10">
      <MemoryRain />
      <div className="relative z-10 flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 py-8 sm:gap-8">
        <p className="font-serif text-sm text-paper-muted">回声笺 / EchoNote</p>
        <CapturePanel />
        <Suspense fallback={null}>
          <RecentNotes />
        </Suspense>
      </div>
    </main>
  );
}
