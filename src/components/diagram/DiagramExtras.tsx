"use client";

/**
 * CapacityChain — animated capacity-estimation derivation.
 * TradeoffCard — reusable tech-vs-tech comparison.
 * FailureLab  — interactive failure simulation with traffic redistribution.
 */

import { useMemo, useState } from "react";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import type { Graph } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CapacityRow {
  label: string;
  value: string;
  note?: string;
}

export function CapacityChain({
  rows,
  title = "From users to numbers",
}: {
  rows: CapacityRow[];
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-3 font-mono text-2xs uppercase tracking-widest text-ink-faint">{title}</h3>
      <ol className="space-y-0">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div
              className="animate-fadeUp flex items-baseline gap-3 rounded-lg px-2 py-1.5"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="w-8 shrink-0 text-right font-mono text-2xs text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink">{r.label}</span>
                {r.note && <span className="block font-mono text-2xs leading-snug text-ink-faint">{r.note}</span>}
              </span>
              <span className="tabular shrink-0 font-mono text-sm font-semibold text-accent">{r.value}</span>
            </div>
            {i < rows.length - 1 && (
              <div className="ml-[26px] h-3 w-px bg-line-strong" aria-hidden />
            )}
          </li>
        ))}
      </ol>
      <p className={cn("mt-2 border-t border-line-soft pt-2 font-mono text-2xs leading-relaxed text-ink-faint")}>
        Design for the last number. Everything upstream is just how you got there.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trade-off comparison cards                                         */
/* ------------------------------------------------------------------ */

export interface TechTradeoff {
  a: string;
  b: string;
  aBlurb?: string;
  bBlurb?: string;
  dims: { name: string; a: string; b: string; winner?: "a" | "b" | "tie" }[];
  verdict: string;
}

export function TradeoffCard({ data }: { data: TechTradeoff }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line bg-zinc-50/80">
            <th className="w-36 px-4 py-3 font-mono text-2xs uppercase tracking-widest text-ink-faint">Dimension</th>
            <th className="px-4 py-3">
              <span className="block font-semibold text-accent-ink">{data.a}</span>
              {data.aBlurb && <span className="block text-2xs font-normal leading-snug text-ink-faint">{data.aBlurb}</span>}
            </th>
            <th className="border-l border-line-soft px-4 py-3">
              <span className="block font-semibold text-accent-ink">{data.b}</span>
              {data.bBlurb && <span className="block text-2xs font-normal leading-snug text-ink-faint">{data.bBlurb}</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.dims.map((d, i) => (
            <tr key={d.name} className="border-b border-line-soft last:border-0">
              <td className="px-4 py-2.5 align-top text-xs font-medium text-ink">{d.name}</td>
              <td className={cn("px-4 py-2.5 align-top", d.winner === "a" ? "bg-ok-soft/60 text-ok-ink" : "text-ink-mute")}>
                {d.a}
                {d.winner === "a" && <span className="ml-1.5 font-mono text-2xs">✓</span>}
              </td>
              <td className={cn("border-l border-line-soft px-4 py-2.5 align-top", d.winner === "b" ? "bg-ok-soft/60 text-ok-ink" : "text-ink-mute")}>
                {d.b}
                {d.winner === "b" && <span className="ml-1.5 font-mono text-2xs">✓</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="border-t border-line bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-accent-ink">
        <strong>Verdict —</strong> {data.verdict}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  FailureLab — interactive failure simulation                        */
/* ------------------------------------------------------------------ */

export interface FailureScenario {
  id: string;
  title: string;
  fail: string[];
  degrade?: string[];
  story: string;
  metrics: { label: string; before: string; after: string; bad?: boolean }[];
  lessons: string[];
  reroute?: string[]; // node ids forming the traffic redistribution path
}

export function FailureLab({
  graph,
  scenarios,
  title = "Simulate failure",
}: {
  graph: Graph;
  scenarios: FailureScenario[];
  title?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sc = scenarios.find((s) => s.id === active) ?? null;

  const effectiveGraph: Graph = useMemo(() => {
    if (!sc) return graph;
    const failSet = new Set(sc.fail);
    const degSet = new Set(sc.degrade ?? []);
    return {
      ...graph,
      nodes: graph.nodes.map((n) =>
        failSet.has(n.id)
          ? { ...n, state: "down" as const }
          : degSet.has(n.id)
            ? { ...n, state: "warn" as const }
            : n.state === "down" || n.state === "warn"
              ? { ...n, state: undefined }
              : n
      ),
      flows: sc.reroute
        ? [
            ...(graph.flows ?? []).filter((f) => !f.path.some((p) => failSet.has(p))),
            { id: `reroute-${sc.id}`, path: sc.reroute, color: "#DC2626", label: "redistributed", speed: 200 },
          ]
        : (graph.flows ?? []).filter((f) => !f.path.some((p) => failSet.has(p))),
    };
  }, [graph, sc]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-zinc-50/70 px-4 py-2">
        <span className="font-mono text-xs font-semibold text-danger">{title}</span>
        {active && (
          <button
            onClick={() => setActive(null)}
            className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-2xs text-ink-mute transition-colors hover:border-danger hover:text-danger"
          >
            ↺ heal everything
          </button>
        )}
      </div>

      {/* scenario selector */}
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(active === s.id ? null : s.id)}
            aria-pressed={active === s.id}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              active === s.id
                ? "border-danger-border bg-danger-soft text-danger-ink"
                : "border-line bg-surface text-ink-mute hover:border-danger hover:text-danger"
            )}
          >
            ✕ {s.title}
          </button>
        ))}
      </div>

      <ArchCanvas
        graph={effectiveGraph}
        mode="static"
        packets={!active || !!sc?.reroute}
        focusOnSelect={false}
      />

      {sc && (
        <div className="animate-fadeUp space-y-3 border-t border-line bg-zinc-50/60 px-4 py-3">
          <div>
            <h4 className="text-sm font-semibold text-danger-ink">{sc.title}</h4>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-soft">{sc.story}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sc.metrics.map((m) => (
              <div key={m.label} className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="text-2xs text-ink-faint">{m.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="tabular font-mono text-xs text-ink-faint line-through decoration-zinc-300">{m.before}</span>
                  <span className="text-ink-faint">→</span>
                  <span className={cn("tabular font-mono text-sm font-semibold", m.bad ? "text-danger" : "text-warn")}>
                    {m.after}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">How production survives this</h4>
            <ul className="mt-1.5 space-y-1">
              {sc.lessons.map((l, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-sm bg-ok" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!active && (
        <div className="border-t border-line px-4 py-3 text-[13px] text-ink-mute">
          Pick a failure above and watch the architecture respond — then read how real systems survive it.
        </div>
      )}
    </div>
  );
}
