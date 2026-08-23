import type { Graph } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Instagram — architecture evolution V1 → V10                        */
/* ------------------------------------------------------------------ */

export interface CaseStudyVersion {
  id: string;
  label: string;
  scale: string;
  trigger: string; // what forces this change
  notes: string[];
  graph: Graph;
}

const v = (id: string, label: string, scale: string, trigger: string, notes: string[], nodes: Graph["nodes"], edges: Graph["edges"]): CaseStudyVersion => ({
  id,
  label,
  scale,
  trigger,
  notes,
  graph: { nodes, edges },
});

export const INSTAGRAM_VERSIONS: CaseStudyVersion[] = [
  v(
    "v1",
    "V1 · One server",
    "100 users",
    "You're building the thing.",
    [
      "One box runs the app, Postgres and image files on disk. This is correct — ship value, learn, iterate.",
      "The only non-negotiable even now: daily backups and a way to restore them.",
    ],
    [
      { id: "u", label: "Users", kind: "client", x: 20, y: 110 },
      { id: "app", label: "Monolith", sub: "app + uploads", kind: "app", x: 240, y: 110 },
      { id: "pg", label: "PostgreSQL", sub: "+ images on disk", kind: "data", x: 480, y: 110 },
    ],
    [
      { from: "u", to: "app" },
      { from: "app", to: "pg" },
    ]
  ),
  v(
    "v2",
    "V2 · Split the database",
    "5K users",
    "App and DB fight for the same RAM and CPU; deploys briefly take the DB down.",
    [
      "Dedicated database host: each tier scales and fails independently.",
      "Images move to local disk on the app host — temporary, but already a smell.",
    ],
    [
      { id: "u", label: "Users", kind: "client", x: 20, y: 110 },
      { id: "app", label: "App server", kind: "app", x: 230, y: 110 },
      { id: "pg", label: "PostgreSQL", sub: "dedicated host", kind: "data", x: 460, y: 110 },
    ],
    [
      { from: "u", to: "app" },
      { from: "app", to: "pg" },
    ]
  ),
  v(
    "v3",
    "V3 · Load balancer + stateless",
    "50K users",
    "One app box caps throughput; every deploy is downtime; one crash is an outage.",
    [
      "Two+ app servers behind an LB. Sessions move out of process memory into signed cookies — services become truly stateless.",
      "Rolling deploys become possible: drain one instance while the LB routes around it.",
    ],
    [
      { id: "u", label: "Users", kind: "client", x: 20, y: 120 },
      { id: "lb", label: "Load Balancer", kind: "app", x: 210, y: 120 },
      { id: "a1", label: "App #1", kind: "app", x: 420, y: 40 },
      { id: "a2", label: "App #2", kind: "app", x: 420, y: 200 },
      { id: "pg", label: "PostgreSQL", kind: "data", x: 640, y: 120 },
    ],
    [
      { from: "u", to: "lb" },
      { from: "lb", to: "a1" },
      { from: "lb", to: "a2" },
      { from: "a1", to: "pg" },
      { from: "a2", to: "pg" },
    ]
  ),
  v(
    "v4",
    "V4 · Object storage + CDN",
    "500K users",
    "Disk fills; serving images from app boxes steals their CPU; cross-continent latency is painful.",
    [
      "Uploads go to object storage via presigned URLs — app servers never touch bytes.",
      "A processor worker generates resolution variants; the CDN serves them globally.",
      "Egress drops off your origin entirely; this decision alone buys years.",
    ],
    [
      { id: "u", label: "Users", kind: "client", x: 20, y: 130 },
      { id: "cdn", label: "CDN", kind: "cache", x: 210, y: 40 },
      { id: "lb", label: "LB", kind: "app", x: 210, y: 220 },
      { id: "api", label: "API", kind: "app", x: 410, y: 220 },
      { id: "s3", label: "Object Store", sub: "originals + variants", kind: "data", x: 650, y: 130 },
      { id: "wk", label: "Processor", sub: "resize pipeline", kind: "app", x: 880, y: 220 },
      { id: "pg", label: "PostgreSQL", kind: "data", x: 650, y: 300 },
    ],
    [
      { from: "u", to: "cdn" },
      { from: "cdn", to: "s3", label: "cache miss" },
      { from: "u", to: "lb" },
      { from: "lb", to: "api" },
      { from: "api", to: "s3", label: "presigned PUT" },
      { from: "api", to: "wk", dashed: true, label: "enqueue variants" },
      { from: "wk", to: "s3" },
      { from: "api", to: "pg" },
    ]
  ),
  v(
    "v5",
    "V5 · Cache the hot reads",
    "2M users",
    "Feed reads hammer Postgres; p99 latency grows with popularity of a few posts.",
    [
      "Redis cache-aside for profiles, post metadata and like counts (reads).",
      "90%+ hit rate removes almost all read load from the primary.",
      "TTLs with jitter; negative caching against scrapers probing dead post IDs.",
    ],
    [
      { id: "u", label: "Users", kind: "client", x: 20, y: 120 },
      { id: "lb", label: "LB", kind: "app", x: 190, y: 120 },
      { id: "api", label: "API ×N", kind: "app", x: 370, y: 120 },
      { id: "rc", label: "Redis", sub: "hot reads", kind: "cache", x: 600, y: 30 },
      { id: "pg", label: "PostgreSQL", kind: "data", x: 600, y: 210 },
    ],
    [
      { from: "u", to: "lb" },
      { from: "lb", to: "api" },
      { from: "api", to: "rc", label: "read path" },
      { from: "api", to: "pg", label: "misses + writes" },
    ]
  ),
  v(
    "v6",
    "V6 · Read replicas",
    "10M users",
    "Even after caching, cache misses + analytics queries saturate the primary's CPU.",
    [
      "Streaming replicas absorb read traffic; primary does writes only.",
      "Read-your-writes: pin a user's reads to the primary briefly after they post.",
      "Analytics moves to a dedicated replica so reports never touch user-facing paths.",
    ],
    [
      { id: "u", label: "Users", kind: "client", x: 20, y: 120 },
      { id: "lb", label: "LB", kind: "app", x: 180, y: 120 },
      { id: "api", label: "API ×N", kind: "app", x: 350, y: 120 },
      { id: "rc", label: "Redis", kind: "cache", x: 560, y: 20 },
      { id: "pm", label: "Primary", sub: "writes only", kind: "data", x: 570, y: 130 },
      { id: "r1", label: "Replica", sub: "misses", kind: "data", x: 790, y: 80 },
      { id: "r2", label: "Replica", sub: "analytics", kind: "data", x: 790, y: 190 },
    ],
    [
      { from: "u", to: "lb" },
      { from: "lb", to: "api" },
      { from: "api", to: "rc" },
      { from: "api", to: "pm" },
      { from: "pm", to: "r1", label: "WAL" },
      { from: "pm", to: "r2", label: "WAL" },
    ]
  ),
  v(
    "v7",
    "V7 · Queue everything slow",
    "30M users",
    "Likes, follows and notifications do synchronous work per request; celebrity events cause brownouts.",
    [
      "Kafka between API and side effects: notifications, fan-out jobs, counters, analytics.",
      "The request path shrinks to: validate → write event → ack. Everything else catches up async.",
      "Consumer lag becomes your backpressure signal — alert on growth, not CPU.",
    ],
    [
      { id: "u", label: "Users", kind: "client", x: 20, y: 120 },
      { id: "api", label: "API ×N", kind: "app", x: 200, y: 120 },
      { id: "k", label: "Kafka", sub: "engagement.events", kind: "queue", x: 430, y: 120 },
      { id: "w1", label: "Notif workers", kind: "app", x: 670, y: 30 },
      { id: "w2", label: "Counter workers", sub: "batched likes", kind: "app", x: 670, y: 120 },
      { id: "w3", label: "Fanout workers", sub: "timelines", kind: "app", x: 670, y: 210 },
      { id: "pg", label: "PostgreSQL", kind: "data", x: 900, y: 120 },
    ],
    [
      { from: "u", to: "api" },
      { from: "api", to: "k", label: "produce & ack" },
      { from: "k", to: "w1" },
      { from: "k", to: "w2" },
      { from: "k", to: "w3" },
      { from: "w2", to: "pg" },
      { from: "w3", to: "pg" },
    ]
  ),
  v(
    "v8",
    "V8 · Shard the write path",
    "100M users",
    "Write QPS and dataset exceed any single primary; vacuum and index sizes hurt.",
    [
      "Shard media metadata by post_id hash; shard social graph by user_id.",
      "Co-location rule: a user's follow edges live together — profile reads stay single-shard.",
      "Celebrity accounts get dedicated treatment (their fan-out is its own system).",
    ],
    [
      { id: "api", label: "API tier", kind: "app", x: 20, y: 140 },
      { id: "rt", label: "Routing tier", sub: "shard map", kind: "infra", x: 220, y: 140 },
      { id: "s0", label: "Shard 0", sub: "users A–F", kind: "data", x: 450, y: 40 },
      { id: "s1", label: "Shard 1", sub: "users G–N", kind: "data", x: 450, y: 140 },
      { id: "s2", label: "Shard 2", sub: "users O–Z", kind: "data", x: 450, y: 240 },
      { id: "ms", label: "Media store", sub: "object storage", kind: "data", x: 700, y: 140 },
    ],
    [
      { from: "api", to: "rt" },
      { from: "rt", to: "s0" },
      { from: "rt", to: "s1" },
      { from: "rt", to: "s2" },
      { from: "s0", to: "ms", dashed: true },
      { from: "s1", to: "ms", dashed: true },
    ]
  ),
  v(
    "v9",
    "V9 · Observability everywhere",
    "150M users",
    "Incidents are diagnosed by folklore; every outage starts with 'it's slow somewhere'.",
    [
      "RED metrics per endpoint, sliced by region and instance class.",
      "OpenTelemetry traces across gateway → api → cache → db with exemplars linking dashboards to traces.",
      "SLO burn-rate alerts page on user pain, not CPU symptoms. Error budgets gate releases.",
    ],
    [
      { id: "svc", label: "Services", kind: "app", x: 20, y: 120 },
      { id: "otel", label: "OTel Collector", kind: "infra", x: 250, y: 40 },
      { id: "prom", label: "Prometheus", sub: "metrics", kind: "data", x: 500, y: 20 },
      { id: "tempo", label: "Tempo / Jaeger", sub: "traces", kind: "data", x: 500, y: 120 },
      { id: "loki", label: "Loki", sub: "logs", kind: "data", x: 500, y: 220 },
      { id: "graf", label: "Grafana + alerts", kind: "infra", x: 750, y: 120 },
    ],
    [
      { from: "svc", to: "otel" },
      { from: "otel", to: "prom" },
      { from: "otel", to: "tempo" },
      { from: "otel", to: "loki" },
      { from: "prom", to: "graf" },
      { from: "tempo", to: "graf", dashed: true },
      { from: "loki", to: "graf", dashed: true },
    ]
  ),
  v(
    "v10",
    "V10 · Production-grade platform",
    "500M users",
    "Regional outages are unacceptable; the world expects the app to just work.",
    [
      "Multi-region active-active reads with regional failover; DNS/anycast steering.",
      "Data replicated cross-region asynchronously; conflict policy chosen per data type.",
      "Chaos drills quarterly: region evacuation rehearsed, not improvised.",
    ],
    [
      { id: "glb", label: "Global LB", sub: "anycast + health routing", kind: "infra", x: 20, y: 130 },
      { id: "r1e", label: "Region US-East", sub: "full stack", kind: "app", x: 260, y: 40 },
      { id: "r1w", label: "Region EU-West", sub: "full stack", kind: "app", x: 260, y: 220 },
      { id: "d1", label: "Data tier", sub: "replicated", kind: "data", x: 520, y: 40 },
      { id: "d2", label: "Data tier", sub: "replicated", kind: "data", x: 520, y: 220 },
      { id: "x", label: "async replication", kind: "infra", x: 740, y: 130 },
    ],
    [
      { from: "glb", to: "r1e" },
      { from: "glb", to: "r1w" },
      { from: "r1e", to: "d1" },
      { from: "r1w", to: "d2" },
      { from: "d1", to: "x", dashed: true },
      { from: "d2", to: "x", dashed: true },
    ]
  ),
];

