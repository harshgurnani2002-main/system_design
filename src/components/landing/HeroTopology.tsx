"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchCanvas, DiagramLegend } from "@/components/diagram/ArchCanvas";
import { RequestFlowPlayer, type FlowStep } from "@/components/diagram/RequestFlowPlayer";
import type { Graph, DiagramNode } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  System Preset 1: Global SaaS & Microservices (Default)            */
/* ------------------------------------------------------------------ */

const SAAS_GRAPH: Graph = {
  nodes: [
    { id: "browser", label: "Client Browser", sub: "Web · Mobile · API", kind: "client", x: 20, y: 160 },
    { id: "dns", label: "Anycast DNS", sub: "Geo-routed ~5ms", kind: "infra", x: 200, y: 30 },
    { id: "cdn", label: "Edge CDN PoP", sub: "Cloudflare / Fastly", kind: "cache", x: 200, y: 290 },
    { id: "lb", label: "API Gateway / LB", sub: "TLS · Auth · Rate Limit", kind: "app", x: 390, y: 160 },
    { id: "api", label: "Microservices", sub: "Stateless Cluster ×N", kind: "app", x: 590, y: 160 },
    { id: "redis", label: "Redis Cluster", sub: "Sessions · Hot Reads ~1ms", kind: "cache", x: 790, y: 30 },
    { id: "pg", label: "PostgreSQL Primary", sub: "ACID · Multi-AZ Replica", kind: "data", x: 790, y: 290 },
    { id: "kafka", label: "Kafka Event Log", sub: "Durable · Partitioned", kind: "queue", x: 990, y: 80 },
    { id: "workers", label: "Async Workers", sub: "Transcoding · Notifications", kind: "app", x: 990, y: 250 },
  ],
  edges: [
    { from: "browser", to: "dns", label: "lookup", dashed: true },
    { from: "browser", to: "cdn", label: "static assets", flow: true },
    { from: "browser", to: "lb", label: "HTTPS /api/*", flow: true },
    { from: "cdn", to: "lb", label: "cache miss", dashed: true },
    { from: "lb", to: "api", label: "least-conn route", flow: true },
    { from: "api", to: "redis", label: "cache check ~1ms", flow: true },
    { from: "api", to: "pg", label: "writes / 5% miss" },
    { from: "api", to: "kafka", label: "emit event", flow: true },
    { from: "kafka", to: "workers", label: "consume batch", flow: true },
  ],
  flows: [
    { id: "saas-assets", path: ["browser", "cdn"], color: "#16A34A", speed: 360 },
    { id: "saas-api", path: ["browser", "lb", "api", "redis"], color: "#2563EB", speed: 320 },
    { id: "saas-db", path: ["api", "pg"], color: "#7C3AED", speed: 220 },
    { id: "saas-events", path: ["api", "kafka", "workers"], color: "#EA580C", speed: 270 },
  ],
};

const SAAS_TRACE_STEPS = [
  {
    title: "1. Client → Anycast DNS",
    detail: "The client resolves api.platform.com via Anycast DNS, routing to the nearest edge PoP in under 10ms.",
    edge: ["browser", "dns"] as [string, string],
    tag: "~5ms",
  },
  {
    title: "2. Client → Edge CDN PoP",
    detail: "Static images, JS/CSS bundles, and cached public GET responses are terminated at the edge with a 94% cache hit rate.",
    edge: ["browser", "cdn"] as [string, string],
    tag: "CACHE HIT 94%",
  },
  {
    title: "3. Client → API Gateway & Load Balancer",
    detail: "Dynamic mutations and uncached endpoints pass through the API Gateway for JWT authentication, DDoS scrubbing, and token-bucket rate limiting.",
    edge: ["browser", "lb"] as [string, string],
    tag: "TLS + AUTH",
  },
  {
    title: "4. Load Balancer → Stateless Microservices",
    detail: "Consistent hashing or least-connections routing distributes traffic to healthy stateless application pods.",
    edge: ["lb", "api"] as [string, string],
  },
  {
    title: "5. API → Redis Cluster (Hot Reads)",
    detail: "In-memory cache returns session tokens, user profiles, and active feeds in ~0.8ms, protecting databases from read overload.",
    edge: ["api", "redis"] as [string, string],
    tag: "HOT READ ~0.8ms",
  },
  {
    title: "6. API → PostgreSQL Primary (Durable Writes)",
    detail: "Transactional writes and cache misses hit PostgreSQL with write-ahead logging (WAL) and streaming replication to standby nodes.",
    edge: ["api", "pg"] as [string, string],
    tag: "ACID WRITE",
  },
  {
    title: "7. API → Kafka Event Log",
    detail: "Non-critical side effects (audit logging, welcome emails, analytics) are published asynchronously as immutable event records.",
    edge: ["api", "kafka"] as [string, string],
    tag: "ASYNC PUB",
  },
  {
    title: "8. Kafka → Background Workers",
    detail: "Horizontally scalable worker fleets consume event partitions in parallel, isolating CPU-heavy processing from user latency.",
    edge: ["kafka", "workers"] as [string, string],
  },
];

