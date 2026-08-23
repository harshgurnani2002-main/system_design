import type { Chapter } from "@/lib/types";

export const coreChaptersA: Chapter[] = [
  {
    slug: "capacity-estimation",
    track: "core-design",
    num: 1,
    title: "Capacity Estimation",
    subtitle:
      "Back-of-the-envelope math that turns 'it should scale' into numbers you can defend — QPS, storage, bandwidth, cache size.",
    minutes: 20,
    skills: ["architecture"],
    concepts: ["qps", "throughput", "latency", "read-write-ratio", "peak-traffic"],
    blocks: [
      {
        t: "p",
        md: "Before choosing a single technology, serious engineers estimate **how big the problem is**. Capacity estimation is not about being precise — it is about being within an order of magnitude, because that is enough to choose between a single Postgres box and a sharded cluster.",
      },
      {
        t: "callout",
        kind: "info",
        title: "Numbers worth memorizing",
        md: "1 day ≈ 86,400s ≈ **10⁵ s** · 1 year ≈ 3×10⁷ s · 1M requests/day ≈ **12 QPS average** · peak ≈ 2–5× average · a tweet ≈ 300 bytes · a photo ≈ 200KB–2MB · a video minute at 1080p ≈ 50MB · RAM ~10ns vs SSD ~150µs vs HDD seek ~10ms.",
      },
      { t: "h", text: "The five questions" },
      {
        t: "list",
        ordered: true,
        items: [
          "**Traffic** — how many requests per second, on average and at peak?",
          "**Storage** — how much data per year, and how does it grow?",
          "**Bandwidth** — bytes in/out per second, driven by your largest payloads?",
          "**Memory/cache** — what working set would give you a high hit rate?",
          "**Fan-out** — one user action triggers how many internal operations?",
        ],
      },
      {
        t: "sim",
        sim: "capacity-calc",
      },
      { t: "h", text: "Worked example: image-sharing app" },
      {
        t: "table",
        head: ["Assumption", "Value"],
        rows: [
          ["Users", "100M registered, 20M DAU"],
          ["Posts per DAU", "2 uploads/day → 40M new images/day"],
          ["Feed reads", "Each DAU views 100 posts/day → 2B reads/day"],
          ["Average image", "500KB (multiple resolutions stored)"],
        ],
      },
      {
        t: "list",
        items: [
          "**Upload QPS:** 40M/day ÷ 10⁵s = 400 QPS average; uploads spike 5× at dinner time → **~2K QPS peak**.",
          "**Read QPS:** 2B/day ÷ 10⁵s = 20K QPS average → **~100K QPS peak**. Reads dominate 50:1 — this ratio drives every later decision toward caching and CDNs.",
          "**Storage:** 40M × 500KB = 20TB/day → **~7PB/year** raw; with 3× replication, plan for 20PB+ capacity. This immediately rules out storing blobs in the database — object storage + CDN it is.",
          "**Egress bandwidth:** 20K QPS × 500KB ≈ **10GB/s** ≈ 80Gbps average. No origin serves this; the CDN must absorb it.",
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "The trap: averages lie",
        md: "Design for **peak**, not average. Traffic follows diurnal patterns (lunch, commute, prime time), celebrity events create 10–100× spikes, and retries amplify failures. A system sized for 12 QPS because 'users post once a day' will fall over at 9 PM. Multiply averages by a peak factor of 2–5× as a floor, and stress-test beyond it.",
      },
      { t: "h", text: "From estimates to architecture" },
      {
        t: "table",
        head: ["If you estimated…", "You probably need…"],
        rows: [
          ["< 1K peak QPS, < 100GB", "One well-tuned Postgres + app servers behind an LB"],
          ["Read-heavy, > 10K QPS", "Cache layer (Redis) + read replicas before anything exotic"],
          ["> 1TB/year growth of blobs", "Object storage (S3-style), never DB BLOBs"],
          ["Write-heavy, > 50K inserts/s", "Partitioned/sharded writes or log-structured stores (Cassandra-style)"],
          ["Global audience, latency-sensitive", "Multi-region + CDN from day one"],
        ],
      },
    ],
    quiz: [
      {
        id: "cap-q1",
        q: "A service receives 100M requests/day. What is the approximate average QPS, and a reasonable peak planning number?",
        options: [
          "~1,160 QPS avg; plan for ~5K peak",
          "~116 QPS avg; plan for ~500 peak",
          "~11,600 QPS avg; plan for 12K peak",
          "~12 QPS avg; plan for 60 peak",
        ],
        correct: [0],
        explain:
          "100M ÷ 10⁵s ≈ 1,000 QPS (1.16K precisely). Peak traffic typically runs 2–5× average; planning for ~5K gives headroom. The ÷10⁵ shortcut makes this mental math.",
      },
      {
        id: "cap-q2",
        q: "An app stores 50M photos/day averaging 800KB. Rough annual storage?",
        options: ["~1.5PB", "~15TB", "~15PB", "~150TB"],
        correct: [2],
        explain:
          "50M × 800KB = 40TB/day → ×365 ≈ 14.6PB/year raw — so ~15PB. With replication factor 3 you provision 45PB+. Numbers like these are why photo apps never store images in the database.",
      },
      {
        id: "cap-q3",
        q: "Your feed has a 200:1 read/write ratio and 80K peak read QPS. The database sustains 8K QPS. What is the most appropriate FIRST move?",
        options: [
          "Shard the database by user ID",
          "Add a cache layer in front of the DB (and CDN for media)",
          "Move everything to Cassandra",
          "Increase the DB instance size 10×",
        ],
        correct: [1],
        explain:
          "Extreme read skew is exactly what caches are for. A 90% hit rate drops DB load to 8K QPS — solved with far less operational complexity than sharding. Sharding is the right answer when WRITES exceed capacity, not reads.",
      },
      {
        id: "cap-q4",
        q: "Which statement about capacity estimation is TRUE?",
        options: [
          "Estimates must be accurate within 10% to be useful",
          "Order-of-magnitude estimates are sufficient to make architectural choices",
          "Storage estimation matters more than QPS estimation",
          "Peak factors only apply to streaming services",
        ],
        correct: [1],
        explain:
          "The purpose is choosing between architectures (one box vs cluster vs multi-region), which requires order-of-magnitude precision only. Precision theater wastes interview time and real meetings alike.",
      },
    ],
    exercise: {
      prompt:
        "Estimate capacity for a WhatsApp-like chat app: 500M users, 100B messages/day, average message 200 bytes, each message fanned out to ~4 recipients. Compute messages/sec, storage/year, and fan-out QPS. Then state which single number worries you most and why.",
      hints: [
        "100B/day ÷ 10⁵s ≈ 1M msg/s just for ingestion.",
        "Fan-out multiplies delivery attempts: 1M × 4 = 4M deliveries/s.",
        "Storage: 100B × 200B = 20TB/day raw — but think about attachments, indexes and replication too.",
      ],
    },
  },

  {
    slug: "load-balancers",
    track: "core-design",
    num: 2,
    title: "Load Balancers",
    subtitle:
      "The component that turns 'a server' into 'a service': algorithms, health checks, L4 vs L7, and where they secretly live everywhere.",
    minutes: 22,
    skills: ["networking", "architecture"],
    concepts: ["load-balancer", "reverse-proxy", "health-check", "sticky-session", "horizontal-scaling"],
    blocks: [
      {
        t: "p",
        md: "The moment you run two copies of your service, someone must decide who handles each request. That someone is the **load balancer** — conceptually the simplest component in distributed systems, and operationally the one whose misconfiguration takes down your entire platform.",
      },
      { t: "h", text: "Why one server is never enough" },
      {
        t: "diagram",
        height: 250,
        caption:
          "Vertical scaling hits hard limits; horizontal scaling needs something in front to distribute traffic.",
        graph: {
          nodes: [
            { id: "c", label: "Clients", kind: "client", x: 20, y: 95 },
            { id: "lb", label: "Load Balancer", sub: "health checks + routing", kind: "app", x: 230, y: 95 },
            { id: "s1", label: "API #1", kind: "app", x: 470, y: 15 },
            { id: "s2", label: "API #2", kind: "app", x: 470, y: 95 },
            { id: "s3", label: "API #3", kind: "app", x: 470, y: 175 },
            { id: "db", label: "PostgreSQL", kind: "data", x: 700, y: 95 },
          ],
          edges: [
            { from: "c", to: "lb" },
            { from: "lb", to: "s1" },
            { from: "lb", to: "s2" },
            { from: "lb", to: "s3" },
            { from: "s1", to: "db" },
            { from: "s2", to: "db" },
            { from: "s3", to: "db" },
          ],
        },
      },
      {
        t: "list",
        items: [
          "**Throughput** — one box caps at N req/s; add boxes to go past it (**horizontal scaling**).",
          "**Availability** — one box means one failure kills the service; N boxes survive N−1 failures.",
          "**Deployability** — rolling deploys work by draining instances one at a time while the LB routes around them.",
          "**Latency tail** — without balancing, one unlucky slow node holds a queue of victims; LBs route around stragglers.",
        ],
      },
      { t: "h", text: "L4 vs L7" },
      {
        t: "table",
        head: ["", "L4 (transport)", "L7 (application)"],
        rows: [
          ["Decides using", "IP + port, connection hash", "URL path, headers, cookies, body"],
          ["Can do", "Fast NAT/DSR passthrough", "Path routing `/api/*` vs `/admin/*`, TLS termination, compression, rate limiting, canary weights"],
          ["Sees", "Nothing about HTTP", "Full request"],
          ["Typical role", "Frontline packet shuffler (AWS NLB, kube-proxy)", "Smart router (AWS ALB, Nginx, Envoy)"],
        ],
      },
      {
        t: "p",
        md: "Production stacks often use both: an L4 balancer handling millions of connections cheaply, feeding an L7 tier that understands the application. Kubernetes' `Service` (kube-proxy) is L4; an `Ingress` controller is L7.",
      },
      { t: "h", text: "Algorithms that actually matter" },
      {
        t: "table",
        head: ["Algorithm", "How it works", "When it wins / fails"],
        rows: [
          ["Round robin", "Cycle through backends", "Great default for uniform requests; fails when request cost varies wildly"],
          ["Least connections", "Send to fewest open conns", "Better under skewed request durations; the safe default for APIs"],
          ["Least response time", "Track recent latency", "Adapts to slow nodes but oscillates under noise"],
          ["Weighted", "Static weights per backend", "Mixed hardware sizes, canary percentages"],
          ["Consistent hashing", "Hash(request key) → ring position", "Sticky routing (cache affinity, WebSockets); survives node churn with minimal reshuffling"],
          ["Random + power of two choices", "Sample two, pick less loaded", "Surprisingly near-optimal; no shared state needed"],
        ],
      },
      {
        t: "callout",
        kind: "info",
        title: "Sticky sessions: convenience with a price",
        md: "Some legacy apps keep session state in process memory, forcing the LB to pin users to nodes (cookie-based stickiness). It works — until a node dies and its sessions vanish, or autoscaling rebalances and cache hit rates collapse. The durable fix is **stateless services**: push session state to Redis or signed tokens, then any backend can serve any request.",
      },
      { t: "h", text: "Health checks: the difference between LB and liability" },
      {
        t: "p",
        md: "A load balancer that forwards traffic to dead backends is worse than none. Health checks come in two flavors: **active** (the LB probes `/healthz` every few seconds) and **passive** (failures observed on real requests eject the node). Get the endpoint right: a health check that verifies dependencies turns one database outage into total outage, because every node reports unhealthy simultaneously. Distinguish **liveness** ('process is up') from **readiness** ('I can serve this kind of request').",
      },
      {
        t: "code",
        lang: "nginx",
        title: "Nginx upstream with least_conn and health semantics",
        code: `upstream api {
    least_conn;
    server api1.internal:8080 max_fails=3 fail_timeout=10s;
    server api2.internal:8080 max_fails=3 fail_timeout=10s;
    server api3.internal:8080 backup;   # only used if others fail
    keepalive 64;                        # reuse upstream connections
}

server {
    listen 443 ssl http2;
    location / {
        proxy_pass http://api;
        proxy_next_upstream error timeout http_502;  # retry next node
        proxy_connect_timeout 2s;                    # fail fast
    }
}`,
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the retry amplifier",
        md: "Node A hangs (doesn't refuse — hangs). The LB's connect timeout is 30s, so requests sit for 30s before failing over. Clients time out at 5s and retry, tripling load onto healthy nodes, which now slow down and start timing out too. Within minutes the whole fleet is down from one hung process. **Fixes:** aggressive connect timeouts (seconds), bounded retries with jitter, and circuit breakers — covered properly in Failure Engineering.",
      },
    ],
    quiz: [
      {
        id: "lb-q1",
        q: "Requests have highly variable cost (some take 10ms, some 10s). Which algorithm avoids piling up on one busy node?",
        options: ["Round robin", "Least connections", "Source IP hash", "DNS round robin"],
        correct: [1],
        explain:
          "Round robin ignores how long each request runs, so long requests accumulate on unlucky nodes. Least connections sends new work to the least-busy backend, self-correcting under skew.",
      },
      {
        id: "lb-q2",
        q: "Why can a health check that validates database connectivity be dangerous?",
        options: [
          "It consumes too many DB connections",
          "A DB outage marks every app node unhealthy at once, removing all capacity instead of degrading gracefully",
          "Health checks cannot reach databases over TLS",
          "It makes rolling deploys impossible",
        ],
        correct: [1],
        explain:
          "Dependency-checking health checks couple node availability to dependency availability. Better: liveness = process up; readiness = can serve (maybe still true in degraded mode); let the app degrade features rather than vanish entirely.",
      },
      {
        id: "lb-q3",
        q: "You need requests from the same user to hit the same backend to exploit per-node in-memory caches, while surviving backend additions/removals. Best choice?",
        options: ["Round robin", "Sticky sessions via LB cookie table", "Consistent hashing on user ID", "Random"],
        correct: [2],
        explain:
          "Consistent hashing maps keys onto a ring so adding/removing a node only remaps ~1/N of keys. Cookie tables require shared state across LB replicas and lose mappings on restart.",
      },
      {
        id: "lb-q4",
        q: "In Kubernetes, which pair correctly matches component to layer?",
        options: [
          "Service = L7, Ingress = L4",
          "Service (kube-proxy) = L4, Ingress controller = L7",
          "Both are L7",
          "Both are DNS-based only",
        ],
        correct: [1],
        explain:
          "kube-proxy balances TCP/UDP flows across pod IPs (L4). Ingress operates on HTTP attributes — hostnames, paths (L7) — and is implemented by controllers like nginx-ingress or Envoy.",
      },
    ],
    exercise: {
      prompt:
        "Configure an Nginx (or Envoy) load balancer for three local API replicas: least-connections, 2s connect timeout, retry-once-on-502, and a passive health check that ejects a node after 3 failures for 15 seconds. Kill one replica mid-load-test and observe recovery.",
      hints: [
        "Use proxy_next_upstream with non_idempotent carefully — retrying POSTs needs idempotency keys.",
        "Watch access logs to confirm ejection and re-admission timing.",
        "Then break the health endpoint itself and predict what happens before you test it.",
      ],
    },
  },

  {
    slug: "caching",
    track: "core-design",
    num: 3,
    title: "Caching",
    subtitle:
      "The highest-leverage performance tool in existence — and the source of the nastiest production bugs. Cache-aside, TTLs, stampedes and hot keys.",
    minutes: 28,
    skills: ["caching", "architecture"],
    concepts: ["cache-hit", "ttl", "eviction", "cache-stampede", "hot-key", "write-through"],
    blocks: [
      {
        t: "p",
        md: "There are only two hard things in systems: naming things, cache invalidation, and off-by-one errors. Caching earns its reputation because it trades **freshness for speed**, and every caching bug you will ever debug is some version of 'the data was stale and we didn't know'.",
      },
      { t: "h", text: "Where caches live" },
      {
        t: "diagram",
        height: 260,
        caption:
          "Every layer between user and disk is a cache opportunity. Each closer layer is faster and smaller.",
        graph: {
          nodes: [
            { id: "b", label: "Browser cache", sub: "memory + disk", kind: "client", x: 20, y: 100 },
            { id: "cdn", label: "CDN edge", sub: "static + API responses", kind: "cache", x: 230, y: 100 },
            { id: "rc", label: "App-level cache", sub: "in-process LRU", kind: "cache", x: 450, y: 30 },
            { id: "redis", label: "Redis", sub: "shared, network-fast", kind: "cache", x: 450, y: 170 },
            { id: "db", label: "Database", sub: "buffer pool + indexes", kind: "data", x: 690, y: 170 },
          ],
          edges: [
            { from: "b", to: "cdn", label: "miss?" },
            { from: "cdn", to: "redis", label: "miss?" },
            { from: "redis", to: "db", label: "miss → query" },
            { from: "b", to: "rc", dashed: true, label: "same process" },
          ],
        },
      },
      { t: "h", text: "Read patterns" },
      {
        t: "table",
        head: ["Pattern", "Flow", "Tradeoff"],
        rows: [
          ["Cache-aside (lazy)", "App checks cache → miss → read DB → populate cache", "Simplest, resilient to cache failure; first read always slow; stale window ≤ TTL"],
          ["Read-through", "Cache library fetches from DB transparently", "Cleaner app code; same staleness properties"],
          ["Write-through", "Write to cache AND DB synchronously", "Cache always fresh; doubles write latency; unused entries pollute cache"],
          ["Write-behind", "Write to cache, flush to DB async", "Fast writes, risk of loss on crash — needs care"],
          ["Refresh-ahead", "Proactively refresh hot keys before expiry", "No misses on hot data; wasted refreshes on cooling data"],
        ],
      },
      {
        t: "p",
        md: "**Cache-aside is the default choice** for application-level caching: your code stays in charge, a cache outage degrades to direct DB reads instead of errors, and eviction policy is the cache's problem, not yours.",
      },
      {
        t: "code",
        lang: "python",
        title: "Cache-aside read & write paths with invalidation",
        code: `# READ PATH
def get_user(user_id: str) -> dict | None:
    key = f"user:{user_id}"
    cached = redis.get(key)
    if cached:
        return json.loads(cached)

    # Cache miss: fetch from primary/replica
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)

    if user is None:
        redis.set(key, "", ex=30)   # negative cache: don't hammer DB for ghosts
        return None

    # Populate cache with jittered TTL (1 hour ± 10%)
    ttl = int(3600 * random.uniform(0.9, 1.1))
    redis.set(key, json.dumps(user), ex=ttl)
    return user

# WRITE PATH (Always update DB first, then DELETE cache)
def update_user(user_id: str, data: dict) -> None:
    db.execute("UPDATE users SET name = %s WHERE id = %s", data["name"], user_id)
    # Evict cache key: deleting is safer than updating to avoid stale overwrite races
    redis.delete(f"user:{user_id}")`,
      },
      {
        t: "callout",
        kind: "danger",
        title: "The Cache-Aside Concurrency Race (Stale Read Overwrite)",
        md: "A common interview misconception is that Cache-Aside is 100% consistent. It is only **eventually consistent**, and has a known concurrency race:\n\n1. **Thread 1 (Read)** misses cache, reads DB (`val = 1`).\n2. **Thread 2 (Write)** updates DB (`val = 2`) and deletes the cache key.\n3. **Thread 1 (Read)** finally finishes its slow execution and writes stale `val = 1` back into Redis with a 1-hour TTL.\n\nResult: The cache holds stale data for the entire TTL!\\n\\n**Production Mitigations:**\n* **Cache Lease Tokens (Memcached/Gutter):** On miss, cache issues a 64-bit lease token. Write-back is rejected if an eviction occurred in between.\n* **Single-Flight Coalescing (Go `singleflight` / mutexes):** Only one concurrent DB query per key; subsequent reads wait on the first future.\n* **Monotonic Versioned Keys:** Key includes version or updated_at timestamp (`user:42:v12`). Writes bump version; stale writes to old versions age out harmlessly.\n* **CDC / Debezium Invalidation:** Tail the database WAL to trigger cache evictions asynchronously.",
      },
      { t: "h", text: "Eviction: what leaves when memory is full" },
      {
        t: "table",
        head: ["Policy", "Behavior", "Use when"],
        rows: [
          ["LRU", "Evict least-recently used", "Temporal locality — the common case (Redis default-ish)"],
          ["LFU", "Evict least-frequently used", "Periodic scans shouldn't evict hot data (Redis 4+ LFU mode)"],
          ["TTL-only", "Expire by time regardless of pressure", "Data freshness dominates sizing concerns"],
          ["FIFO / Random", "Rarely right", "Almost never"],
        ],
      },
      { t: "h", text: "The four classic cache diseases" },
      {
        t: "list",
        items: [
          "**Stampede (dogpile)** — a hot key expires; 10,000 concurrent requests all miss and all hit the DB simultaneously. Fix: request coalescing (single flight), probabilistic early expiration, or locks around recomputation.",
          "**Hot key** — one key (celebrity profile, viral post) receives disproportionate traffic, saturating one shard while others idle. Fix: replicate the key across shards, or add in-process micro-caching.",
          "**Penetration** — queries for nonexistent keys bypass caching and slam the DB (scrapers probing random IDs). Fix: negative caching (cache empty results briefly) and bloom filters.",
          "**Avalanche** — mass expiry after a synchronized pre-warm or a cache-node crash. Fix: jittered TTLs, replicated cache tiers, and warm-up procedures on deploy.",
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "Invalidation strategy beats hit rate",
        md: "Teams obsess over hit rates and get burned by staleness. Decide explicitly per data type: **TTL-only** (profiles tolerate minutes stale), **event-driven invalidation** (write path publishes 'user:42 changed', readers delete the key), or **versioned keys** (`user:42:v7` — writers bump version, old entries age out naturally, no deletes needed). Versioned keys are the most robust pattern nobody teaches.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the stampede blackout",
        md: "At 14:00 UTC a config change resets TTLs on 50K product keys simultaneously. All expire within one second. The DB absorbs 50K extra queries/s against a 10K budget; latency spikes to 30s; connection pools exhaust; the site goes down for 12 minutes. Postmortem fix: TTL jitter (±10%), single-flight locking per key, and staggered pre-warming. Every element of this incident is preventable at design time.",
      },
      { t: "h", text: "What NOT to cache" },
      {
        t: "list",
        items: [
          "Data written then read once — pure overhead.",
          "Huge values (multi-MB blobs) — they evict many small hot entries; put blobs in object storage and cache their URLs.",
          "Highly contentious counters where exactness matters — cache the aggregate asynchronously instead (see the Instagram lesson).",
          "Anything you cannot articulate a staleness budget for. If you can't say 'minutes stale is fine', you're not ready to cache it.",
        ],
      },
    ],
    quiz: [
      {
        id: "cache-q1",
        q: "A hot product page's cache entry expires during a flash sale. Thousands of simultaneous requests hit the DB. This is:",
        options: ["Cache penetration", "Cache stampede", "Cache avalanche", "Hot key problem"],
        correct: [1],
        explain:
          "A stampede is many clients racing to recompute ONE expired key. Avalanche is mass expiry of MANY keys; penetration is queries for keys that never exist. Fixes overlap: coalescing/single-flight here, jittered TTLs for avalanche, negative caching for penetration.",
      },
      {
        id: "cache-q2",
        q: "Why is cache-aside usually preferred over write-through for read-heavy workloads?",
        options: [
          "It guarantees zero staleness",
          "Writes stay fast and a cache outage degrades gracefully to DB reads",
          "It eliminates the need for TTLs",
          "Databases forbid write-through",
        ],
        correct: [1],
        explain:
          "Cache-aside adds no write-path latency and fails soft: if Redis dies, reads fall through to the DB (slower but alive). Write-through couples every write to cache availability and slows them down.",
      },
      {
        id: "cache-q3",
        q: "User profiles change rarely and tolerate ~5 min staleness. Simplest robust strategy?",
        options: [
          "Event-driven invalidation on every write",
          "Versioned keys with a version table",
          "TTL of 300s, cache-aside",
          "No cache; add read replicas",
        ],
        correct: [2],
        explain:
          "When a staleness budget exists, a plain TTL is the simplest correct solution — no invalidation machinery, no version coordination. Reach for event-driven invalidation only when staleness budgets shrink below practical TTLs.",
      },
      {
        id: "cache-q4",
        q: "Which is the best fix for scraper traffic requesting millions of nonexistent user IDs?",
        options: [
          "Longer TTLs on real users",
          "Negative caching: store short-TTL markers for missing keys, optionally behind a bloom filter",
          "Bigger database instance",
          "Rate limit the database",
        ],
        correct: [1],
        explain:
          "Missing keys currently bypass the cache entirely. Caching 'not found' responses (even 30–60s) converts DB floods into cache hits; bloom filters reject most probes before touching anything.",
      },
    ],
    exercise: {
      prompt:
        "Add cache-aside caching to a read endpoint of your choice with: TTL 60s ±10% jitter, negative caching for misses, and a single-flight lock (per-process is fine). Load test with 500 concurrent clients on a cold cache and compare DB QPS with and without coalescing.",
      hints: [
        "Jitter: ttl = 60 * (0.9 + random()*0.2).",
        "Single-flight: a dict of in-progress futures keyed by cache key.",
        "Measure the stampede window: how many DB queries fire in the second after expiry?",
      ],
    },
  },

  {
    slug: "rate-limiting",
    track: "core-design",
    num: 4,
    title: "Rate Limiting",
    subtitle:
      "Protecting systems from their users — token buckets, sliding windows, distributed limits, and graceful degradation.",
    minutes: 20,
    skills: ["architecture", "security"],
    concepts: ["rate-limiting", "token-bucket", "backpressure", "ddos"],
    blocks: [
      {
        t: "p",
        md: "Every public system eventually meets a user who will send infinite requests — a buggy loop, a scraper, or an attacker. **Rate limiting** caps how much work any caller can demand, converting potential overload into clean, documented rejection. It is the difference between degradation and outage.",
      },
      { t: "h", text: "Algorithms" },
      {
        t: "sim",
        sim: "token-bucket",
      },
      {
        t: "table",
        head: ["Algorithm", "Idea", "Gotcha"],
        rows: [
          ["Fixed window counter", "Count per minute bucket; reject over limit", "Boundary burst: 2× limit possible across a window edge"],
          ["Sliding window log", "Store timestamp of every request", "Exact but memory-hungry at scale"],
          ["Sliding window counter", "Interpolate between adjacent fixed windows", "Good approximation, O(1) memory — common default"],
          ["Token bucket", "Bucket refills at rate r, capacity b; request consumes a token", "Allows controlled bursts up to b — ideal for APIs"],
          ["Leaky bucket", "Constant outflow queue", "Smooths bursts completely; adds queuing delay"],
        ],
      },
      { t: "h", text: "Where limits live" },
      {
        t: "diagram",
        height: 220,
        caption:
          "Defense in depth: coarse edge limits absorb volumetric abuse; fine-grained per-user limits protect specific resources.",
        graph: {
          nodes: [
            { id: "edge", label: "Edge / CDN WAF", sub: "IP-based, volumetric DDoS", kind: "infra", x: 20, y: 85 },
            { id: "gw", label: "API Gateway", sub: "per-API-key quotas", kind: "app", x: 280, y: 85 },
            { id: "svc", label: "Service", sub: "per-user, per-action limits", kind: "app", x: 540, y: 85 },
            { id: "rl", label: "Redis", sub: "shared counters", kind: "cache", x: 540, y: 195 },
          ],
          edges: [
            { from: "edge", to: "gw" },
            { from: "gw", to: "svc" },
            { from: "svc", to: "rl", label: "INCR + EXPIRE" },
          ],
        },
      },
      {
        t: "code",
        lang: "lua",
        title: "Atomic sliding-window counter in Redis (core logic)",
        code: `-- KEYS[1] = rate:{user}  ARGV: now_ms, window_ms, limit
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])

redis.call("DEL", "tmp:" .. KEYS[1])
local buckets = redis.call("HGETALL", KEYS[1])
local total = 0
for i = 1, #buckets, 2 do
  local ts   = tonumber(buckets[i])
  local cnt  = tonumber(buckets[i + 1])
  if now - ts < window * 2 then          -- keep last two windows
    redis.call("HSET", "tmp:" .. KEYS[1], ts, cnt)
    total = total + cnt
  end
end
redis.call("RENAME", "tmp:" .. KEYS[1], KEYS[1])

if total >= limit then return {0, limit - total} end
redis.call("HINCRBY", KEYS[1], now, 1)
redis.call("PEXPIRE", KEYS[1], window * 2)
return {1, limit - total - 1}`,
      },
      {
        t: "p",
        md: "The critical property is **atomicity**: check-and-increment must be one operation, or two concurrent requests both pass. In Redis that means Lua scripts or `INCR`+`EXPIRE` pipelines; in Postgres, a single `INSERT ... ON CONFLICT` upsert row per window.",
      },
      {
        t: "callout",
        kind: "info",
        title: "Communicate like a professional",
        md: "Return `429 Too Many Requests` with `Retry-After` headers and document limits publicly. Silent throttling breeds support tickets; explicit contracts build trust. GitHub's API is the gold standard: `X-RateLimit-Limit`, `-Remaining`, `-Reset` on every response.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the limiter outage paradox",
        md: "Your rate limiter uses Redis. Redis dies. Do you fail open (allow all traffic) or closed (reject everything)? Fail-open during an attack = origin overwhelmed. Fail-closed on a Redis blip = self-inflicted outage. Production answer: **fail open with degraded local limits** — each gateway falls back to conservative in-memory buckets while alerting loudly. Design the fallback before you need it.",
      },
    ],
    quiz: [
      {
        id: "rl-q1",
        q: "An API allows 100 req/min via fixed-window counting. A client sends 100 at 00:59:59 and 100 at 01:00:01. What happened?",
        options: [
          "Client exceeded the limit; requests were rejected",
          "200 requests were accepted within ~2 seconds — the boundary burst problem",
          "The window slid automatically",
          "Tokens were consumed from the next bucket",
        ],
        correct: [1],
        explain:
          "Fixed windows reset abruptly, so adjacent edges allow double the intended rate. Sliding windows or token buckets eliminate this artifact.",
      },
      {
        id: "rl-q2",
        q: "Why prefer token buckets for public APIs?",
        options: [
          "They use the least memory",
          "They permit short bursts up to bucket capacity while enforcing a sustained average rate",
          "They never reject requests",
          "They require no shared state",
        ],
        correct: [1],
        explain:
          "Real traffic is bursty. Token buckets absorb legitimate bursts (capacity b) while capping long-run throughput (refill r) — matching user expectations better than rigid smoothing.",
      },
      {
        id: "rl-q3",
        q: "Multiple gateway replicas share rate-limit state in Redis. What breaks if check-and-set isn't atomic?",
        options: [
          "Limits become stricter than configured",
          "Race conditions let concurrent requests exceed the limit",
          "Redis CPU spikes",
          "Nothing — eventual consistency is fine here",
        ],
        correct: [1],
        explain:
          "Two replicas reading the same count both admit their request. Atomic operations (Lua INCR-and-check, or single-command primitives) close the race.",
      },
      {
        id: "rl-q4",
        q: "Your central rate-limiter service becomes unavailable. Most defensible production behavior?",
        options: [
          "Reject all traffic until restored",
          "Allow unlimited traffic until restored",
          "Fall back to conservative local per-instance limits while alerting",
          "Restart the gateways",
        ],
        correct: [2],
        explain:
          "Pure fail-open invites overload; fail-closed converts a dependency blip into full outage. Local fallback limits bound damage in both directions — availability engineering over purity.",
      },
    ],
    exercise: {
      prompt:
        "Implement a distributed sliding-window limiter in Redis (Lua script): 100 requests/min per user, returning remaining quota and retry-after. Load test with 50 parallel workers and verify the limit is never exceeded even under races.",
      hints: [
        "Model two adjacent window buckets with weighted sums; HINCRBY per bucket.",
        "Set key EXPIRE to 2×window to garbage-collect idle users.",
        "Verify with a script asserting sum(admitted) ≤ limit across all workers.",
      ],
    },
  },
];
