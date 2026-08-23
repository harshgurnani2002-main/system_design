"use client";

import { useProgress } from "@/lib/store/progress";
import { LABS } from "@/content/labs";
import { cn } from "@/lib/utils";

export function LabProgress() {
  const completed = useProgress((s) => s.completedLabs);
  const done = Object.keys(completed).filter((k) => LABS.some((l) => l.slug === k)).length;
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={LABS.length}>
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(done / LABS.length) * 100}%` }} />
      </div>
      <span className="font-mono text-2xs text-ink-mute">{done}/{LABS.length} shipped</span>
    </div>
  );
}

export function LabDot({ slug }: { slug: string }) {
  const done = useProgress((s) => !!s.completedLabs[slug]);
  if (!done) return null;
  return (
    <span className="inline-flex items-center rounded-md border border-ok-border bg-ok-soft px-1.5 py-0.5 font-mono text-2xs text-ok-ink">
      ✓ shipped
    </span>
  );
}

export function LabCompleteButton({ slug }: { slug: string }) {
  const { completedLabs, completeLab } = useProgress();
  const done = !!completedLabs[slug];
  return (
    <button
      onClick={() => !done && completeLab(slug)}
      aria-pressed={done}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
        done
          ? "border border-ok-border bg-ok-soft text-ok-ink"
          : "bg-accent text-white hover:bg-accent-hover"
      )}
    >
      {done ? "✓ Lab shipped" : "Mark lab as shipped"}
    </button>
  );
}