/* ------------------------------------------------------------------ */
/*  System Preset 2: Instagram 1M Likes Storm                         */
/* ------------------------------------------------------------------ */

const INSTA_GRAPH: Graph = {
  nodes: [
    { id: "users", label: "1,000,000 Users", sub: "Viral Celebrity Post", kind: "client", x: 20, y: 160 },
    { id: "gateway", label: "Cloudflare Edge", sub: "TLS · Spike Absorber", kind: "infra", x: 220, y: 160 },
    { id: "apifleet", label: "Stateless Ingress", sub: "POST /posts/:id/like", kind: "app", x: 430, y: 160 },
    { id: "sharded_redis", label: "Sharded Redis", sub: "100 Counter Buckets", kind: "cache", x: 650, y: 50 },
    { id: "kafka_batch", label: "Kafka Like Stream", sub: "Batch Flush 100ms", kind: "queue", x: 650, y: 270 },
    { id: "agg_worker", label: "Batch Aggregator", sub: "Folds 50k → 1 write", kind: "app", x: 870, y: 270 },
    { id: "pg_shards", label: "PostgreSQL Shards", sub: "Batched Counter Increment", kind: "data", x: 870, y: 50 },
  ],
  edges: [
    { from: "users", to: "gateway", label: "50,000 likes/sec", flow: true },
    { from: "gateway", to: "apifleet", label: "fanout", flow: true },
    { from: "apifleet", to: "sharded_redis", label: "INCRBY bucket", flow: true },
    { from: "apifleet", to: "kafka_batch", label: "like event", flow: true },
    { from: "kafka_batch", to: "agg_worker", label: "read batch", flow: true },
    { from: "agg_worker", to: "pg_shards", label: "UPDATE likes = likes + N" },
    { from: "sharded_redis", to: "pg_shards", label: "async flush", dashed: true },
  ],
  flows: [
    { id: "insta-traffic", path: ["users", "gateway", "apifleet"], color: "#2563EB", speed: 420 },
    { id: "insta-redis", path: ["apifleet", "sharded_redis"], color: "#16A34A", speed: 380 },
    { id: "insta-batch", path: ["apifleet", "kafka_batch", "agg_worker", "pg_shards"], color: "#EA580C", speed: 300 },
  ],
};

