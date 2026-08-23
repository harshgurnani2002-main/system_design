import type { Lab } from "@/lib/types";

const g = (nodes: Lab["architecture"]["nodes"], edges: Lab["architecture"]["edges"]) => ({
  nodes,
  edges,
});

export const LABS: Lab[] = [
  {
    slug: "url-shortener",
    num: 1,
    title: "Build a URL Shortener",
    track: "core",
    minutes: 90,
    objective:
      "Ship a working shortener with idempotent creation, cached redirects and click analytics — the smallest system that exercises real design decisions.",
    prereqs: ["Docker", "Basic Python or Node", "PostgreSQL basics"],
    architecture: g(
      [
        { id: "c", label: "Client", kind: "client", x: 20, y: 60 },
        { id: "api", label: "API", kind: "app", x: 220, y: 60 },
        { id: "rc", label: "Redis", kind: "cache", x: 440, y: 15 },
        { id: "db", label: "Postgres", kind: "data", x: 440, y: 120 },
      ],
      [
        { from: "c", to: "api" },
        { from: "api", to: "rc", label: "hot codes" },
        { from: "api", to: "db" },
      ]
    ),
    instructions: [
      { step: "Scaffold", detail: "FastAPI app with POST /shorten and GET /{code}. Add a Compose file with Postgres + Redis." },
      { step: "Schema", detail: "urls(id BIGINT PRIMARY KEY, code VARCHAR(10) UNIQUE, long_url TEXT, created_at TIMESTAMPTZ). Index code as primary lookup path." },
      { step: "Collision-Free Encoding", detail: "Generate unique 64-bit IDs using a distributed generator (Twitter Snowflake or PostgreSQL sequence range per worker); convert the integer ID to Base62 string (0-9, a-z, A-Z). Unlike MD5 slicing (which hits Birthday Paradox collisions after ~1.8M keys), sequence-to-Base62 is guaranteed 100% collision-free." },
      { step: "Idempotency", detail: "Accept optional Idempotency-Key header; store key→response in Redis for 24h; replay original short URL on duplicate submission." },
      { step: "Cache-aside redirects", detail: "Redis GET url:{code} → miss → DB → SETEX 86400±jitter. Negative-cache missing codes 60s." },
      { step: "Analytics async", detail: "On redirect, INCR clicks:{code} in Redis; background worker flushes batched counter updates to DB every 30s." },
    ],
    code: [
      {
        title: "Base62 integer encoder (collision-free)",
        lang: "python",
        code: `BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

def encode_base62(num: int) -> str:
    """Converts a 64-bit integer (e.g. from Snowflake/DB sequence) to Base62."""
    if num == 0:
        return BASE62_ALPHABET[0]
    digits = []
    while num > 0:
        num, rem = divmod(num, 62)
        digits.append(BASE62_ALPHABET[rem])
    return "".join(reversed(digits))  # e.g., 10000000000 -> 'aUKY8'`,
      },
      {
        title: "redirect with cache-aside",
        lang: "python",
        code: `@app.get("/{code}")
def redirect(code: str):
    long = r.get(f"url:{code}")
    if long is None:
        row = db.execute(
            "SELECT long_url FROM urls WHERE code = %s", (code,)
        ).fetchone()
        if row is None:
            r.setex(f"url:{code}:miss", 60, "1")
            raise HTTPException(404)
        long = row[0]
        r.setex(f"url:{code}", int(86400 * uniform(0.9, 1.1)), long)
    r.incr(f"clicks:{code}")
    return RedirectResponse(long, status_code=302)`,
      },
    ],
    tasks: [
      "Load test redirects: 5K RPS for 2 min; verify DB QPS stays near zero after warmup",
      "Prove idempotency: same Idempotency-Key twice returns identical response",
      "Kill Postgres mid-test; redirects keep serving from cache",
    ],
    hints: [
      "uniform(0.9,1.1) jitter prevents synchronized expiry stampedes.",
      "Watch redis INFO keyspace vs postgres pg_stat_statements to see the cache working.",
    ],
    solution:
      "Reference implementation lives in the academy repo under labs/01-url-shortener/ with tests asserting cache behavior, idempotency replay and negative caching.",
    production: [
      "Add rate limiting per API key on /shorten (abuse magnet)",
      "Malicious URL screening via safe-browsing API before persisting",
      "301 vs 302 decision documented per business need",
    ],
  },
  {
    slug: "rate-limiter-lab",
    num: 2,
    title: "Build a Distributed Rate Limiter",
    track: "core",
    minutes: 75,
    objective:
      "Implement the sliding-window limiter from the Rate Limiting chapter against real Redis, and prove it holds under concurrent load.",
    prereqs: ["Lab 1 environment", "Redis Lua basics"],
    architecture: g(
      [
        { id: "w1", label: "Worker ×50", kind: "client", x: 20, y: 60 },
        { id: "gw", label: "Gateway", kind: "app", x: 230, y: 60 },
        { id: "rl", label: "Redis Lua", kind: "cache", x: 450, y: 60 },
      ],
      [
        { from: "w1", to: "gw" },
        { from: "gw", to: "rl", label: "atomic check" },
      ]
    ),
    instructions: [
      { step: "Script", detail: "Port the chapter's sliding-window Lua script; return {allowed, remaining, retry_after_ms}." },
      { step: "Middleware", detail: "Wrap FastAPI middleware calling the script per user; attach X-RateLimit-* headers to every response." },
      { step: "Fail-open fallback", detail: "On Redis connection error, fall back to conservative local token bucket (10 req/s) and set a metric." },
      { step: "Prove it", detail: "50 threads × 200 requests each against limit=100/min. Assert total admitted ≤ 100 across ALL workers." },
    ],
    code: [
      {
        title: "calling atomically",
        lang: "python",
        code: `script = r.register_script(SLIDING_WINDOW_LUA)

def check(user: str) -> tuple[bool, int]:
    now = int(time.time() * 1000)
    try:
        allowed, remaining = script(
            keys=[f"rate:{user}"],
            args=[now, 60_000, 100],
        )
        return bool(allowed), remaining
    except redis.ConnectionError:
        metrics.limiter_fallback.inc()
        return local_bucket.allow(user), -1`,
      },
    ],
    tasks: [
      "Demonstrate the race: replace Lua with GET+SET logic, run the concurrency test, watch limits break",
      "Kill Redis mid-load; verify fail-open engages and recovers cleanly",
    ],
    hints: [
      "redis-py register_script handles EVALSHA/NOSCRIPT fallback automatically.",
      "The race demo is the point — seeing 140 admitted makes atomicity visceral.",
    ],
    solution: "labs/02-rate-limiter includes both broken and correct versions plus the concurrency assertion harness.",
    production: [
      "Cost-based tokens for expensive endpoints",
      "Per-tenant quotas backed by config service",
      "Alert when fallback metric > 0 for > 30s",
    ],
  },
  {
    slug: "cache-layer",
    num: 3,
    title: "Add a Cache Layer Correctly",
    track: "core",
    minutes: 60,
    objective:
      "Retrofit cache-aside onto a read-heavy endpoint with jittered TTLs, single-flight coalescing and hit-rate metrics.",
    prereqs: ["Lab 1 stack"],
    architecture: g(
      [
        { id: "api", label: "API ×4", kind: "app", x: 20, y: 60 },
        { id: "sf", label: "Single-flight", sub: "per-process", kind: "app", x: 240, y: 60 },
        { id: "rc", label: "Redis", kind: "cache", x: 450, y: 60 },
        { id: "db", label: "Postgres", kind: "data", x: 660, y: 60 },
      ],
      [
        { from: "api", to: "sf" },
        { from: "sf", to: "rc" },
        { from: "sf", to: "db", label: "on miss only" },
      ]
    ),
    instructions: [
      { step: "Baseline", detail: "Load test the un-cached endpoint; record DB QPS and p99." },
      { step: "Cache-aside", detail: "TTL 300s ± 10% jitter; serialize values as JSON; cap value size at 512KB." },
      { step: "Single-flight", detail: "Dict of asyncio futures keyed by cache key; concurrent misses await one DB query." },
      { step: "Metrics", detail: "Counters: hits, misses, coalesced, errors. Grafana-style log lines each minute." },
      { step: "Stampede drill", detail: "Flush Redis under 500-RPS load; compare DB spike with and without single-flight." },
    ],
    tasks: [
      "Achieve > 90% hit rate on realistic access pattern (zipf distribution)",
      "Show the stampede delta numerically between runs",
    ],
    hints: [
      "zipf via numpy.random.zipf for realistic key popularity.",
      "Errors count as misses but must not poison the future map.",
    ],
    solution: "labs/03-cache-layer ships with the zipf generator and before/after flame summaries.",
    production: [
      "Stale-while-revalidate for top-N keys",
      "Separate pools per data class (user vs product) to prevent eviction coupling",
    ],
  },
  {
    slug: "kafka-pipeline",
    num: 4,
    title: "Kafka Event Pipeline",
    track: "messaging",
    minutes: 90,
    objective:
      "Stand up Kafka in Docker, produce order events keyed by user, consume idempotently, and survive deliberate consumer crashes.",
    prereqs: ["Docker Compose", "Lab 1"],
    architecture: g(
      [
        { id: "api", label: "Order API", kind: "app", x: 20, y: 95 },
        { id: "k", label: "Kafka", sub: "orders.events · 6 partitions", kind: "queue", x: 250, y: 95 },
        { id: "c1", label: "Billing consumer", kind: "app", x: 500, y: 40 },
        { id: "c2", label: "Email consumer", kind: "app", x: 500, y: 150 },
        { id: "pg", label: "Postgres", kind: "data", x: 720, y: 95 },
      ],
      [
        { from: "api", to: "k", label: "key=user_id" },
        { from: "k", to: "c1" },
        { from: "k", to: "c2" },
        { from: "c1", to: "pg" },
      ]
    ),
    instructions: [
      { step: "Broker", detail: "Compose: redpanda (single node is fine for labs) + schema of OrderCreated/OrderPaid events." },
      { step: "Outbox relay", detail: "Order API writes outbox rows transactionally; relay polls and produces to Kafka, marks sent." },
      { step: "Consumers", detail: "Billing consumer upserts payments table; inbox table records processed (topic,partition,offset)." },
      { step: "Crash drills", detail: "kill -9 consumer mid-batch repeatedly; assert zero double-charges via inbox dedup." },
      { step: "Lag dashboard", detail: "Log consumer lag every 10s; slow one consumer deliberately and watch lag climb." },
    ],
    code: [
      {
        title: "idempotent consumer core",
        lang: "python",
        code: `for msg in consumer:
    with db.transaction():
        inserted = db.execute(
            """INSERT INTO inbox (topic, part, off_) VALUES (%s,%s,%s)
               ON CONFLICT DO NOTHING RETURNING id""",
            (msg.topic, msg.partition, msg.offset),
        ).fetchone()
        if inserted is None:
            consumer.commit()   # already processed
            continue
        apply_billing(msg.value)   # side effect, same tx
    consumer.commit()`,
      },
    ],
    tasks: [
      "Verify per-user ordering: interleave two users' events, assert per-user sequence intact",
      "Break ordering deliberately (round-robin keys) and observe the corruption",
    ],
    hints: [
      "Redpanda starts faster than ZooKeeper-era Kafka and speaks the same protocol.",
      "Consumer group rebalances during kill drills are expected noise — wait for stability.",
    ],
    solution: "labs/04-kafka-pipeline contains compose, outbox relay, consumers and the chaos script.",
    production: [
      "Schema registry with compatibility rules",
      "DLQ topics + alerting on depth",
      "Partition count ≥ 2× max consumers from day one",
    ],
  },
  {
    slug: "notification-service",
    num: 5,
    title: "Notification Service",
    track: "messaging",
    minutes: 75,
    objective:
      "Build the fan-out pipeline from the interview question: preferences gate, channel adapters, dedup and quiet hours.",
    prereqs: ["Lab 4 running"],
    architecture: g(
      [
        { id: "p", label: "Producers", kind: "client", x: 20, y: 95 },
        { id: "k", label: "Kafka", kind: "queue", x: 210, y: 95 },
        { id: "pref", label: "Preferences", sub: "Redis cache", kind: "cache", x: 420, y: 25 },
        { id: "router", label: "Router", kind: "app", x: 420, y: 165 },
        { id: "push", label: "Push adapter", kind: "infra", x: 660, y: 60 },
        { id: "mail", label: "Email adapter", kind: "infra", x: 660, y: 165 },
      ],
      [
        { from: "p", to: "k" },
        { from: "k", to: "router" },
        { from: "router", to: "pref", label: "check first" },
        { from: "router", to: "push" },
        { from: "router", to: "mail" },
      ]
    ),
    instructions: [
      { step: "Intent contract", detail: "Define NotificationIntent event: user_id, type, entity, payload, dedup_key." },
      { step: "Preference gate", detail: "User prefs table (channel opt-outs, quiet hours TZ-aware); Redis cache 5-min TTL." },
      { step: "Dedup", detail: "SETEX dedup:{key} NX in Redis; duplicate intents within window drop silently (metric them)." },
      { step: "Adapters", detail: "Fake push/email adapters logging sends; simulate provider 429s with probability p; backoff accordingly." },
      { step: "Digest mode", detail: "Optional: buffer low-priority types per user, flush digests hourly." },
    ],
    tasks: [
      "Storm test: 10K duplicate intents → exactly 1 send",
      "Quiet hours: schedule across timezones, verify local-time correctness",
    ],
    hints: [
      "NX on SETEX gives you check-and-set atomically.",
      "Provider backoff belongs in the adapter, never the router.",
    ],
    solution: "labs/05-notifications includes storm-test harness proving dedup under parallel producers.",
    production: [
      "Token hygiene feedback loop from provider failures",
      "Multi-provider email failover",
      "Budget caps on paid channels (SMS)",
    ],
  },
  {
    slug: "order-processing",
    num: 6,
    title: "Order Processing Saga",
    track: "advanced",
    minutes: 120,
    objective:
      "Implement the food-ordering saga end-to-end: orchestration state machine, compensations, outbox and idempotent steps.",
    prereqs: ["Labs 4–5 patterns"],
    architecture: g(
      [
        { id: "o", label: "Order Saga", sub: "state machine", kind: "app", x: 20, y: 95 },
        { id: "pay", label: "Payment svc", kind: "app", x: 260, y: 20 },
        { id: "inv", label: "Inventory svc", kind: "app", x: 260, y: 170 },
        { id: "pg", label: "Each svc: own PG", kind: "data", x: 520, y: 95 },
        { id: "k", label: "Kafka", kind: "queue", x: 740, y: 95 },
      ],
      [
        { from: "o", to: "pay", label: "charge" },
        { from: "o", to: "inv", label: "reserve" },
        { from: "pay", to: "pg" },
        { from: "inv", to: "pg" },
        { from: "o", to: "k", label: "events" },
      ]
    ),
    instructions: [
      { step: "State machine", detail: "orders(state): CREATED→PAID→RESERVED→CONFIRMED | FAILED. Persist transitions with events." },
      { step: "Steps as services", detail: "Payment & inventory as separate processes with own DBs; saga commands via Kafka request/reply or direct HTTP+retry." },
      { step: "Compensations", detail: "refund_payment, release_reservation implemented idempotently (operation IDs)." },
      { step: "Failure injection", detail: "Env flag FAIL_AFTER=charge|reserve crashes the target service post-commit — exercise compensations." },
      { step: "Timeouts", detail: "Saga watchdog: PAID but not RESERVED within 30s → auto-compensate." },
    ],
    tasks: [
      "Run 100 orders with 20% injected failures; assert final consistency (no charged-unreserved money)",
      "Kill the saga process itself mid-flow; recovery must resume from persisted state",
    ],
    hints: [
      "Every command carries an operation UUID; services dedupe on it.",
      "State machine persistence IS the recovery mechanism — no in-memory-only transitions.",
    ],
    solution: "labs/06-order-saga includes the chaos matrix and consistency assertions.",
    production: [
      "Human-review queue for failed compensations",
      "Metrics per transition; alert on stuck states",
      "Deadline-based escalation to support tooling",
    ],
  },
  {
    slug: "containerize-stack",
    num: 7,
    title: "Containerize the Whole Stack",
    track: "infra",
    minutes: 60,
    objective: "Apply the Docker chapter to your lab monolith: multi-stage builds, non-root, healthchecks, one-command startup.",
    prereqs: ["Labs 1–6 code"],
    architecture: g(
      [
        { id: "cmp", label: "docker compose up", kind: "client", x: 20, y: 95 },
        { id: "api", label: "api image", kind: "infra", x: 250, y: 30 },
        { id: "wk", label: "worker image", kind: "infra", x: 250, y: 160 },
        { id: "pg", label: "postgres:16", kind: "data", x: 480, y: 95 },
        { id: "rc", label: "redis:7", kind: "cache", x: 700, y: 95 },
      ],
      [
        { from: "cmp", to: "api" },
        { from: "cmp", to: "wk" },
        { from: "api", to: "pg" },
        { from: "wk", to: "rc" },
      ]
    ),
    instructions: [
      { step: "Multi-stage", detail: "Builder stage installs deps; runtime copies /install prefix. Target < 200MB." },
      { step: "Hardening", detail: "USER 10001, no shell tools beyond curl, read-only rootfs where possible." },
      { step: "Healthchecks", detail: "/healthz checks process; /readyz checks DB+Redis reachability." },
      { step: "Compose polish", detail: "depends_on conditions, named volumes, resource limits (mem_limit) mirroring prod budgets." },
    ],
    tasks: [
      "docker image ls before/after optimization — show the shrink",
      "Simulate OOM: set mem_limit below app usage, watch restart policy engage",
    ],
    hints: ["dive shows layer-by-layer waste.", "pip --no-cache-dir and apt --no-install-recommends compound."],
    solution: "labs/07-containerize has hardened Dockerfiles for every service.",
    production: ["Image signing (cosign)", "Registry garbage collection schedule", "Base image bump automation (renovate)"],
  },
  {
    slug: "deploy-kubernetes",
    num: 8,
    title: "Deploy to Kubernetes",
    track: "infra",
    minutes: 90,
    objective: "Move the Compose stack to kind: Deployments, Services, Ingress, ConfigMaps/Secrets, probes done right.",
    prereqs: ["Lab 7 images"],
    architecture: g(
      [
        { id: "ing", label: "Ingress", kind: "infra", x: 20, y: 95 },
        { id: "svc", label: "Service", kind: "app", x: 220, y: 95 },
        { id: "d1", label: "Deployment api", sub: "replicas 3", kind: "app", x: 430, y: 40 },
        { id: "sts", label: "Postgres", sub: "PVC-backed", kind: "data", x: 430, y: 160 },
        { id: "cm", label: "ConfigMap/Secret", kind: "data", x: 680, y: 95 },
      ],
      [
        { from: "ing", to: "svc" },
        { from: "svc", to: "d1" },
        { from: "d1", to: "cm" },
        { from: "sts", to: "cm" },
      ]
    ),
    instructions: [
      { step: "Cluster", detail: "kind create cluster; load your images into it (kind load docker-image)." },
      { step: "Manifests", detail: "Namespace sda-labs; Deployment api with requests/limits, readiness/liveness split correctly." },
      { step: "Data tier", detail: "Postgres via StatefulSet + PVC (or CloudNativePG operator if adventurous)." },
      { step: "Ingress", detail: "nginx-ingress via helm; route lab.local → api service; self-signed TLS." },
      { step: "Drills", detail: "Scale 1→5; delete a pod under load; rollout undo a bad image tag." },
    ],
    tasks: [
      "Zero-downtime proof: continuous load during rolling update, zero failed requests",
      "Probe surgery: make liveness depend on Postgres, trigger DB outage, document the cascade you just built",
    ],
    hints: [
      "kubectl get endpoints -w shows readiness gating live.",
      "The probe-surgery drill is the K8s chapter's warning made real.",
    ],
    solution: "labs/08-kubernetes ships kustomize overlays for dev/prod variants.",
    production: ["PodDisruptionBudgets", "NetworkPolicies default-deny", "ResourceQuotas per namespace"],
  },
  {
    slug: "autoscaling",
    num: 9,
    title: "Autoscale It",
    track: "infra",
    minutes: 60,
    objective: "Wire HPA + metrics-server, drive real load, and watch scale-out/scale-in behave under graceful termination.",
    prereqs: ["Lab 8 cluster"],
    architecture: g(
      [
        { id: "load", label: "Load gen", kind: "client", x: 20, y: 95 },
        { id: "hpa", label: "HPA", sub: "target 70% CPU", kind: "app", x: 230, y: 95 },
        { id: "dep", label: "Deployment", sub: "1→10 replicas", kind: "app", x: 450, y: 95 },
        { id: "met", label: "metrics-server", kind: "infra", x: 450, y: 200 },
      ],
      [
        { from: "load", to: "dep" },
        { from: "hpa", to: "dep" },
        { from: "met", to: "hpa", label: "usage/requests" },
      ]
    ),
    instructions: [
      { step: "Metrics", detail: "Install metrics-server (kind needs insecure-TLS flags); verify kubectl top pods works." },
      { step: "Requests first", detail: "Set cpu requests — HPA is dead without them (watch it report <unknown>)." },
      { step: "HPA", detail: "min 2 max 10, targetAverageUtilization 70%, stabilizationWindow tuned." },
      { step: "Drive load", detail: "hey/k6 ramp script; watch replicas climb; cut load; watch scale-in respect grace periods." },
    ],
    tasks: [
      "Plot replica count vs RPS over time; identify reaction lag",
      "Break scaling: remove requests, observe unknown metrics, fix",
    ],
    hints: ["CPU lags demand — consider custom metrics (concurrency) once CPU works.", "terminationGracePeriodSeconds governs drain during scale-in."],
    solution: "labs/09-autoscaling includes the k6 ramp and expected timeline annotations.",
    production: ["KEDA for queue-depth-driven scaling", "PodDisruptionBudget during scale-in", "Pre-scale for known events"],
  },
  {
    slug: "prometheus-grafana",
    num: 10,
    title: "Prometheus + Grafana",
    track: "observability",
    minutes: 75,
    objective: "Instrument RED metrics, scrape with Prometheus, build the golden dashboard, alert on SLO burn.",
    prereqs: ["Any running lab service"],
    architecture: g(
      [
        { id: "app", label: "App /metrics", kind: "app", x: 20, y: 95 },
        { id: "prom", label: "Prometheus", sub: "scrape 15s", kind: "data", x: 240, y: 95 },
        { id: "graf", label: "Grafana", kind: "infra", x: 460, y: 40 },
        { id: "alert", label: "Alertmanager", kind: "infra", x: 460, y: 160 },
      ],
      [
        { from: "prom", to: "app" },
        { from: "prom", to: "graf" },
        { from: "prom", to: "alert" },
      ]
    ),
    instructions: [
      { step: "Instrument", detail: "prometheus-client: http_requests_total by endpoint/status, histogram _duration_seconds." },
      { step: "Scrape", detail: "Prometheus config targeting your service; verify targets UP in its UI." },
      { step: "Dashboard", detail: "Grafana: rate(), error ratio, histogram_quantile p50/p95/p99 per endpoint — RED complete." },
      { step: "SLO burn", detail: "Recording rule: 99% success over 5m; Alertmanager rule pages when burn > 14.4× (fast burn)." },
      { step: "Fire drill", detail: "Inject failures until the alert fires; acknowledge through the full path." },
    ],
    tasks: [
      "Break cardinality on purpose (label user_id), watch Prometheus memory, then fix",
      "Answer 'is it healthy?' for three endpoints using ONLY your dashboard",
    ],
    hints: ["histogram_quantile(0.99, sum by (le) (rate(..._bucket[5m]))) is the incantation.", "Burn-rate alerts need TWO windows (fast+slow) to avoid flapping."],
    solution: "labs/10-prometheus includes dashboard JSON importable to Grafana.",
    production: ["Long-term storage (Thanos/Mimir) when one Prometheus isn't enough", "Exemplars linking panels→traces"],
  },
  {
    slug: "tracing",
    num: 11,
    title: "Distributed Tracing",
    track: "observability",
    minutes: 60,
    objective: "Thread OpenTelemetry traces through two services + Redis + Postgres; find a planted latency bug via Tempo.",
    prereqs: ["Lab 10 stack"],
    architecture: g(
      [
        { id: "gw", label: "gateway svc", kind: "app", x: 20, y: 95 },
        { id: "feed", label: "feed svc", kind: "app", x: 240, y: 95 },
        { id: "rc", label: "Redis", kind: "cache", x: 460, y: 30 },
        { id: "pg", label: "Postgres", kind: "data", x: 460, y: 160 },
        { id: "otlp", label: "OTel → Tempo", kind: "infra", x: 680, y: 95 },
      ],
      [
        { from: "gw", to: "feed", label: "traceparent" },
        { from: "feed", to: "rc" },
        { from: "feed", to: "pg" },
        { from: "gw", to: "otlp", dashed: true },
        { from: "feed", to: "otlp", dashed: true },
      ]
    ),
    instructions: [
      { step: "SDK", detail: "opentelemetry-auto-instrumentation for your framework; OTLP exporter to collector." },
      { step: "Propagate", detail: "Confirm traceparent header crosses service boundary; spans merge into one trace." },
      { step: "Plant the bug", detail: "Hidden env flag adds 400ms sleep inside feed svc's cache-miss branch." },
      { step: "Hunt", detail: "Using ONLY trace waterfalls, find which span eats latency; correlate to code line." },
    ],
    tasks: [
      "Compute % of trace time per span type across 100 traces",
      "Enable tail sampling: keep all errors + slow (>1s) traces, 5% of rest",
    ],
    hints: ["Auto-instrumentation covers DB/Redis clients — look for the manual span around business logic.", "Sampling config lives in the collector, not the SDK, for tail sampling."],
    solution: "labs/11-tracing plants three distinct bugs with expected diagnosis times.",
    production: ["Sampler strategy per traffic class", "Span attributes budget (cardinality!)", "Service graphs in Grafana for topology at a glance"],
  },
  {
    slug: "cicd-pipeline",
    num: 12,
    title: "Full CI/CD Pipeline",
    track: "infra",
    minutes: 90,
    objective: "Assemble the GitHub Actions pipeline from the CI/CD chapter for your lab repo: gates, caching, environments, rollback drill.",
    prereqs: ["GitHub repo", "Labs 7–8 artifacts"],
    architecture: g(
      [
        { id: "push", label: "Push / PR", kind: "client", x: 20, y: 95 },
        { id: "ci", label: "Lint+Test", sub: "pg service container", kind: "app", x: 210, y: 95 },
        { id: "build", label: "Buildx+Scan", kind: "infra", x: 420, y: 95 },
        { id: "env", label: "Environment: prod", sub: "approval gate", kind: "infra", x: 630, y: 40 },
        { id: "dep", label: "Deploy+Verify", kind: "app", x: 630, y: 150 },
      ],
      [
        { from: "push", to: "ci" },
        { from: "ci", to: "build" },
        { from: "build", to: "env" },
        { from: "env", to: "dep" },
      ]
    ),
    instructions: [
      { step: "CI job", detail: "pytest with Postgres service container; coverage gate 80%; pip + buildx GHA caches." },
      { step: "Build job", detail: "needs: test; push SHA-tagged image to GHCR; Trivy CRITICAL/HIGH exit-code gate." },
      { step: "Deploy job", detail: "environment: production (protected); kubectl set image + rollout status timeout 120s." },
      { step: "Branch protection", detail: "Require ci/test + ci/build on main; linear history; dismiss stale approvals." },
      { step: "Disaster drill", detail: "Deploy intentionally-broken image; watch rollout fail; rollback timed under 3 min." },
    ],
    tasks: [
      "Pipeline wall-clock < 8 min warm; prove cache hit on second run",
      "Attempt merging with failing required check — confirm GitHub blocks you",
    ],
    hints: ["GITHUB_TOKEN packages:write permission scopes registry access cleanly.", "rollout status exiting nonzero IS your health gate — don't add sleep hacks."],
    solution: "labs/12-cicd contains the workflow file matching the chapter, annotated.",
    production: ["OIDC cloud auth instead of static keys", "Canary analysis step before full rollout", "Pipeline-as-product: own its flakiness"],
  },
  {
    slug: "outage-simulation",
    num: 13,
    title: "Simulate a Production Outage",
    track: "observability",
    minutes: 90,
    objective:
      "Capstone: break your running stack in five scripted ways and diagnose each using only dashboards, logs and traces — then write the postmortems.",
    prereqs: ["Labs 8–11 observability live"],
    architecture: g(
      [
        { id: "chaos", label: "Chaos controller", sub: "toxiproxy / kubectl", kind: "infra", x: 20, y: 95 },
        { id: "stack", label: "Your stack", kind: "app", x: 260, y: 95 },
        { id: "obs", label: "Dashboards", sub: "metrics·logs·traces", kind: "data", x: 500, y: 95 },
        { id: "pm", label: "Postmortem doc", kind: "client", x: 730, y: 95 },
      ],
      [
        { from: "chaos", to: "stack" },
        { from: "stack", to: "obs" },
        { from: "obs", to: "pm" },
      ]
    ),
    instructions: [
      { step: "Scenario A", detail: "Redis network cut (toxiproxy timeout). Expected symptoms: latency spike, fallback metric, degraded-but-alive IF you built fail-open." },
      { step: "Scenario B", detail: "Postgres connection exhaustion (open 200 idle conns externally). Watch pool waits surface in traces." },
      { step: "Scenario C", detail: "Slow dependency: inject 800ms into payment adapter. Circuit breaker should open; verify fallback served." },
      { step: "Scenario D", detail: "Memory leak: allocate-and-hold loop in one pod; catch OOMKill loop via memory panel BEFORE crash-loop alerts." },
      { step: "Scenario E", detail: "Bad deploy: ship version logging wrong correlation IDs; feel the diagnostic pain; then fix observability debt." },
      { step: "Write-up", detail: "For each: detection time, diagnosis path (which signal led where), MTTR, and ONE prevention item." },
    ],
    tasks: [
      "All five scenarios diagnosed without reading application source code",
      "Postmortems follow blameless template: timeline, impact, root cause, action items",
    ],
    hints: [
      "Change ONE variable at a time; note dashboard timestamps as you go.",
      "If a scenario doesn't alert, that's a finding — your observability gap, documented.",
    ],
    solution: "labs/13-outage includes expected symptom timelines per scenario and a postmortem template.",
    production: [
      "GameDays quarterly with the real on-call rotation",
      "Error budgets fund the fixes postmortems generate",
      "Chaos experiments graduate to CI after three clean runs",
    ],
  },
];
