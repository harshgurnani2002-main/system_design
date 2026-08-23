import type { CaseStudy } from "@/lib/caseTypes";

/* ------------------------------------------------------------------ */
/*  Shared layout helpers — consistent coordinates across all studies  */
/* ------------------------------------------------------------------ */

const n = (id: string, label: string, kind: CaseStudy["architecture"]["nodes"][number]["kind"], x: number, y: number, sub?: string) => ({
  id,
  label,
  kind,
  x,
  y,
  ...(sub ? { sub } : {}),
});

/* ================================================================== */
/*  URL SHORTENER                                                      */
/* ================================================================== */

const urlShortener: CaseStudy = {
  slug: "url-shortener",
  name: "URL Shortener",
  tagline: "The canonical warm-up done properly: ID generation, a redirect hot path measured in microseconds, and analytics that never touch it.",
  category: "Primitives",
  difficulty: "Warm-up",
  minutes: 18,

  problem: [
    "Users paste a long URL and receive a short code; anyone who hits that code is redirected to the original. That is the entire product — which is precisely why interviewers use it: with no domain complexity to hide behind, every shortcut you take in requirements, estimation, or data modeling is immediately visible.",
    "The shape of the workload decides everything: writes are rare (~40/sec), redirects are relentless (100:1 read skew), and a single row lookup must resolve in single-digit milliseconds billions of times a month. Design poorly here and you have built a slow database proxy with a vanity domain.",
  ],

  requirements: {
    functional: [
      "Create a short code for a given long URL; return the full short link",
      "Redirect any visitor of a short code to the destination URL",
      "Optional expiry date and disable/revoke per code",
      "Basic analytics: click counts, referrers, rough geography per code",
      "Custom domains for enterprise customers (brand.co/abc123)",
      "Blocklist screening at creation (malware, phishing, parked domains)",
    ],
    nonFunctional: [
      "Redirect p99 < 10ms server-side; perceived latency dominated by network anyway",
      "Highly available reads — a redirect outage breaks every customer link simultaneously",
      "Codes immutable: a code NEVER changes destination after publication",
      "Creation strongly consistent (no duplicate codes, no lost mappings)",
      "Analytics eventual: seconds of lag acceptable, zero impact on redirect path",
    ],
  },

  capacity: [
    { label: "New codes/month", value: "100M", note: "~40 writes/sec average — trivial" },
    { label: "Read:write ratio", value: "100:1", note: "shared links accumulate clicks" },
    { label: "Redirects/month", value: "10B", note: "~3.9K QPS avg, ~20K peak" },
    { label: "Row size", value: "~400B", note: "code, url, owner, timestamps" },
    { label: "Code-table growth", value: "~40GB/year", note: "fits one Postgres primary for years" },
    { label: "Click events/month", value: "10B raw", note: "rolled up ~100:1 into hourly aggregates" },
    { label: "Hot set in Redis", value: "<5GB", note: ">90% of traffic hits popular codes" },
  ],

  api: [
    { method: "POST", path: "/shorten", desc: "Body: {url, expires_at?, custom_alias?} — screens blocklists, allocates code, inserts, warms nothing (lazy)" },
    { method: "GET", path: "/{code}", desc: "The redirect itself: Redis lookup, 302 with Location header, emits click event async" },
    { method: "GET", path: "/codes/{code}/stats", desc: "Serves pre-aggregated rollups — never queries raw click rows" },
    { method: "DELETE", path: "/codes/{code}", desc: "Soft-disable: sets revoked_at; redirect returns 410 thereafter" },
    { method: "POST", path: "/domains", desc: "Register custom domain: verify ownership, provision ACME cert, attach CDN" },
  ],

  dataModel: [
    { name: "codes", fields: "code PK(base62), url TEXT, owner_id, created_at, expires_at?, revoked_at?", note: "the entire core product is this one indexed table" },
    { name: "aliases", fields: "custom_code PK, domain, code FK", note: "only for custom aliases/domains; keeps codes PK uniform" },
    { name: "click_events", fields: "code, ts, ip_hash, ua_class, referer, country", note: "Kafka stream — raw retention 7 days for replay" },
    { name: "click_rollups_1h", fields: "code, hour_bucket, country, referer_class, count", note: "(code, hour, ...) aggregate — stats reads never touch raw events" },
  ],

  architecture: {
    nodes: [
      n("users", "Users", "client", 20, 240),
      n("cdn", "CDN", "cache", 240, 80, "custom domains · TLS"),
      n("lb", "Load Balancer", "app", 240, 240),
      n("redir", "Redirect Service", "app", 470, 160, "hot path · stateless"),
      n("api", "Create API", "app", 470, 360, "screening · allocation"),
      n("redis", "Redis", "cache", 700, 80, "hot codes · negative cache"),
      n("kafka", "Kafka", "queue", 700, 360, "click.events"),
      n("pg", "PostgreSQL", "data", 930, 160, "codes + rollups"),
      n("awork", "Analytics Workers", "app", 930, 360, "batch rollups"),
      n("mon", "Monitoring", "infra", 1160, 240, "miss ratio · lag"),
    ],
    edges: [
      { from: "users", to: "cdn", label: "vanity domains" },
      { from: "users", to: "lb", label: "HTTPS", flow: true },
      { from: "lb", to: "redir", label: "GET /:code", flow: true },
      { from: "lb", to: "api", label: "POST /shorten" },
      { from: "redir", to: "redis", label: "cache-aside GET", flow: true },
      { from: "redir", to: "pg", dashed: true, label: "miss fallback ~2%" },
      { from: "redir", to: "kafka", label: "click event", flow: true },
      { from: "api", to: "pg", label: "INSERT code" },
      { from: "kafka", to: "awork", flow: true },
      { from: "awork", to: "pg", label: "hourly rollups" },
      { from: "kafka", to: "mon", dashed: true, label: "lag" },
      { from: "awork", to: "mon", dashed: true },
    ],
    flows: [
      { id: "us-create", path: ["users", "lb", "api", "pg"], color: "#2563EB", speed: 260, label: "create path" },
      { id: "us-redirect", path: ["users", "lb", "redir", "redis"], color: "#16A34A", speed: 340, label: "redirect hot path" },
    ],
  },

  archNotes: [
    "Two paths with wildly different budgets: creation is a 50ms transactional write nobody waits on eagerly; redirection is a sub-5ms lookup executed 4,000 times a second. They share almost nothing and are deployed independently.",
    "Analytics is structurally banished from the hot path: the redirect service only emits a fire-and-forget event to Kafka. A click costs one network publish, never a database write.",
    "Redis holds hot codes AND negative entries (recently-missed unknown codes) so enumeration scanners hammer Redis, not Postgres.",
    "Stateless redirect fleet means capacity is pure horizontal scaling; the database is the only stateful tier and it barely notices traffic.",
    "At 10x everything still works: 400 writes/sec and 40K reads/sec are embarrassingly small numbers for this topology. That is the lesson — recognize when the boring design IS the right one.",
  ],

  requestFlow: [
    {
      title: "Shorten request arrives",
      detail: "POST /shorten passes auth, then screening: URL well-formedness, safe-browsing blocklist, per-account rate limits, reserved-word check. Abusive payloads die here, before touching storage.",
      edge: ["users", "lb"],
      nodes: ["api"],
      tag: "~1ms checks",
    },
    {
      title: "Base62 encode the next ID",
      detail: "Allocator reserves a counter range (each app instance leases blocks of 10K, so no per-request coordination) and encodes the integer in base62 — 7 chars covers 62^7, about 3.5 trillion codes.",
      edge: ["lb", "api"],
      nodes: ["api"],
      tag: "no locks",
    },
    {
      title: "Persist the mapping",
      detail: "Single-row INSERT into codes. The primary key IS the code, so uniqueness is enforced structurally. Custom aliases go through the same insert with a retry-on-conflict loop.",
      edge: ["api", "pg"],
      tag: "~4ms commit",
    },
    {
      title: "User shares the link",
      detail: "No infrastructure involved — the short link propagates through chat apps, QR codes, and social posts. This organic distribution is what builds the extreme read skew we designed for.",
      nodes: ["cdn"],
      tag: "skew begins",
    },
    {
      title: "Visitor hits the code",
      detail: "GET /aB3xK9t lands on any redirect pod. The handler validates nothing but syntax — auth does not exist on the public hot path — and issues one Redis GET.",
      edge: ["lb", "redir"],
      nodes: ["redir"],
      tag: "stateless hop",
    },
    {
      title: "Redis HIT serves in under 5ms",
      detail: "Destination URL returned as a plain string, 302 emitted, one click event published to Kafka asynchronously, done. Over 90% of all traffic ends here and never reaches Postgres.",
      edge: ["redir", "redis"],
      tag: "<5ms total",
    },
    {
      title: "Miss path (and negative caching)",
      detail: "On a miss, Postgres answers (~2ms more), the entry is backfilled with jittered TTL — and unknown codes are cached as short-lived tombstones so scanner floods stop at Redis. Miss ratio above 5% pages, because it usually means a flushed cache, not bad luck.",
      edge: ["redir", "pg"],
      nodes: ["pg", "kafka"],
      tag: "miss ~2%",
    },
  ],

  deepDives: [
    {
      topic: "ID generation: the whole system in miniature",
      body: "Counter-plus-base62 versus random-string-with-unique-index is the first real fork in the road, and it previews decisions you will face at every scale: coordination versus collision-retry, predictability versus opacity.",
      bullets: [
        "Counter + base62: dense, short (7 chars at 3.5T capacity), zero collisions — but sequential codes are enumerable, letting competitors scrape your link graph.",
        "Random 8-char codes: no coordination, unguessable — but birthday-bound collisions appear around ~15M live codes, so the unique-index retry loop is mandatory, not optional.",
        "Hybrid used here: sequential counter encrypted with a format-preserving permutation (Feistel network) — dense storage, non-enumerable output, still collision-free.",
        "Whatever you choose, the code lives in the PRIMARY KEY: uniqueness is a structural guarantee, not application logic.",
      ],
    },
    {
      topic: "301 vs 302: an HTTP caching decision with revenue attached",
      body: "The redirect status code looks like trivia; it actually determines whether you ever see repeat traffic again. Browsers treat them completely differently, and the choice is irreversible in one direction.",
      bullets: [
        "301 (permanent): browsers cache aggressively — subsequent clicks never touch your servers. Cheapest possible redirects, but analytics flatlines and a compromised/wrong destination is stuck until users clear caches.",
        "302/307 (temporary): every click round-trips through you. You pay bandwidth for the privilege of accurate counts, mid-flight fixes, and A/B routing.",
        "Rule of thumb: analytics-funded products MUST use 302; static 'link shortened once, forever' tools can afford 301.",
        "Either way, set Cache-Control explicitly on responses — silent heuristics are how accidental 301-style behavior happens with a 302.",
      ],
    },
    {
      topic: "Cache-aside arithmetic: why a 98% hit rate changes the database you buy",
      body: "At 4K QPS, a 98% cache hit rate leaves ~80 QPS reaching Postgres — one modest replica idles through it. Every point of hit rate you lose multiplies database load by 1.5x or worse.",
      bullets: [
        "Popularity follows Zipf: the top ~50K codes absorb most clicks, so a small Redis working set yields huge hit rates. Precompute nothing; lazily backfill on miss.",
        "TTL jitter (e.g., 24h ± 20%) prevents synchronized expiry storms when a batch of links went viral the same hour.",
        "Negative caching caps scanner damage: unknown-code lookups get 60-second tombstones, converting enumeration attacks from DB incidents into Redis noise.",
        "Monitor MISS RATIO as a first-class SLO, not just latency — it is the earliest signal of cache trouble.",
      ],
    },
  ],

  failures: [
    {
      id: "redis-flush",
      title: "Redis flush storm onto Postgres",
      fail: ["redis"],
      story: "A misconfigured deploy runs FLUSHALL during a traffic peak. Every redirect misses; the full 4K QPS lands on Postgres within seconds. Warm-up discipline decides whether this is a slow minute or an outage.",
      reroute: ["lb", "redir", "pg"],
      metrics: [
        { label: "DB read QPS", before: "~80", after: "42K", bad: true },
        { label: "Redirect p95", before: "4ms", after: "180ms", bad: true },
        { label: "Availability", before: "100%", after: "99.2%", bad: true },
      ],
      lessons: [
        "Never let an empty cache meet full traffic: on restart, warm the top-N codes BEFORE taking production load.",
        "Request coalescing (single flight per missing key) turns 40K simultaneous identical misses into 50K-distinct-keys worth of actual queries.",
        "Postgres itself survives 40K indexed point-reads — the near-death experience teaches why the miss ratio SLO exists.",
        "Destructive Redis commands belong behind ACLs and require a maintenance flag; FLUSHALL at 2am is a career event.",
      ],
    },
    {
      id: "analytics-lag",
      title: "Analytics consumer falls behind",
      fail: [],
      degrade: ["kafka"],
      story: "A customer's campaign goes viral and click events triple. Rollup workers accumulate lag; dashboards show stale counts. Redirects continue unaffected — the isolation was the design.",
      reroute: ["redir", "kafka", "awork"],
      metrics: [
        { label: "Consumer lag", before: "3K msgs", after: "28M msgs", bad: true },
        { label: "Stats freshness", before: "<60s", after: "~25 min", bad: true },
        { label: "Redirect p99", before: "4ms", after: "4ms", bad: false },
      ],
      lessons: [
        "The redirect SLA and analytics SLA are independent by construction — prove it by breaking one deliberately in GameDays.",
        "Alert on lag GROWTH RATE; absolute lag recovers itself once the campaign cools.",
        "Rollups are idempotent (keyed by code+hour bucket), so replaying a backlog after scaling out is safe.",
        "Raw-event retention (7 days) lets you rebuild any rollup window after a bug — analytics mistakes are recoverable; redirect mistakes are not.",
      ],
    },
  ],

  scaling: [
    { stage: "10K users", action: "Single Postgres, redirects read straight from it", why: "Even at 100:1 skew this is a few hundred QPS — measure before adding components." },
    { stage: "1M", action: "Add Redis cache-aside + negative caching", why: "DB p99 jitter during backups/vacuums becomes visible; the cache buys tail latency." },
    { stage: "10M", action: "Async analytics via Kafka + rollup tables", why: "Click-volume writes begin competing with redirect reads for the same rows." },
    { stage: "100M+", action: "Read replicas for stats, custom domains on CDN, blocklist screening service", why: "Isolation of concerns completes; the core redirect path has not changed since day one." },
  ],

  tradeoffs: [
    {
      a: "Counter + base62",
      aBlurb: "Sequential allocator, encoded dense",
      b: "Random codes + unique index",
      bBlurb: "Unguessable strings, retry on conflict",
      dims: [
        { name: "Collision handling", a: "None — density guaranteed", b: "Retry loop required forever", winner: "a" },
        { name: "Enumerability", a: "Scrapable if unpermuted", b: "Effectively unguessable", winner: "b" },
        { name: "Coordination", a: "Needs ID ranges or a sequence", b: "Fully decentralized", winner: "b" },
        { name: "Code length at scale", a: "Shortest possible (dense)", b: "+1–2 chars for equal entropy", winner: "a" },
      ],
      verdict: "Counter-based generation wins operationally; add a Feistel permutation if scrapability matters. Random codes are the right answer when NO coordination component may exist — know which constraint you are actually under.",
    },
    {
      a: "301 Permanent",
      aBlurb: "Browser caches the redirect",
      b: "302 Temporary",
      bBlurb: "Every click returns to origin",
      dims: [
        { name: "Repeat-click cost", a: "Zero after first visit", b: "Full lookup every time", winner: "a" },
        { name: "Analytics fidelity", a: "Undercounts massively", b: "Exact per-click stream", winner: "b" },
        { name: "Fixing mistakes", a: "Nearly impossible once cached", b: "Instant, next click", winner: "b" },
        { name: "SEO link equity", a: "Passes through", b: "Weaker signal", winner: "a" },
      ],
      verdict: "If your business model depends on knowing clicks (almost every commercial shortener), 302 is not negotiable. Choose 301 only when the link's job ends after the first hop.",
    },
  ],

  alternatives: [
    "KV store (DynamoDB/Cassandra-style) as the code table — effortless write scale, but you give up relational integrity for owners/analytics joins you barely need anyway; viable and boring.",
    "Serve redirects entirely from an edge KV (Cloudflare Workers-style) — single-digit-ms global latency, at the cost of eventual consistency for revocation.",
    "Hash the URL itself (MD5-truncate) as the code — free deduplication of identical destinations, but leaks which sites are popular and still needs collision handling.",
  ],

  interview: {
    prompt: "Design bit.ly: 100M new links/month, 100:1 read skew, per-link click analytics. You have 18 minutes — go.",
    stages: [
      { name: "Requirements", expect: "Scope to shorten + redirect + basic analytics OUT LOUD. Candidates who fail this warm-up usually failed to scope, not to design." },
      { name: "Estimation", expect: "Derive ~40 writes/sec and ~4K reads/sec, then SAY the conclusion: a single Postgres suffices for years. Refusing to scale-down is as wrong as refusing to scale-up." },
      { name: "ID generation", expect: "Present counter+base62 vs random+unique-index with the enumerability and collision tradeoffs; mention permutation as the resolution." },
      { name: "Redirect path", expect: "302 vs 301 tied to the analytics business case; cache-aside with jittered TTLs and negative caching; <5ms budget stated." },
      { name: "Async analytics", expect: "Click events to Kafka, rollup tables for reads — and articulate WHY nothing synchronous belongs on the redirect path." },
      { name: "Failure & abuse", expect: "Walk the flush storm (warmup, coalescing) and enumeration attacks (negative caching, rate limits). Clean answers here convert a warm-up into a strong signal." },
    ],
  },

  production: [
    "Screen every creation against safety blocklists BEFORE insert; a shortener that hosts phishing gets domain-flagged by browsers within hours, killing all customers at once.",
    "Reserve a code namespace (api/, admin, profanity) at the allocator level — retrofitting reserved words after 100M codes is misery.",
    "Custom domains require ownership verification: otherwise your platform offers free phishing hosting on someone else's brand.",
    "Expose ?preview for suspicious links; it is cheaper than the support tickets and reputation damage of drive-by redirects.",
    "Watch p99 of the REDIRECT specifically during vacuum/backup windows — the cache hides DB degradation until it doesn't.",
  ],

  costs: [
    "This system is nearly free at honest scale: one small Postgres, one Redis, two tiny stateless fleets. If someone proposes Cassandra here, ask what number drove it.",
    "Real spend concentrates in TLS certificates for custom domains, blocklist API calls, and abuse-mitigation tooling — operational, not architectural, costs.",
    "Kafka retention is the only growing bill; 7-day raw retention plus indefinite rollups keeps it flat regardless of traffic growth.",
  ],
};

