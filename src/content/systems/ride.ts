import type { CaseStudy } from "@/lib/caseTypes";

const n = (id: string, label: string, kind: CaseStudy["architecture"]["nodes"][number]["kind"], x: number, y: number, sub?: string) => ({
  id,
  label,
  kind,
  x,
  y,
  ...(sub ? { sub } : {}),
});

/* ================================================================== */
/*  ZOMATO                                                             */
/* ================================================================== */

const zomato: CaseStudy = {
  slug: "zomato",
  name: "Zomato",
  tagline: "Three-sided marketplace: discovery → ordering saga → live delivery tracking across payments, kitchens and riders.",
  category: "Delivery",
  difficulty: "Hard",
  minutes: 36,

  problem: [
    "Food delivery is a distributed workflow pretending to be a website. One order coordinates a customer's payment, a restaurant's kitchen, and a rider's GPS — three independent parties with their own failure modes, connected by events that must never be lost and never be double-applied.",
    "The engineering core is the order state machine (CREATED → PAID → CONFIRMED → PREPARING → PICKED_UP → DELIVERED), sagas with compensations instead of distributed transactions, idempotency everywhere money moves, and high-frequency location writes that must not drown the system.",
  ],

  requirements: {
    functional: [
      "Restaurant discovery with search/filters by cuisine, rating, ETA",
      "Cart + checkout with offers/taxes; payment via PSP webhooks",
      "Order lifecycle with restaurant accept window & auto-cancel",
      "Rider assignment, live tracking on customer map, ETA updates",
      "Push/SMS notifications at every meaningful transition",
      "Ratings & refunds flow post-delivery",
    ],
    nonFunctional: [
      "Order placement <800ms p95 end-to-end user-perceived",
      "ZERO double-charges; payment retries are idempotent",
      "Location pings every 3–5s per active rider without degrading the platform",
      "State-machine transitions are durable & auditable (dispute resolution)",
      "Dinner peak = 10× lunch baseline; auto-scale accordingly",
    ],
  },

  capacity: [
    { label: "MAU", value: "80M" },
    { label: "Orders/day", value: "2.5M", note: "~30 orders/s avg" },
    { label: "Peak orders/min", value: "~8K", note: "Friday dinner" },
    { label: "Active riders at peak", value: "~300K", note: "concurrent GPS streams" },
    { label: "Location pings/sec", value: "60–100K", note: "riders × ping rate" },
    { label: "Payment webhook volume", value: "2× order rate", note: "retries included" },
    { label: "Order record size", value: "~5KB", note: "items, timeline, addresses" },
  ],

  api: [
    { method: "POST", path: "/orders (Idempotency-Key)", desc: "Creates order in CREATED state; replays safely on retry" },
    { method: "POST", path: "/payments/webhook", desc: "PSP callback; transitions PAYMENT_PENDING→PAID exactly once" },
    { method: "POST", path: "/restaurant/orders/{id}/accept", desc: "Within window; timeout auto-cancels + refund saga" },
    { method: "POST", path: "/rider/location (batch)", desc: "High-frequency ingest; latest-value semantics in GEO index" },
    { method: "WS", path: "/track/{order_id}", desc: "Customer socket receiving rider position deltas" },
  ],

  dataModel: [
    { name: "orders", fields: "id, user_id, restaurant_id, state, total, idempotency_key UNIQUE", note: "state machine owner" },
    { name: "order_events", fields: "order_id, from_state, to_state, actor, ts", note: "append-only audit trail" },
    { name: "payments", fields: "order_id, psp_ref, amount, status, refunded_at", note: "reconciliation source" },
    { name: "riders_location", fields: "rider_id, geo(geohash), heading, updated_at", note: "Redis GEO — latest value only" },
    { name: "outbox", fields: "aggregate_id, topic, payload, sent_at NULL", note: "the dual-write cure" },
  ],

  architecture: {
    nodes: [
      n("cust", "Customer App", "client", 20, 140),
      n("gw", "API Gateway", "app", 220, 140, "auth · idempotency"),
      n("osvc", "Order Service", "app", 440, 60, "saga conductor"),
      n("pay", "Payment Service", "app", 670, 20),
      n("rest", "Restaurant Service", "app", 670, 140),
      n("match", "Rider Matching", "app", 670, 260, "geo radius search"),
      n("loc", "Location Ingest", "app", 900, 340, "batched pings"),
      n("geo", "Redis GEO", "cache", 1130, 340, "latest positions"),
      n("kafka", "Kafka", "queue", 440, 300, "order.events"),
      n("track", "Tracking WS Hub", "infra", 220, 380, "customer push"),
      n("notif", "Notification Svc", "app", 900, 100),
      n("pgs", "Per-service Postgres", "data", 1130, 180),
      n("mon", "Monitoring", "infra", 1360, 260),
    ],
    edges: [
      { from: "cust", to: "gw", label: "place order", flow: true },
      { from: "gw", to: "osvc", protocol: "gRPC" },
      { from: "osvc", to: "pay", label: "charge cmd" },
      { from: "osvc", to: "rest", label: "send to kitchen" },
      { from: "rest", to: "match", dashed: true, label: "on READY" },
      { from: "match", to: "geo", label: "nearest riders" },
      { from: "loc", to: "geo", label: "upsert latest", flow: true },
      { from: "osvc", to: "kafka", label: "state changes", flow: true },
      { from: "kafka", to: "track", label: "consume" },
      { from: "kafka", to: "notif" },
      { from: "pay", to: "pgs" },
      { from: "rest", to: "pgs", dashed: true },
      { from: "osvc", to: "pgs" },
      { from: "track", to: "cust", label: "live map", dashed: true },
      { from: "geo", to: "mon", dashed: true },
    ],
    flows: [
      { id: "zom-order", path: ["cust", "gw", "osvc", "kafka"], color: "#2563EB", speed: 280 },
      { id: "zom-track", path: ["loc", "geo", "track", "cust"], color: "#16A34A", speed: 320, label: "live location" },
    ],
  },

  archNotes: [
    "Every service owns its database; Kafka carries state transitions. The outbox table makes 'write state + publish event' atomic inside Order Service.",
    "The saga conductor drives compensations: refund if restaurant rejects post-payment; release rider if delivery fails.",
    "Location uses LATEST-VALUE semantics (Redis GEO), never append-everything — history goes to cold storage async.",
    "Customer-facing tracking samples rider position every ~5s even though ingestion sees 3–4s pings — smoothing beats flooding.",
  ],

  requestFlow: [
    { title: "Checkout with idempotency key", detail: "Client generates UUID key; Order Service creates CREATED row keyed uniquely. A network retry replays the same response — no ghost orders.", edge: ["cust", "gw"], tag: "idempotent" },
    { title: "Payment handoff", detail: "Order → PAYMENT_PENDING. Payment service talks to PSP; success arrives via webhook, NOT synchronous response.", edge: ["osvc", "pay"], tag: "async reality" },
    { title: "Webhook → PAID (exactly-once illusion)", detail: "Outbox row written in same tx as payment status; relay publishes OrderPaid. Duplicate webhooks dedupe on psp_ref.", edge: ["pay", "pgs"], nodes: ["kafka"] },
    { title: "Kitchen notification", detail: "Restaurant tablet receives order; accept window starts (~2 min). Timeout triggers compensation: refund + cancel.", edge: ["osvc", "rest"], tag: "saga step" },
    { title: "Rider matching", detail: "On READY, matcher queries Redis GEO for riders within 2km with capacity, ranks by distance+rating, assigns with expiry offer.", edge: ["match", "geo"], nodes: ["match"] },
    { title: "Live tracking", detail: "Rider pings batch into Location Ingest → Redis GEO upsert. Tracking hub fans filtered deltas to the customer's WebSocket.", edge: ["loc", "geo"], tag: "latest-value only" },
    { title: "Delivered & settle", detail: "DELIVERED is terminal; settlement jobs reconcile payouts asynchronously. Ratings open.", edge: ["kafka", "notif"], tag: "eventual settlement" },
  ],

  deepDives: [
    {
      topic: "Why no distributed transactions",
      body: "Two-phase commit across Payment/Restaurant/Rider services would couple availability of four systems. Real marketplaces use sagas: local transactions + compensations.",
      bullets: [
        "Every forward step declares its undo (charge→refund, reserve→release).",
        "Compensations run through the SAME reliable pipeline (outbox+Kafka).",
        "Uncompensable steps (notifications) go LAST.",
      ],
    },
    {
      topic: "Idempotency is the whole security model for money",
      body: "Mobile networks retry; users double-tap; PSPs replay webhooks. Without keys, duplicates become double charges.",
      bullets: [
        "Client key on order creation; server-side uniqueness constraint.",
        "PSP reference ids dedupe webhook processing.",
        "All mutation endpoints accept keys — tested with chaos scripts that kill pods mid-request.",
      ],
    },
    {
      topic: "Taming the location firehose",
      body: "100K pings/s sounds terrifying until you realize nobody cares where a rider was 10 seconds ago.",
      bullets: [
        "GEOADD latest-position per rider — O(1) memory per rider.",
        "Batch client-side (3 pings per POST) cuts request volume 3×.",
        "Historical trails stream to cheap object storage for analytics/disputes.",
      ],
    },
  ],

  failures: [
    {
      id: "psp-down",
      title: "Payment provider outage during dinner rush",
      fail: ["pay"],
      degrade: ["osvc"],
      story: "PSP stops responding. Orders can't reach PAID. The correct behavior: fail fast, keep carts, show honest status — never silently drop.",
      metrics: [
        { label: "Order success rate", before: "98%", after: "12%", bad: true },
        { label: "Double charges", before: "0", after: "0", bad: false },
        { label: "Circuit breaker", before: "closed", after: "OPEN → fast fails", bad: true },
      ],
      lessons: [
        "Multi-PSP routing with health-based failover (secondary provider warms idle).",
        "Breaker opens after N timeouts; checkout shows 'try another method'.",
        "Queue-and-retry payment intents survive brief blips without user action.",
      ],
    },
    {
      id: "consumer-crash-loop",
      title: "Kafka consumer group crash-loops mid-shift",
      fail: ["kafka"],
      story: "A poison pill message (malformed payload) crashes consumers repeatedly; state transitions stop flowing to tracking/notifs.",
      reroute: ["osvc", "pgs"],
      metrics: [
        { label: "Consumer lag", before: "0", after: "growing unbounded", bad: true },
        { label: "Orders still placed", before: "yes", after: "YES", bad: false },
        { label: "Tracking freshness", before: "realtime", after: "frozen", bad: true },
      ],
      lessons: [
        "DLQ after N retries — poison pills quarantine, never block partitions.",
        "Alert on consumer lag growth rate; page before customers notice frozen maps.",
        "Schema validation at producer time prevents most poison pills entirely.",
      ],
    },
    {
      id: "db-failover",
      title: "Order database primary fails over",
      fail: [],
      degrade: ["pgs"],
      story: "Postgres primary dies; replica promotes in ~30s. In-flight requests fail; completed ones are safe.",
      metrics: [
        { label: "Failover window", before: "—", after: "~30s degraded", bad: true },
        { label: "Committed orders lost", before: "0", after: "0", bad: false },
        { label: "In-flight requests", before: "—", after: "fail visibly, clients retry", bad: true },
      ],
      lessons: [
        "Sync replication for the orders DB buys near-zero loss at small latency cost.",
        "Clients hold idempotency keys — automatic retries after failover succeed cleanly.",
        "Runbook drills make the 30s boring instead of terrifying.",
      ],
    },
  ],

  scaling: [
    { stage: "Single city", action: "Monolith + one DB + polling status", why: "Learn the ops before the architecture." },
    { stage: "Multi-city", action: "Extract Order/Payment services + outbox", why: "Money paths demand isolation first." },
    { stage: "National peak", action: "Event spine (Kafka) + GEO matching + WS tracking", why: "Real-time features need decoupled lanes." },
    { stage: "Millions/day", action: "Shard orders by city/region; regional read replicas", why: "Disputes/analytics shouldn't touch hot path." },
  ],

  tradeoffs: [
    {
      a: "Saga orchestration (central conductor)",
      b: "Choreography (pure events)",
      dims: [
        { name: "Flow visibility", a: "One inspectable state machine", b: "Scattered across services", winner: "a" },
        { name: "Coupling", a: "Conductor knows steps", b: "Services know only events", winner: "b" },
        { name: "Compensation handling", a: "Explicit, testable paths", b: "Emergent, hard to verify", winner: "a" },
        { name: "Simple pipelines", a: "Overkill ceremony", b: "Perfect fit", winner: "b" },
      ],
      verdict: "Money-touching multi-step flows deserve an orchestrator; simple notifications choreograph themselves.",
    },
    {
      a: "Latest-value locations (Redis GEO)",
      b: "Append-everything trail",
      dims: [
        { name: "Write amplification", a: "O(active riders)", b: "O(pings)", winner: "a" },
        { name: "History/analytics", a: "Needs separate pipeline", b: "Free", winner: "b" },
        { name: "Query latency (nearby search)", a: "Sub-ms GEOINDEX", b: "Scan nightmare", winner: "a" },
      ],
      verdict: "Hot path wants latest-value; history belongs in a parallel cheap lane. Never make the map wait for analytics.",
    },
  ],

  alternatives: [
    "Temporal/Cadence-style workflow engines replace hand-rolled saga conductors with durable execution primitives.",
    "Third-party delivery fleets (API-based) remove rider management but cap margin and control.",
  ],

  interview: {
    prompt: "Design Zomato-style ordering: discovery through delivery for 2.5M orders/day with zero double-charges.",
    stages: [
      { name: "Requirements", expect: "Lead with the state machine and the three-sided consistency story (money exact, tracking eventual)." },
      { name: "Estimation", expect: "8K orders/min peak, 100K pings/s, 2× webhook volume — shape queues and GEO tier." },
      { name: "Data & API", expect: "Idempotency-Key on creation, unique constraints, append-only order_events audit." },
      { name: "Architecture", expect: "Service-per-domain with owned DBs, outbox relay to Kafka, saga conductor with compensations." },
      { name: "Deep dive", expect: "Walk 'payment succeeded but order create failed' — show how outbox prevents it structurally." },
      { name: "Failure", expect: "PSP outage breaker behavior; poison-pill DLQ; DB failover with idempotent retries." },
    ],
  },

  production: [
    "Accept-window timers must be durable (DB-backed deadlines), not in-memory setTimeout.",
    "Reconciliation job compares PSP settlements vs payments nightly — discrepancies page finance AND engineering.",
    "Rider app offline mode queues assignments acks; conflicts resolve server-side.",
  ],

  costs: [
    "SMS fallback for critical notifications is 50–100× push cost — use sparingly by design.",
    "Geo-matching compute scales with rider density; cluster cities by region for cache locality.",
  ],
};

