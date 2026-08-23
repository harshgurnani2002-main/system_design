"use client";

/**
 * RequestFlowPlayer — the "slow motion learning mode".
 * Walks a request through the architecture hop by hop with narration,
 * highlighting the active edge and endpoints on the diagram.
 */

import { useEffect, useRef, useState } from "react";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import type { Graph } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FlowStep {
  title: string;
  detail: string;
  edge?: [string, string]; // highlighted edge from->to
  nodes?: string[]; // additional nodes to highlight
  tag?: string; // e.g. "CACHE MISS", "~2ms"
}

export function RequestFlowPlayer({
  graph,
  steps,
  height = 320,
}: {
  graph: Graph;
  steps: FlowStep[];
  height?: number;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => {
        setIdx((i) => {
          if (i >= steps.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 2200);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, steps.length]);

  const step = steps[idx];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <ArchCanvas
        graph={graph}
        mode="static"
        height={undefined}
        activeFlowEdges={step?.edge ? [`${step.edge[0]}->${step.edge[1]}`] : undefined}
        highlightNodes={step?.nodes}
        packets={false}
      />

      {/* transport controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-zinc-50/70 px-4 py-2.5">
        <div className="flex items-center gap-1">
          <CtrlBtn
            onClick={() => setPlaying((p) => !p)}
            label={playing ? "Pause walkthrough" : "Auto-play walkthrough"}
          >
            {playing ? "⏸" : "▶"}
          </CtrlBtn>
          <CtrlBtn onClick={() => setIdx((i) => Math.max(0, i - 1))} label="Previous step" disabled={idx === 0}>
            ‹
          </CtrlBtn>
          <CtrlBtn
            onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
            label="Next step"
            disabled={idx === steps.length - 1}
          >
            ›
          </CtrlBtn>
          <CtrlBtn onClick={() => { setIdx(0); setPlaying(false); }} label="Restart" disabled={idx === 0 && !playing}>
            ↺
          </CtrlBtn>
        </div>

        <span className="font-mono text-2xs text-ink-faint">
          Step {idx + 1} / {steps.length}
        </span>

        <div className="ml-auto hidden items-center gap-1 sm:flex">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i === idx ? "bg-accent" : i < idx ? "bg-accent/40" : "bg-line-strong hover:bg-zinc-300"
              )}
            />
          ))}
        </div>
      </div>

      {/* narration */}
      <div className="min-h-[86px] border-t border-line px-4 py-3" aria-live="polite" onKeyDown={(e) => {
        if (e.key === "ArrowRight") setIdx((i) => Math.min(steps.length - 1, i + 1));
        if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      }} tabIndex={0}>
        {step && (
          <div key={idx} className="animate-fadeUp">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-accent">{step.title}</span>
              {step.tag && (
                <span className="rounded-md border border-warn-border bg-warn-soft px-1.5 py-0.5 font-mono text-2xs text-warn-ink">
                  {step.tag}
                </span>
              )}
            </div>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-soft">{step.detail}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-sm text-ink-mute transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-mute"
    >
      {children}
    </button>
  );
}
