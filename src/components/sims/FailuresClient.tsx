"use client";

import { useState } from "react";
import type { Graph } from "@/lib/types";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import { cn } from "@/lib/utils";
import { useProgress } from "@/lib/store/progress";

interface Scenario {
  id: string;
  title: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  brief: string;
  graph: Graph;
  symptoms: string[];
  logs: string[];
  metrics: { label: string; value: string; bad?: boolean }[];
  options: string[];
  correct: number;
  explain: string;
  fixes: string[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "f1",
    title: "Checkout latency spike at lunch rush",
    severity: "SEV-2",
    brief:
      "p99 on /checkout jumped from 220ms to 4s over 20 minutes. No deploys in the window. Users report double-tapping 'pay'.",
    graph: {
      nodes: [
        { id: "c", label: "Clients", kind: "client", x: 20, y: 100 },
        { id: "api", label: "API", sub: "healthy", kind: "app", x: 230, y: 100 },
        { id: "rc", label: "Redis", kind: "cache", x: 450, y: 30 },
        { id: "pg", label: "PostgreSQL", sub: "conn pool 200/200", kind: "data", x: 450, y: 175, state: "hot" },
      ],
      edges: [
        { from: "c", to: "api" },
        { from: "api", to: "rc", label: "sessions" },
        { from: "api", to: "pg", flow: true },
      ],
    },
    symptoms: [
      "API CPU normal (35%), memory normal",
      "Postgres connections at max (200/200), mostly `idle in transaction`",
      "A new reporting job started at 12:00 pulling full-table scans every 60s",
    ],
    logs: [
      `12:03:11 WARN  [api] pool timeout waiting for connection db=orders elapsed=5000ms`,
      `12:03:11 ERROR [api] checkout failed err=PoolTimeout trace=9fa3…`,
      `12:04:02 INFO  [reporting] snapshot job rows_scanned=48_112_003 duration=54s`,
      `12:05:47 WARN  [api] retry attempt=2 order=create trace=77bd…`,
    ],
    metrics: [
      { label: "p99 checkout", value: "4.1s", bad: true },
      { label: "DB connections", value: "200/200", bad: true },
      { label: "DB CPU", value: "88%", bad: true },
      { label: "Redis hit rate", value: "97%", bad: false },
    ],
    options: [
      "Redis cache cluster is down and reads fall through to Postgres",
      "A batch job is saturating DB I/O and pinning connections; checkouts starve",
      "API fleet is undersized for lunch traffic; add pods",
      "Network packet loss between API and database",
    ],
    correct: 1,
    explain:
      "API health is fine and Redis is healthy — but a reporting job is scanning tens of millions of rows every minute, saturating shared DB resources AND holding connections. The `idle in transaction` pile-up is the smoking gun: app transactions wait behind the scanner.",
    fixes: [
      "Kill/pause the reporting job immediately (restore service first)",
      "Move analytics to a read replica permanently",
      "Enforce statement_timeout + separate connection pools per workload class",
    ],
  },
  {
    id: "f2",
    title: "Every deploy causes 30s of errors",
    severity: "SEV-2",
    brief:
      "Each rolling deploy produces a burst of 502s lasting ~30 seconds. It has been 'normal' for months.",
    graph: {
      nodes: [
        { id: "lb", label: "Load Balancer", sub: "health: /healthz", kind: "app", x: 20, y: 110 },
        { id: "a1", label: "Pod v1.7", sub: "draining", kind: "app", x: 250, y: 40, state: "warn" },
        { id: "a2", label: "Pod v1.8", sub: "starting · not ready", kind: "app", x: 250, y: 180 },
        { id: "db", label: "Postgres", kind: "data", x: 480, y: 110 },
      ],
      edges: [
        { from: "lb", to: "a1" },
        { from: "lb", to: "a2" },
        { from: "a1", to: "db" },
        { from: "a2", to: "db", dashed: true },
      ],
    },
    symptoms: [
      "Errors correlate exactly with pod start time",
      "New pods pass container start but serve 500s for ~25s",
      "App connects to DB during boot before schema/migrations verified",
    ],
    logs: [
      `deploy-14:02:01 INFO  pod api-7f9c started container healthy`,
      `deploy-14:02:04 WARN  api readiness probe failed: GET /readyz 500`,
      `deploy-14:02:06 ERROR api unhandled: relation "orders" does not exist (migration pending?)`,
      `deploy-14:02:31 INFO  api ready — serving traffic`,
    ],
    metrics: [
      { label: "5xx during deploy", value: "~2.1% of requests", bad: true },
      { label: "Time to first ready", value: "29s", bad: true },
      { label: "Steady-state error rate", value: "0.01%", bad: false },
      { label: "CPU at start", value: "normal", bad: false },
    ],
    options: [
      "Load balancer health checks are too aggressive; increase interval",
      "Pods receive traffic before they're truly ready — readiness gate is wrong or missing migrations wait",
      "Database can't handle two versions at once; deploy sequentially",
      "Kubernetes is restarting pods too fast during rollout",
    ],
    correct: 1,
    explain:
      "Traffic hits pods whose process started but whose dependencies aren't verified. The LB isn't the problem — the readiness contract is. `/readyz` must gate ALL traffic until migrations are confirmed and warmup completes; startup probes should cover slow boots.",
    fixes: [
      "Fix /readyz to verify DB connectivity + current migration version",
      "Add startupProbe so slow boots don't trip liveness",
      "Run migrations as a pre-deploy Job, decoupled from app boot",
    ],
  },
  {
    id: "f3",
    title: "Memory climbs for 6 days, then pods die",
    severity: "SEV-1",
    brief:
      "Gradual RSS growth across all API pods since Tuesday's release. OOM kills began overnight, crash-looping under peak traffic.",
    graph: {
      nodes: [
        { id: "api1", label: "API pod A", sub: "RSS 94% of limit", kind: "app", x: 20, y: 40, state: "down" },
        { id: "api2", label: "API pod B", sub: "RSS 71%", kind: "app", x: 240, y: 40, state: "hot" },
        { id: "api3", label: "API pod C", sub: "restarting ×14", kind: "app", x: 240, y: 160, state: "down" },
        { id: "rc", label: "Redis", sub: "pubsub subscribers ↑", kind: "cache", x: 480, y: 100, state: "warn" },
      ],
      edges: [
        { from: "api1", to: "rc" },
        { from: "api2", to: "rc" },
        { from: "api3", to: "rc" },
      ],
    },
    symptoms: [
      "Growth curve linear with uptime, not traffic",
      "Tuesday release added an in-process event bus subscribing to Redis pub/sub",
      "Heap dumps show thousands of duplicate listener registrations",
    ],
    logs: [
      `pod-api-c OOMKilled (memory limit 512Mi) restart #14`,
      `WARN eventbus subscriber registered topic=orders.events total_subs=48_211`,
      `WARN eventbus subscriber registered topic=orders.events total_subs=48_212`,
    ],
    metrics: [
      { label: "Memory growth", value: "+38MB/hour/pod", bad: true },
      { label: "OOM kills last 24h", value: "61", bad: true },
      { label: "Request error rate", value: "spikes with restarts", bad: true },
      { label: "GC pause p99", value: "growing", bad: true },
    ],
    options: [
      "Traffic grew past capacity; increase memory limits fleet-wide",
      "Event listeners are registered per-request and never unsubscribed — classic leak introduced by the pub/sub feature",
      "Redis is leaking memory into connected clients via pub/sub backpressure",
      "Garbage collector tuning is wrong for containers; switch GC mode",
    ],
    correct: 1,
    explain:
      "Linear-with-uptime growth plus listener registration logs = leak. Every request (or reconnect) registers another subscriber that's never removed. Raising limits just delays the OOM; the fix is unsubscribe-on-close and deduplicating subscriptions per pod.",
    fixes: [
      "Unsubscribe on connection/request teardown; assert one subscription per topic per process",
      "Alert on RSS/limit ratio > 80% sustained — catch this before OOM",
      "Canary the fix and watch memory slope flatten over 24h",
    ],
  },
  {
    id: "f4",
    title: "Region failover left users logged out",
    severity: "SEV-3",
    brief:
      "During a routine region evacuation, users in EU got logged out and lost carts for ~10 minutes. No data loss was expected — sessions live in Redis.",
    graph: {
      nodes: [
        { id: "glb", label: "Global LB", sub: "failed over → eu", kind: "infra", x: 20, y: 110 },
        { id: "us", label: "US Redis", sub: "unreachable", kind: "cache", x: 260, y: 40, state: "down" },
        { id: "eu", label: "EU Redis", sub: "empty session set", kind: "cache", x: 260, y: 180 },
        { id: "api", label: "EU API", sub: "auth failing 401", kind: "app", x: 490, y: 180 },
      ],
      edges: [
        { from: "glb", to: "eu" },
        { from: "api", to: "eu", label: "session lookup MISS" },
        { from: "us", to: "eu", label: "replication", dashed: true },
      ],
    },
    symptoms: [
      "Sessions were written ONLY to the us-east Redis",
      "Replication was configured async with no monitoring on lag",
      "Failover runbook assumed 'state is replicated'",
    ],
    logs: [
      `glb: health(us-east)=FAIL routing 100% → eu-west`,
      `eu/api: INFO session miss sid=8f2c… → 401`,
      `eu/redis: INFO connected role=replica read-only=YES`,
      `oncall: ERROR eu redis still REPLICATION PENDING — serving without sessions`,
    ],
    metrics: [
      { label: "Session hit rate (eu)", value: "0% for 10 min", bad: true },
      { label: "401 rate", value: "+400×", bad: true },
      { label: "Cart writes", value: "rejected", bad: true },
      { label: "US→EU repl lag", value: "unbounded", bad: true },
    ],
    options: [
      "DNS TTL was too high; lower it to 30 seconds",
      "Sessions were single-region by design; replication existed only as config, never validated — failover served from an empty replica",
      "JWT tokens expired during the failover window",
      "EU API pods were missing the session encryption key secret",
    ],
    correct: 1,
    explain:
      "This is a disaster-recovery lie: the runbook claimed multi-region state, but nothing verified replica lag or promotion readiness. The system failed exactly where it was never tested. DR without drills is documentation fiction.",
    fixes: [
      "Make sessions regional-sticky OR replicate with monitored lag + promotion automation",
      "GameDay the evacuation quarterly; alert when any replica lags > 5s",
      "Prefer stateless auth (signed JWT + revocation list) to make regions interchangeable",
    ],
  },
  {
    id: "f5",
    title: "Queue lag exploded after a viral campaign",
    severity: "SEV-2",
    brief:
      "Marketing launched a flash sale. Orders flow fine, but notification emails arrive hours late and inventory shows stale numbers.",
    graph: {
      nodes: [
        { id: "api", label: "Order API", sub: "healthy", kind: "app", x: 20, y: 120 },
        { id: "k", label: "Kafka", sub: "lag 4.2M msgs", kind: "queue", x: 240, y: 120, state: "hot" },
        { id: "w1", label: "Email worker ×2", kind: "app", x: 470, y: 50 },
        { id: "inv", label: "Inventory projector", sub: "1 consumer", kind: "app", x: 470, y: 190 },
        { id: "pg", label: "Postgres", kind: "data", x: 700, y: 120 },
      ],
      edges: [
        { from: "api", to: "k", label: "10× normal volume" },
        { from: "k", to: "w1" },
        { from: "k", to: "inv" },
        { from: "inv", to: "pg" },
      ],
    },
    symptoms: [
      "Consumer group `inventory-proj`: 1 consumer, 6 partitions, lag growing",
      "Email workers scale on CPU (fine) but their downstream SMTP provider throttles",
      "No alerts fired until customers complained",
    ],
    logs: [
      `kafka: consumer-group inventory-proj total-lag=4_213_882`,
      `inventory-proj: INFO processed offset=88_441/92_654 partition=3`,
      `email-worker: WARN smtp 454 throttled retry_after=300s batch=210`,
      `alerts: (none configured for consumer lag)`,
    ],
    metrics: [
      { label: "Inventory lag", value: "4.2M messages", bad: true },
      { label: "Inventory consumers", value: "1 of 6 possible", bad: true },
      { label: "Email delay", value: "3–5 hours", bad: true },
      { label: "Order API success", value: "99.98%", bad: false },
    ],
    options: [
      "Kafka brokers are overloaded; add broker nodes",
      "Consumers were sized for average load with no headroom: 1 consumer for 6 partitions caps throughput; scale consumers and alert on lag",
      "Postgres write throughput collapsed; shard inventory tables",
      "Producers should batch more aggressively to reduce topic pressure",
    ],
    correct: 1,
    explain:
      "The API tier is healthy — this is pure consumer-side starvation. One consumer processes partitions serially while six sit idle. Broker scaling won't help. The systemic gap: nobody alerted on lag, so a known-scaling property became a customer-visible incident.",
    fixes: [
      "Scale consumers toward partition count (or KEDA on lag); over-partition topics from day one",
      "Alert: lag > threshold for > 5 min; page on sustained growth",
      "For email: queue-shape awareness — provider throttling needs its own buffer and pacing",
    ],
  },
];