/* ------------------------------------------------------------------ */
/*  Zomato-like ordering — order lifecycle                             */
/* ------------------------------------------------------------------ */

export interface OrderState {
  id: string;
  label: string;
  actor: "customer" | "payment" | "restaurant" | "driver" | "system";
  note: string;
}

export const ORDER_STATES: OrderState[] = [
  { id: "CREATED", label: "CREATED", actor: "customer", note: "Cart committed. Idempotency key issued — retries can't double-order." },
  { id: "PAYMENT_PENDING", label: "PAYMENT_PENDING", actor: "payment", note: "Payment intent created at PSP. Webhooks will confirm." },
  { id: "PAID", label: "PAID", actor: "payment", note: "Money captured. Saga step 1 done; compensation = refund." },
  { id: "RESTAURANT_CONFIRMED", label: "RESTAURANT_CONFIRMED", actor: "restaurant", note: "Accept window ~2min. Timeout auto-cancels + refund." },
  { id: "PREPARING", label: "PREPARING", actor: "restaurant", note: "Kitchen ticket printed. ETA estimates stream to customer." },
  { id: "READY", label: "READY", actor: "restaurant", note: "Driver matching starts if not already assigned." },
  { id: "PICKED_UP", label: "PICKED_UP", actor: "driver", note: "Location pings begin (WebSocket, every 3–5s)." },
  { id: "DELIVERED", label: "DELIVERED", actor: "driver", note: "Terminal state. Ratings open; settlement jobs run async." },
];