const INSTA_TRACE_STEPS = [
  {
    title: "1. 1M Users Like Viral Post Simultaneously",
    detail: "Celebrity posts photo. Traffic spikes from 200 likes/sec to 65,000 likes/sec within 10 seconds.",
    edge: ["users", "gateway"] as [string, string],
    tag: "65,000 QPS",
  },
  {
    title: "2. Cloudflare Edge TLS Termination",
    detail: "Edge absorbs connection storm and verifies basic client authenticity before reaching internal networks.",
    edge: ["gateway", "apifleet"] as [string, string],
  },
  {
    title: "3. Direct Database Writes Would Crash Postgres (Hot-Key Row Lock)",
    detail: "If 65,000 concurrent threads try to 'UPDATE posts SET likes = likes + 1 WHERE id = 123', row-level locking causes connection pool starvation and database death.",
    nodes: ["apifleet"],
    tag: "BOTTLENECK AVOIDED",
  },
  {
    title: "4. Sharded Redis Counter Buckets",
    detail: "Instead of 1 counter, we shard into 100 sub-keys: 'post:123:likes:bucket_42'. INCR operations run in sub-millisecond RAM with zero contention.",
    edge: ["apifleet", "sharded_redis"] as [string, string],
    tag: "~0.4ms RAM",
  },
  {
    title: "5. Kafka Batch Aggregation Pipeline",
    detail: "Likes stream into Kafka. The Batch Aggregator folds 50,000 individual like events into a single database update query every 2 seconds.",
    edge: ["kafka_batch", "agg_worker"] as [string, string],
    tag: "50,000:1 REDUCTION",
  },
  {
    title: "6. Single Batched Write to PostgreSQL",
    detail: "The database executes 1 query: 'UPDATE posts SET likes = likes + 49820'. Postgres operates at 5% CPU with rock-solid stability.",
    edge: ["agg_worker", "pg_shards"] as [string, string],
    tag: "STABLE & SCALED",
  },
];

/* ------------------------------------------------------------------ */
/*  System Preset 3: Uber Geospatial Dispatch                         */
/* ------------------------------------------------------------------ */

const UBER_GRAPH: Graph = {
  nodes: [
    { id: "riders", label: "Riders & Drivers", sub: "GPS Pings every 4s", kind: "client", x: 20, y: 160 },
    { id: "ws_gw", label: "WebSocket Gateway", sub: "5M Persistent TCP Conns", kind: "infra", x: 230, y: 160 },
    { id: "geo_redis", label: "Geospatial Redis", sub: "H3 / S2 Hexagon Cells", kind: "cache", x: 470, y: 40 },
    { id: "match_eng", label: "Matching Engine", sub: "ETA & Supply Optimizer", kind: "app", x: 470, y: 280 },
    { id: "kafka_trip", label: "Trip Event Stream", sub: "State Transitions", kind: "queue", x: 720, y: 160 },
    { id: "dispatch_db", label: "Distributed Store", sub: "Cassandra / Spanner", kind: "data", x: 950, y: 160 },
  ],
  edges: [
    { from: "riders", to: "ws_gw", label: "bidirectional TCP", flow: true },
    { from: "ws_gw", to: "geo_redis", label: "GEOADD lat/lng", flow: true },
    { from: "ws_gw", to: "match_eng", label: "request ride", flow: true },
    { from: "match_eng", to: "geo_redis", label: "GEORADIUS 2km", flow: true },
    { from: "match_eng", to: "kafka_trip", label: "dispatch offer", flow: true },
    { from: "kafka_trip", to: "dispatch_db", label: "persist trip state" },
  ],
  flows: [
    { id: "uber-gps", path: ["riders", "ws_gw", "geo_redis"], color: "#16A34A", speed: 380 },
    { id: "uber-match", path: ["ws_gw", "match_eng", "geo_redis"], color: "#2563EB", speed: 320 },
    { id: "uber-trip", path: ["match_eng", "kafka_trip", "dispatch_db"], color: "#7C3AED", speed: 260 },
  ],
};

const UBER_TRACE_STEPS = [
  {
    title: "1. 5M Drivers Stream GPS Coordinates Every 4 Seconds",
    detail: "Drivers send lightweight binary location packets via long-lived persistent WebSocket connections.",
    edge: ["riders", "ws_gw"] as [string, string],
    tag: "5M TCP CONNS",
  },
  {
    title: "2. Geospatial Indexing in Redis with Uber H3",
    detail: "Earth surface is tessellated into discrete hexagonal cells (Uber H3). Locations are stored in Redis geospatial sorted sets for O(log N) bounding-box queries.",
    edge: ["ws_gw", "geo_redis"] as [string, string],
    tag: "H3 HEXAGONS",
  },
  {
    title: "3. Rider Requests Pickup",
    detail: "Rider hits 'Request Ride'. The request reaches the Matching Engine with pickup latitude/longitude and destination.",
    edge: ["ws_gw", "match_eng"] as [string, string],
  },
  {
    title: "4. Spatial Query: GEORADIUS 2km",
    detail: "The Matching Engine queries Redis for all idle drivers in the rider's immediate and neighboring H3 hex cells in < 3ms.",
    edge: ["match_eng", "geo_redis"] as [string, string],
    tag: "<3ms RADIUS",
  },
  {
    title: "5. Dispatch Optimization & Offer Broadcast",
    detail: "Bipartite matching algorithm evaluates routing distance, traffic ETA, driver acceptance history, and pricing tiers.",
    edge: ["match_eng", "kafka_trip"] as [string, string],
    tag: "OPTIMAL MATCH",
  },
  {
    title: "6. Distributed State Machine Transition",
    detail: "The trip state advances: REQUESTED → OFFERED → ACCEPTED → ARRIVED → IN_PROGRESS → COMPLETED with idempotency across distributed storage.",
    edge: ["kafka_trip", "dispatch_db"] as [string, string],
    tag: "SAGA PATTERN",
  },
];