export function FailuresClient() {
  const [openId, setOpenId] = useState<string | null>("f1");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const { recordQuiz } = useProgress();

  return (
    <div className="space-y-4">
      {SCENARIOS.map((sc) => {
        const open = openId === sc.id;
        const answered = answers[sc.id] !== undefined;
        const isRight = answered && answers[sc.id] === sc.correct;
        return (
          <article key={sc.id} className={cn("overflow-hidden rounded-xl border bg-surface transition-colors", open ? "border-line-strong shadow-node" : "border-line")}>
            <button
              onClick={() => setOpenId(open ? null : sc.id)}
              aria-expanded={open}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-left"
            >
              <div>
                <span className={cn(
                  "mr-2 inline-block rounded-md border px-1.5 py-0.5 font-mono text-2xs align-middle",
                  sc.severity === "SEV-1" ? "border-danger-border bg-danger-soft text-danger-ink" : sc.severity === "SEV-2" ? "border-warn-border bg-warn-soft text-warn-ink" : "border-line bg-zinc-100 text-ink-mute"
                )}>
                  {sc.severity}
                </span>
                <span className="text-[15px] font-medium text-ink">{sc.title}</span>
              </div>
              <span className="font-mono text-2xs text-ink-faint">{answered ? (isRight ? "diagnosed ✓" : "reviewed") : "open case file"}</span>
            </button>

            {open && (
              <div className="animate-fadeUp border-t border-line">
                <div className="grid lg:grid-cols-[1fr_360px]">
                  <div className="border-b border-line lg:border-b-0 lg:border-r">
                    <ArchCanvas graph={sc.graph} height={230} mode="static" />
                    <div className="space-y-1 px-4 py-3 font-mono text-2xs leading-relaxed">
                      {sc.logs.map((l, i) => {
                        const isError = l.includes("ERROR");
                        const isWarn = l.includes("WARN");
                        return (
                          <div key={i} className={cn(isError ? "text-danger" : isWarn ? "text-warn" : "text-ink-mute")}>
                            {l}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <section>
                      <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Symptoms</h3>
                      <ul className="mt-1.5 space-y-1">
                        {sc.symptoms.map((s, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-soft">
                            <span className="text-danger">▸</span> {s}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-mono text-2xs uppercase tracking-widest text-ink-faint">Key metrics</h3>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {sc.metrics.map((m) => (
                          <div key={m.label} className={cn("rounded-lg border px-2 py-1.5", m.bad ? "border-danger-border bg-danger-soft/60" : "border-line bg-zinc-50")}>
                            <div className="text-2xs text-ink-faint">{m.label}</div>
                            <div className={cn("tabular font-mono text-xs font-semibold", m.bad ? "text-danger-ink" : "text-ok-ink")}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                {/* diagnosis */}
                <div className="border-t border-line bg-zinc-50/60 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-ink">Your diagnosis</h3>
                  <div className="flex flex-col gap-1.5">
                    {sc.options.map((opt, i) => {
                      const chosen = answers[sc.id] === i;
                      const revealOk = answered && i === sc.correct;
                      const revealBad = answered && chosen && i !== sc.correct;
                      return (
                        <button
                          key={i}
                          disabled={answered}
                          onClick={() => {
                            setAnswers((a) => ({ ...a, [sc.id]: i }));
                            if (i === sc.correct) recordQuiz(`failure-${sc.id}`, 1, 1);
                            else recordQuiz(`failure-${sc.id}`, 0, 1);
                          }}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-left text-[13px] leading-snug transition-colors",
                            !answered && "border-line hover:border-accent hover:bg-accent-soft/40",
                            revealOk && "border-ok-border bg-ok-soft",
                            revealBad && "border-danger-border bg-danger-soft",
                            answered && !revealOk && !revealBad && "border-line opacity-55"
                          )}
                        >
                          {revealOk ? "✓ " : revealBad ? "✕ " : ""}
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {answered && (
                    <div className={cn("animate-fadeUp mt-3 rounded-lg border p-4", isRight ? "border-ok-border bg-ok-soft" : "border-danger-border bg-danger-soft")}>
                      <div className={cn("text-xs font-semibold", isRight ? "text-ok-ink" : "text-danger-ink")}>
                        {isRight ? "Correct diagnosis" : "Not quite — here's what happened"}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{sc.explain}</p>
                      <ul className="mt-2 space-y-1">
                        {sc.fixes.map((f, i) => (
                          <li key={i} className="flex gap-2 text-[13px] text-ink-mute">
                            <span className="text-accent">→</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
