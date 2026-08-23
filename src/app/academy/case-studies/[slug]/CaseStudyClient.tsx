"use client";

import { useEffect, useMemo, useState } from "react";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import { INSTAGRAM_VERSIONS, ORDER_STATES, ORDER_FAILURES, ZOMATO_GRAPH } from "@/content/casestudies";
import { useProgress } from "@/lib/store/progress";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Instagram — evolution player                                       */
/* ------------------------------------------------------------------ */

export function InstagramEvolution() {
  const [idx, setIdx] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const { completeChapter, completedChapters } = useProgress();
  const done = !!completedChapters["casestudy-instagram"];
  const ver = INSTAGRAM_VERSIONS[idx];

  useEffect(() => {
    if (!autoplay) return;
    const iv = setInterval(() => {
      setIdx((i) => {
        if (i >= INSTAGRAM_VERSIONS.length - 1) {
          setAutoplay(false);
          return i;
        }
        return i + 1;
      });
    }, 2600);
    return () => clearInterval(iv);
  }, [autoplay]);

  return (
    <div>
      {/* version tabs */}
      <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Architecture versions">
        {INSTAGRAM_VERSIONS.map((v, i) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={idx === i}
            onClick={() => setIdx(i)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors",
              idx === i
                ? "border-accent bg-accent text-white"
                : i < idx
                  ? "border-accent-border bg-accent-soft text-accent-ink"
                  : "border-line bg-surface text-ink-mute hover:border-line-strong"
            )}
          >
            {v.label.split("·")[0].trim()}
          </button>
        ))}
        <button
          onClick={() => setAutoplay((a) => !a)}
          className={cn(
            "ml-auto shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs",
            autoplay ? "border-warn-border bg-warn-soft text-warn-ink" : "border-line bg-surface text-ink-mute hover:border-line-strong"
          )}
          aria-pressed={autoplay}
        >
          {autoplay ? "⏸ stop" : "▶ evolve"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <ArchCanvas graph={ver.graph} height={300} mode="static" />
        <div className="grid border-t border-line md:grid-cols-[220px_1fr]">
          <div className="border-b border-line px-4 py-3 md:border-b-0 md:border-r">
            <div className="font-mono text-xs font-semibold text-accent">{ver.label}</div>
            <div className="mt-1 font-mono text-2xs uppercase tracking-wide text-ink-faint">{ver.scale}</div>
          </div>
          <div className="px-4 py-3">
            <p className="text-[13px] leading-relaxed text-ink">
              <span className="font-semibold">Forced by:</span> <span className="text-ink-mute">{ver.trigger}</span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {ver.notes.map((n, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-sm bg-accent/70" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line bg-zinc-50/60 px-4 py-2.5">
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              ← Earlier
            </Button>
            <Button size="sm" variant="secondary" disabled={idx === INSTAGRAM_VERSIONS.length - 1} onClick={() => setIdx((i) => Math.min(INSTAGRAM_VERSIONS.length - 1, i + 1))}>
              Later →
            </Button>
          </div>
          <button
            onClick={() => completeChapter("casestudy-instagram")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              done ? "bg-ok-soft text-ok-ink" : "text-accent hover:bg-accent-soft"
            )}
          >
            {done ? "✓ studied" : "mark understood"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-2xs text-ink-faint">
        Every stage above exists because the previous one failed. Architecture is a sequence of responses to pain.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Zomato — order lifecycle                                           */
/* ------------------------------------------------------------------ */

const ACTOR_COLOR: Record<string, string> = {
  customer: "#2563EB",
  payment: "#16A34A",
  restaurant: "#D97706",
  driver: "#DC2626",
  system: "#71717A",
};

export function OrderLifecycle() {
  const [sel, setSel] = useState(0);
  const [playing, setPlaying] = useState(true);
  const { completeChapter, completedChapters } = useProgress();
  const done = !!completedChapters["casestudy-zomato"];

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => setSel((s) => (s + 1) % ORDER_STATES.length), 1600);
    return () => clearInterval(iv);
  }, [playing]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-line bg-surface p-4">
        <div className="no-scrollbar flex items-center gap-0 overflow-x-auto pb-2">
          {ORDER_STATES.map((s, i) => (
            <div key={s.id} className="flex shrink-0 items-center">
              <button
                onClick={() => {
                  setSel(i);
                  setPlaying(false);
                }}
                aria-current={sel === i}
                className={cn(
                  "whitespace-nowrap rounded-lg border px-3 py-2 font-mono text-xs transition-all",
                  sel === i
                    ? "border-transparent text-white shadow-node"
                    : sel > i
                      ? "border-ok-border bg-ok-soft text-ok-ink"
                      : "border-line bg-surface text-ink-mute hover:border-line-strong"
                )}
                style={sel === i ? { background: ACTOR_COLOR[s.actor] } : undefined}
              >
                {s.label}
              </button>
              {i < ORDER_STATES.length - 1 && (
                <svg viewBox="0 0 24 8" className="h-2 w-6 shrink-0 text-line-strong" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M0 4h20M17 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 min-h-[64px] rounded-lg bg-zinc-50 px-4 py-3 animate-fadeUp" key={sel}>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: ACTOR_COLOR[ORDER_STATES[sel].actor] }} />
            <span className="font-mono text-xs font-semibold text-ink">{ORDER_STATES[sel].label}</span>
            <span className="font-mono text-2xs uppercase tracking-wide text-ink-faint">actor: {ORDER_STATES[sel].actor}</span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{ORDER_STATES[sel].note}</p>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => setPlaying((p) => !p)} className="font-mono text-xs text-accent hover:text-accent-hover" aria-pressed={playing}>
            {playing ? "⏸ pause lifecycle" : "▶ play lifecycle"}
          </button>
          <button
            onClick={() => completeChapter("casestudy-zomato")}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", done ? "text-ok-ink" : "text-accent hover:bg-accent-soft")}
          >
            {done ? "✓ studied" : "mark understood"}
          </button>
        </div>
      </div>

      <ArchCanvas graph={ZOMATO_GRAPH} height={340} mode="static" />
      <p className="text-center font-mono text-2xs text-ink-faint">
        Each service owns its database; Kafka carries state changes. No distributed transactions — only sagas and events.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Failure forensics                                                  */
/* ------------------------------------------------------------------ */

export function FailureForensics() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {ORDER_FAILURES.map((f, i) => {
        const isOpen = open === i;
        return (
          <article key={i} className={cn("overflow-hidden rounded-xl border transition-colors", isOpen ? "border-danger-border bg-danger-soft/40" : "border-line bg-surface")}>
            <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="text-sm font-medium text-ink">{f.title}</span>
              <span className={cn("font-mono text-2xs", isOpen ? "text-danger-ink" : "text-ink-faint")}>{isOpen ? "− close forensics" : "+ diagnose"}</span>
            </button>
            {isOpen && (
              <div className="animate-fadeUp space-y-2.5 border-t border-danger-border px-4 pb-4 pt-3">
                <ForensicRow label="Symptom" tone="warn" body={f.symptom} />
                <ForensicRow label="Root cause" tone="danger" body={f.rootCause} />
                <ForensicRow label="The fix" tone="ok" body={f.fix} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ForensicRow({ label, body, tone }: { label: string; body: string; tone: "warn" | "danger" | "ok" }) {
  const cls = {
    warn: "text-warn-ink",
    danger: "text-danger-ink",
    ok: "text-ok-ink",
  }[tone];
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <span className={cn("w-24 shrink-0 font-mono text-2xs uppercase tracking-wide", cls)}>{label}</span>
      <span className="text-[13px] leading-relaxed text-ink-soft">{body}</span>
    </div>
  );
}
