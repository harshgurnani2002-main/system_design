"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@/lib/store/progress";
import { INTERVIEW_QUESTIONS } from "@/content/interview";
import { cn } from "@/lib/utils";

export function InterviewProgress() {
  const done = useProgress((s) => s.interviewDone);
  const count = Object.keys(done).filter((k) => INTERVIEW_QUESTIONS.some((q) => q.slug === k)).length;
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={INTERVIEW_QUESTIONS.length}>
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(count / INTERVIEW_QUESTIONS.length) * 100}%` }} />
      </div>
      <span className="font-mono text-2xs text-ink-mute">{count}/{INTERVIEW_QUESTIONS.length} drilled</span>
    </div>
  );
}

export function InterviewProgressDot({ slug }: { slug: string }) {
  const done = useProgress((s) => !!s.interviewDone[slug]);
  if (!done) return null;
  return (
    <span className="inline-flex items-center rounded-md border border-ok-border bg-ok-soft px-1.5 py-0.5 font-mono text-2xs text-ok-ink">✓ drilled</span>
  );
}

export function InterviewTimer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || left <= 0) return;
    const iv = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(iv);
  }, [running, left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const low = left < minutes * 60 * 0.2;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "tabular rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold",
          !running && "border-line bg-surface text-ink",
          running && !low && "border-accent-border bg-accent-soft text-accent-ink",
          running && low && "border-danger-border bg-danger-soft text-danger-ink animate-pulseSoft"
        )}
        role="timer"
        aria-label={`Time remaining ${mm}:${ss}`}
      >
        {mm}:{ss}
      </span>
      <button
        onClick={() => setRunning((r) => !r)}
        className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs text-ink-mute transition-colors hover:border-accent hover:text-accent"
        aria-label={running ? "Pause timer" : "Start timer"}
      >
        {running ? "pause" : "start"}
      </button>
      <button
        onClick={() => { setLeft(minutes * 60); setRunning(false); }}
        className="rounded-lg px-1.5 py-1.5 font-mono text-xs text-ink-faint hover:text-ink"
        aria-label="Reset timer"
      >
        reset
      </button>
    </div>
  );
}

export function InterviewChecklist({ slug, items }: { slug: string; items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const { completeInterview, interviewDone } = useProgress();
  const allDone = checked.size === items.length;

  function toggle(i: number) {
    setChecked((c) => {
      const n = new Set(c);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  useEffect(() => {
    if (allDone && !interviewDone[slug]) completeInterview(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  return (
    <div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={checked.has(i)}
                onChange={() => toggle(i)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
                aria-label={item}
              />
              <span className={cn("text-sm leading-relaxed transition-colors", checked.has(i) ? "text-ink-faint line-through" : "text-ink-soft")}>
                {item}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {allDone && (
        <p className="animate-fadeUp mt-3 rounded-lg border border-ok-border bg-ok-soft px-3 py-2 text-[13px] text-ok-ink">
          Full arc completed — requirements through failure handling. That&apos;s a real interview pass.
        </p>
      )}
    </div>
  );
}