/* ================================================================== */
/*  UBER                                                               */
/* ================================================================== */

const uber: CaseStudy = {
  slug: "uber",
  name: "Uber",
  tagline: "Geospatial matching at city scale: H3 hexagons, supply positioning and trip state under constant motion.",
  category: "Mobility",
  difficulty: "Expert",
  minutes: 35,

  problem: [
    "Uber matches moving riders with moving drivers in seconds, across hundreds of cities, while surge pricing balances supply and demand in real time. Everything reduces to geospatial indexing plus relentless event throughput.",
    "The signature problems: indexing Earth's surface for 'nearest K' queries (H3 hexagonal grid), ingesting driver locations at massive write rates, and managing trip state machines where BOTH parties may lose connectivity mid-trip.",
  ],

  requirements: {
    functional: [
      "Rider requests trip; system matches nearby drivers with ETA quotes",
      "Driver accepts; navigation-guided pickup; trip tracks to destination",
      "Surge pricing communicates multipliers transparently",
      "Fare calculation (base + distance + time + surge); receipts",
      "Driver heatmaps showing demand-rich areas",
    ],
    nonFunctional: [
      "Match latency <3s p99 globally",
      "Driver location update every 4s; system absorbs 5M+ updates/min",
      "Trip state survives device/app restarts (server-owned truth)",
      "Zero lost trips during regional incidents (degrade matching, not rides)",
    ],
  },

  capacity: [
    { label: "Trips/day", value: "25M+", note: "~290 trips/s average" },
    { label: "Peak trips/min", value: "100K+", note: "NYE, concerts" },
    { label: "Active drivers online", value: "5M+", note: "global snapshot" },
    { label: "Location updates/min", value: ">5M", note: "drivers × 4s cadence" },
    { label: "Match decisions/s", value: "~10K peak" },
    { label: "Geo cells tracked", value: "billions (H3 res 8–9)", note: "sparse population" },
  ],

  api: [
    { method: "POST", path: "/rides/requests", desc: "Create trip intent → matching begins; returns match or ETA options" },
    { method: "POST", path: "/drivers/location (batch)", desc: "Batched geo updates; upsert into H3 cell indexes" },
    { method: "POST", path: "/rides/{id}/accept", desc: "Driver claims trip; idempotent, first-writer-wins with lease" },
    { method: "GET", path: "/surge?cell=", desc: "Current multiplier per hexagon cell" },
    { method: "WS", path: "/trip/{id}/stream", desc: "Bidirectional trip events (status, location, chat)" },
  ],

  dataModel: [
    { name: "trips", fields: "id, rider_id, driver_id, state(requested|matched|in_progress|complete), route_line" , note: "server owns truth" },
    { name: "driver_locations", fields: "driver_id, h3_cell(res9), lat, lng, updated_at", note: "latest-value per driver + cell inverted index" },
    { name: "supply_cells", fields: "h3_cell, available_count, avg_eta_s, window", note: "precomputed supply snapshots" },
    { name: "surge_multipliers", fields: "h3_cell(res8), multiplier, valid_until", note: "computed continuously" },
  ],

  architecture: {
    nodes: [
      n("rider", "Rider App", "client", 20, 160),
      n("drv", "Driver App", "client", 20, 400),
      n("gw", "Gateway Fleet", "infra", 230, 280, "regional edges"),
      n("tsvc", "Trip Service", "app", 450, 180, "state machine"),
      n("msvc", "Matching Service", "app", 450, 320, "H3 ring search"),
      n("locsvc", "Location Service", "app", 450, 460, "ingest + index"),
      n("surge", "Surge Engine", "app", 680, 180, "supply/demand"),
      n("h3", "Geo Index (H3)", "cache", 680, 320, "driver cell maps"),
      n("pos", "Positioning Store", "data", 680, 460, "latest + history"),
      n("kf", "Telemetry Stream", "queue", 900, 180, "all events"),
      n("nav", "Navigation/Routing", "app", 900, 320, "ETAs · routes"),
      n("mon", "City Dashboards", "infra", 1120, 320),
    ],
    edges: [
      { from: "rider", to: "gw", label: "request ride", flow: true },
      { from: "drv", to: "gw", label: "location batches", flow: true },
      { from: "gw", to: "tsvc", label: "trip cmds" },
      { from: "gw", to: "locsvc", label: "geo ingest" },
      { from: "tsvc", to: "msvc", label: "find supply", flow: true },
      { from: "msvc", to: "h3", label: "ring query", flow: true },
      { from: "locsvc", to: "h3", label: "upsert cells" },
      { from: "locsvc", to: "pos", label: "persist latest" },
      { from: "surge", to: "h3", dashed: true, label: "reads supply" },
      { from: "kf", to: "surge", label: "demand signals" },
      { from: "gw", to: "kf", label: "events" },
      { from: "tsvc", to: "nav", label: "route + ETA" },
      { from: "nav", to: "mon", dashed: true },
    ],
    flows: [
      { id: "ub-match", path: ["rider", "gw", "tsvc", "msvc", "h3"], color: "#2563EB", speed: 300 },
      { id: "ub-supply", path: ["drv", "gw", "locsvc", "h3"], color: "#EA580C", speed: 340 },
    ],
  },

  archNotes: [
    "H3 hexagons tile Earth so neighbors are uniform — ring(k) enumeration gives expanding-radius candidate search without trigonometry per query.",
    "Matching searches outward ring-by-ring with hard latency budget; imperfect nearest is fine, slow is fatal.",
    "Surge is computed from SUPPLY CELLS vs DEMAND FORECASTS continuously — pricing as a control system, not a lookup.",
  ],

  requestFlow: [
    { title: "Rider requests", detail: "Trip service creates REQUESTED trip pinned to the rider's H3 cell; matching clock starts (<3s budget).", edge: ["rider", "gw"], tag: "clock started" },
    { title: "Ring search", detail: "Matcher queries res-9 cell, then ring 1, ring 2… scoring drivers by ETA (not raw distance) until candidates found.", edge: ["msvc", "h3"], tag: "expanding rings" },
    { title: "Offer & claim", detail: "Best driver gets a push offer with 15s expiry. Accept is a leased claim — two taps can't double-book.", edge: ["tsvc", "msvc"], tag: "lease semantics" },
    { title: "Supply heartbeat continues", detail: "Meanwhile every driver streams batched locations; Location Service upserts cells continuously.", edge: ["drv", "gw"], nodes: ["locsvc"], tag: "5M+/min" },
    { title: "Surge recalibrates", detail: "Demand spikes (concert exit) hit telemetry; surge engine raises multipliers for affected cells with smooth decay.", edge: ["kf", "surge"], tag: "control loop" },
    { title: "Trip progresses server-side", detail: "State lives in Trip Service — either phone dying doesn't matter; reconnect resumes exact state.", edge: ["gw", "kf"], nodes: ["tsvc"], tag: "durable state" },
  ],

  deepDives: [
    {
      topic: "Why hexagons (H3) beat lat/lng grids",
      body: "Square grids have neighbors at two distances (edge vs corner), breaking uniform ring expansion. Hexagons have six equidistant neighbors — perfect for hierarchical radius search.",
      bullets: [
        "Resolutions nest cleanly: res-9 (~174m) for matching, res-8 (~461m) for surge zones.",
        "Cell-based aggregation makes supply/demand computation embarrassingly parallel.",
        "Index inversion: cell → sorted driver list, updated on every ping.",
      ],
    },
    {
      topic: "ETA is the product",
      body: "Users forgive 2-minute walks to better prices, never wrong ETAs. Routing engines blend road-network graphs with live traffic.",
      bullets: [
        "Custom routing engine over OpenStreetMap-derived graphs, traffic-adjusted per segment.",
        "ETA predictions use gradient-boosted models on historical segments × time-of-day.",
        "Matching scores by predicted ETA, not haversine distance — traffic-aware from day one.",
      ],
    },
    {
      topic: "Offline-first drivers",
      body: "Cellular dead zones are routine. Driver apps queue everything and sync aggressively when signal returns.",
      bullets: [
        "Location batching compresses gaps; interpolation marks uncertain segments.",
        "Trip actions (arrive/start/dropoff) work offline with server reconciliation.",
        "Conflicts resolve server-authoritatively — the phone is a sensor, not the truth.",
      ],
    },
  ],

  failures: [
    {
      id: "geo-hot-cell",
      title: "Stadium-exit hotspot melts one geo shard",
      fail: ["h3"],
      degrade: ["msvc"],
      story: "One H3 region's inverted index gets 100× normal updates + queries. Shard-level mitigation required while city-wide matching continues.",
      metrics: [
        { label: "Match latency (hot zone)", before: "800ms", after: "timeout-prone", bad: true },
        { label: "Rest of city", before: "normal", after: "normal", bad: false },
        { label: "Surge response", before: "smooth", after: "spiky", bad: true },
      ],
      lessons: [
        "Hot cells split dynamically (finer resolution) when update rates cross thresholds.",
        "Ring search degrades gracefully: skip hottest cell rather than fail the request.",
        "Pre-event playbook: predictable surges get pre-sharded infrastructure.",
      ],
    },
    {
      id: "region-loss",
      title: "Regional cloud impairment during rush hour",
      fail: ["gw"],
      reroute: ["rider", "tsvc", "msvc", "h3"],
      story: "One region's gateways degrade; global steering shifts new sessions elsewhere while in-flight trips persist server-side.",
      metrics: [
        { label: "In-flight trips", before: "healthy", after: "healthy (server-owned)", bad: false },
        { label: "New matches", before: "<3s", after: "4–7s during shift", bad: true },
        { label: "Driver earnings impact", before: "—", after: "minutes-level", bad: true },
      ],
      lessons: [
        "Server-owned trip state means device chaos never kills a ride.",
        "Traffic steering rehearsals keep failover boring.",
        "Matching SLA relaxes BEFORE breaking — honest degradation beats errors.",
      ],
    },
  ],

  scaling: [
    { stage: "1 city", action: "Postgres + PostGIS nearest queries", why: "Correctness first; volumes tiny." },
    { stage: "10 cities", action: "In-memory geo indexes + dedicated location service", why: "Write rates exceed relational comfort." },
    { stage: "Global", action: "H3 sharding + regional matching autonomy", why: "Cities don't need each other's drivers." },
    { stage: "Optimization era", action: "ML dispatch (predicted supply positioning)", why: "Move drivers BEFORE demand appears." },
  ],

  tradeoffs: [
    {
      a: "Nearest-driver matching (greedy)",
      b: "Batch-window optimization",
      dims: [
        { name: "Match latency", a: "<1s typical", b: "Waits seconds for batching", winner: "a" },
        { name: "Global efficiency", a: "Locally greedy, some mismatches", b: "Better pairing %, fewer deadheads", winner: "b" },
        { name: "Complexity", a: "Simple ring search", b: "Auction/matching solvers", winner: "a" },
      ],
      verdict: "Ship greedy; graduate to short batching windows (2–4s) once density makes waiting profitable. Uber's evolution in miniature.",
    },
  ],

  alternatives: [
    "Google Maps Platform routing APIs as managed ETA/routing — faster start, margin + customization ceiling.",
    "Quad-tree/geohash instead of H3 — viable; hexagon neighbor-uniformity wins at scale.",
  ],

  interview: {
    prompt: "Design Uber matching: 25M trips/day, 5M online drivers, <3s match, city-scale surge.",
    stages: [
      { name: "Requirements", expect: "Separate location INGEST rate from MATCH QPS; call out server-owned trip state." },
      { name: "Estimation", expect: "5M updates/min justifies latest-value stores + inverted cell indexes." },
      { name: "Geo modeling", expect: "Choose H3 with resolution reasoning; explain ring-search mechanics." },
      { name: "Architecture", expect: "Trip/matching/location/surge services; lease-based driver claims; telemetry spine." },
      { name: "Deep dive", expect: "Surge as feedback control: supply cells vs forecast demand, multiplier decay." },
      { name: "Failure", expect: "Hot-cell mitigation and region evacuation with zero lost trips." },
    ],
  },

  production: [
    "Driver location privacy: retention windows + aggregation before analytics surfaces.",
    "Surge changes require audit trails — regulators ask questions.",
    "Map-matching snaps noisy GPS to road graph before ETA math.",
  ],

  costs: [
    "Routing compute dominates: cache popular routes aggressively, compute long-tail on demand.",
    "Push notification spend (driver offers) is material — batch and prioritize wisely.",
  ],
};

