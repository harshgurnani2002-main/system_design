"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import type { DiagramNode } from "@/lib/types";
import { Slider, Stat, Sparkline } from "@/components/ui/Controls";
import { Button } from "@/components/ui/Button";
import { cn, fmtCompact, fmtMs } from "@/lib/utils";

interface SimState {
  load: number; // effective load incl retries
  retryMult: number;
}

export function SimulatorClient() {
  /* ---- controls ---- */
  const [rps, setRps] = useState(8000);
  const [hitRate, setHitRate] = useState(80);
  const [dbCap, setDbCap] = useState(6000);
  const [replicas, setReplicas] = useState(3);
  const [redisDown, setRedisDown] = useState(false);
  const [slowDb, setSlowDb] = useState(false);
  const [running, setRunning] = useState(true);

  /* ---- dynamic state ---- */
  const [sim, setSim] = useState<SimState>({ load: 8000, retryMult: 1 });
  const [hist, setHist] = useState<{ lat: number[]; err: number[]; db: number[]; pool: number[] }>({
    lat: [],
    err: [],
    db: [],
    pool: [],
  });
  const [log, setLog] = useState<{ t: string; msg: string; tone: "info" | "warn" | "err" | "ok" }[]>([
    { t: ts(), msg: "Steady state. All systems nominal.", tone: "info" },
  ]);
  const prevRef = useRef({ err: 0 });
  const [trace, setTrace] = useState<null | { steps: { label: string; ms: number; note?: string; bad?: boolean }[]; id: string }>(null);

  const effHit = redisDown ? 0 : hitRate / 100;
  const missLoad = sim.load * (1 - effHit);
  const dbUtil = missLoad / dbCap;
  const apiCap = replicas * 3500;
  const apiUtil = sim.load / apiCap;

  const latBase = 12 + (slowDb ? 40 : 0);
  const dbLat = slowDb ? 120 : 8;
  function computeLatency(u: number, base: number) {
    if (u < 0.5) return base;
    if (u < 1) return base / Math.max(0.08, 1 - u);
    return 2500 + (u - 1) * 4000;
  }
  const p99 = Math.min(
    9800,
    computeLatency(apiUtil, latBase) * 0.4 + computeLatency(dbUtil, dbLat) * (effHit > 0 ? (1 - effHit) : 1) + (redisDown && hitRate > 30 ? 60 : 0)
  );
  const errRate =
    apiUtil >= 1 || dbUtil >= 1
      ? Math.min(0.92, 0.05 + (Math.max(apiUtil, dbUtil) - 1) * 0.55)
      : Math.max(0, apiUtil - 0.85) * 0.15 + (redisDown ? 0.005 : 0.001);

  /* ---- cascade tick ---- */
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setSim((s) => {
        // retry storm dynamics
        const targetMult = errRate > 0.12 ? Math.min(2.6, s.retryMult + 0.25) : Math.max(1, s.retryMult - 0.35);
        const mult = s.retryMult + (targetMult - s.retryMult) * 0.5;
        return { ...s, retryMult: mult, load: rps * mult };
      });

      setHist((h) => ({
        lat: [...h.lat.slice(-47), p99],
        err: [...h.err.slice(-47), errRate],
        db: [...h.db.slice(-47), missLoad],
        pool: [...h.pool.slice(-47), Math.min(1, (missLoad / dbCap) * 100)],
      }));

      const prev = prevRef.current;
      if (prev.err < 0.12 && errRate >= 0.12) push("CASCADING FAILURE: clients retrying into an already-saturated system. Load amplifying.", "err");
      else if (prev.err < 0.02 && errRate >= 0.02) push("Error rate rising — saturation beginning.", "warn");
      if (prev.err >= 0.12 && errRate < 0.12) push("Retry storm subsided. Load returning to baseline.", "ok");
      prevRef.current = { err: errRate };
    }, 420);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, rps, dbCap, effHit, apiUtil, dbUtil, p99, errRate, missLoad, redisDown]);

  function push(msg: string, tone: "info" | "warn" | "err" | "ok") {
    setLog((l) => [...l.slice(-30), { t: ts(), msg, tone }]);
  }

  /* ---- graph ---- */
  const graph = useMemo<{
    nodes: DiagramNode[];
    edges: { from: string; to: string; label?: string; flow?: boolean }[];
  }>(() => {
    const st = (u: number): DiagramNode["state"] => (u >= 1 ? "down" : u >= 0.85 ? "hot" : u >= 0.6 ? "warn" : "ok");
    return {
      nodes: [
        { id: "c", label: "Clients", sub: `${fmtCompact(rps)} req/s`, kind: "client", x: 20, y: 110 },
        { id: "lb", label: "Load Balancer", kind: "app", x: 220, y: 110 },
        { id: "api", label: `API ×${replicas}`, sub: `${fmtCompact(sim.load)} eff · util ${(apiUtil * 100).toFixed(0)}%`, kind: "app", x: 430, y: 110, state: st(apiUtil) },
        { id: "rc", label: redisDown ? "Redis ✕ DOWN" : "Redis", sub: redisDown ? "cache unavailable" : `hit ${(hitRate).toFixed(0)}%`, kind: "cache", x: 670, y: 20, state: redisDown ? "down" : "ok" },
        { id: "pg", label: "PostgreSQL", sub: `${fmtCompact(missLoad)} / ${fmtCompact(dbCap)} QPS`, kind: "data", x: 670, y: 205, state: st(dbUtil) },
      ] as DiagramNode[],
      edges: [
        { from: "c", to: "lb", flow: true },
        { from: "lb", to: "api", flow: true },
        ...(redisDown
          ? []
          : [{ from: "api", to: "rc", label: "reads", flow: true } as { from: string; to: string; label?: string; flow?: boolean }]),
        { from: "api", to: "pg", label: redisDown ? "ALL traffic" : "misses + writes", flow: true },
      ],
    };
  }, [rps, replicas, sim.load, apiUtil, redisDown, hitRate, missLoad, dbCap, dbUtil]);

  /* ---- request trace ---- */
  function runTrace() {
    const hit = Math.random() < effHit;
    const id = "req_" + Math.random().toString(36).slice(2, 8);
    const dbMs = slowDb ? 90 + Math.random() * 60 : 6 + Math.random() * 8;
    const steps = [
      { label: "DNS resolved", ms: +(2 + Math.random() * 4).toFixed(1), note: "cached at resolver · TTL 60s" },
      { label: "CDN edge", ms: +(8 + Math.random() * 10).toFixed(1), note: "static assets only — API passes through" },
      { label: "Load balancer", ms: +(0.4 + Math.random() * 0.5).toFixed(1), note: `least_connections → api-${1 + Math.floor(Math.random() * replicas)}` },
      { label: "API gateway auth", ms: +(3 + Math.random() * 4).toFixed(1), note: "JWT verified locally · no round trip" },
      {
        label: hit && !redisDown ? "Redis GET" : "Redis GET (miss)",
        ms: hit && !redisDown ? +(0.4 + Math.random() * 0.8).toFixed(2) : +(0.5 + Math.random()).toFixed(2),
        note: hit && !redisDown ? "HIT — response assembled from memory" : "MISS — falling through to Postgres",
        bad: !hit || redisDown,
      },
      ...(hit && !redisDown
        ? []
        : [
            {
              label: "PostgreSQL query",
              ms: +dbMs.toFixed(1),
              note: slowDb ? "seq scan + lock wait ⚠ dependency degraded" : "index scan · rows=42",
              bad: slowDb,
            },
          ]),
      { label: "Response rendered", ms: +(1 + Math.random() * 2).toFixed(1), note: `status 200 · ${JSON.stringify({ ok: true }).length}B` },
    ];
    setTrace({ steps, id });
  }

  const health = errRate > 0.12 ? "danger" : errRate > 0.02 || p99 > 500 ? "warn" : "ok";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">System Simulator</h1>
          <p className="mt-1 text-sm text-ink-mute">
            Overload the architecture deliberately. Watch saturation become queueing, queueing become timeouts, and
            timeouts become a retry storm.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={running ? "secondary" : "primary"} onClick={() => setRunning((r) => !r)}>
            {running ? "Pause sim" : "Resume sim"}
          </Button>
          <Button size="sm" variant="subtle" onClick={runTrace}>
            Trace Request
          </Button>
        </div>
      </div>

      <div className={cn(
        "mt-4 overflow-hidden rounded-xl border bg-surface",
        health === "ok" && "border-line",
        health === "warn" && "border-warn-border",
        health === "danger" && "border-danger-border"
      )}>
        <div className={cn(
          "flex items-center gap-2 border-b px-4 py-2 font-mono text-2xs",
          health === "ok" && "border-line text-ok-ink",
          health === "warn" && "border-warn-border bg-warn-soft text-warn-ink",
          health === "danger" && "border-danger-border bg-danger-soft text-danger-ink"
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", health === "ok" ? "bg-ok" : health === "warn" ? "bg-warn animate-pulseSoft" : "bg-danger animate-pulseSoft")} />
          {health === "ok" ? "HEALTHY — capacity headroom available" : health === "warn" ? "DEGRADED — approaching saturation" : "FAILING — retry storm active"}
          {sim.retryMult > 1.05 && <span className="ml-auto">retry amplification ×{sim.retryMult.toFixed(2)}</span>}
        </div>

        <ArchCanvas graph={graph} height={300} mode="static" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* controls */}
        <section aria-label="Simulation controls" className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Controls</h2>
          <Slider label="Offered traffic" value={rps} min={500} max={120000} step={500} onChange={(v) => { setRps(v); }} format={(v) => `${fmtCompact(v)} RPS`} />
          <Slider label="Cache hit rate" value={hitRate} min={0} max={99} onChange={setHitRate} disabled={redisDown} format={(v) => `${v}%`} hint="Share of reads served by Redis." />
          <Slider label="Postgres capacity" value={dbCap} min={1000} max={40000} step={500} onChange={setDbCap} format={(v) => `${fmtCompact(v)} QPS`} hint="What the primary can sustain before queueing." />
          <Slider label="API replicas" value={replicas} min={1} max={16} onChange={setReplicas} format={(v) => `${v} × 3.5K RPS`} />
          <div className="flex flex-wrap gap-2 pt-1">
            <ToggleBtn active={redisDown} onClick={() => { setRedisDown((d) => !d); push(redisDown ? "Redis recovered." : "Redis taken DOWN — reads now bypass cache.", redisDown ? "ok" : "err"); }}>
              Kill Redis
            </ToggleBtn>
            <ToggleBtn active={slowDb} onClick={() => { setSlowDb((s) => !s); push(slowDb ? "Database latency restored." : "Database degraded: queries now ~10× slower.", slowDb ? "ok" : "warn"); }}>
              Slow the database
            </ToggleBtn>
          </div>

          {/* preset scenarios */}
          <div className="border-t border-line-soft pt-3">
            <h3 className="mb-2 font-mono text-2xs uppercase tracking-widest text-ink-faint">Guided incidents</h3>
            <div className="flex flex-col gap-1.5">
              <PresetBtn label="Cache avalanche recovery" desc="Kill Redis at 80% hit rate, then watch DB absorb everything." onClick={() => { setRps(20000); setHitRate(80); setDbCap(6000); setReplicas(4); setSlowDb(false); setRedisDown(true); push("Scenario loaded: Redis outage under load.", "warn"); }} />
              <PresetBtn label="Retry storm cascade" desc="Overwhelm the DB until client retries amplify load 2.6×." onClick={() => { setRps(45000); setHitRate(20); setDbCap(8000); setReplicas(3); setRedisDown(false); setSlowDb(false); push("Scenario loaded: overload → cascade.", "warn"); }} />
              <PresetBtn label="Slow-dependency meltdown" desc="DB 10× slower: threads pile up even below capacity limits." onClick={() => { setRps(15000); setHitRate(70); setDbCap(12000); setReplicas(4); setSlowDb(true); setRedisDown(false); push("Scenario loaded: dependency degradation.", "warn"); }} />
            </div>
          </div>
        </section>

        {/* metrics + trace + log */}
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Effective load" value={fmtCompact(sim.load)} sub={`offered ${fmtCompact(rps)}`} tone={sim.retryMult > 1.1 ? "danger" : "neutral"} />
            <Stat label="p99 latency" value={fmtMs(p99)} tone={p99 > 800 ? "danger" : p99 > 300 ? "warn" : "ok"} />
            <Stat label="Error rate" value={`${(errRate * 100).toFixed(1)}%`} tone={errRate > 0.05 ? "danger" : errRate > 0.01 ? "warn" : "ok"} />
            <Stat label="DB utilization" value={`${Math.min(999, dbUtil * 100).toFixed(0)}%`} tone={dbUtil > 0.9 ? "danger" : dbUtil > 0.7 ? "warn" : "ok"} />
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-4">
            <MetricCol label="p99 latency" data={hist.lat} color="#2563EB" />
            <MetricCol label="error rate" data={hist.err} max={1} color="#DC2626" />
            <MetricCol label="db QPS" data={hist.db} color="#7C3AED" threshold={dbCap} />
            <MetricCol label="pool pressure" data={hist.pool} max={100} color="#D97706" />
          </div>

          {trace && (
            <div className="animate-fadeUp rounded-xl border border-accent-border bg-accent-soft/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-accent-ink">TRACE {trace.id}</span>
                <span className="font-mono text-2xs text-ink-mute">
                  total {trace.steps.reduce((a, s) => a + s.ms, 0).toFixed(1)}ms
                </span>
              </div>
              <ol className="space-y-1.5">
                {trace.steps.map((s, i) => (
                  <li key={i} className="flex items-baseline gap-3 font-mono text-2xs">
                    <span className="w-28 shrink-0 text-right text-ink-faint">{i === 0 ? "" : "+"}{s.ms}ms</span>
                    <span className={cn("w-36 shrink-0", s.bad ? "text-warn-ink" : "text-ink")}>{s.label}</span>
                    <span className="text-ink-mute">{s.note}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-xl border border-line bg-[#FCFCFB] p-3">
            <h3 className="mb-1.5 font-mono text-2xs uppercase tracking-widest text-ink-faint">Event log</h3>
            <div className="max-h-44 space-y-0.5 overflow-y-auto font-mono text-2xs leading-relaxed">
              {[...log].reverse().map((l, i) => (
                <div key={i} className={cn(l.tone === "err" && "text-danger", l.tone === "warn" && "text-warn", l.tone === "ok" && "text-ok", l.tone === "info" && "text-ink-mute")}>
                  <span className="text-ink-faint">{l.t}</span> {l.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCol({ label, data, color, max, threshold }: { label: string; data: number[]; color: string; max?: number; threshold?: number }) {
  const latest = data.length ? data[data.length - 1] : 0;
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between font-mono text-2xs">
        <span className="uppercase tracking-wide text-ink-faint">{label}</span>
        <span style={{ color }} className="font-semibold">
          {max === 1 ? `${(latest * 100).toFixed(0)}%` : fmtCompact(latest)}
        </span>
      </div>
      <Sparkline data={data} max={max} color={color} height={34} threshold={threshold} />
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-danger-border bg-danger-soft text-danger-ink" : "border-line bg-surface text-ink-soft hover:border-danger hover:text-danger"
      )}
    >
      {children}
    </button>
  );
}

function PresetBtn({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft/30">
      <div className="text-xs font-medium text-ink">{label}</div>
      <div className="text-2xs leading-snug text-ink-mute">{desc}</div>
    </button>
  );
}

function ts() {
  return new Date().toTimeString().slice(0, 8);
}
