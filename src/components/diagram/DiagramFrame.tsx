"use client";

/**
 * DiagramFrame — full-featured presentation wrapper around ArchCanvas:
 * header bar (title + packet play/pause), legend, and a click-to-explain
 * info panel that answers "Why is this component here?".
 *
 * This powers case studies, the homepage hero, and any diagram that deserves
 * the complete interactive treatment. Plain chapter diagrams use ArchCanvas
 * directly (hover tooltips still work everywhere via the shared knowledge base).
 */

import { useMemo, useState } from "react";
import { ArchCanvas, DiagramLegend } from "@/components/diagram/ArchCanvas";
import type { Graph, NodeInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DiagramFrame({
  title,
  graph,
  height = 380,
  maxHeight,
  className,
  showLegend = true,
  defaultPaused = false,
}: {
  title?: string;
  graph: Graph;
  height?: number;
  maxHeight?: number;
  className?: string;
  showLegend?: boolean;
  defaultPaused?: boolean;
}) {
  const [paused, setPaused] = useState(defaultPaused);
  const [selected, setSelected] = useState<string | null>(null);

  const selNode = useMemo(() => graph.nodes.find((n) => n.id === selected) ?? null, [graph.nodes, selected]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface", className)}>
      {(title || graph.flows?.length) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-zinc-50/70 px-4 py-2">
          {title ? (
            <span className="font-mono text-xs font-semibold text-accent">{title}</span>
          ) : (
            <span />
          )}
          {graph.flows?.length ? (
            <button
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-2xs text-ink-mute transition-colors hover:border-accent hover:text-accent"
            >
              {paused ? "▶ resume traffic" : "⏸ pause traffic"}
            </button>
          ) : null}
        </div>
      )}

      <ArchCanvas
        graph={graph}
        mode="explore"
        height={height}
        maxHeight={maxHeight}
        selectedId={selected}
        onSelectNode={setSelected}
        packetsPaused={paused}
        focusOnSelect
      />

      {showLegend && (
        <div className="border-t border-line px-4 py-2">
          <DiagramLegend />
        </div>
      )}

      <NodeInfoPanel nodeLabel={selNode?.label ?? null} kind={selNode?.kind} info={selNode?.info} onClose={() => setSelected(null)} />
    </div>
  );
}

export function NodeInfoPanel({
  nodeLabel,
  kind,
  info,
  onClose,
}: {
  nodeLabel: string | null;
  kind?: string;
  info?: NodeInfo;
  onClose?: () => void;
}) {
  if (!nodeLabel || !info) return null;
  return (
    <div className="animate-fadeUp border-t border-line bg-zinc-50/60 px-4 py-3" role="region" aria-label={`About ${nodeLabel}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{nodeLabel}</h3>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft">{info.purpose}</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close explanation" className="rounded p-1 text-ink-faint hover:bg-zinc-200/60 hover:text-ink">
            ✕
          </button>
        )}
      </div>

      <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {info.latency && (
          <Fact label="Typical latency" value={info.latency} mono />
        )}
        {info.uses && info.uses.length > 0 && (
          <div className="text-2xs leading-relaxed text-ink-mute">
            <span className="font-mono uppercase tracking-wide text-ink-faint">Used for · </span>
            {info.uses.join(" · ")}
          </div>
        )}
      </div>

      {info.why && (
        <p className="mt-2 rounded-lg border border-accent-border bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent-ink">
          <strong>Why it&apos;s here —</strong> {info.why}
        </p>
      )}
      {info.fails && (
        <p className="mt-1.5 rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger-ink">
          <strong>If it fails —</strong> {info.fails}
        </p>
      )}
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="text-2xs text-ink-mute">
      <span className="font-mono uppercase tracking-wide text-ink-faint">{label} · </span>
      <span className={cn(mono && "font-mono", "text-ink")}>{value}</span>
    </div>
  );
}