/* ================================================================== */
/*  SWIGGY                                                            */
/* ================================================================== */

const swiggy: CaseStudy = {
  slug: "swiggy",
  name: "Swiggy",
  tagline: "Zomato's mirror with different tradeoffs: hyperlocal batching, Genie-style anything-delivery and ETA honesty.",
  category: "Delivery",
  difficulty: "Standard",
  minutes: 22,

  problem: [
    "Swiggy competes in the same three-sided marketplace as Zomato but pushes different levers: batching multiple restaurant pickups per rider, hyperlocal demand prediction, and extensions (Genie, Instamart) that reuse the delivery fleet for anything-that-fits-in-a-bag.",
    "Studying both companies teaches the real lesson: identical business problems produce architecturally similar systems with locally different optimizations.",
  ],

  requirements: {
    functional: [
      "Same core as Zomato: discover → order → pay → track → deliver",
      "Rider batching: chain nearby pickups/dropoffs per trip",
      "Instamart: dark-store grocery with 10–20min promise",
      "Live order-level ETA combining kitchen + traffic models",
    ],
    nonFunctional: [
      "ETA accuracy within ±4min for 85%+ of deliveries",
      "Rider utilization >90% during peaks (batching efficiency)",
      "Instamart pick-pack-dispatch <8min internally",
    ],
  },

  capacity: [
    { label: "Orders/day", value: "2M+" },
    { label: "Instamart orders/day", value: "~500K", note: "growing fastest" },
    { label: "Dark stores", value: "~500", note: "micro-warehouses" },
    { label: "Riders", value: "~400K network" },
    { label: "Batched deliveries share", value: ">40% at peak", note: "two orders one rider" },
  ],

  api: [
    { method: "POST", path: "/orders/batch-optimize", desc: "Internal: assign rider to compatible order pairs" },
    { method: "GET", path: "/eta/{order_id}", desc: "Composite ETA: prep + pickup travel + traffic + drop travel" },
    { method: "POST", path: "/instamart/reserve-slot", desc: "Capacity-bucket reservation for dark-store picking" },
  ],

  dataModel: [
    { name: "delivery_tasks", fields: "task_id, type(pickup|drop), order_id, rider_id, seq, window", note: "the batching primitive" },
    { name: "dark_store_inventory", fields: "store_id, sku, qty_reserved, shelf_loc", note: "reservation-aware stock" },
    { name: "eta_components", fields: "order_id, kitchen_min, travel_min, traffic_factor", note: "explainable ETA parts" },
  ],

  architecture: {
    nodes: [
      n("apps", "Consumer Apps", "client", 20, 240),
      n("edge", "Edge Gateway", "infra", 220, 240),
      n("ord", "Order Orchestrator", "app", 440, 160),
      n("inst", "Instamart Service", "app", 440, 340, "dark store ops"),
      n("wh", "Warehouse Ops", "data", 440, 480, "inventory"),
      n("dsp", "Dispatch Optimizer", "app", 660, 240, "batching solver"),
      n("eta", "ETA Engine", "app", 880, 160, "ml + traffic"),
      n("fleet", "Fleet State", "cache", 880, 320, "rider positions"),
      n("evq", "Event Backbone", "queue", 660, 440),
      n("obs", "Ops Dashboards", "infra", 1100, 240),
    ],
    edges: [
      { from: "apps", to: "edge", flow: true },
      { from: "edge", to: "ord" },
      { from: "edge", to: "inst", label: "grocery flow" },
      { from: "ord", to: "dsp", label: "needs rider" },
      { from: "inst", to: "dsp", label: "ready bags" },
      { from: "dsp", to: "fleet", label: "candidates", flow: true },
      { from: "eta", to: "dsp", label: "travel times", dashed: true },
      { from: "dsp", to: "evq", label: "assignments" },
      { from: "evq", to: "obs", dashed: true },
      { from: "inst", to: "wh" },
      { from: "fleet", to: "obs", dashed: true },
    ],
    flows: [{ id: "sw-batch", path: ["ord", "dsp", "fleet"], color: "#EA580C", speed: 300 }],
  },

  archNotes: [
    "Dispatch optimizer is the crown jewel: a constrained assignment solver running every few seconds over pending tasks + rider states.",
    "ETA is decomposed and explainable — each component owned by a team, combined deterministically.",
    "Instamart inventory uses RESERVATIONS during picking to avoid overselling at flash-sale moments.",
  ],

  requestFlow: [
    { title: "Grocery order lands", detail: "Instamart reserves SKUs immediately (reserved≠sold until picked), slotting pick tasks by dark-store layout.", edge: ["edge", "inst"], tag: "reserve-first" },
    { title: "Pick-pack countdown", detail: "Store picker app sequences items by aisle; bag sealed with order manifest in target <8min.", nodes: ["wh"], tag: "internal SLA" },
    { title: "Dispatch optimization cycle", detail: "Every ~5s the solver pairs this bag with compatible restaurant drops for the best rider routes.", edge: ["dsp", "fleet"], tag: "assignment solver" },
    { title: "Composite ETA published", detail: "Kitchen + travel components combine into the customer-visible number, updated as conditions change.", edge: ["eta", "dsp"], tag: "±4min target" },
  ],

  deepDives: [
    {
      topic: "Batching economics",
      body: "Two orders per rider trip cut per-order delivery cost ~30% but add complexity to ETAs and cancellation handling.",
      bullets: [
        "Compatibility = geographic overlap + time windows + temperature classes.",
        "First leg delay tolerance built into second order's quoted ETA.",
        "Cancel-one-leg logic must never strand the other order.",
      ],
    },
  ],

  failures: [
    {
      id: "solver-degrade",
      fail: [],
      title: "Dispatch optimizer falls behind at peak",
      degrade: ["dsp"],
      story: "Solver cycles slow under load; riders wait longer between assignments; batching ratio drops (cost rises) but orders still deliver.",
      metrics: [
        { label: "Assignment delay", before: "20s", after: "90s", bad: true },
        { label: "Batching rate", before: "42%", after: "18%", bad: true },
        { label: "Deliveries completed", before: "✓", after: "✓", bad: false },
      ],
      lessons: [
        "Greedy fallback mode keeps the fleet moving when the solver starves.",
        "Cost metrics (utilization) alert before customer metrics suffer.",
      ],
    },
  ],

  scaling: [
    { stage: "Food-only", action: "Reuse standard ordering stack", why: "Identical to Zomato pattern." },
    { stage: "+Instamart", action: "Inventory reservations + dark-store WMS lite", why: "Grocery breaks 'infinite restaurant stock' assumption." },
    { stage: "Unified fleet", action: "Task abstraction over food+grocery+parcels", why: "One rider pool, many task types." },
  ],

  tradeoffs: [
    {
      a: "Instant reservation inventory",
      b: "Check-at-pick inventory",
      dims: [
        { name: "Overselling risk", a: "Near zero", b: "Flash-sale disasters", winner: "a" },
        { name: "Shelf accuracy needs", a: "Strict (phantom stock blocks sales)", b: "Loose", winner: "b" },
        { name: "Conversion rate", a: "Higher trust", b: "Apology coupons", winner: "a" },
      ],
      verdict: "Reservation wins wherever pick-time is minutes not seconds — pay the inventory-accuracy operational cost.",
    },
  ],

  alternatives: [
    "Third-party logistics integration for Genie parcels (variable-size problem).",
    "Zone-level micro-fulfillment automation (robots) — capex-heavy future direction.",
  ],

  interview: {
    prompt: "Design Swiggy Instamart: 10-minute grocery with 500 dark stores and a shared rider fleet.",
    stages: [
      { name: "Requirements", expect: "Slot the problem: inventory reservation + picking SLA + dispatch optimization are three distinct subsystems." },
      { name: "Estimation", expect: "500K orders/day ÷ 500 stores ≈ 40 orders/store/hour shapes picker staffing math." },
      { name: "Architecture", expect: "Order orchestrator + warehouse ops + shared dispatch with task abstraction." },
      { name: "Deep dive", expect: "Explain batching compatibility rules and cancellation-of-one-leg handling." },
    ],
  },

  production: [
    "Phantom-inventory audits reconcile reserved vs shelf counts hourly.",
    "ETA component dashboards let each owning team see their drift independently.",
  ],

  costs: [
    "Dark-store real estate is the dominant fixed cost — location selection algorithms earn their keep.",
  ],
};