export const ORDER_FAILURES: { title: string; symptom: string; rootCause: string; fix: string }[] = [
  {
    title: "Payment captured but order stuck in PAYMENT_PENDING",
    symptom: "Customers charged; restaurant never sees order; support tickets spike.",
    rootCause:
      "PSP webhook arrived before the order service finished committing its transaction — classic dual-write race between payment record and order state.",
    fix: "Transactional outbox: order service owns the state transition AND publishes OrderPaid in the same DB commit. Payment webhooks update payment status only; saga reacts to events, not webhooks directly.",
  },
  {
    title: "Restaurant accepted; then service deploy killed the confirmation",
    symptom: "Restaurant tablet shows 'accepted', customer app shows 'waiting' forever.",
    rootCause: "Accept action wrote to restaurant DB and published Kafka event as two separate operations; pod died between them.",
    fix: "Outbox again — plus consumer-side inbox dedup so replays are harmless. The accept flow becomes: tx(accept + outbox) → relay publishes → order saga consumes idempotently.",
  },
  {
    title: "Driver location updates flood the system during dinner rush",
    symptom: "Kafka consumer lag grows unbounded; live tracking feels minutes behind.",
    rootCause: "Every ping (per driver per 3s) fanned out synchronously to tracking store + customer WebSocket + ETA model.",
    fix: "Batch location ingestion: latest-value semantics in Redis GEO (not append-everything), sample customer-visible updates to every ~5s, and scale consumers on lag (KEDA).",
  },
  {
    title: "Duplicate orders after mobile client retry",
    symptom: "Two identical orders seconds apart; both charged.",
    rootCause: "Client retried POST /orders on timeout; no idempotency key honored server-side.",
    fix: "Require Idempotency-Key on order creation; store key→order_id uniquely; replay original response on duplicates. The CREATED state issues the key before payment begins.",
  },
  {
    title: "Kafka unavailable → checkout totally down?",
    symptom: "During broker maintenance, new orders fail entirely though Postgres is healthy.",
    rootCause: "Order creation synchronously produced to Kafka inside the request path — availability coupled to the broker.",
    fix: "Only the OUTBOX RELAY talks to Kafka. Checkout needs only its own DB. Broker outage delays side effects, never blocks orders.",
  },
];

