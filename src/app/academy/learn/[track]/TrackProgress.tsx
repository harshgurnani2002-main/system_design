"use client";

import { useProgress } from "@/lib/store/progress";
import { cn } from "@/lib/utils";

export function TrackProgress({ chapters }: { chapters: string[] }) {
  const completed = useProgress((s) => s.completedChapters);
  const done = chapters.filter((c) => completed[c]).length;
  const pct = chapters.length ? Math.round((done / chapters.length) * 100) : 0;

  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-all duration-500", done === chapters.length && chapters.length > 0 ? "bg-ok" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-2xs text-ink-mute">
        {done}/{chapters.length} complete
      </span>
    </div>
  );
}

export function StatusDot({ slug }: { slug: string }) {
  const completed = useProgress((s) => s.completedChapters[slug]);
  if (!completed) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-ok-border bg-ok-soft px-1.5 py-0.5 font-mono text-2xs text-ok-ink">
      ✓ done
    </span>
  );
}