/* ================================================================== */
/*  RATE LIMITER                                                       */
/* ================================================================== */

const rateLimiterSystem: CaseStudy = {
  slug: "rate-limiter",
  name: "Rate Limiter",
  tagline: "Not one algorithm — a stack of them: IP-level shields at the edge, API-key quotas at the gateway, per-user precision in services, and what happens the day Redis dies.",
  category: "Primitives",
  difficulty: "Warm-up",
  minutes: 20,

  problem: [
    "\"Add rate limiting\" sounds like one feature. In reality a serious platform enforces SEVERAL nested limit systems, each mapped to a different identity and trust level: source IPs at the network edge (cheap, coarse, sometimes wrong behind NAT), API keys at the gateway (contractual quotas customers paid for), and individual users/resources deep in services (business rules like five login attempts per minute).",
    "The engineering substance is elsewhere: making a distributed counter both correct and fast (atomic Lua, server-authoritative time), keeping the limiter itself from becoming your single point of failure (fail-open philosophy with local fallback buckets), and designing the client contract — headers, 429 semantics, Retry-After — so well-behaved clients back off gracefully instead of retry-storming you.",
  ],

  requirements: {
    functional: [
      "Enforce limits keyed by IP (edge), API key + plan (gateway), user/resource pairs (services)",
      "Multiple algorithm profiles: fixed window, sliding window, token bucket — assigned per rule",
      "Weighted/cost-based limits: endpoints consume variable units against one budget",
      "Central rule management with hot-reload; shadow mode to trial new rules unenforced",
      "Standard client contract: X-RateLimit-* headers, 429 with Retry-After",
      "Graceful degradation mode when the central counter store is unreachable",
    ],
    nonFunctional: [
      "Limiter adds < 2ms p99 to request latency at 100K RPS",
      "Counter decisions exact under concurrency (no check-then-set races)",
      "Limiter outage must NEVER hard-fail traffic — availability over precision",
      "Rule changes propagate fleet-wide in < 5s without deploys",
      "Full audit trail: who was limited, by which rule, when",
    ],
  },

  capacity: [
    { label: "Gateway peak", value: "100K RPS", note: "every request triggers ≥1 counter op" },
    { label: "Counter ops/sec", value: "~100K Lua evals", note: "≈ traffic rate; batched where rules share keys" },
    { label: "Redis sizing", value: "2–3 primaries", note: "each shard sustains ~50–80K simple ops/s" },
    { label: "Active keys", value: "~10M", note: "client×route combos alive in a window" },
    { label: "Memory per key", value: "~120B", note: "counter + metadata + TTL overhead" },
    { label: "Live counter memory", value: "~1.2GB", note: "trivial; eviction policy still required" },
    { label: "Fail-open headroom", value: "200K buckets/pod", note: "~50MB RAM per gateway pod" },
  ],

  api: [
    { method: "HDR", path: "X-RateLimit-Limit | Remaining | Reset", desc: "Stamped on EVERY response — allowed or not. Clients that can see the wall stop driving into it." },
    { method: "429", path: "+ Retry-After: <seconds>", desc: "Rejections carry the exact reset math: ceil(window_reset − now). Well-behaved SDKs sleep exactly that long." },
    { method: "LUA", path: "EVAL check(key, delta, limit, ttl)", desc: "Single atomic script: INCR (or bucket refill), compare, PEXPIRE, return {allowed, remaining, reset_ms}. No application-side races exist." },
    { method: "PUT", path: "/limits/rules/{id}", desc: "Upsert rule {subject, route, algorithm, limit, window}; versioned snapshot published to all gateways" },
    { method: "POST", path: "/limits/rules/{id}/shadow", desc: "Evaluate-and-log mode: measures what WOULD be limited before you dare enforce it" },
  ],

  dataModel: [
    { name: "counters", fields: "key(subject:route:window), value INT, expires_at", note: "lives ONLY in Redis; rebuilt from traffic in seconds" },
    { name: "rules", fields: "id, subject_type, route_pattern, algorithm, limit, window_ms, priority", note: "source of truth in Postgres; snapshot-cached in every gateway" },
    { name: "plan_quotas", fields: "api_key, monthly_units, used_units, reset_date", note: "cost-based billing dimension — eventually consistent is fine" },
    { name: "violation_log", fields: "ts, subject, rule_id, action, sampled", note: "sampled heavily at attack time; feeds abuse and tuning loops" },
  ],

  architecture: {
    nodes: [
      n("net", "Internet", "client", 20, 240),
      n("dns", "DNS", "infra", 240, 80),
      n("waf", "Firewall", "infra", 240, 240, "IP limits · DDoS shield"),
      n("gw", "API Gateway", "app", 470, 240, "API-key quotas · Retry-After"),
      n("local", "Local Buckets", "cache", 470, 80, "in-mem fail-open fallback"),
      n("svc1", "Checkout Service", "app", 700, 140, "per-user fine limits"),
      n("svc2", "Search Service", "app", 700, 340, "per-user fine limits"),
      n("redis", "Redis", "cache", 930, 240, "Lua atomic counters"),
      n("cfg", "Config Service", "app", 700, 460, "rules hot-reload"),
      n("mon", "Monitoring", "infra", 1160, 440, "429 rates · rule burn"),
    ],
    edges: [
      { from: "net", to: "dns", label: "resolve" },
      { from: "net", to: "waf", label: "HTTPS", flow: true },
      { from: "waf", to: "gw", label: "scrubbed traffic", flow: true },
      { from: "gw", to: "local", dashed: true, label: "fallback only" },
      { from: "gw", to: "svc1", protocol: "gRPC", flow: true },
      { from: "gw", to: "svc2", protocol: "gRPC" },
      { from: "gw", to: "redis", label: "quota INCR (Lua)", flow: true },
      { from: "svc1", to: "redis", label: "fine-limit INCR (Lua)" },
      { from: "svc2", to: "redis", label: "fine-limit INCR (Lua)" },
      { from: "cfg", to: "gw", dashed: true, label: "rule push <5s" },
      { from: "gw", to: "mon", dashed: true, label: "429 telemetry" },
      { from: "redis", to: "mon", dashed: true },
    ],
    flows: [
      { id: "rl-pass", path: ["net", "waf", "gw", "svc1"], color: "#16A34A", speed: 300, label: "passes all gates" },
      { id: "rl-fallback", path: ["net", "waf", "gw"], color: "#DC2626", speed: 220, label: "Redis dead: local buckets decide" },
    ],
  },

  archNotes: [
    "Each layer owns ONE identity granularity: Firewall handles source IPs (millions, coarse, disposable), gateway handles API keys (thousands, contractual), services handle user/resource pairs (billions, precise). Rules never straddle layers — that is what keeps each counter cheap.",
    "The gateway's decision is one Lua round-trip: the script increments, refills, compares, and sets TTL atomically. Splitting INCR from EXPIRE into two calls is the classic bug — a crash between them leaves a key with no expiry and permanently locks the client out.",
    "Config Service treats rules as versioned snapshots, not live queries: gateways hold the full rule set (~10MB) in RAM and swap atomically on publish. Shadow mode logs what a new rule WOULD reject before anyone dares enforce it.",
    "Local Buckets sit cold at every gateway pod: pre-provisioned token buckets sized conservatively (about half normal limits), activated only when Redis is unreachable. They exist so that fail-open still fails MEANINGFULLY.",
    "Relationship to DDoS, stated honestly: these limiters protect business logic from abusive VALID requests. Volumetric attacks are absorbed upstream by anycast scrubbing — a Redis-backed counter is itself a victim of a real DDoS, not a defense.",
  ],

  requestFlow: [
    {
      title: "Request arrives at the edge",
      detail: "DNS steers the client to the nearest PoP. Before any application logic, the edge decides whether this packet deserves CPU at all — that decision must cost nanoseconds, hence IP-keyed and stateless-friendly.",
      edge: ["net", "dns"],
      nodes: ["waf"],
      tag: "layer 0",
    },
    {
      title: "Firewall gate (IP level)",
      detail: "Coarse per-IP token buckets (hundreds of req/s), geofence rules, and known-bad signatures. False positives here block offices behind NAT — so limits are generous and errors fail OPEN toward the gateway.",
      edge: ["net", "waf"],
      nodes: ["waf"],
      tag: "~0.2ms",
    },
    {
      title: "Gateway quota — atomic via Lua",
      detail: "One EVAL: the script refills the API key's token bucket using REDIS SERVER TIME (never pod clocks), consumes the request's cost units, updates TTL, and returns allowed/remaining/reset in a single atomic step. Concurrent requests cannot interleave into a race.",
      edge: ["gw", "redis"],
      nodes: ["redis"],
      tag: "ATOMIC",
    },
    {
      title: "Allowed — response stamped",
      detail: "Headers X-RateLimit-Limit, Remaining, and Reset ride on the response. Services apply their own finer per-user counters downstream (five password attempts/min lives HERE, not at the edge). Client SDKs read the headers and self-throttle.",
      edge: ["gw", "svc1"],
      nodes: ["svc1"],
      tag: "X-RateLimit-*",
    },
    {
      title: "Rejected — 429 with real math",
      detail: "Bucket exhausted: 429 returns with Retry-After = ceil(reset − now). Rejection telemetry streams to Monitoring, where the operator watches WHICH rule burned — a spike in one rule is either abuse or a misconfiguration, and the difference is a config fix away.",
      edge: ["gw", "mon"],
      nodes: ["gw", "redis"],
      tag: "HTTP 429",
    },
    {
      title: "Rules hot-reload",
      detail: "Operator publishes rule v47 to Config Service; gateways swap their in-memory snapshot within seconds — no deploys, no restarts, atomic cutover. New rules go through shadow mode first: measure rejections for a day, THEN enforce.",
      edge: ["cfg", "gw"],
      nodes: ["cfg"],
      tag: "<5s spread",
    },
    {
      title: "Redis unreachable — fail-open locally",
      detail: "Connection errors trip the circuit breaker; each gateway pod switches to its Local Buckets (conservative half-limits, in RAM) and fires a page. Traffic keeps flowing with approximate limits; precision returns when Redis heals. Hard fail-closed — rejecting everyone because the COUNTER died — is the textbook wrong answer.",
      edge: ["gw", "local"],
      nodes: ["local"],
      tag: "FAIL-OPEN",
    },
  ],

  deepDives: [
    {
      topic: "Four algorithms, condensed to the dimensions that matter",
      body: "Fixed window, sliding log, sliding-window counter, token bucket — interviews demand all four; production picks per layer based on memory, burst behavior, and auditability.",
      bullets: [
        "Fixed window (INCR + EXPIRE): cheapest, but a client can push 2x limit across a boundary — acceptable for coarse IP gates where generosity is the design.",
        "Sliding log (ZSET of timestamps): perfectly exact, O(window) memory per client — reserved for compliance-grade limits on few subjects, never for millions of IPs.",
        "Sliding-window counter (weighted previous+current window): Cloudflare-style approximation, tiny memory, smooths boundaries — the workhorse for gateway quotas.",
        "Token bucket (refill rate r, capacity b): expresses BOTH sustained rate and burst allowance in one primitive; the default wherever product semantics say 'bursts are human'.",
      ],
    },
    {
      topic: "Why the counter must be atomic — and why TIME lives in Redis",
      body: "A rate limiter is a concurrent system wearing a CRUD costume. Every correctness bug in this domain traces to interleaving or clock trust.",
      bullets: [
        "INCR-then-EXPIRE as two round-trips races: between them, a failover drops the TTL and the client is locked out FOREVER. The Lua script makes increment, comparison, and TTL one indivisible operation.",
        "Window boundaries computed from pod clocks diverge when clocks skew: pods disagree about which window a request belongs to, users see arbitrary rejections, and synchronized window flips create mini-stampedes.",
        "Calling TIME inside the script makes the Redis primary the single source of truth — every gateway computes identical windows regardless of local clock health.",
        "Shard counters by consistent hashing on key; salt the rare mega-tenant key across 16 shards and sum on read, or one customer's traffic pins one Redis core.",
      ],
    },
    {
      topic: "Fail-open is a product decision, not an error path",
      body: "The limiter guards availability, so its own failure mode is philosophical: reject everything (fail-closed, 'safe') or admit everything (fail-open, 'approximate'). Production systems choose open — with structure.",
      bullets: [
        "Local fallback buckets are PRE-Provisioned and sized at ~50% of real limits: degraded mode errs restrictive-but-sane rather than unlimited.",
        "Circuit breaker trips in <1s of connection errors; half-open probes recover automatically. Nobody should be paging through runbooks to flip modes manually.",
        "Alert on limiter-health SLO (decision latency, Redis error rate) — by the time customers complain about unfair 429s the incident is old news.",
        "During volumetric DDoS the limiter is a casualty, not a shield: scrubbing centers and anycast absorb the flood so the counter store never sees it.",
      ],
    },
  ],

  failures: [
    {
      id: "limiter-outage",
      title: "Central counter store (Redis cluster) goes dark",
      fail: ["redis"],
      story: "A network partition isolates the Redis primaries mid-peak. Gateways cannot get exact decisions. Fail-closed would 500 the entire API because a COUNTER died; the designed degradation switches every pod to local buckets within a second.",
      reroute: ["gw", "local"],
      metrics: [
        { label: "Decision mode", before: "exact (central)", after: "approx (local)", bad: true },
        { label: "API availability", before: "99.95%", after: "99.93%", bad: true },
        { label: "False 429s", before: "0.01%", after: "~2%", bad: true },
        { label: "Hard failures", before: "0%", after: "0%", bad: false },
      ],
      lessons: [
        "NEVER hard fail-closed: a limiter outage becoming a full API outage inverts the purpose of having a limiter.",
        "Local bucket budgets are pre-provisioned and rehearsed in GameDays — improvised in-memory limiting under pressure is how you discover unbounded dict growth.",
        "Accept measurable slop (±30% accuracy, 2% false rejections) as the PRICE of uptime; document it as an explicit degradation tier.",
        "Recovery is automatic (half-open probes); humans investigate the partition AFTER traffic is safe.",
      ],
    },
    {
      id: "clock-skew",
      title: "Clock skew corrupts window math",
      fail: [],
      degrade: ["redis"],
      story: "One gateway pod drifts 90 seconds fast after an NTP failure. Its fixed-window boundaries fire early and disagree with sibling pods: the SAME client is rejected on one pod and admitted on another, and every window flip triggers a synchronized INCR storm.",
      metrics: [
        { label: "Cross-pod decision consistency", before: "100%", after: "~88%", bad: true },
        { label: "Boundary INCR spikes", before: "flat", after: "6x for 90s", bad: true },
        { label: "Support tickets ('random 429s')", before: "baseline", after: "40/hour", bad: true },
      ],
      lessons: [
        "Compute ALL window/refill math from TIME inside the Lua script — one authoritative clock beats N synced ones.",
        "Token buckets degrade most gracefully under skew (refill is continuous, no cliff-edge windows); prefer them where clock hygiene is doubtful.",
        "NTP monitoring with skew alarms belongs to the limiter's OWN dashboard, not the OS team's backlog.",
        "Client-supplied timestamps are never trusted for limiting math — attackers send future epochs deliberately.",
      ],
    },
  ],

  scaling: [
    { stage: "Single service", action: "In-process token buckets per instance", why: "Approximate but free; correct enough when N instances is small." },
    { stage: "Multi-service", action: "Central Redis counters at the gateway", why: "Shared limits need one source of truth; latency budget still generous." },
    { stage: "100K RPS", action: "Sharded counters, snapshot-based rule config, shadow mode", why: "Hot-key salting and hot-reload become survival requirements." },
    { stage: "Global", action: "Per-region counter stores + regional fail-open autonomy", why: "Cross-region Redis round-trips blow the 2ms budget; regions must degrade independently." },
  ],

  tradeoffs: [
    {
      a: "Fixed/sliding window counters",
      aBlurb: "Count events in a time bucket (exact or approximated)",
      b: "Token bucket family",
      bBlurb: "Refill budget continuously, spend per request",
      dims: [
        { name: "Burst tolerance", a: "None inherent — boundary bursts leak", b: "Explicit burst capacity b", winner: "b" },
        { name: "Memory per subject", a: "Tiny for fixed/approx; large only for exact logs", b: "Two numbers per bucket" },
        { name: "Auditability ('what did he do in window W')", a: "Natural fit", b: "Awkward reconstruction", winner: "a" },
        { name: "Clock-skew resilience", a: "Window cliffs amplify skew", b: "Continuous refill degrades smoothly", winner: "b" },
        { name: "Implementation risk", a: "Trivial (INCR+EXPIRE)", b: "Refill math must be atomic", winner: "a" },
      ],
      verdict: "Default to token buckets at enforcement points (they express product intent best and survive skew); use window counters where billing/audit semantics literally promise 'per calendar minute'. The sliding LOG is a compliance tool, not an infrastructure default.",
    },
    {
      a: "Centralized exact limits",
      aBlurb: "Redis Lua counters — one truth, one round-trip",
      b: "Local approximate limits",
      bBlurb: "Per-pod in-memory buckets — zero network",
      dims: [
        { name: "Accuracy under concurrency", a: "Exact, race-free", b: "Sum of guesses (±N pods)", winner: "a" },
        { name: "Added latency", a: "~1–2ms network hop", b: "Sub-microsecond", winner: "b" },
        { name: "Availability coupling", a: "Limiter store is a dependency", b: "Independent per pod", winner: "b" },
        { name: "Contractual quotas (billing)", a: "Defensible numbers", b: "Cannot honor contracts", winner: "a" },
      ],
      verdict: "They are not rivals — it is a hierarchy. Central exact counters enforce anything with money attached; local approximate buckets run ALWAYS as the substrate that keeps the platform alive when the center dies.",
    },
  ],

  alternatives: [
    "Envoy's global rate-limit service (gRPC descriptor protocol) — battle-tested separation of enforcement and decision; adopt before building your own gateway logic.",
    "Provider-native edge limiting (Cloudflare/AWS WAF rules) — excellent coarse layers, weak per-user business semantics; complement, not replace, your gateway tier.",
    "Client-side throttling libraries reading X-RateLimit headers (SDK-enforced backoff) — dramatically reduces 429 traffic, but is advisory only: never the enforcement mechanism.",
  ],

  interview: {
    prompt: "Design rate limiting for a 100K-RPS public API: three customer plans, per-endpoint costs, and a hard requirement that the limiter never causes an outage.",
    stages: [
      { name: "Requirements", expect: "Split limits BY IDENTITY and LAYER (IP / API key / user-resource) before mentioning any algorithm — candidates who jump to 'token bucket!' miss the entire design axis." },
      { name: "Algorithms", expect: "Condense the four algorithms into dimensions (burst, memory, auditability, skew) and assign per layer; justify token bucket defaults." },
      { name: "Atomic counters", expect: "Single Lua script covering refill+check+TTL with SERVER time; articulate the INCR/EXPIRE split bug and hot-key salting." },
      { name: "Architecture", expect: "WAF→gateway→service mapping to trust granularity; config service with versioned snapshots and shadow mode; header contract on every response." },
      { name: "Failure", expect: "Fail-open with pre-provisioned conservative local buckets, circuit breaker, and the sentence 'a counter outage must not outage the API'." },
      { name: "Capacity & DDoS", expect: "100K RPS → 2–3 Redis shards, ~1.2GB counters, 2ms budget; and honesty that DDoS is an edge/scrubbing problem, not a Redis problem." },
    ],
  },

  production: [
    "Publish your 429/Retry-After contract publicly and make SDKs honor it with jittered backoff — most 'incidents' attributed to rate limiting are retry storms that headers would have prevented.",
    "Every enforced rule spends a week in shadow mode; the rejections it WOULD have caused are reviewed by a human. Enforcing blind is how launch days melt down.",
    "Keep violation logging sampled and bounded — under an attack, unsampled logging IS the outage.",
    "Test the fail-open path in staging by iptables-blocking Redis: if the dashboard doesn't turn amber within a second, your circuit breaker is decoration.",
    "Per-rule dashboards (rejections/min, top rejected subjects) beat global graphs — operators tune rules, not abstractions.",
  ],

  costs: [
    "Redis shards sized to PEAK Lua throughput are the whole hardware bill — a handful of replicas; the expensive part is engineering discipline, not iron.",
    "Rule-config snapshots replicated to every global PoP are megabytes; treat distribution as free but VERSIONING as sacred.",
    "The hidden cost of getting limits WRONG is support load: every ambiguous 429 generates a ticket. Generous limits plus shadow-mode tuning is cheaper than precision engineering at the boundary.",
  ],
};

