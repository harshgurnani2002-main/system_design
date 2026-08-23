"use client";

import Link from "next/link";
import { CHAPTERS } from "@/content";
import { useProgress } from "@/lib/store/progress";
import { TRACKS, trackChapters } from "@/content";
import { cn } from "@/lib/utils";

export default function QuizzesPage() {
  const results = useProgress((s) => s.quizResults);
  const taken = Object.keys(results).length;
  const totalQ = CHAPTERS.reduce((a, c) => a + c.quiz.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Practice</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Quizzes</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          Every chapter ends in engineering-judgment questions — bottleneck identification, capacity math,
          consistency-model selection — each with a full explanation. {totalQ} questions across {CHAPTERS.length}{" "}
          chapters.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(taken / CHAPTERS.length) * 100}%` }} />
          </div>
          <span className="font-mono text-2xs text-ink-mute">{taken}/{CHAPTERS.length} attempted</span>
        </div>
      </header>

      <div className="space-y-8 py-6">
        {TRACKS.map((t) => {
          const chapters = trackChapters(t.slug).filter((c) => c.quiz.length > 0);
          if (chapters.length === 0) return null;
          return (
            <section key={t.slug}>
              <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">{t.name}</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {chapters.map((c) => {
                  const r = results[c.slug];
                  return (
                    <li key={c.slug}>
                      <Link href={`/academy/learn/${c.track}/${c.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-zinc-50">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink">{c.title}</div>
                          <div className="font-mono text-2xs text-ink-faint">{c.quiz.length} questions</div>
                        </div>
                        {r ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-md border px-2 py-0.5 font-mono text-xs",
                              r.correct / r.total >= 0.75
                                ? "border-ok-border bg-ok-soft text-ok-ink"
                                : "border-warn-border bg-warn-soft text-warn-ink"
                            )}
                          >
                            {r.correct}/{r.total}
                          </span>
                        ) : (
                          <span className="shrink-0 font-mono text-2xs text-accent">take →</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