type PresetKey = "saas" | "instagram" | "uber";

const PRESETS: Record<
  PresetKey,
  {
    title: string;
    subtitle: string;
    graph: Graph;
    steps: FlowStep[];
    badge: string;
    qps: string;
    p99: string;
  }
> = {
  saas: {
    title: "Global Microservices & Caching",
    subtitle: "High-throughput web API with CDN edge, Redis cache layer & Kafka async event queue",
    graph: SAAS_GRAPH,
    steps: SAAS_TRACE_STEPS,
    badge: "Most Common Architecture",
    qps: "12,500 req/s",
    p99: "18ms",
  },
  instagram: {
    title: "Instagram 1M Likes Spike",
    subtitle: "Handling viral celebrity posts with sharded Redis counters & Kafka batch compaction",
    graph: INSTA_GRAPH,
    steps: INSTA_TRACE_STEPS,
    badge: "Hot-Key Contention Pattern",
    qps: "65,000 writes/s",
    p99: "4ms",
  },
  uber: {
    title: "Uber Geospatial Dispatch",
    subtitle: "5M concurrent WebSockets, H3 hex spatial indexing, and distributed saga state machines",
    graph: UBER_GRAPH,
    steps: UBER_TRACE_STEPS,
    badge: "Real-Time Spatial Systems",
    qps: "250,000 pings/s",
    p99: "12ms",
  },
};