/* ================================================================== */
/*  DISTRIBUTED JOB QUEUE                                              */
/* ================================================================== */

const jobQueue: CaseStudy = {
  slug: "job-queue",
  name: "Distributed Job Queue",
  tagline: "At-least-once delivery plus idempotent handlers: the crash-retry dance, visibility timeouts, dead letters, and why 'exactly-once' is a billing fiction.",
  category: "Primitives",
  difficulty: "Hard",
  minutes: 30,

  problem: [
    "Every nontrivial product secretly runs on deferred work: send the receipt email, resize the upload, charge the card, regenerate the report. The queue looks like the simplest box in the architecture diagram — until a worker crashes mid-task, a message redelivers twice, a poison message wedges a lane, and someone asks why a customer got three password-reset emails.",
    "Designing it properly means confronting the field's least comfortable truth head-on: delivery guarantees top out at AT LEAST ONCE. Everything else — idempotency keys, dedup tables, dead-letter triage, visibility-timeout tuning, bulkheaded worker pools — is engineering that converts that guarantee into a system users perceive as exactly-once. This case study walks the crash-retry sequence frame by frame, because that sequence is where designs are actually won or lost.",
  ],

  requirements: {
    functional: [
      "Producers enqueue typed tasks with payloads; API callers may request completion results",
      "Worker pools consume with leases: message invisible while leased, reappears if the lease lapses",
      "Retries with exponential backoff and jitter; configurable per task type",
      "Dead-letter queue after max attempts, with inspection and replay tooling",
      "Idempotency key per task: duplicate deliveries execute side effects exactly once",
      "Priority lanes (interactive vs bulk) with isolated worker pools per lane",
      "Scheduled and delayed jobs (cron expressions, run-at timestamps)",
      "Backpressure: bounded queue depths, producer rejection when full, consumer autoscaling on depth",
    ],
    nonFunctional: [
      "Delivery guarantee: at-least-once, stated in every API doc — no exceptions, no lies",
      "Interactive-task enqueue-to-start < 2s p95; bulk lane makes no latency promise",
      "Duplicate SIDE-EFFECT rate (double emails, double charges): zero, by handler contract",
      "No global ordering — per-key FIFO within a partition only, documented per task type",
      "Queue depth, oldest-message age, DLQ growth: all alerted with paging thresholds",
    ],
  },

  capacity: [
    { label: "Tasks/day", value: "50M", note: "~600/s average" },
    { label: "Burst arrival", value: "5K/s", note: "backfill imports, midnight cron waves" },
    { label: "Mean task duration W", value: "~2s blended", note: "emails 150ms, resizes 2–8s" },
    { label: "Steady-state in-flight (Little)", value: "λ·W = 600×2 = 1,200", note: "÷64 concurrency/pod ≈ 19 pods" },
    { label: "Burst in-flight", value: "5,000×4s = 20,000", note: "÷64 ≈ 313 pods at autoscale ceiling" },
    { label: "Buffer for burst ramp", value: "~300K msgs", note: "5K/s × 60s absorb window before autoscale catches up" },
    { label: "Dedup table", value: "150M live rows ≈ 15GB", note: "50M/day with 72h TTL" },
    { label: "DLQ thresholds", value: "warn 1K · page 10K", note: "or growth >100/min, whichever first" },
  ],

  api: [
    { method: "POST", path: "/tasks", desc: "Body: {type, payload, idem_key, priority?, run_at?}. Server rejects a repeated idem_key with the ORIGINAL task's status — enqueue is idempotent too." },
    { method: "GET", path: "/tasks/{id}", desc: "Status machine: queued → leased → done | dead. Includes attempts and next_visible_at for debugging." },
    { method: "POST", path: "/dlq/{task_id}/replay", desc: "Re-enqueue with attempts reset; supports dry-run validation of payload against CURRENT schema before replaying." },
    { method: "PUT", path: "/schedules/{id}", desc: "Cron-driven producer: scheduler claims due rows (FOR UPDATE SKIP LOCKED) and enqueues into the bulk lane." },
    { method: "DELETE", path: "/tasks/{id}", desc: "Cancel only while queued; leased tasks must run — handlers own cancellation semantics after that." },
  ],

  dataModel: [
    { name: "tasks", fields: "id, type, payload JSONB, idem_key UNIQUE, attempts, max_attempts, visible_after, status", note: "visible_after implements the lease invisibility window; status ∈ queued|leased|done|dead" },
    { name: "dead_letters", fields: "task snapshot (full row), failed_at, reason, last_error", note: "triage UI + replay tooling; quarantined poison pills flagged separately" },
    { name: "processed_keys", fields: "idem_key PK, task_id, result_ref, processed_at", note: "THE correctness anchor: handlers upsert here transactionally with side effects where possible" },
    { name: "schedules", fields: "id, cron_expr, task_type, payload_template, next_run_at", note: "polled by scheduler; claims due rows so multiple schedulers stay safe" },
  ],

  architecture: {
    nodes: [
      n("web", "Web / API Producers", "client", 20, 240),
      n("gw", "API Gateway", "app", 240, 240, "enqueue · idempotency check"),
      n("sched", "Scheduler", "app", 240, 460, "cron · delayed jobs"),
      n("qhi", "Queue", "queue", 470, 80, "priority lane · interactive"),
      n("qlow", "Queue", "queue", 470, 240, "bulk lane · batch"),
      n("dlq", "Queue", "queue", 930, 240, "dead letters · replay"),
      n("poolA", "Worker", "app", 700, 80, "pool A · emails"),
      n("poolB", "Worker", "app", 700, 240, "pool B · image resize"),
      n("obj", "Object Store", "data", 700, 460, "image bytes"),
      n("redis", "Redis", "cache", 930, 80, "result backend"),
      n("pg", "PostgreSQL", "data", 930, 460, "idem dedup · outbox"),
      n("kafka", "Kafka", "queue", 1160, 80, "task.completed fanout"),
      n("mon", "Monitoring", "infra", 1390, 240, "depth · age · DLQ alerts"),
    ],
    edges: [
      { from: "web", to: "gw", label: "POST /tasks", flow: true },
      { from: "sched", to: "qlow", label: "due jobs" },
      { from: "gw", to: "pg", label: "dedup check · outbox" },
      { from: "gw", to: "qhi", label: "interactive lane", flow: true },
      { from: "gw", to: "qlow", label: "bulk lane", flow: true },
      { from: "qhi", to: "poolA", label: "lease · visibility timeout", flow: true },
      { from: "qlow", to: "poolB", label: "lease · visibility timeout", flow: true },
      { from: "poolA", to: "redis", label: "store result" },
      { from: "poolB", to: "obj", label: "bytes in/out" },
      { from: "poolB", to: "redis", label: "store result" },
      { from: "poolA", to: "pg", dashed: true, label: "dedupe upsert" },
      { from: "poolB", to: "pg", dashed: true, label: "dedupe upsert" },
      { from: "poolA", to: "dlq", dashed: true, label: "after max_attempts" },
      { from: "poolB", to: "dlq", dashed: true, label: "after max_attempts" },
      { from: "poolB", to: "kafka", label: "task.completed", flow: true },
      { from: "dlq", to: "mon", dashed: true, label: "depth alarm" },
      { from: "kafka", to: "mon", dashed: true, label: "fanout lag" },
      { from: "redis", to: "mon", dashed: true },
    ],
    flows: [
      { id: "jq-happy", path: ["web", "gw", "qhi", "poolA", "redis"], color: "#2563EB", speed: 260, label: "happy task lifecycle" },
      { id: "jq-dead", path: ["qlow", "poolB", "dlq"], color: "#DC2626", speed: 220, label: "exhausted retries → DLQ" },
    ],
  },

  archNotes: [
    "The broker is deliberately thin: persistence plus lease semantics. All intelligence — retry policy, idempotency, prioritization policy, poison detection — lives in services that engineers can actually test. Brokers that promise too much become unupgradeable shrines.",
    "Two lanes with SEPARATE worker pools (bulkheads): a 50MB-upload flood degrades image resizing but physically cannot starve password-reset emails. Priority ordering inside one shared pool is scheduling; separate pools are ISOLATION — production needs the second thing.",
    "PostgreSQL anchors correctness: the idem_key UNIQUE constraint makes duplicate ENQUEUES impossible, and processed_keys makes duplicate EXECUTION harmless. The queue moves work; the database proves it happened once.",
    "Kafka sits AFTER completion, not before: task.completed events fan out to analytics, webhooks, and cache invalidation as a pure broadcast log — decoupled from the retry machinery entirely.",
    "Result backend (Redis) exists so HTTP callers can poll POST /tasks status without touching worker databases; results expire in 24h because nobody ever polls day-old task states.",
  ],

  requestFlow: [
    {
      title: "Producer enqueues with idempotency key",
      detail: "The client SDK derives idem_key (UUIDv5 of intent: user+action+window, or explicit). POST /tasks carries type, payload, and key. From this instant, every layer of the system can safely retry ANYTHING.",
      edge: ["web", "gw"],
      nodes: ["gw"],
      tag: "idempotent from birth",
    },
    {
      title: "Dedup check + transactional outbox",
      detail: "Gateway INSERTs the task row — the UNIQUE(idem_key) constraint silently absorbs duplicate submissions (client retried? double-click? we return the original task). The outbox pattern records the enqueue event in the same transaction, so the task and its audit trail are born atomically.",
      edge: ["gw", "pg"],
      nodes: ["pg"],
      tag: "UNIQUE wins",
    },
    {
      title: "Broker persists to the priority lane",
      detail: "Password-reset class tasks enter the interactive lane; nightly-export class enters bulk. The message is durable NOW — the producer's user already saw the spinner end. Everything after this step is allowed to fail, repeatedly.",
      edge: ["gw", "qhi"],
      nodes: ["qhi"],
      tag: "durability point",
    },
    {
      title: "Worker leases the task",
      detail: "Pool A claims the message: it becomes INVISIBLE to other workers for the visibility timeout (say 60s), and attempts increments to 1. Note carefully: nothing has succeeded yet. The lease is optimism, not progress.",
      edge: ["qhi", "poolA"],
      nodes: ["poolA"],
      tag: "lease 60s",
    },
    {
      title: "CRASH — mid-task, no ack",
      detail: "At t=35s the worker process is OOM-killed AFTER calling the email API but BEFORE acknowledging. The message is still 'leased' in the broker's view. Side effect: possibly sent. Acknowledgment: never arrived. This exact asymmetry is why at-least-once is the only honest guarantee.",
      nodes: ["poolA"],
      tag: "the money moment",
    },
    {
      title: "Lease expires — message returns visible",
      detail: "At t=60s the visibility timeout lapses; the broker makes the task visible again with attempts=1. No detective work, no reconciliation job — the TIMEOUT ITSELF is the crash-recovery mechanism. (Set it below p99 task duration and you manufacture duplicates on LIVE tasks instead — see failure lab.)",
      edge: ["qhi", "poolA"],
      nodes: ["qhi"],
      tag: "auto-recovery",
    },
    {
      title: "Second attempt — handler dedupes via key",
      detail: "A DIFFERENT worker picks up the task. Before re-executing, the handler checks processed_keys for the idem_key: present (first attempt got far enough to record it) → SKIP the email, record success. Had the first attempt died before sending, the key would be absent and the email simply sends now.",
      edge: ["poolA", "pg"],
      nodes: ["pg", "poolA"],
      tag: "side effect ×1",
    },
    {
      title: "Ack removes the task",
      detail: "Handler deletes the message (ack), writes the result to Redis, and emits task.completed to Kafka for fanout consumers. Total executions: 2. Emails received: 1. THAT ratio — executions divided by effects — is the entire game.",
      edge: ["poolA", "redis"],
      nodes: ["kafka"],
      tag: "executed 2×, sent 1×",
    },
  ],

  deepDives: [
    {
      topic: "At-least-once + idempotency = the exactly-once illusion",
      body: "Exactly-once DELIVERY across crashes requires consensus between two processes about an event that may or may not have happened — the two-generals problem, provably impossible. So production systems stop promising delivery semantics and start engineering EFFECT semantics.",
      bullets: [
        "Broker contract: at-least-once. Period. Any vendor claiming exactly-once delivery means exactly-once PROCESSING given specific (idempotent) handlers — read the footnote.",
        "Idempotency keys convert duplicates from corruption into wasted CPU: the second execution finds processed_keys populated and no-ops.",
        "Best-case dedup is TRANSACTIONAL with the side effect (insert processed_key + send in one DB transaction). When the side effect lives outside the DB (email API), accept the narrow window: sent-but-not-recorded, recovered by the retry finding no key and resending — mitigate with provider-side idempotency where offered.",
        "The dedup table needs a TTL (72h here): long enough to span any realistic retry gap, short enough that the UNIQUE index stays small and hot.",
      ],
    },
    {
      topic: "Visibility timeout: a distributed lock you didn't have to build",
      body: "The lease/visibility model (SQS-style) replaces broker-tracked acknowledgments with time. It is simpler to reason about than explicit ack protocols — and it fails in a characteristic way that you must size for.",
      bullets: [
        "Timeout too SHORT (< p99 duration): live workers lose their lease mid-task; another worker starts the same job; duplicates multiply silently. Size at p99 × 3, or add lease HEARTBEATS (worker extends its own timeout while alive).",
        "Timeout too LONG: crashed tasks linger invisible, inflating effective latency by up to one full timeout. Tune per task CLASS — a 5s lease for emails, 10-minute leases for video transcode.",
        "Explicit-ack alternative (RabbitMQ prefetch / Kafka offsets): the BROKER tracks unacked work precisely; recovery happens on connection loss or rebalance. More bookkeeping, no timeout-guessing — but rebalances mid-task cause their own redelivery surprises.",
        "Either way the invariant is identical: an unacknowledged task WILL redeliver eventually. Design handlers for that certainty, not for the happy path.",
      ],
    },
    {
      topic: "Priority lanes, bulkheads, and backpressure",
      body: "Queues fail by indirection: the symptom appears in lane A while the disease grows in lane B. Isolation and admission control are how you keep failure legible.",
      bullets: [
        "Priority lanes WITHOUT separate pools achieve little: head-of-line blocking in a shared pool ignores priorities under exactly the load where you needed them. Interactive and bulk get their own pools — the bulkhead IS the priority mechanism.",
        "Starvation guard for the bulk lane: reserve a floor fraction of capacity (≥20%) for bulk even during interactive storms, or age-promote old bulk tasks. Fairness is a policy knob, not an accident.",
        "Backpressure is bounded queues: when a lane exceeds max depth, producers receive 429/503 IMMEDIATELY — failing fast at admission beats silently accepting work you cannot process (the queue equivalent of the limiter's 429).",
        "Autoscale consumers on DEPTH and oldest-message age (KEDA-style), never on CPU — idle workers waiting on slow IO are the norm, and CPU signals nothing.",
        "Poison pills get quarantined, not retried: schema-validation failures can never succeed, so detect determinism and dead-letter IMMEDIATELY with a reason, saving the retry budget for transient faults.",
      ],
    },
  ],

  failures: [
    {
      id: "lease-too-short",
      title: "Visibility timeout shorter than real task durations",
      fail: [],
      degrade: ["qhi", "poolA"],
      story: "Ops tunes the interactive lane's lease to 30s 'for snappy recovery'. But p99 email duration (provider slowness) is 45s. Live tasks keep losing leases mid-flight; ghost duplicates pile onto healthy workers, multiplying load exactly when the provider is already slow — a self-reinforcing duplicate storm.",
      metrics: [
        { label: "Duplicate executions", before: "~0", after: "3.2% of tasks", bad: true },
        { label: "Double emails received", before: "0", after: "0", bad: false },
        { label: "Effective worker capacity", before: "100%", after: "-18% (ghost work)", bad: true },
      ],
      lessons: [
        "Size visibility timeouts from p99 MEASURED durations × safety factor — never from median or aspiration.",
        "Long-running tasks must heartbeat-extend their lease; a static timeout is a bet that your p99 never grows.",
        "The zero-double-emails line is the payoff: idempotency keys converted a correctness incident into wasted cycles.",
        "Alert on lease-expiry-redelivery RATE — it is the direct measurement of 'timeout too short' and precedes every other symptom.",
      ],
    },
    {
      id: "dlq-silent-fill",
      title: "Dead-letter queue fills silently for weeks",
      fail: [],
      degrade: ["dlq"],
      story: "A partner API rotates credentials; their webhook-delivery tasks start failing permanently and dead-lettering. Nothing alerts because DLQ depth 'isn't a real metric'. Nineteen days later a customer asks where their invoices went. The system worked perfectly — except for the part where nobody looked.",
      metrics: [
        { label: "DLQ depth", before: "0", after: "480K messages", bad: true },
        { label: "Silently missing receipts", before: "0/day", after: "12K/day", bad: true },
        { label: "Time-to-detection", before: "n/a", after: "19 days", bad: true },
      ],
      lessons: [
        "Alert on DLQ depth AND growth rate (warn at 1K, page at 10K or >100/min) — a filling DLQ is the queue's fever chart.",
        "Replay tooling needs dry-run validation against CURRENT schemas: mass-replaying 480K stale payloads creates a second incident.",
        "Quarantine poison pills separately after N replay failures, or one deterministic failure class buries actionable transients in noise.",
        "The DLQ is a FEATURE — a durable confession of what the system could not do — not a garbage bin. Staff its triage accordingly.",
      ],
    },
    {
      id: "lane-starvation",
      title: "Image flood starves the shared pool (the case for bulkheads)",
      fail: [],
      degrade: ["poolB"],
      story: "History: both task classes originally shared one worker fleet. A marketing campaign tripled uploads; CPU-bound resizing saturated every worker; password-reset emails waited 40 MINUTES behind thumbnails. The fix is the diagram you see: separate pools per lane. Today's version of the same storm shows the blast radius CONTAINED.",
      reroute: ["qlow", "poolB", "obj"],
      metrics: [
        { label: "Email send p95 (interactive lane)", before: "2s", after: "2s — unaffected", bad: false },
        { label: "Resize backlog", before: "200 tasks", after: "180K tasks", bad: true },
        { label: "Blast radius", before: "everything (old design)", after: "bulk lane only", bad: true },
      ],
      lessons: [
        "Separate worker pools per task class — bulkheading — is the only priority mechanism that survives real load.",
        "Autoscale each lane on ITS depth; a shared autoscaler averages away exactly the signal you need.",
        "Concurrency caps per pool protect downstreams too: the email provider and the image pipeline have independent capacity limits.",
        "When someone proposes merging lanes for 'efficiency', price the merge in worst-case tail latency for the interactive class.",
      ],
    },
  ],

  scaling: [
    { stage: "Prototype", action: "In-process background threads + DB jobs table", why: "One server, one truth; learn your task-duration distribution before buying infrastructure." },
    { stage: "First million", action: "Managed queue + single worker fleet + retries/DLQ", why: "Buy the lease/redelivery machinery; it is subtle and undifferentiated." },
    { stage: "10M/day", action: "Lane separation (bulkheads), dedup table, replay tooling", why: "Task classes now have incompatible SLAs and failure modes; correctness tooling becomes urgent." },
    { stage: "50M+/day", action: "Depth-based autoscaling, scheduled-job subsystem, Kafka completion fanout, per-partition FIFO where needed", why: "Operations dominates: elasticity, observability, and ordered-subset guarantees each earn their complexity." },
  ],

  tradeoffs: [
    {
      a: "Visibility timeout (SQS-style)",
      aBlurb: "Lease expires → message reappears",
      b: "Explicit acks (RabbitMQ/Kafka-style)",
      bBlurb: "Broker tracks unacked until told otherwise",
      dims: [
        { name: "Crash recovery", a: "Automatic — time heals", b: "On connection loss/rebalance", winner: "a" },
        { name: "Long-task handling", a: "Timeout guessing or heartbeats", b: "Precise — held until acked", winner: "b" },
        { name: "Duplicate risk window", a: "Lease-expiry duplicates on live tasks", b: "Rebalance redeliveries", winner: "a" },
        { name: "Broker complexity", a: "Thin — timestamp bookkeeping", b: "Tracks per-consumer state", winner: "a" },
        { name: "Ordering semantics", a: "Weak by default", b: "Partition/ordering primitives native", winner: "b" },
      ],
      verdict: "Leases win for heterogeneous fire-and-forget work (most products); explicit acks win when ordering or long-lived streaming consumption dominates. Either way the handler-side contract is IDENTICAL: assume redelivery, enforce idempotency.",
    },
    {
      a: "Priority lanes + separate pools",
      aBlurb: "Interactive and bulk physically isolated",
      b: "Single fair queue",
      bBlurb: "One lane, weighted sharing",
      dims: [
        { name: "Interactive tail latency", a: "Immune to bulk storms", b: "Degrades under load", winner: "a" },
        { name: "Bulk starvation risk", a: "Needs capacity-floor policy", b: "Fairness built in", winner: "b" },
        { name: "Fleet efficiency (utilization)", a: "Pools sized per peak class", b: "Work-stealing fills gaps", winner: "b" },
        { name: "Operational legibility", a: "Each lane tells its own story", b: "One entangled backlog", winner: "a" },
      ],
      verdict: "Run lanes separately whenever classes have different SLAs — which is essentially always. Add a capacity floor for the bulk lane so priority does not decay into starvation, and revisit only if utilization economics genuinely force sharing.",
    },
  ],

  alternatives: [
    "Kafka as the sole backbone (retry topics + consumer groups) — superb durability and ordering per partition, but retry/backoff/DLQ ergonomics become DIY middleware; best when tasks ARE events.",
    "SQS + Lambda / EventBridge Scheduler — zero lease management and elastic concurrency; you trade control (timeout tuning, pooling strategy, observability depth) for that convenience.",
    "Temporal / workflow engines — for multi-step sagas with human-visible state, a workflow engine subsumes much of this machinery; adopting one for plain fire-and-forget tasks is overkill.",
  ],

  interview: {
    prompt: "Design the async task platform for a SaaS with 50M tasks/day: emails, media processing, scheduled reports. Walk through what happens when a worker dies mid-task — then defend your delivery guarantee.",
    stages: [
      { name: "Requirements", expect: "States at-least-once UNPROMPTED and scopes ordering to per-key partitions. Anyone promising exactly-once delivery here has failed the interview's central question." },
      { name: "Estimation", expect: "Little's law numerically: 600/s × 2s = 1,200 in-flight → ~19 pods; burst 5K/s × 4s = 20,000 → ~313 pods; queue absorbs the autoscale ramp." },
      { name: "Core protocol", expect: "Lease/visibility timeout mechanics, attempts, exponential backoff WITH JITTER, max_attempts → DLQ. Draws the state machine without hesitation." },
      { name: "Correctness", expect: "idem_key UNIQUE at enqueue + processed_keys dedup at execution = the exactly-once illusion; explains the sent-but-unrecorded window honestly." },
      { name: "Architecture", expect: "Bulkheaded pools per lane, bounded depths with producer rejection, scheduler with SKIP LOCKED claiming, DLQ with replay/dry-run tooling." },
      { name: "Failure narration", expect: "Recites the crash sequence cold: crash at t=35s → lease lapse at t=60s → redelivery → dedup hit → ack. Executions 2, effects 1. That fluency IS the hire signal." },
    ],
  },

  production: [
    "Schema-validate payloads at ENQUEUE: deterministic failures should dead-letter instantly with a reason, never burn three retries discovering what a JSON-schema check knew upfront.",
    "Version task types (email.send.v2) so rolling deploys never leave workers holding payloads they cannot parse; consumers accept N-1 versions during migrations.",
    "Monitor oldest-message AGE alongside depth: depth alone hides a stuck lane behind a healthy average.",
    "Replay jobs run at capped rates with dry-run first — replaying a 480K backlog at full speed is a self-inflicted arrival-rate attack on your own downstreams.",
    "Track lease-expiry redelivery rate and duplicate-execution rate as first-class SLOs; both are leading indicators of timeout misconfiguration and handler regressions respectively.",
  ],

  costs: [
    "Worker fleets dominate spend — image/CPU-heavy pools justify spot instances on the bulk lane; the interactive lane pays for stability.",
    "Broker costs scale with retention and sharding, not throughput: 300K-message buffers are pocket change; six months of raw task history is not. Archive to object storage instead.",
    "The dedup table is the quiet line item: 72h TTL at 50M/day is ~15GB — trivial, but teams that forget the TTL discover a 50TB table at year's end.",
  ],
};

export const PRIMITIVE_SYSTEMS: CaseStudy[] = [urlShortener, rateLimiterSystem, jobQueue];
