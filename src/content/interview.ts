import type { InterviewQuestion } from "@/lib/types";

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    slug: "url-shortener",
    title: "Design a URL Shortener",
    difficulty: "Easy",
    minutes: 25,
    summary:
      "The classic warm-up: tiny URL in, redirect out — but at 100M URLs and 20K redirects/sec the details matter.",
    requirements: {
      functional: [
        "Shorten a long URL → short code (e.g., `x.io/aB3xK9`)",
        "Redirect short code → original URL (301/302)",
        "Optional: custom aliases, expiry, click analytics",
      ],
      nonFunctional: [
        "Read-heavy: 100:1 read/write ratio",
        "< 50ms redirect p99 — this is user-facing hot path",
        "High availability; codes never change once issued",
      ],
    },
    estimation: [
      { label: "Writes", value: "100M new/month ≈ 40 QPS avg (~200 peak)" },
      { label: "Reads", value: "100:1 → 4K QPS avg (~20K peak)" },
      { label: "Storage", value: "100M × 500B/yr ≈ 50GB/yr — trivial for Postgres" },
      { label: "Code space", value: "base62, 7 chars = 62⁷ ≈ 3.5 trillion codes" },
    ],
    architectureNotes: [
      "Stateless API behind LB; single Postgres is honestly enough for years — say so!",
      "Counter-based ID + base62 encoding beats random collision-check loops; or use random 7-char with UNIQUE constraint retry.",
      "Cache hot codes in Redis (cache-aside, 24h TTL) to absorb read spikes.",
      "Redirect via 302 if analytics matter (hits origin), 301 if pure speed (browser caches forever).",
      "Analytics async: emit events to Kafka, aggregate in workers — never on the redirect path.",
    ],
    deepDives: [
      {
        topic: "Code generation strategies",
        points: [
          "Sequential counter + base62: predictable/guessable, needs coordinated counter or pre-allocated ranges.",
          "Random + unique index: no coordination, rare retries on collision — simpler operationally.",
          "Never hash without truncation care: MD5[:7] collisions need handling anyway.",
        ],
      },
      {
        topic: "Redirect performance",
        points: [
          "CDN can cache popular redirects entirely off-origin.",
          "Redis p99 <1ms makes DB hits rare; negative-cache missing codes against scrapers.",
          "Rate-limit code creation per IP/user — abuse magnet.",
        ],
      },
    ],
    tradeoffs: [
      ["ID strategy", "Counter+base62", "Random base62"],
      ["Storage", "Postgres single node", "DynamoDB key-value"],
      ["Redirect", "301 permanent", "302 temporary"],
    ],
    failureHandling: [
      "DB down → serve cached redirects (stale-OK); creation fails loudly with 503.",
      "Hot viral link → single cached key absorbs it; watch for negative-cache penetration on dead codes.",
      "Duplicate shorten requests → idempotency by long-URL hash returning same code.",
    ],
    checklist: [
      "Clarified functional vs non-functional requirements",
      "Estimated QPS, storage, and read/write ratio",
      "Chose ID generation strategy with collision analysis",
      " Drew the request path including cache layer",
      "Discussed 301 vs 302 tradeoff explicitly",
      "Addressed abuse: rate limiting, malicious URLs",
    ],
  },
  {
    slug: "rate-limiter-design",
    title: "Design a Rate Limiter",
    difficulty: "Easy",
    minutes: 20,
    summary:
      "Where should limits live, which algorithm, how do replicas agree — the questions that separate seniors from juniors.",
    requirements: {
      functional: [
        "Limit requests per client (API key / user / IP) per window",
        "Return 429 + Retry-After when exceeded",
        "Configurable rules per endpoint tier",
      ],
      nonFunctional: [
        "Check adds < 5ms to request path",
        "Atomic under concurrency across gateway replicas",
        "Fail-open with degraded local limits if limiter store dies",
      ],
    },
    estimation: [
      { label: "Checks/sec", value: "= traffic rate: 100K QPS → 100K limiter ops/s" },
      { label: "State size", value: "Active clients/hour × counters ≈ few GB Redis" },
      { label: "Latency budget", value: "One Redis round trip (~0.5ms same-DC)" },
    ],
    architectureNotes: [
      "Token bucket as default algorithm (burst-friendly); sliding window counter where exactness matters.",
      "Central Redis with Lua script = atomic check-and-consume; local in-memory fallback buckets on Redis failure.",
      "Layered enforcement: edge WAF (IP volumetric) → gateway (API-key quota) → service (per-action fine limits).",
      "Headers on every response: X-RateLimit-Limit/Remaining/Reset — contracts beat surprises.",
    ],
    deepDives: [
      {
        topic: "Distributed correctness",
        points: [
          "Non-atomic INCR-then-EXPIRE races admit extra requests under concurrent load.",
          "Lua scripts execute atomically in Redis — the standard solution.",
          "Clock skew matters for sliding windows: derive time from Redis TIME, not app servers.",
        ],
      },
      {
        topic: "Bursts vs sustained load",
        points: [
          "Token bucket capacity b absorbs legitimate bursts; refill r caps average.",
          "Sliding log gives exactness at O(requests) memory — reserve for expensive endpoints only.",
          "Consider cost-based limiting: expensive endpoints consume multiple tokens.",
        ],
      },
    ],
    tradeoffs: [
      ["Algorithm", "Token bucket", "Sliding window log"],
      ["State", "Centralized Redis", "Local per-replica"],
      ["Failure mode", "Fail-open + local fallback", "Fail-closed"],
    ],
    failureHandling: [
      "Redis outage → local conservative buckets + alerting (never hard fail-closed).",
      "Thundering herd after reset → jittered windows, not synchronized resets.",
      "Abuse pattern shift → rules must be hot-configurable, not redeploy-bound.",
    ],
    checklist: [
      "Asked who/what is being limited (user? IP? endpoint?)",
      "Chose algorithm with burst semantics justified",
      "Handled distributed atomicity explicitly",
      "Designed the fail-open degradation path",
      "Specified client-facing headers and error contract",
    ],
  },
  {
    slug: "instagram-feed",
    title: "Design Instagram Feed",
    difficulty: "Medium",
    minutes: 45,
    summary:
      "Fan-out wars: push timelines, pull timelines, celebrity problems, and the like-storm that melts naive counters.",
    requirements: {
      functional: [
        "Publish posts (images/video) with captions",
        "Home feed: posts from accounts I follow, reverse-chronological",
        "Like/comment/follow interactions",
      ],
      nonFunctional: [
        "100M DAU; feed load < 200ms p95",
        "Eventual consistency acceptable for likes; NOT for post visibility",
        "Media-heavy: CDN mandatory",
      ],
    },
    estimation: [
      { label: "Feed reads", value: "100M × 10 sessions × 20 scrolls ≈ 2B/day ≈ 23K QPS avg" },
      { label: "Posts", value: "50M/day uploads ≈ 600 QPS writes" },
      { label: "Storage", value: "50M × 500KB ≈ 25TB/day media → object storage" },
      { label: "Fan-out", value: "Avg 300 followers; celebrities 100M+" },
    ],
    architectureNotes: [
      "Upload path: presigned S3 upload → image processor workers (resize variants) → metadata to Postgres → fan-out event.",
      "Feed strategy HYBRID: fan-out-on-write to Redis timeline lists for normal users; celebrities excluded (fan-out-on-read merges their posts at request time).",
      "Timeline entries store post IDs only; hydrate via cache; paginate by cursor (post_id + timestamp), never OFFSET.",
      "Likes: async aggregation pipeline — Redis counters flushed in batches to Postgres; hot posts get sharded counters. (Full simulation in the Instagram lesson.)",
    ],
    deepDives: [
      {
        topic: "Fan-out write vs read",
        points: [
          "Push: O(followers) work per post but O(1) reads — great until Kim Kardashian posts.",
          "Pull: cheap writes, expensive reads at 2B/day — nonstarter alone.",
          "Hybrid threshold (~100K followers): most users push, celebs pull-merge; ranker stitches results.",
        ],
      },
      {
        topic: "Feed ranking storage",
        points: [
          "Redis ZSET per user timeline: score = epoch_ms, member = post_id; ZREVRANGE paginates natively.",
          "Memory math: 300 avg entries × 100M users × ~100B ≈ 3TB — cluster it, TTL inactive users.",
          "Deleted/unfollowed posts: lazy filtering at read (tombstone set) beats rewriting timelines.",
        ],
      },
    ],
    tradeoffs: [
      ["Feed model", "Fan-out on write", "Fan-out on read"],
      ["Counters", "Sync DB update", "Async batched aggregation"],
      ["Media", "DB BLOBs", "Object storage + CDN"],
    ],
    failureHandling: [
      "Redis timeline cluster down → fall back to pull-based assembly (slower but alive).",
      "Celebrity post storm → their posts bypass fan-out entirely by design.",
      "Like storm → covered deeply in the interactive lesson: batching + sharded counters.",
    ],
    checklist: [
      "Estimated reads/writes/storage with real numbers",
      "Chose hybrid fan-out with explicit celebrity threshold",
      "Designed upload pipeline incl. image processing",
      "Addressed pagination mechanics (cursor-based)",
      "Explained like-counter scaling strategy",
      "Identified what's allowed to be eventually consistent",
    ],
  },
  {
    slug: "chat-system",
    title: "Design WhatsApp-style Chat",
    difficulty: "Hard",
    minutes: 45,
    summary:
      "Billions of persistent connections, delivery receipts, ordering guarantees and offline sync — real-time done seriously.",
    requirements: {
      functional: [
        "1:1 and group messaging with delivery/read receipts",
        "Online presence indicators",
        "Offline message delivery on reconnect",
        "Media attachments",
      ],
      nonFunctional: [
        "500M connections; message delivery < 500ms p99",
        "Ordering per conversation guaranteed",
        "No message loss, ever (durability before ack)",
      ],
    },
    estimation: [
      { label: "Connections", value: "500M concurrent WebSockets ≈ 40 conns/server × 12.5M... realistically 100K+ servers or LB-tiered gateways" },
      { label: "Messages", value: "60B/day ≈ 700K msg/s avg, 2M+ peak" },
      { label: "Storage", value: "60B × 200B ≈ 12TB/day messages + media separately" },
    ],
    architectureNotes: [
      "Connection gateways hold WebSockets; routing layer maps user→gateway via Redis presence registry.",
      "Message flow: sender→gateway→queue→storage→fanout→recipient gateways; ack chain drives receipts (sent/delivered/read).",
      "Per-conversation sequence numbers assigned by partitioned sequencer service guarantee ordering.",
      "Offline: messages persist durably; on reconnect, client sends last-seq per conversation, server replays delta.",
      "Groups: fan-out to member list; supergroups cap membership or move to pub/sub topics.",
    ],
    deepDives: [
      {
        topic: "Ordering & exactly-once illusion",
        points: [
          "Client-generated message IDs + server sequence numbers dedupe retries.",
          "Store-then-forward: persist before acking sender — 'sent' means durable.",
          "Idempotent fan-out: recipient gateways dedupe by (conversation_id, seq).",
        ],
      },
      {
        topic: "Presence at scale",
        points: [
          "Heartbeats every 30s; presence TTL 90s handles silent disconnects.",
          "Batch presence updates through pub/sub — broadcasting 500M states directly is impossible.",
          "Debounce flapping users; show 'last seen' coarser than reality to save fan-out.",
        ],
      },
    ],
    tradeoffs: [
      ["Delivery", "Store-and-forward", "Direct relay"],
      ["Ordering", "Sequencer service", "Lamport clocks"],
      ["Group fan-out", "Push to members", "Shared group topic"],
    ],
    failureHandling: [
      "Gateway crash → clients reconnect (backoff+jitter), presence registry expires entries, undelivered queue items replay.",
      "Queue unavailable → gateways buffer briefly then return 503; senders retry idempotently.",
      "Split brain on routing registry → lease-based ownership prevents double-delivery beyond dedupe.",
    ],
    checklist: [
      "Sized connection infrastructure honestly",
      "Designed ack/receipt state machine",
      "Guaranteed per-conversation ordering mechanism",
      "Handled offline replay protocol",
      "Made delivery effectively-once via dedup",
      "Scoped presence system realistically",
    ],
  },
  {
    slug: "news-feed-ranking",
    title: "Design Twitter Timeline",
    difficulty: "Hard",
    minutes: 40,
    summary:
      "The celebrity problem at its purest: 300M followers watching one account press 'post'.",
    requirements: {
      functional: ["Post tweets ≤280 chars + media", "Home timeline from follows", "Retweet/like/reply"],
      nonFunctional: [
        "Timeline load < 250ms p95; tweet visible to followers < 5s",
        "150M DAU reading 100+ tweets/session",
      ],
    },
    estimation: [
      { label: "Timeline reads", value: "150M × 15 loads/day ≈ 26K QPS avg" },
      { label: "Tweet writes", value: "500M/day ≈ 6K QPS" },
      { label: "Fan-out worst case", value: "1 tweet × 100M followers = 100M timeline inserts" },
    ],
    architectureNotes: [
      "Same hybrid fan-out as Instagram but stricter latency: pre-materialized Redis timelines are mandatory for the common case.",
      "Celebrity handling: tweets from >1M-follower accounts skip fan-out; timeline service merges them during read (they're rare per-user).",
      "Search: near-real-time indexing pipeline (tweet → Kafka → Elasticsearch) for full-text; trending via streaming aggregations.",
      "Media: separate upload domain, CDN everywhere, EXIF stripping in processors.",
    ],
    deepDives: [
      {
        topic: "The 100M-follower tweet",
        points: [
          "Naive fan-out: 100M Redis writes ≈ hours of cluster capacity for ONE tweet.",
          "Merge-at-read: fetch followed-celeb IDs (small set), interleave into fetched timeline page.",
          "Cache merged pages briefly; viral moments amortize across repeated scroll requests.",
        ],
      },
      {
        topic: "Consistency choices",
        points: [
          "Your own tweet must appear instantly (read-your-writes): serve author's view from primary.",
          "Follower timelines lagging seconds is acceptable — eventual consistency budget stated explicitly.",
          "Delete propagation: tombstones checked lazily; timelines self-heal on natural eviction.",
        ],
      },
    ],
    tradeoffs: [
      ["Timeline", "Precomputed push", "On-demand pull"],
      ["Ranking", "Chronological", "ML-ranked"],
      ["Counts", "Exact ACID", "Approximate async"],
    ],
    failureHandling: [
      "Timeline Redis degraded → pull-mode assembly for affected shards; latency up, service up.",
      "Viral spike (10× tweets) → fan-out queues absorb; celebrity path unaffected by design.",
      "Bad ranking deploy → feature-flagged rollback to chronological within minutes.",
    ],
    checklist: [
      "Quantified the celebrity fan-out problem numerically",
      "Designed hybrid push/pull with thresholds",
      "Separated author-view consistency from follower-view",
      "Planned search/trending pipelines",
      "Stated staleness budgets per feature",
    ],
  },
  {
    slug: "web-crawler",
    title: "Design a Web Crawler",
    difficulty: "Medium",
    minutes: 35,
    summary:
      "Politeness, deduplication and bounded frontier management — distributed systems disguised as scraping.",
    requirements: {
      functional: [
        "Fetch pages starting from seeds, extract links, recurse politely",
        "Respect robots.txt and per-host rate limits",
        "Detect duplicate content",
      ],
      nonFunctional: ["1B pages/month ≈ 400 pages/s sustained", "Politeness: ≤1 req/host/5s", "Resumable after crashes"],
    },
    estimation: [
      { label: "Throughput", value: "400 pages/s × 100KB ≈ 40MB/s ingress" },
      { label: "URL frontier", value: "Billions queued → disk-backed priority structure" },
      { label: "Host count", value: "Tens of millions of distinct hosts drive politeness sharding" },
    ],
    architectureNotes: [
      "Frontier service: priority queues keyed by host hash; politeness enforced per-host-bucket (delay tokens).",
      "Workers pull URL batches scoped to hosts they own (consistent hashing) — no cross-worker host collisions.",
      "Content hash (SimHash/SHA) dedupe store filters re-fetches; canonicalization strips UTM params, fragments.",
      "Everything checkpointed: seen-URL bloom filter + RocksDB frontier survive restarts.",
    ],
    deepDives: [
      {
        topic: "Politeness engineering",
        points: [
          "Per-host token buckets globally coordinated via the frontier's host-sharded design.",
          "robots.txt cached with TTL; 429/503 responses back off exponentially per host.",
          "Crawler traps (calendars, infinite spaces): depth limits, URL-pattern classifiers, content-hash cycles detection.",
        ],
      },
      {
        topic: "Scale mechanics",
        points: [
          "DNS resolution is a hidden bottleneck: dedicated resolver cache layer (millions of lookups/min).",
          "Bloom filter for 'seen' at 10B URLs ≈ 12GB at 1% FP — acceptable with DB verification on positives.",
          "Backpressure: parse/index pipelines slower than fetch → frontier pauses fetchers (bounded memory).",
        ],
      },
    ],
    tradeoffs: [
      ["Frontier", "In-memory queues", "Disk-backed (RocksDB)"],
      ["Dedupe", "Exact hash set", "Bloom + verify"],
      ["Coordination", "Central scheduler", "Host-sharded autonomy"],
    ],
    failureHandling: [
      "Worker crash → leased URL batches expire, frontier requeues; idempotent processing tolerates refetches.",
      "Target site outage → per-host circuit breaker parks the host bucket, retries later.",
      "Frontier corruption → periodic snapshots + WAL replay rebuild state.",
    ],
    checklist: [
      "Addressed robots.txt and politeness unprompted",
      "Sharded work by host consistently",
      "Designed resumability (crash-safe frontier)",
      "Chose dedup strategy with memory math",
      "Identified DNS as bottleneck",
    ],
  },
  {
    slug: "notification-system",
    title: "Design a Notification Platform",
    difficulty: "Medium",
    minutes: 30,
    summary:
      "Billions of pushes/emails/SMS daily without melting user trust or provider quotas — fan-out, dedup and preferences at scale.",
    requirements: {
      functional: [
        "Send push/email/SMS/in-app from any producer service",
        "User preferences (channel opt-outs, quiet hours)",
        "Deduplication and digesting options",
      ],
      nonFunctional: ["1B notifications/day ≈ 12K/s avg, 50K+ peaks", "Push delivery < 5s p99", "No lost notifications"],
    },
    estimation: [
      { label: "Volume", value: "1B/day ÷ 10⁵s = 10K/s baseline" },
      { label: "Provider limits", value: "FCM/APNs batch quotas shape outbound pacing" },
      { label: "Storage", value: "Notification records ~1KB × 1B/day ≈ 1TB/day (TTL'd)" },
    ],
    architectureNotes: [
      "Producers publish intent events → Kafka → preference/filter stage → channel routers → provider adapters.",
      "Preferences service caches user settings in Redis; default-deny wins over producer urgency.",
      "Dedup keys (user, type, entity, window) in Redis prevent notification storms from retry loops upstream.",
      "Provider adapters handle rate limits, retries with backoff, and token invalidation feedback loops.",
      "In-app channel: notification store + WebSocket/SSE fan-out; unread counts via async counters.",
    ],
    deepDives: [
      {
        topic: "Reliability without spam",
        points: [
          "At-least-once Kafka + idempotent senders (provider message IDs recorded) = no loss, no dupes.",
          "DLQ for poison intents; alert on DLQ depth rather than silently dropping.",
          "Quiet hours computed per-user timezone at filter stage — not at send time.",
        ],
      },
      {
        topic: "Provider reality",
        points: [
          "APNs/FCM respond with per-token failures: prune dead tokens aggressively (list hygiene = deliverability).",
          "SMS costs money per message: budget guards + per-user SMS caps are product features, not hacks.",
          "Multi-provider failover for email (SES→SendGrid) with warm-IP reputation management.",
        ],
      },
    ],
    tradeoffs: [
      ["Delivery guarantee", "At-least-once + dedup", "Exactly-once fantasy"],
      ["Routing", "Single provider", "Multi-provider failover"],
      ["Digesting", "Immediate send", "Windowed digests"],
    ],
    failureHandling: [
      "Kafka consumer crash → offsets uncommitted, redelivery deduped by message-ID table.",
      "Provider outage → adapter circuit-breaks, routes overflow to secondary provider.",
      "Preference service down → cached defaults served stale; never bypass preferences.",
    ],
    checklist: [
      "Modeled producer→router→adapter pipeline clearly",
      "Enforced preferences as a hard gate",
      "Designed dedup keys and idempotent sending",
      "Handled provider quotas and token hygiene",
      "Chose and justified delivery semantics",
    ],
  },
];