/* ================================================================== */
/*  GOOGLE MAPS                                                        */
/* ================================================================== */

const gmaps: CaseStudy = {
  slug: "google-maps",
  name: "Google Maps",
  tagline: "Planet-scale tiles, routing graphs and live traffic — read-heavy geospatial infrastructure.",
  category: "Mobility",
  difficulty: "Hard",
  minutes: 28,

  problem: [
    "Maps serves billions of map views daily: raster/vector tiles rendered from planet-scale geographic data, routing over continental road graphs in milliseconds, and live traffic layered on top — all overwhelmingly READ-heavy with fierce caching economics.",
    "The distinctive challenges: tiling pyramids (zoom levels), Contraction Hierarchies for instant routing, and privacy-preserving traffic aggregation from millions of devices.",
  ],

  requirements: {
    functional: [
      "Pan/zoom map rendering worldwide (vector tiles client-rendered)",
      "Point-to-point routing with alternate routes + live traffic",
      "Place search with fuzzy matching + geo-ranking",
      "Turn-by-turn navigation with re-routing on deviation",
      "Transit/multi-modal options",
    ],
    nonFunctional: [
      "Tile load <100ms p90; route computation <300ms globally",
      "Traffic freshness 2–5 min urban",
      "Read availability absolute — a map that won't render is dead",
      "Privacy: traffic derived from anonymized aggregated speeds",
    ],
  },

  capacity: [
    { label: "MAU", value: ">2B", note: "incl. embedded/API" },
    { label: "Tile requests/day", value: "100B+", note: "viewport pan/zoom storms" },
    { label: "Routes/day", value: ">1B" },
    { label: "Road graph edges", value: "billions", note: "global OSM++ quality" },
    { label: "Tile cache hit ratio", value: ">99%", note: "the entire business model" },
  ],

  api: [
    { method: "GET", path: "/tiles/{z}/{x}/{y}.pbf", desc: "Vector protobuf tiles; immutable + forever-cacheable" },
    { method: "GET", path: "/directions?origin=&dest=&mode=", desc: "Routes with alternatives; traffic-aware weights" },
    { method: "GET", path: "/places?q=&near=", desc: "Fuzzy place search with prominence ranking" },
    { method: "POST", path: "/navigation/position", desc: "Nav session updates; server re-routes on deviation" },
  ],

  dataModel: [
    { name: "tile_index", fields: "z, x, y, feature_blob, version", note: "immutable per version epoch" },
    { name: "road_graph", fields: "edges(edge_id, geom, class, speed_profile)", note: "contraction-hierarchy overlays precomputed" },
    { name: "traffic_segments", fields: "segment_id, speed_bucket, confidence, window", note: "aggregated device probes" },
    { name: "places", fields: "place_id, centroid, categories, prominence_score" },
  ],

  architecture: {
    nodes: [
      n("clients", "Apps / Web / Embedded", "client", 20, 200),
      n("ecdn", "Massive Tile CDN", "cache", 240, 80, "edge cached forever"),
      n("obj", "Tile Object Store", "data", 460, 80),
      n("tile", "Tile Service", "app", 460, 200, "version epochs"),
      n("api", "Maps API Frontend", "infra", 240, 340),
      n("route", "Routing Service", "app", 460, 340, "CH queries"),
      n("places", "Places Service", "app", 460, 480),
      n("ch", "Road Graph + CH", "data", 690, 340, "precomputed overlays"),
      n("traffic", "Traffic Aggregator", "queue", 690, 480, "probe ingestion"),
      n("mon", "QoE Monitoring", "infra", 920, 200),
    ],
    edges: [
      { from: "clients", to: "ecdn", label: "tiles", flow: true },
      { from: "clients", to: "api", label: "routes/search", flow: true },
      { from: "ecdn", to: "obj", dashed: true, label: "misses rare" },
      { from: "api", to: "route", flow: true },
      { from: "api", to: "places" },
      { from: "route", to: "ch", label: "bidirectional search" },
      { from: "traffic", to: "ch", label: "speed overlays", dashed: true },
      { from: "tile", to: "ecdn", label: "epoch publish", dashed: true },
      { from: "tile", to: "obj", dashed: true },
      { from: "route", to: "mon", dashed: true },
    ],
    flows: [{ id: "gm-tiles", path: ["clients", "ecdn"], color: "#16A34A", speed: 420 }],
  },

  archNotes: [
    "Tiles are IMMUTABLE per version epoch: cache-control measured in months, invalidation replaced by version-bumped URLs.",
    "Contraction Hierarchies preprocess the road graph offline so queries answer bidirectionally in ms — the classic space-for-speed tradeoff.",
    "Traffic aggregates ANONYMIZED probe speeds into segment buckets; individual traces never persist at query layer.",
  ],

  requestFlow: [
    { title: "Viewport pan", detail: "Client computes needed z/x/y tiles, fetches from CDN — 99%+ served from edge without origin contact.", edge: ["clients", "ecdn"], tag: "~99% hit" },
    { title: "Route request", detail: "Origin/destination geocode → snap to road graph → bidirectional CH search returns top-k routes in ms.", edge: ["api", "route"], tag: "<300ms global" },
    { title: "Traffic overlay", detail: "Selected edges colorize using current segment speed buckets merged into the result.", edge: ["traffic", "ch"], tag: "2–5min fresh" },
    { title: "Navigate & deviate", detail: "During nav, client posts positions; deviation beyond threshold triggers server re-route with fresh weights.", nodes: ["route"], tag: "re-route loop" },
  ],

  deepDives: [
    {
      topic: "Contraction Hierarchies explained simply",
      body: "Naive Dijkstra over billions of edges takes seconds. CH preprocessing 'shortcuts' important intersections so queries only touch a tiny hierarchy.",
      bullets: [
        "Offline: order vertices by importance, add shortcut edges preserving shortest paths.",
        "Online: search upward from source, downward from target, meet in middle.",
        "Result: continental routes in single-digit ms — enables interactive alternatives.",
      ],
    },
    {
      topic: "Tiles: immutability as strategy",
      body: "Mutable caches invalidate unpredictably at planetary scale. Version epochs sidestep the entire problem.",
      bullets: [
        "Data updates ship as new epoch; URLs embed version → old caches age out naturally.",
        "CDN cost collapses because nothing ever purges.",
      ],
    },
  ],

  failures: [
    {
      fail: [],
      id: "routing-degrade",
      title: "Traffic feed corruption",
      degrade: ["traffic"],
      story: "Bad probe aggregation publishes absurd speeds (-1 km/h highways). Routes detour wildly while tiles stay perfect.",
      metrics: [
        { label: "Route sanity checks", before: "passing", after: "alarm", bad: true },
        { label: "User impact", before: "none", after: "wrong detours", bad: true },
        { label: "Tile serving", before: "perfect", after: "perfect", bad: false },
      ],
      lessons: [
        "Statistical plausibility gates on published speeds (min/max floors).",
        "Rollback to last-good traffic epoch automatically on anomaly detection.",
        "Isolation again: corrupt ONE input, others unaffected.",
      ],
    },
  ],

  scaling: [
    { stage: "Regional product", action: "Raster tiles + PostGIS routing", why: "Prove utility quickly." },
    { stage: "Continental", action: "Vector tiles + in-memory graph partition", why: "Client rendering unlocks styles + smaller payloads." },
    { stage: "Planet", action: "CH/FIATH preprocessing + epoch-versioned tiles + probe traffic", why: "Interactive global routing demands preprocessing." },
  ],

  tradeoffs: [
    {
      a: "Vector tiles (client renders)",
      b: "Raster tiles (server renders)",
      dims: [
        { name: "Payload per viewport", a: "Small (geometry, styled locally)", b: "Large bitmaps", winner: "a" },
        { name: "Client CPU/battery", a: "Higher", b: "Trivial", winner: "b" },
        { name: "Style flexibility", a: "Runtime themes, night mode free", b: "Bake per style", winner: "a" },
        { name: "Legacy support", a: "Weak", b: "Universal", winner: "b" },
      ],
      verdict: "Modern default is vector; rasters survive for embedding simplicity and ancient devices.",
    },
  ],

  alternatives: [
    "Open-source stack (OSM + Valhalla/OpenRouteService + TileServerGL) — genuinely viable self-hosted path.",
    "Mapbox/HERE managed platforms for product speed over infra control.",
  ],

  interview: {
    prompt: "Design Google Maps: 100B+ tile views/day, sub-second global routing, live traffic.",
    stages: [
      { name: "Requirements", expect: "Recognize extreme read-skew; separate tile plane (static) from route plane (dynamic)." },
      { name: "Data structures", expect: "Tiling pyramid + contraction hierarchies with preprocessing cost discussion." },
      { name: "Architecture", expect: "Immutable-version CDN tiles; routing service over preprocessed graphs; anonymized probe pipeline." },
      { name: "Failure", expect: "Traffic-corruption scenario with statistical gates and epoch rollback." },
    ],
  },

  production: [
    "Tile version epochs coordinate with mobile app release trains (old apps pin old versions).",
    "Place prominence scores recompute weekly — ranking drift is monitored like an SLO.",
  ],

  costs: [
    "CDN egress for tiles is enormous but nearly perfectly cacheable — the cheapest bytes you'll ever serve twice.",
  ],
};

export const RIDE_DELIVERY_SYSTEMS: CaseStudy[] = [zomato, uber, swiggy, gmaps];
