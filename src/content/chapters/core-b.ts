import type { Chapter } from "@/lib/types";

export const coreChaptersB: Chapter[] = [
  {
    slug: "redis",
    track: "core-design",
    num: 5,
    title: "Redis",
    subtitle:
      "More than a cache: data structures, persistence, replication, and the production patterns — plus every way teams get burned by it.",
    minutes: 24,
    skills: ["caching", "databases"],
    concepts: ["cache", "ttl", "eviction", "hot-key", "idempotency", "distributed-lock"],
    blocks: [
      {
        t: "p",
        md: "Redis is an **in-memory data structure server**. That single sentence explains both its speed (sub-millisecond, no disk round trips on reads) and its danger (memory is finite and expensive). Teams that treat it as 'a fast database' get paged; teams that understand it as a toolbox of atomic data structures build rate limiters, leaderboards, queues and caches with ten lines of code.",
      },
      { t: "h", text: "The data structures are the product" },
      {
        t: "table",
        head: ["Type", "What it gives you", "Killer use case"],
        rows: [
          ["String", "Bytes, counters via INCR (atomic)", "Cache entries, rate-limit counters, distributed locks"],
          ["Hash", "Field→value maps", "User profiles, cart contents — update one field without read-modify-write"],
          ["List", "Linked list, push/pop both ends", "Simple job queues, recent activity feeds"],
          ["Set", "Unique members, O(1) add/remove/member?", "Follows, tags, deduplication"],
          ["Sorted Set (ZSET)", "Members scored, ordered queries", "Leaderboards, time-series windows, feed timelines"],
          ["Stream", "Append-only log with consumer groups", "Lightweight eventing when Kafka is overkill"],
          ["Bitmap / HyperLogLog", "Bit arrays; cardinality sketches", "DAU tracking in ~12KB per day per metric"],
        ],
      },
      {
        t: "code",
        lang: "bash",
        title: "Five minutes of Redis, five real features",
        code: `# Leaderboard
ZADD leaderboard 98420 "user:42"
ZREVRANGE leaderboard 0 9 WITHSCORES

# Rate limiter (fixed window)
INCR rate:user:42            # returns count
EXPIRE rate:user:42 60       # first time only

# Distributed lock (see caveats below)
SET lock:job:7 pod-3 NX EX 30

# Recent notifications per user
LPUSH notif:user:42 '{"type":"like","post":"p1"}'
LTRIM notif:user:42 0 99     # keep newest 100

# Unique visitor count for a page (approximate)
PFADD page:home:2026-08-21 "user:42"
PFCOUNT page:home:2026-08-21`,
      },
      { t: "h", text: "Persistence: your durability dial" },
      {
        t: "table",
        head: ["Mode", "Mechanism", "Loses on crash", "Cost"],
        rows: [
          ["RDB", "Point-in-time snapshot every N seconds", "Everything since last snapshot", "Cheap; fork-based background save"],
          ["AOF (everysec)", "Append every write, fsync ~1/s", "~1 second of writes", "Larger files, rewrite compaction"],
          ["AOF (always)", "fsync per command", "Nothing acknowledged", "Write latency ≈ disk fsync — rarely worth it"],
          ["None", "Pure cache", "Everything (fine!)", "Fastest; correct choice when data is reproducible"],
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "Redis is not a database",
        md: "Even with AOF always, Redis offers single-node durability semantics at best — a failover can lose the last acknowledged writes, and there are no transactions across keys under concurrency the way SQL gives you. The rule that keeps teams safe: **Redis holds derived or reconstructable state; the source of truth lives in Postgres/S3/Kafka.** The Architecture Builder will flag any design where Redis is the only home of critical data.",
      },
      { t: "h", text: "Scaling topology" },
      {
        t: "diagram",
        height: 250,
        caption:
          "Primary-replica for read scale and HA; Cluster shards keyspace across nodes by hash slot (CRC16 mod 16384).",
        graph: {
          nodes: [
            { id: "app", label: "App servers", kind: "app", x: 20, y: 95 },
            { id: "p1", label: "Redis A", sub: "primary · slots 0–8191", kind: "cache", x: 300, y: 15 },
            { id: "r1", label: "Redis A'", sub: "replica", kind: "cache", x: 300, y: 105, state: undefined },
            { id: "p2", label: "Redis B", sub: "primary · slots 8192–16383", kind: "cache", x: 300, y: 195 },
            { id: "r2", label: "Redis B'", sub: "replica", kind: "cache", x: 560, y: 195 },
            { id: "sent", label: "Sentinel ×3", sub: "failover + discovery", kind: "infra", x: 560, y: 60 },
          ],
          edges: [
            { from: "app", to: "p1" },
            { from: "app", to: "p2" },
            { from: "p1", to: "r1", label: "async repl" },
            { from: "p2", to: "r2", label: "async repl" },
            { from: "sent", to: "p1", dashed: true },
            { from: "sent", to: "r1", dashed: true },
          ],
        },
      },
      {
        t: "list",
        items: [
          "**Replication** is asynchronous — a replica can lag and can lose the last writes if promoted. Plan reads accordingly.",
          "**Sentinel** provides automatic failover for a primary-replica group (small scale).",
          "**Cluster** shards across 16,384 hash slots; multi-key operations require keys in the same slot (`hash tags` like `{user42}:cart`).",
          "**Hot keys** defeat sharding: one celebrity key still lands on one shard. Fix with local replicas of the value or fan-out caching — exactly the Instagram Like Storm lesson.",
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: KEYS * takes down production",
        md: "A debug endpoint calls `KEYS user:*` on a 40GB instance. Redis is single-threaded: the scan blocks all commands for seconds. Health checks time out, Sentinel fails over, the new primary inherits the same blocked client, cascading restarts follow. **Fixes:** use `SCAN` (incremental), set `slowlog-log-slower-than`, forbid dangerous commands via `rename-command`, and alert on `latency_percentiles_usec`.",
      },
      { t: "h", text: "Distributed locks: handle with fear" },
      {
        t: "p",
        md: "`SET key value NX EX 30` gives mutual exclusion — until the holder GC-pauses past expiry, a second worker acquires the lock, and both mutate shared state. Mitigate with **fencing tokens** (monotonic numbers checked by the resource) or accept best-effort semantics and make work idempotent. Redlock's multi-node variant remains genuinely controversial; treat locks as an optimization hint, never as a correctness guarantee.",
      },
    ],
    quiz: [
      {
        id: "redis-q1",
        q: "You need top-10 scores updated millions of times per hour. Best Redis structure?",
        options: ["LIST with LPUSH+SORT", "HASH of user→score plus app-side sorting", "Sorted Set (ZSET)", "Bitmap"],
        correct: [2],
        explain:
          "ZSETs maintain score order incrementally: ZADD updates, ZREVRANGE reads top-N in O(log N). Sorting lists or hashes in application code re-does work Redis already does.",
      },
      {
        id: "redis-q2",
        q: "Redis runs as pure cache (no persistence) and crashes. What happens?",
        options: [
          "Permanent data loss corrupts the system",
          "Cache empties; DB absorbs full load until warm — plan for the thundering herd",
          "Replicas automatically rebuild it",
          "Clients receive errors until manual flush",
        ],
        correct: [1],
        explain:
          "For cache-only Redis, a crash is survivable but not free: instant 100% miss rate slams the database. Warm-up procedures and jittered TTLs soften the recovery; this is the 'cache avalanche' scenario.",
      },
      {
        id: "redis-q3",
        q: "In Redis Cluster, why does SETNX across keys `{u1}:lock` and `{u1}:profile` succeed while `lock` + `profile` (different slots) fails?",
        options: [
          "Cluster forbids locks",
          "Multi-key operations require same hash slot; {u1} forces co-location",
          "SETNX only works on primaries",
          "It's a Lua limitation",
        ],
        correct: [1],
        explain:
          "Hash tags in braces determine slot assignment. Keys sharing a tag live on the same node, enabling multi-key atomic ops. It's also a partitioning tool: co-locate a user's data deliberately.",
      },
      {
        id: "redis-q4",
        q: "Which use of Redis is most likely to cause a production incident?",
        options: [
          "Session store with 30-min TTL",
          "Sole persistent store for payment records",
          "Rate-limit counters with 60s TTL",
          "Leaderboard ZSETs rebuilt nightly from Postgres",
        ],
        correct: [1],
        explain:
          "Payments need durable, transactional, auditable storage. Everything else listed is derived/reconstructable — exactly what Redis is for. The Builder's intelligence panel flags this pattern as a critical warning.",
      },
    ],
    exercise: {
      prompt:
        "Build three mini-features against a local Redis: (1) sliding-window rate limiter, (2) leaderboard with rank lookup for arbitrary users, (3) job queue with LIST + a reliable-processing pattern (processing list + BRPOPLPUSH). Break each one deliberately: kill Redis mid-operation and document what each loses.",
      hints: [
        "Rank lookup: ZREVRANK returns 0-based rank — add 1 for display.",
        "Reliable queue: if a worker dies, another LMOVEs orphaned jobs back.",
        "Note which losses matter (counters reset = fine) and which don't (sessions wiped = logout storm).",
      ],
    },
  },
];