export function HeroTopology() {
  const [activePreset, setActivePreset] = useState<PresetKey>("saas");
  const [mode, setMode] = useState<"live" | "trace">("live");
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);

  const current = PRESETS[activePreset];

  return (
    <section aria-label="Interactive Architecture Sandbox" className="relative">
      {/* Outer frame */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop transition-all">
        {/* Top Control Bar with Tabs */}
        <div className="border-b border-line bg-zinc-50/80 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* System Presets Tablist */}
            <div
              role="tablist"
              aria-label="System Architecture Presets"
              className="flex flex-wrap items-center gap-1.5 rounded-lg bg-zinc-200/60 p-1"
            >
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                const isSel = activePreset === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    id={`tab-${key}`}
                    aria-selected={isSel}
                    aria-controls={`panel-${key}`}
                    onClick={() => {
                      setActivePreset(key);
                      setSelectedNode(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-accent",
                      isSel
                        ? "bg-surface text-ink shadow-sm ring-1 ring-black/5 font-semibold"
                        : "text-ink-mute hover:text-ink hover:bg-surface/50"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        key === "saas" && "bg-blue-500",
                        key === "instagram" && "bg-amber-500",
                        key === "uber" && "bg-emerald-500"
                      )}
                      aria-hidden="true"
                    />
                    {key === "saas" && "Global Microservices"}
                    {key === "instagram" && "Instagram Like Storm"}
                    {key === "uber" && "Uber Geospatial"}
                  </button>
                );
              })}
            </div>

            {/* Mode Actions */}
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-2xs text-ink-mute sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-ok" />
                Live QPS: <strong className="text-ink">{current.qps}</strong>
              </span>

              <span className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-2xs text-ink-mute sm:inline-flex">
                P99: <strong className="text-accent-ink">{current.p99}</strong>
              </span>

              <div className="flex items-center rounded-lg border border-line bg-zinc-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("live")}
                  aria-pressed={mode === "live"}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    mode === "live"
                      ? "bg-surface text-accent font-semibold shadow-xs"
                      : "text-ink-mute hover:text-ink"
                  )}
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden>
                    <path d="M4 3.5v9l8-4.5-8-4.5z" />
                  </svg>
                  Live Traffic
                </button>
                <button
                  type="button"
                  onClick={() => setMode("trace")}
                  aria-pressed={mode === "trace"}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    mode === "trace"
                      ? "bg-surface text-accent font-semibold shadow-xs"
                      : "text-ink-mute hover:text-ink"
                  )}
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden>
                    <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" />
                  </svg>
                  Step-by-Step Trace
                </button>
              </div>
            </div>
          </div>

          {/* Subtitle / Context */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2 text-xs">
            <p className="text-ink-soft">
              <strong className="text-ink font-semibold">{current.title}</strong> — {current.subtitle}
            </p>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-2xs font-medium text-accent-ink">
              {current.badge}
            </span>
          </div>
        </div>

        {/* Diagram Canvas Body */}
        <div
          role="tabpanel"
          id={`panel-${activePreset}`}
          aria-labelledby={`tab-${activePreset}`}
          className="relative bg-paper grid-paper"
        >
          {mode === "live" ? (
            <div className="p-2">
              <ArchCanvas
                graph={current.graph}
                mode="explore"
                height={440}
                selectedId={selectedNode?.id}
                onSelectNode={(id) => {
                  const n = current.graph.nodes.find((item) => item.id === id) ?? null;
                  setSelectedNode(n);
                }}
                focusOnSelect
              />
              <div className="border-t border-line bg-surface/90 px-4 py-2">
                <DiagramLegend />
              </div>
            </div>
          ) : (
            <div className="p-2">
              <RequestFlowPlayer graph={current.graph} steps={current.steps} />
            </div>
          )}

          {/* Selected Node Inspector Drawer (Accessible Live Region) */}
          {selectedNode && mode === "live" && (
            <div
              className="animate-fadeUp border-t border-line bg-surface p-4 text-xs"
              role="region"
              aria-label={`Details for ${selectedNode.label}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink">{selectedNode.label}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-2xs uppercase text-ink-mute">
                      {selectedNode.kind}
                    </span>
                    {selectedNode.sub && (
                      <span className="text-ink-faint">({selectedNode.sub})</span>
                    )}
                  </div>
                  <p className="mt-1 text-ink-soft">
                    {selectedNode.info?.purpose ||
                      "Essential architectural component handling routing, data storage, or compute for this layer."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  aria-label="Close component details"
                  className="rounded-md border border-line px-2 py-1 text-2xs font-medium text-ink-mute hover:bg-zinc-100 hover:text-ink"
                >
                  ✕ Close
                </button>
              </div>

              {selectedNode.info && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedNode.info.latency && (
                    <div className="rounded-md border border-line-soft bg-zinc-50 p-2">
                      <span className="font-mono text-2xs uppercase text-ink-faint">Typical Latency: </span>
                      <span className="font-mono font-medium text-ink">{selectedNode.info.latency}</span>
                    </div>
                  )}
                  {selectedNode.info.why && (
                    <div className="rounded-md border border-accent-border bg-accent-soft p-2 text-accent-ink">
                      <strong className="font-medium">Why it&apos;s here: </strong>
                      {selectedNode.info.why}
                    </div>
                  )}
                  {selectedNode.info.fails && (
                    <div className="sm:col-span-2 rounded-md border border-danger-border bg-danger-soft p-2 text-danger-ink">
                      <strong className="font-medium">Failure Impact: </strong>
                      {selectedNode.info.fails}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-zinc-50/70 px-4 py-2.5 text-2xs text-ink-mute">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent animate-ping" aria-hidden />
            <span>Click any component on canvas to inspect engineering trade-offs and latency profiles</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/academy/simulator"
              className="font-medium text-accent hover:text-accent-hover hover:underline"
            >
              Open Full Traffic Simulator →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