export const ZOMATO_GRAPH: Graph = {
  nodes: [
    { id: "c", label: "Customer App", kind: "client", x: 20, y: 60 },
    { id: "gw", label: "API Gateway", sub: "auth · rate limits", kind: "app", x: 210, y: 60 },
    { id: "ord", label: "Order Service", sub: "saga conductor", kind: "app", x: 430, y: 60 },
    { id: "pay", label: "Payment Service", kind: "app", x: 660, y: 15 },
    { id: "rest", label: "Restaurant Service", kind: "app", x: 660, y: 105 },
    { id: "drv", label: "Driver Service", sub: "matching · GPS ingest", kind: "app", x: 660, y: 195 },
    { id: "pg", label: "Postgres per svc", sub: "own data, own tx", kind: "data", x: 890, y: 105 },
    { id: "k", label: "Kafka", sub: "order.events", kind: "queue", x: 430, y: 170 },
    { id: "ws", label: "Tracking (WS)", sub: "live driver location", kind: "app", x: 210, y: 170 },
  ],
  edges: [
    { from: "c", to: "gw" },
    { from: "gw", to: "ord" },
    { from: "ord", to: "pay", label: "charge cmd" },
    { from: "ord", to: "rest", label: "confirm cmd" },
    { from: "rest", to: "drv", label: "assign" },
    { from: "pay", to: "pg" },
    { from: "rest", to: "pg" },
    { from: "drv", to: "pg" },
    { from: "ord", to: "k", label: "state changes" },
    { from: "k", to: "ws", label: "consume" },
    { from: "drv", to: "ws", label: "pings", dashed: true },
  ],
};
