"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import type { DiagramNode, Graph } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Slider, Stat, Sparkline } from "@/components/ui/Controls";
import { fmtCompact, fmtMs, cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Model                                                              */
/* ------------------------------------------------------------------ */

interface Metrics {
  dbLoad: number;
  dbCap: number;
  redisLoad: number;
  redisCap: number;
  latencyP99: number;
  errRate: number;
  queueDepth: number;
  stalenessMs: number;
}

interface Fix {
  id: "redis" | "batching" | "shards" | "replicas";
  label: string;
  desc: string;
}

const FIXES: Fix[] = [
  { id: "redis", label: "Add Redis cache", desc: "Serve post reads from memory. Absorbs ~95% of read load." },
  { id: "batching", label: "Async like batching", desc: "Buffer likes in a queue; flush merged counts every 2s. 1000× fewer writes." },
  { id: "shards", label: "Shard the counter", desc: "Split the hot post's counter into 16 buckets summed on read. Kills the hot key." },
  { id: "replicas", label: "Add DB replicas", desc: "Route reads to replicas; primary handles writes only." },
];

interface StageDef {
  id: number;
  name: string;
  brief: string;
  insight: string;
  maxQps: number;
  stormMode?: boolean;
  available: Fix["id"][];
  requiredForNext: Fix["id"][];
  nextHint: string;
}

const STAGES: StageDef[] = [
  {
    id: 0,
    name: "V1 · One honest server",
    brief:
      "A monolith and PostgreSQL. Push traffic with the slider and watch what happens first.",
    insight: "",
    maxQps: 60000,
    available: [],
    requiredForNext: [],
    nextHint: "Push traffic past ~5K QPS until errors appear.",
  },
  {
    id: 1,
    name: "V2 · Cache the reads",
    brief:
      "Reads were 90% of load. Add Redis and re-run the same traffic. Writes still go straight to Postgres.",
    insight:
      "Caching fixed READS. But every like is a WRITE — and Postgres still absorbs all of them.",
    maxQps: 60000,
    available: ["redis"],
    requiredForNext: ["redis"],
    nextHint: "Enable the cache, push traffic again, and watch where the bottleneck moves.",
  },
  {
    id: 2,
    name: "V3 · The Like Storm",
    brief:
      "A creator posts. 100,000 fans smash like within a minute — ALL updating the SAME counter row.",
    insight:
      "One row = one lock. Concurrent updates serialize. This is the HOT KEY problem — no amount of generic capacity fixes it.",
    maxQps: 120000,
    stormMode: true,
    available: ["redis", "shards", "batching"],
    requiredForNext: ["batching"],
    nextHint: "Experience the storm, then enable async batching.",
  },
  {
    id: 3,
    name: "V4 · Async aggregation",
    brief:
      "Likes land in a queue; a worker merges them and flushes every 2 seconds. Notice the new tradeoff.",
    insight:
      "DB writes dropped by the batch factor. The cost: counts lag ~2s behind reality — eventual consistency, bought deliberately.",
    maxQps: 120000,
    stormMode: true,
    available: ["redis", "shards", "batching"],
    requiredForNext: ["shards"],
    nextHint: "Batching saved Postgres — but look at Redis. One key is still melting.",
  },
  {
    id: 4,
    name: "V5 · Sharded counters",
    brief:
      "Split the hot counter into 16 buckets; readers sum them. Add replicas for read headroom.",
    insight:
      "Hot key dissolved across shards. This is the production pattern: batch writes, shard hot keys, accept bounded staleness.",
    maxQps: 1000000,
    stormMode: true,
    available: ["redis", "shards", "batching", "replicas"],
    requiredForNext: [],
    nextHint: "Drive it to 1M QPS. It holds.",
  },
];

/* ------------------------------------------------------------------ */
/*  Metric computation                                                 */
/* ------------------------------------------------------------------ */

function compute(qps: number, s: StageDef, on: Set<Fix["id"]>): Metrics {
  const BATCH = 4000;
  const SHARDS = 16;

  let dbLoad: number;
  let redisLoad = 0;

  if (!on.has("redis")) {
    // everything hits postgres
    dbLoad = qps;
  } else {
    const reads = qps * 0.9;
    const writes = qps * 0.1;
    const missTraffic = reads * 0.05;
    dbLoad = writes + missTraffic;
    redisLoad = reads + writes * 0.15;
  }

  if (s.stormMode) {
    // all traffic is likes on ONE post
    if (!on.has("batching")) {
      dbLoad = qps; // serialized row updates
    } else {
      dbLoad = Math.max(1, qps / BATCH);
    }
    redisLoad = on.has("shards") ? qps : qps; // same op count; capacity differs below
  }

  const dbCap = on.has("replicas") && !s.stormMode ? 15000 : 5000;
  // single-row lock contention caps useful write throughput hard
  const rowLockCap = s.stormMode && !on.has("batching") ? 350 : Infinity;
  const effDbCap = Math.min(dbCap, rowLockCap);

  const redisShardCap = on.has("shards") ? 80000 * SHARDS : 80000;
  const redisCap = redisShardCap;

  const dbUtil = dbLoad / effDbCap;
  const redisUtil = redisLoad / redisCap;

  const baseLat = 18;
  const dbLat = dbUtil < 1 ? baseLat / (1 - dbUtil * 0.92) : 9000;
  const redisLat = redisUtil < 1 ? 1.5 / (1 - redisUtil * 0.9) : 4000;
  const latencyP99 = Math.min(
    9500,
    baseLat + (dbUtil > 0.25 ? dbLat : 0) + (redisUtil > 0.3 ? redisLat : 0)
  );

  const errRate =
    dbUtil >= 1 || redisUtil >= 1
      ? Math.min(0.85, (Math.max(dbUtil, redisUtil) - 1) * 0.9 + 0.04)
      : dbUtil > 0.85
        ? (dbUtil - 0.85) * 0.08
        : 0.001;

  const queueDepth =
    s.stormMode && on.has("batching")
      ? Math.max(0, (qps - dbLoad * BATCH) * 2)
      : dbUtil > 1
        ? (dbLoad - effDbCap) * 30
        : 0;

  return {
    dbLoad,
    dbCap: effDbCap,
    redisLoad,
    redisCap,
    latencyP99,
    errRate,
    queueDepth,
    stalenessMs: on.has("batching") ? 2000 : 0,
  };
}

function nodeState(load: number, cap: number): DiagramNode["state"] {
  if (cap === 0) return undefined;
  const u = load / cap;
  if (u >= 1) return "down";
  if (u >= 0.8) return "hot";
  if (u >= 0.55) return "warn";
  return "ok";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InstagramLikes({ onComplete }: { onComplete?: () => void }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [qps, setQps] = useState(1000);
  const [on, setOn] = useState<Set<Fix["id"]>>(new Set());
  const [log, setLog] = useState<{ t: string; msg: string; tone: "info" | "warn" | "err" | "ok" }[]>([
    { t: now(), msg: "System online. 1 post, 1 Postgres, big dreams.", tone: "info" },
  ]);
  const [hist, setHist] = useState<{ lat: number[]; err: number[]; db: number[]; redis: number[] }>({
    lat: [],
    err: [],
    db: [],
    redis: [],
  });

  const stage = STAGES[stageIdx];
  const m = useMemo(() => compute(qps, stage, on), [qps, stage, on]);
  const prevRef = useRef({ err: 0, dbU: 0, rU: 0 });
  const completedRef = useRef(false);

  const pushLog = useCallback((msg: string, tone: "info" | "warn" | "err" | "ok") => {
    setLog((l) => [...l.slice(-40), { t: now(), msg, tone }]);
  }, []);

  /* ---- simulation tick: history + log events ---- */
  useEffect(() => {
    const iv = setInterval(() => {
      setHist((h) => ({
        lat: [...h.lat.slice(-47), m.latencyP99],
        err: [...h.err.slice(-47), m.errRate],
        db: [...h.db.slice(-47), m.dbLoad],
        redis: [...h.redis.slice(-47), m.redisLoad],
      }));
      const prev = prevRef.current;
      const dbU = m.dbCap ? m.dbLoad / m.dbCap : 0;
      const rU = m.redisCap ? m.redisLoad / m.redisCap : 0;
      if (prev.err < 0.05 && m.errRate >= 0.05)
        pushLog(`Errors crossing ${(m.errRate * 100).toFixed(0)}% — clients are seeing timeouts.`, "err");
      if (prev.dbU < 1 && dbU >= 1) pushLog("PostgreSQL saturated. Queue building.", "err");
      if (rU >= 1 && prev.rU < 1) pushLog("Redis hot key saturated — single shard at 100% CPU.", "err");
      if (prev.err >= 0.05 && m.errRate < 0.01) pushLog("Error rate recovered. Users breathe again.", "ok");
      prevRef.current = { err: m.errRate, dbU, rU };
    }, 320);
    return () => clearInterval(iv);
  }, [m, pushLog]);

  const toggleFix = (id: Fix["id"]) => {
    setOn((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        n.add(id);
        const fix = FIXES.find((f) => f.id === id)!;
        pushLog(`Enabled: ${fix.label}`, "ok");
      }
      return n;
    });
  };

  // keep traffic slider within the active stage's range
  useEffect(() => {
    setQps((q) => Math.min(q, STAGES[stageIdx].maxQps));
  }, [stageIdx]);

  const goalMet =
    stage.id === 0
      ? m.errRate >= 0.05
      : stage.id === 1
        ? on.has("redis") && m.dbLoad / m.dbCap > 0.8
        : stage.id === 2
          ? on.has("batching")
          : stage.id === 3
            ? on.has("shards")
            : qps >= 900000 && m.errRate < 0.02;

  useEffect(() => {
    if (goalMet && stage.id === STAGES.length - 1 && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [goalMet, stage.id, onComplete]);

  /* ---- graph ---- */
  const graph: Graph = useMemo(() => {
    const nodes: DiagramNode[] = [];
    const edges: Graph["edges"] = [];
    const dbSt = nodeState(m.dbLoad, m.dbCap);
    const rSt = m.redisLoad > 0 ? nodeState(m.redisLoad, m.redisCap) : undefined;

    if (stage.id === 0) {
      nodes.push(
        { id: "c", label: "Clients", sub: `${fmtCompact(qps)} req/s`, kind: "client", x: 20, y: 90 },
        { id: "api", label: "Like API", sub: "monolith", kind: "app", x: 260, y: 90 },
        { id: "pg", label: "PostgreSQL", sub: `${fmtCompact(m.dbLoad)} / ${fmtCompact(m.dbCap)} QPS`, kind: "data", x: 520, y: 90, state: dbSt }
      );
      edges.push({ from: "c", to: "api", flow: true }, { from: "api", to: "pg", flow: true });
    } else if (stage.id <= 1) {
      nodes.push(
        { id: "c", label: "Clients", sub: `${fmtCompact(qps)} req/s`, kind: "client", x: 20, y: 90 },
        { id: "api", label: "Like API", kind: "app", x: 240, y: 90 },
        { id: "rc", label: "Redis", sub: on.has("redis") ? `${fmtCompact(m.redisLoad)} / ${fmtCompact(m.redisCap)}` : "not yet added", kind: "cache", x: 480, y: 10, state: on.has("redis") ? rSt : undefined },
        { id: "pg", label: "PostgreSQL", sub: `${fmtCompact(m.dbLoad)} / ${fmtCompact(m.dbCap)} QPS`, kind: "data", x: 480, y: 170, state: dbSt }
      );
      edges.push(
        { from: "c", to: "api", flow: true },
        ...(on.has("redis")
          ? ([{ from: "api", to: "rc", label: "reads", flow: true }, { from: "api", to: "pg", label: "writes", flow: true }] as Graph["edges"])
          : [{ from: "api", to: "pg", flow: true }])
      );
    } else {
      const batched = on.has("batching");
      nodes.push(
        { id: "c", label: "Fans liking", sub: `${fmtCompact(qps)} likes/s`, kind: "client", x: 20, y: 90 },
        { id: "api", label: "Like API", kind: "app", x: 230, y: 90 },
        { id: "rc", label: on.has("shards") ? "Redis ×16 shards" : "Redis · hot key", sub: `${fmtCompact(m.redisLoad)} / ${fmtCompact(m.redisCap)}`, kind: "cache", x: 470, y: 10, state: rSt },
        { id: "q", label: "Queue", sub: batched ? `depth ${fmtCompact(m.queueDepth)}` : "bypassed", kind: "queue", x: 470, y: 170, state: batched && m.queueDepth > 50000 ? "warn" : "ok" },
        { id: "wk", label: "Aggregator", sub: batched ? `flush /2s · ÷${fmtCompact(4000)}` : "off", kind: "app", x: 700, y: 170 },
        { id: "pg", label: "PostgreSQL", sub: `${fmtCompact(m.dbLoad)} / ${fmtCompact(m.dbCap)} QPS`, kind: "data", x: 930, y: 170, state: dbSt }
      );
      edges.push(
        { from: "c", to: "api", flow: true },
        { from: "api", to: "rc", label: "INCR", flow: true },
        ...(batched
          ? ([{ from: "api", to: "q", label: "enqueue", flow: true }, { from: "q", to: "wk", flow: true }, { from: "wk", to: "pg", label: "batch UPDATE", flow: true }] as Graph["edges"])
          : [{ from: "api", to: "pg", label: "UPDATE … row lock", flow: true }])
      );
    }
    return { nodes, edges };
  }, [stage.id, qps, m, on]);

  const health = m.errRate > 0.1 ? "danger" : m.errRate > 0.01 || m.latencyP99 > 800 ? "warn" : "ok";

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-zinc-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-accent">{stage.name}</span>
          <span className={cn(
            "rounded-md border px-1.5 py-0.5 font-mono text-2xs",
            health === "ok" && "border-ok-border bg-ok-soft text-ok-ink",
            health === "warn" && "border-warn-border bg-warn-soft text-warn-ink",
            health === "danger" && "border-danger-border bg-danger-soft text-danger-ink"
          )}>
            {health === "ok" ? "HEALTHY" : health === "warn" ? "DEGRADED" : "FAILING"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setStageIdx(i); }}
              aria-label={`Go to stage ${i + 1}`}
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                i === stageIdx ? "bg-accent" : i < stageIdx ? "bg-accent/40" : "bg-line-strong hover:bg-zinc-300"
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_290px]">
        {/* canvas + narrative */}
        <div className="border-b border-line lg:border-b-0 lg:border-r">
          <ArchCanvas graph={graph} height={330} mode="static" />
          <div className="border-t border-line-soft px-4 py-3">
            <p className="text-sm leading-relaxed text-ink-soft">{stage.brief}</p>
            {stage.insight && goalMet && (
              <p className="mt-2 rounded-lg border border-accent-border bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-accent-ink animate-fadeUp">
                <strong>Insight.</strong> {stage.insight}
              </p>
            )}
            {!stage.insight && m.errRate >= 0.05 && stage.id === 0 && (
              <p className="mt-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-[13px] leading-relaxed text-danger-ink animate-fadeUp">
                <strong>Bottleneck found.</strong> PostgreSQL caps at {fmtCompact(m.dbCap)} QPS. Latency climbs non-linearly as utilization → 100%, then requests start timing out. What would you add first?
              </p>
            )}
          </div>
        </div>

        {/* control panel */}
        <div className="flex flex-col gap-4 p-4">
          <Slider
            label={stage.stormMode ? "Like storm intensity" : "Offered traffic"}
            value={qps}
            min={500}
            max={stage.maxQps}
            step={500}
            onChange={(v) => setQps(v)}
            format={(v) => `${fmtCompact(v)} QPS`}
          />

          {stage.available.length > 0 && (
            <div>
              <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">Actions</div>
              <div className="flex flex-col gap-1.5">
                {FIXES.filter((f) => stage.available.includes(f.id)).map((f) => {
                  const active = on.has(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFix(f.id)}
                      aria-pressed={active}
                      className={cn(
                        "group rounded-lg border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-accent-border bg-accent-soft"
                          : "border-line bg-surface hover:border-line-strong hover:bg-zinc-50"
                      )}
                    >
                      <div className={cn("text-xs font-semibold", active ? "text-accent-ink" : "text-ink")}>
                        {active ? "✓ " : "+ "}
                        {f.label}
                      </div>
                      <div className="mt-0.5 text-2xs leading-snug text-ink-mute">{f.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Stat label="p99 latency" value={fmtMs(m.latencyP99)} tone={m.latencyP99 > 800 ? "danger" : m.latencyP99 > 300 ? "warn" : "ok"} />
            <Stat label="Errors" value={`${(m.errRate * 100).toFixed(1)}%`} tone={m.errRate > 0.05 ? "danger" : m.errRate > 0.01 ? "warn" : "ok"} />
            <Stat label="DB load" value={fmtCompact(m.dbLoad)} sub={`cap ${fmtCompact(m.dbCap)}`} tone={m.dbLoad / m.dbCap > 0.9 ? "danger" : "neutral"} />
            <Stat label="Redis load" value={m.redisLoad > 0 ? fmtCompact(m.redisLoad) : "—"} sub={m.redisLoad > 0 ? `cap ${fmtCompact(m.redisCap)}` : "no cache"} tone={m.redisLoad / m.redisCap > 0.9 ? "danger" : "neutral"} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-2xs text-ink-faint"><span>p99 trend</span><span className="font-mono">60s</span></div>
            <Sparkline data={hist.lat} color="#2563EB" height={34} />
            <Sparkline data={hist.err} max={1} color="#DC2626" height={26} />
          </div>

          {m.stalenessMs > 0 && (
            <div className="rounded-lg border border-warn-border bg-warn-soft px-3 py-2 text-2xs leading-snug text-warn-ink">
              Eventual consistency active: displayed counts may lag up to {(m.stalenessMs / 1000).toFixed(0)}s. Users rarely notice; databases notice everything.
            </div>
          )}
        </div>
      </div>

      {/* footer: log + next */}
      <div className="grid border-t border-line md:grid-cols-[1fr_220px]">
        <div className="max-h-28 overflow-y-auto border-b border-line bg-[#FCFCFB] px-4 py-2 font-mono text-2xs leading-relaxed md:border-b-0 md:border-r">
          {log.slice(-6).map((l, i) => (
            <div key={i} className={cn(
              l.tone === "err" && "text-danger",
              l.tone === "warn" && "text-warn",
              l.tone === "ok" && "text-ok",
              l.tone === "info" && "text-ink-mute"
            )}>
              <span className="text-ink-faint">{l.t} </span>{l.msg}
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-center gap-2 px-4 py-3">
          <div className="text-2xs leading-snug text-ink-mute">{stage.nextHint}</div>
          <Button
            variant={goalMet ? "primary" : "secondary"}
            size="sm"
            disabled={!goalMet || stage.id === STAGES.length - 1}
            onClick={() => {
              setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
              setQps(stage.id >= 2 ? 20000 : 1000);
              pushLog(`── Advancing to ${STAGES[Math.min(stage.id + 1, STAGES.length - 1)].name} ──`, "info");
            }}
          >
            {stage.id === STAGES.length - 1 ? "Architecture complete ✓" : goalMet ? "Continue →" : "Locked"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function now() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}
