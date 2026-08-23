import type { Chapter } from "@/lib/types";

export const scaleChapters: Chapter[] = [
  {
    slug: "scaling-to-millions",
    track: "scalability",
    num: 1,
    title: "Scaling to Millions",
    subtitle:
      "The canonical evolution from one server to a global system — each step triggered by a real bottleneck, not fashion.",
    minutes: 25,
    skills: ["architecture", "databases", "caching"],
    concepts: ["horizontal-scaling", "stateless", "sharding", "replication", "cdn", "queue"],
    blocks: [
      {
        t: "p",
        md: "Scalability is not a product you buy; it is a sequence of refactors, each one forced by a specific bottleneck. Memorize the sequence and you can walk into any design interview or architecture review and know exactly which lever comes next.",
      },
      { t: "h", text: "The evolution" },
      {
        t: "diagram",
        height: 280,
        caption:
          "V1 single box → V2 LB + stateless apps → V3 cache → V4 DB replicas → V5 queue for async work → V6 shard writes → V7 multi-region.",
        graph: {
          nodes: [
            { id: "u", label: "Users", kind: "client", x: 20, y: 120 },
            { id: "cdn", label: "CDN", kind: "cache", x: 190, y: 30 },
            { id: "lb", label: "LB", kind: "app", x: 190, y: 210 },
            { id: "a1", label: "API ×N", sub: "stateless", kind: "app", x: 380, y: 210 },
            { id: "rc", label: "Redis", kind: "cache", x: 380, y: 90 },
            { id: "q", label: "Kafka", sub: "async work", kind: "queue", x: 570, y: 210 },
            { id: "wk", label: "Workers", kind: "app", x: 760, y: 290 },
            { id: "pm", label: "PG primary", kind: "data", x: 570, y: 90 },
            { id: "rr", label: "Replicas", kind: "data", x: 760, y: 60 },
            { id: "sh", label: "Shards", sub: "user_id keyed", kind: "data", x: 950, y: 190 },
          ],
          edges: [
            { from: "u", to: "cdn" },
            { from: "u", to: "lb" },
            { from: "lb", to: "a1" },
            { from: "a1", to: "rc", label: "hot reads" },
            { from: "a1", to: "q", label: "side effects" },
            { from: "q", to: "wk" },
            { from: "a1", to: "pm", label: "writes" },
            { from: "pm", to: "rr", label: "WAL" },
            { from: "pm", to: "sh", dashed: true, label: "when writes cap out" },
          ],
        },
      },
      {
        t: "table",
        head: ["Stage", "Bottleneck that forces it", "Move"],
        rows: [
          ["V1 Single server", "—", "App + DB on one box; ship value first"],
          ["V2 Separate DB", "App and DB fight for RAM/CPU", "Dedicated database host"],
          ["V3 Load balancer", "One box caps throughput; deploys cause downtime", "LB + N stateless app servers; sessions move to Redis/cookies"],
          ["V4 Cache", "DB read QPS dominates; p99 grows", "Redis cache-aside + CDN for static/media"],
          ["V5 Read replicas", "Reads still exceed primary capacity", "Async replicas route reads; accept replication lag"],
          ["V6 Queue", "Request path does slow work (email, images) → latency spikes", "Publish events; workers process async"],
          ["V7 Sharding", "Write QPS / dataset exceed one primary forever", "Partition by entity key; co-locate related data"],
          ["V8 Multi-region", "Global latency; regional outage = full outage", "Active-active or active-passive regions + geo-routing"],
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "Statelessness is the hinge of everything",
        md: "Every stage after V3 requires app servers that hold no per-request state between requests: no local sessions, no local file uploads, no in-process caches as source of truth. Externalize state (Redis, S3, DB) and horizontal scaling becomes boring — which is the goal.",
      },
      { t: "h", text: "Autoscaling without lies" },
      {
        t: "list",
        items: [
          "Scale on a signal that reflects load **before** saturation: request concurrency or queue depth, not CPU at 90% (too late).",
          "Set `terminationGracePeriod` so draining instances finish in-flight work during scale-in.",
          "Protect dependencies: autoscaling app tier against a fixed-size DB just moves the collapse point. Know your end-to-end capacity chain.",
          "Pre-scale for known events (launches, sales). Reactive autoscaling handles noise; humans handle predictable waves.",
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: scaling the wrong tier",
        md: "Latency climbs at peak. On-call adds app pods 3×. Latency worsens — every pod now opens more DB connections, pushing Postgres to 100% CPU. The bottleneck was never the app tier. **Lesson:** identify the saturated resource (pg_stat_activity, connection counts, queue depths) before adding capacity anywhere. Scaling a non-bottleneck makes systems slower.",
      },
    ],
    quiz: [
      {
        id: "sc-q1",
        q: "At which stage do sessions typically move OUT of application memory?",
        options: ["When adding a CDN", "When adding a load balancer with multiple app servers", "When sharding", "Never — sessions stay local"],
        correct: [1],
        explain:
          "Multiple backends mean any user may hit any node, so per-node session memory breaks. Externalize to Redis or signed cookies before (or exactly when) you add the second app server.",
      },
      {
        id: "sc-q2",
        q: "Writes are 30K/s sustained, primary is maxed, cache hit rate is already 95%. Next move?",
        options: [
          "More read replicas",
          "Bigger Redis",
          "Shard writes by entity key",
          "Add another load balancer",
        ],
        correct: [2],
        explain:
          "Replicas only scale reads; caching already absorbed reads. When WRITE throughput exceeds a single primary, sharding (or a write-optimized store) is the remaining lever.",
      },
      {
        id: "sc-q3",
        q: "Why does reactive autoscaling often arrive too late?",
        options: [
          "Metrics are expensive to collect",
          "CPU crosses thresholds after queues already build; scale-out takes minutes while damage takes seconds",
          "Kubernetes limits replica count",
          "It doesn't — CPU is a leading indicator",
        ],
        correct: [1],
        explain:
          "By the time CPU saturates, request queues have already grown and users feel latency. Leading signals (concurrency, queue depth, saturation predictors) plus pre-scaling for known events close the gap.",
      },
    ],
    exercise: {
      prompt:
        "Take any project you've built. Write its V1→V8 evolution table: at each stage name the metric that would have forced the change and the exact component introduced. Present it as if defending an architecture review.",
      hints: [
        "Be honest about numbers: 'at ~5K QPS my single PG hits 80% CPU' beats vague claims.",
        "Include the failure each stage prevents, not just the feature it adds.",
      ],
    },
  },

  {
    slug: "failure-engineering",
    track: "reliability",
    num: 1,
    title: "Failure Engineering",
    subtitle:
      "Designing for the day things break: timeouts, retries, circuit breakers, bulkheads, graceful degradation and chaos practice.",
    minutes: 24,
    skills: ["distributed", "observability", "architecture"],
    concepts: ["circuit-breaker", "backpressure", "idempotency", "graceful-degradation", "chaos-engineering"],
    blocks: [
      {
        t: "p",
        md: "In distributed systems, **partial failure is the normal state**. The engineering question is never 'will it break' but 'what does it do while broken'. Failure engineering is the set of patterns that turn crashes into degraded-but-alive service.",
      },
      { t: "h", text: "Timeouts: the foundation" },
      {
        t: "list",
        items: [
          "**Every network call gets a timeout.** No exceptions. A missing timeout converts one slow dependency into thread-pool exhaustion across your fleet.",
          "Derive budgets from data: if dependency p99.9 is 300ms, timeout at ~500ms–1s, not 30s.",
          "**Propagate deadlines** downstream: if the caller has 200ms left, the callee should know. gRPC deadlines do this natively; HTTP needs header conventions.",
          "Budget the whole request: auth 20ms + core 150ms + enrichment 100ms ≤ total 300ms. Enforce at each hop.",
        ],
      },
      { t: "h", text: "Retries: helpful servant, deadly master" },
      {
        t: "diagram",
        height: 230,
        caption:
          "Unbounded retries amplify load exactly when the system can least afford it. Backoff+jitter+budgets tame the wave.",
        graph: {
          nodes: [
            { id: "c", label: "Clients", kind: "client", x: 20, y: 40 },
            { id: "s", label: "Service", sub: "already struggling", kind: "app", x: 260, y: 40, state: "warn" },
            { id: "d", label: "Dependency", sub: "slow · timing out", kind: "app", x: 520, y: 40, state: "down" },
            { id: "amp", label: "Retry storm", sub: "3× traffic on 1× capacity", kind: "infra", x: 260, y: 160 },
          ],
          edges: [
            { from: "c", to: "s" },
            { from: "s", to: "d", label: "attempt 1..N" },
            { from: "s", to: "amp", dashed: true },
          ],
        },
      },
      {
        t: "table",
        head: ["Rule", "Why"],
        rows: [
          ["Only retry idempotent operations", "Non-idempotent retries create duplicates (double charges!)"],
          ["Exponential backoff + full jitter", "Avoid synchronized retry waves"],
          ["Cap attempts (2–3) and total time", "Bound worst-case latency amplification"],
          ["Retry budget (e.g., ≤10% of calls)", "Under widespread failure, stop adding fuel"],
          ["Retry only transient errors", "400 will never succeed; retrying burns capacity"],
        ],
      },
      { t: "h", text: "Circuit breakers & bulkheads" },
      {
        t: "code",
        lang: "text",
        title: "Circuit breaker lifecycle (Closed → Open → Half-Open canary)",
        code: `CLOSED ──────── failures ≥ threshold ────────▶ OPEN
   ▲                                             │
   │                                             │ after cooldown
   │ canary succeeds                             ▼
   └──────────────── HALF-OPEN ◀─────────────────┘
                  (strictly 1 canary probe)
                     │
                     │ canary fails
                     ▼
                    OPEN (reset cooldown)`,
      },
      {
        t: "list",
        items: [
          "**Half-Open Canary Throttling:** When the cooldown expires, the breaker transitions to `HALF-OPEN` and permits only a single canary probe (or tightly bounded semaphore). It does NOT open the gates to thousands of pending requests, which would instantly re-crash a struggling dependency.",
          "**Bulkhead:** separate connection pools/thread pools per dependency. Recommendation service dying must not consume checkout's threads.",
          "**Load shedding:** when overloaded, reject lowest-priority work early with clear errors instead of accepting everything and timing out everyone.",
          "**Graceful degradation:** design fallbacks per feature — cached recommendations, default avatars, disabled sorting. The page renders; some sections say 'temporarily unavailable'.",
        ],
      },
      {
        t: "callout",
        kind: "ok",
        title: "Chaos engineering, honestly applied",
        md: "You don't need Netflix-scale tooling. Start small: kill a pod under load in staging (`kubectl delete pod`), add 200ms latency to Redis (toxiproxy), fill a disk, block DNS. Watch dashboards BEFORE reading logs. Every surprise is a missing timeout, absent breaker, or blind dashboard — fix, repeat. The teams that survive incidents are the ones that practiced them.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the cascading collapse anatomy",
        md: "1) DB slows 10× (bad migration plan). 2) App threads pile up waiting 30s timeouts. 3) Pools exhaust; healthy endpoints starve too. 4) Health checks fail; LB removes ALL nodes. 5) Restart storms replay cold caches onto the same sick DB. Each stage is preventable: tight timeouts, breakers, readiness vs liveness separation, warm-up periods. This exact cascade is what the System Simulator lets you trigger and dissect.",
      },
    ],
    quiz: [
      {
        id: "fe-q1",
        q: "A payment POST times out client-side after 5s. The server actually completed it at 6s. Client retries. Result?",
        options: [
          "Nothing — servers dedupe automatically",
          "Double charge unless the API uses idempotency keys",
          "Retry fails because server is down",
          "Timeouts prevent duplicates",
        ],
        correct: [1],
        explain:
          "The retry arrives after the original committed. Without an idempotency key the server sees two distinct payments. This is THE canonical argument for idempotency design on money paths.",
      },
      {
        id: "fe-q2",
        q: "What distinguishes a circuit breaker from a retry policy?",
        options: [
          "Breakers retry faster",
          "Breakers stop sending traffic entirely for a period, protecting both parties; retries re-attempt individual calls",
          "They're identical patterns",
          "Breakers only apply to databases",
        ],
        correct: [1],
        explain:
          "Retries manage individual attempts; the breaker watches aggregate outcomes and cuts the flow when a dependency is clearly unhealthy — converting queued victims into fast failures with fallbacks.",
      },
      {
        id: "fe-q3",
        q: "Which health-check design avoids total fleet removal during a DB outage?",
        options: [
          "All checks verify DB connectivity",
          "Liveness = process up; readiness reflects ability to serve, allowing degraded mode",
          "No health checks at all",
          "Check every 100ms for speed",
        ],
        correct: [1],
        explain:
          "If readiness requires the DB, a DB outage ejects every pod simultaneously. Decoupled checks let nodes serve non-DB features while alerting — partial service beats zero service.",
      },
    ],
    exercise: {
      prompt:
        "Pick a service you own (or the lab stack). Add: per-dependency timeouts derived from measured percentiles, retries with jitter capped at 2 attempts, a circuit breaker with metrics, and one graceful degradation path. Then run toxiproxy experiments: 500ms latency injection, then full cut. Document what your dashboard showed at each stage.",
      hints: [
        "Measure before tuning: p99.9 of the dependency sets your timeout.",
        "Expose breaker state as a metric; alert when open > 1 min.",
        "The degradation path should be a product decision ('show cached prices') not an error page.",
      ],
    },
  },

  {
    slug: "event-driven-architecture",
    track: "advanced",
    num: 1,
    title: "Event-Driven Architecture",
    subtitle:
      "Sagas, outboxes, CQRS and the exactly-once illusion — coordinating workflows that span services without distributed transactions.",
    minutes: 26,
    skills: ["messaging", "distributed", "architecture"],
    concepts: ["saga", "outbox", "cqrs", "event-driven", "idempotency", "exactly-once"],
    blocks: [
      {
        t: "p",
        md: "Once order placement touches Payments, Inventory, Restaurants and Delivery — four databases owned by four teams — the two-phase commit fantasy dies. **Event-driven architecture** coordinates these flows with events and compensations instead of locks. It buys independent scalability and deployability at the price of eventual consistency you must design for deliberately.",
      },
      { t: "h", text: "Choreography vs orchestration" },
      {
        t: "diagram",
        height: 250,
        caption:
          "Choreography: services react to each other's events. Orchestration: a saga conductor commands steps and tracks compensation.",
        graph: {
          nodes: [
            { id: "o", label: "Order Service", sub: "publishes OrderCreated", kind: "app", x: 20, y: 95 },
            { id: "pay", label: "Payment", kind: "app", x: 270, y: 15 },
            { id: "inv", label: "Inventory", kind: "app", x: 270, y: 175 },
            { id: "k", label: "Kafka", kind: "queue", x: 480, y: 95 },
            { id: "saga", label: "Order Saga", sub: "state machine · compensations", kind: "app", x: 700, y: 95 },
          ],
          edges: [
            { from: "o", to: "k", label: "events" },
            { from: "pay", to: "k" },
            { from: "inv", to: "k" },
            { from: "k", to: "saga", label: "consumes all" },
          ],
        },
      },
      {
        t: "table",
        head: ["", "Choreography", "Orchestration"],
        rows: [
          ["Coupling", "Services know only events", "Saga knows the whole flow"],
          ["Visibility", "Flow emerges from code — hard to trace", "Explicit state machine, one place to inspect"],
          ["Best for", "Simple pipelines (≤3 steps)", "Business transactions with compensations"],
          ["Risk", "Cyclic event spaghetti", "Central logic owner (acceptable!)"],
        ],
      },
      { t: "h", text: "The saga pattern" },
      {
        t: "code",
        lang: "text",
        title: "Food order saga with compensations",
        code: `FORWARD:                    COMPENSATION (if later step fails):
1. validate order           —
2. charge payment      ◀──  refund payment
3. reserve inventory   ◀──  release reservation
4. notify restaurant   ◀──  cancel notification
5. assign driver       ◀──  unassign

Rule: every forward step needs either a compensation
or a guarantee it cannot fail after commit.`,
      },
      {
        t: "callout",
        kind: "warn",
        title: "Compensations are business logic, not undo buttons",
        md: "You cannot roll back an email or a charged card automatically. Compensations are new business actions (refund, apology credit) with their own failure modes — they need retries, idempotency and monitoring like everything else. Design the compensation FIRST; if none exists, that step must be last.",
      },
      { t: "h", text: "Outbox + inbox: the honest delivery pair" },
      {
        t: "list",
        items: [
          "**Transactional Outbox:** Write business data and the event payload into an `outbox` table in the *same local database transaction*. No dual-write inconsistency.",
          "**Outbox Relay: Polling vs. CDC:** A background relay process publishes outbox events to Kafka. Choose between **Polling Publisher** (periodic `SELECT ... FOR UPDATE SKIP LOCKED`, simple but adds DB read load) or **Transaction Log Tailing / CDC** (Debezium reading PostgreSQL WAL / MySQL binlog directly, with zero DB query overhead and sub-millisecond latency).",
          "**Inbox Table (Consumer Idempotency):** The consumer stores incoming message IDs in its local database within the transaction that executes the business side effect. Duplicate deliveries result in unique constraint skips.",
          "Together they provide the **effective exactly-once illusion** across distributed microservices.",
        ],
      },
      { t: "h", text: "CQRS: different models for writing and reading" },
      {
        t: "diagram",
        height: 220,
        caption:
          "Writes go through domain models normalized for correctness; events project into denormalized read models tuned for queries.",
        graph: {
          nodes: [
            { id: "cmd", label: "Commands", kind: "client", x: 20, y: 95 },
            { id: "w", label: "Write model", sub: "normalized · transactions", kind: "data", x: 240, y: 95 },
            { id: "e", label: "Events", kind: "queue", x: 450, y: 95 },
            { id: "r1", label: "Feed view", sub: "Redis lists", kind: "cache", x: 680, y: 25 },
            { id: "r2", label: "Search index", kind: "data", x: 680, y: 165 },
          ],
          edges: [
            { from: "cmd", to: "w" },
            { from: "w", to: "e" },
            { from: "e", to: "r1", label: "projector" },
            { from: "e", to: "r2", label: "indexer" },
          ],
        },
      },
      {
        t: "p",
        md: "You don't need full ES+CQRS ceremony to benefit: 'write to Postgres, publish event, project into Redis/search' captures 90% of the value. The cost is projection lag — UIs must show pending states ('posting…') rather than pretending synchronous consistency.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the dual-write ghost",
        md: "A service writes inventory to Postgres AND publishes InventoryChanged to Kafka — two separate clients, no shared transaction. Deploy restarts mid-way: DB updated, event never sent. Downstream projections are now permanently wrong, and nothing alerts because both systems look individually healthy. Only the outbox closes this hole. If you remember one pattern from this chapter, make it this one.",
      },
    ],
    quiz: [
      {
        id: "eda-q1",
        q: "In a saga, charging payment succeeded but inventory reservation failed. Correct response?",
        options: [
          "Roll back the payment via database transaction",
          "Execute the compensation: refund payment, mark order failed, notify user",
          "Leave money charged; retry inventory forever",
          "Manually reconcile later",
        ],
        correct: [1],
        explain:
          "Cross-service rollback doesn't exist. The saga executes the defined compensation path — refund — turning a technical failure into a handled business outcome.",
      },
      {
        id: "eda-q2",
        q: "What problem does the transactional outbox solve?",
        options: [
          "Slow Kafka producers",
          "Atomicity between local DB state changes and event publication",
          "Message ordering across partitions",
          "Schema evolution",
        ],
        correct: [1],
        explain:
          "Dual writes (DB + broker) can diverge on crash. Writing the event in the SAME transaction as the state change, then relaying async, makes publication eventually-guaranteed and consistent.",
      },
      {
        id: "eda-q3",
        q: "An inbox table helps consumers by…",
        options: [
          "Speeding up deserialization",
          "Recording processed message IDs so duplicate deliveries become no-ops within the consumer's own transaction",
          "Compressing payloads",
          "Replacing consumer groups",
        ],
        correct: [1],
        explain:
          "Side effect + inbox insert commit together. A redelivered message finds its ID present and skips — converting at-least-once transport into effectively-once processing.",
      },
      {
        id: "eda-q4",
        q: "Which is the strongest argument FOR orchestration over choreography in an order flow?",
        options: [
          "Orchestration has fewer moving parts",
          "Compensation logic and flow visibility live in one inspectable state machine",
          "Choreography cannot use Kafka",
          "Orchestration guarantees exactly-once",
        ],
        correct: [1],
        explain:
          "Multi-step business transactions with compensations need a single place to answer 'where is order 42 stuck?' Choreography scatters that knowledge across services — fine for simple pipelines, painful for sagas.",
      },
    ],
    exercise: {
      prompt:
        "Model a flight-booking saga: reserve seat → charge card → issue ticket → send email. Write the event list, the compensation for each step, and the outbox/inbox schemas. Identify which step has NO safe compensation and reorder accordingly.",
      hints: [
        "Email is uncompensable — schedule it last.",
        "Ticket issuance might be compensable only until departure time — model that deadline explicitly.",
        "Consider what happens if the refund itself fails — where does it land? (Hint: dead letter + human.)",
      ],
    },
  },
];
