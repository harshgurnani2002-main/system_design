import type { Chapter } from "@/lib/types";

export const dataChapters: Chapter[] = [
  {
    slug: "postgres-scaling",
    track: "data-systems",
    num: 1,
    title: "PostgreSQL at Scale",
    subtitle:
      "Indexes, query plans, MVCC, connection pooling, replication, partitioning — and the honest decision tree for when to shard.",
    minutes: 30,
    skills: ["databases", "architecture"],
    concepts: ["index", "mvcc", "replication", "sharding", "connection-pool", "partitioning"],
    blocks: [
      {
        t: "p",
        md: "PostgreSQL will take you astonishingly far — single-digit-terabyte datasets, tens of thousands of QPS on good hardware — before you need anything fancier. The skill is knowing **which knob to turn as load grows**, because each knob has a cost and turning them in the wrong order creates migrations you'll regret.",
      },
      { t: "h", text: "Indexes: B-trees and what they actually cost" },
      {
        t: "diagram",
        height: 250,
        caption:
          "A B-tree index narrows candidates logarithmically: millions of rows → ~3 page reads. Without it, every query is a full scan.",
        graph: {
          nodes: [
            { id: "root", label: "Root page", sub: "keys → pointers", kind: "data", x: 300, y: 10 },
            { id: "i1", label: "Internal", sub: "id < 5000", kind: "data", x: 150, y: 105 },
            { id: "i2", label: "Internal", sub: "id ≥ 5000", kind: "data", x: 470, y: 105 },
            { id: "l1", label: "Leaf rows", sub: "heap pointers", kind: "data", x: 40, y: 200 },
            { id: "l2", label: "Leaf rows", kind: "data", x: 230, y: 200 },
            { id: "l3", label: "Leaf rows", kind: "data", x: 420, y: 200 },
            { id: "l4", label: "Leaf rows", kind: "data", x: 610, y: 200 },
          ],
          edges: [
            { from: "root", to: "i1" },
            { from: "root", to: "i2" },
            { from: "i1", to: "l1" },
            { from: "i1", to: "l2" },
            { from: "i2", to: "l3" },
            { from: "i2", to: "l4" },
          ],
        },
      },
      {
        t: "list",
        items: [
          "**Composite index order matters**: `(user_id, created_at)` serves `WHERE user_id=? ORDER BY created_at` perfectly; `(created_at, user_id)` does not. Equality columns first, range/sort last.",
          "**Covering indexes** (`INCLUDE`) let index-only scans skip the heap entirely.",
          "**Partial indexes** (`WHERE status='pending'`) keep tiny, blazing indexes on hot subsets.",
          "Every index slows writes and consumes cache. Ten indexes on a hot write table is a self-inflicted wound; measure with `pg_stat_user_indexes` and drop the unused ones.",
        ],
      },
      {
        t: "code",
        lang: "sql",
        title: "Reading EXPLAIN ANALYZE like an engineer",
        code: `EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 42 ORDER BY created_at DESC LIMIT 20;

-- BAD: Sort + Seq Scan on orders  (cost=0.00..35811.00 rows=120 width=64)
--      -> Sort (top-N heapsort)
--      -> Seq Scan on orders

-- GOOD with INDEX orders_user_created_idx (user_id, created_at DESC):
-- Limit (actual time=0.041..0.062)
--   -> Index Scan using orders_user_created_idx
--        Index Cond: user_id = 42
-- Planning+execution: 0.08 ms`,
      },
      { t: "h", text: "Transactions, isolation and MVCC" },
      {
        t: "p",
        md: "Postgres implements **MVCC**: writers never block readers. Each row version carries `xmin`/`xmax`; a snapshot decides which versions are visible. This is why a long report query doesn't stall OLTP writes — but old versions must eventually be reclaimed by **VACUUM**, which is why long-running transactions are production hazards: they pin the horizon, bloat tables, and can exhaust transaction ID space if ignored.",
      },
      {
        t: "table",
        head: ["Isolation level", "Protects against", "Cost"],
        rows: [
          ["READ COMMITTED (default)", "Dirty reads", "Anomalies within a statement sequence possible"],
          ["REPEATABLE READ", "+ Non-repeatable reads, phantom reads (PG's version)", "Serialization failures → retry logic needed"],
          ["SERIALIZABLE", "Everything, via SSI conflict detection", "Retries under contention; use only where correctness demands"],
        ],
      },
      {
        t: "callout",
        kind: "info",
        title: "The retry rule",
        md: "Any transaction that can fail with a serialization or deadlock error needs bounded retry with jitter in application code. Frameworks won't do this for you, and 'it worked in staging' usually means staging had no concurrency.",
      },
      { t: "h", text: "Connection pooling: the first real bottleneck" },
      {
        t: "p",
        md: "Each Postgres connection is a process (~5–10MB). At 200 app servers × 20 pool connections, you exhaust `max_connections` long before exhausting CPU. A pooler (**PgBouncer** in transaction mode) multiplexes thousands of client connections onto dozens of server connections. Transaction mode forbids session state (`SET`, prepared statements across transactions, advisory locks) — plan for it early rather than discovering it during an outage.",
      },
      { t: "h", text: "Replication: reads and safety" },
      {
        t: "diagram",
        height: 240,
        caption:
          "Streaming replication: primary ships WAL; replicas apply asynchronously. Promotion on failure trades durability for availability.",
        graph: {
          nodes: [
            { id: "w", label: "Writes", kind: "client", x: 20, y: 60 },
            { id: "p", label: "Primary", sub: "WAL → stream", kind: "data", x: 260, y: 60 },
            { id: "r1", label: "Replica 1", sub: "reads + standby", kind: "data", x: 560, y: 15 },
            { id: "r2", label: "Replica 2", sub: "reads + analytics", kind: "data", x: 560, y: 110 },
          ],
          edges: [
            { from: "w", to: "p" },
            { from: "p", to: "r1", label: "async WAL" },
            { from: "p", to: "r2", label: "async WAL" },
          ],
        },
      },
      {
        t: "list",
        items: [
          "**Synchronous replication** (`synchronous_commit=remote_apply`) guarantees the replica has it before ack — at the cost of write latency and availability when replicas lag.",
          "**Async** is the default: fast, but failover can lose the last few transactions, and read-your-writes breaks unless you route carefully.",
          "**Read-your-writes fix:** after a write, pin that user's subsequent reads to the primary for a few seconds (sticky routing), or check replication lag per query.",
        ],
      },
      { t: "h", text: "Partitioning vs sharding" },
      {
        t: "table",
        head: ["", "Partitioning (one instance)", "Sharding (many instances)"],
        rows: [
          ["What splits", "One table into pieces (range/list/hash)", "The dataset across machines"],
          ["Solves", "Index size, vacuum time, retention drops", "Write throughput, RAM/CPU/disk ceilings"],
          ["Joins across pieces", "Fine — planner handles it", "Hard; design schema around co-location"],
          ["Operational cost", "Low", "High: rebalancing, cross-shard queries, hot shards"],
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "The sharding decision tree",
        md: "Shard ONLY when: writes exceed vertical capacity AND caching/replicas/partitioning are exhausted AND the business accepts cross-shard complexity. Choose a shard key matching your dominant access pattern (tenant_id, user_id) — one that makes most queries single-shard. Resharding later is a months-long project; choose like it's permanent, because it is.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: lock convoy on the hot table",
        md: "A migration adds a column via `ALTER TABLE ... SET DEFAULT` on a 400M-row table. In modern Postgres this is metadata-only — but it must briefly take an ACCESS EXCLUSIVE lock, and it queues behind a 9-second analytics query. Every subsequent query now queues behind the ALTER. Within seconds: total connection exhaustion, site down. **Rule:** set `lock_timeout` small on all DDL, run migrations in off-peak, use tools that expand-then-contract.",
      },
    ],
    quiz: [
      {
        id: "pg-q1",
        q: "`SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20` is slow. Best index?",
        options: ["(created_at)", "(user_id)", "(user_id, created_at DESC)", "(created_at, user_id)"],
        correct: [2],
        explain:
          "Equality column first, then the sort column — the index returns rows already in order, so Postgres walks it and stops after 20. (created_at, user_id) helps neither filter nor sort for this query shape.",
      },
      {
        id: "pg-q2",
        q: "200 app instances each hold pools of 25 connections; max_connections=500. Earliest correct fix?",
        options: [
          "Raise max_connections to 6000",
          "Add PgBouncer in transaction mode between apps and DB",
          "Move to MongoDB",
          "Shard the database",
        ],
        correct: [1],
        explain:
          "Each PG connection is a process; thousands of mostly-idle connections waste memory and hurt scheduling. Poolers multiplex efficiently. Raising limits delays collapse while increasing memory pressure.",
      },
      {
        id: "pg-q3",
        q: "After failing over to an async replica, users report their just-submitted posts missing. Root cause?",
        options: [
          "Data corruption",
          "Async replication lost the last un-replicated commits during failover",
          "Missing index on posts",
          "VACUUM removed recent rows",
        ],
        correct: [1],
        explain:
          "Async means the primary acked writes before replicas received them. Failover promotes a replica that may be behind — those tail transactions are gone. Mitigations: sync replication for critical paths, or accept and communicate the window.",
      },
      {
        id: "pg-q4",
        q: "Multi-tenant SaaS: 90% of queries filter by tenant_id; one giant tenant outgrows others. Sharding key choice?",
        options: ["Random round-robin", "created_at date ranges", "tenant_id", "user email hash"],
        correct: [2],
        explain:
          "Shard by the dominant access dimension so queries hit one shard. Date sharding spreads every tenant everywhere; random destroys locality. The big tenant may still need its own dedicated shard ('hot tenant' handling).",
      },
    ],
    exercise: {
      prompt:
        "Generate 10M orders in a local Postgres. Time the dashboard query before indexing; add the composite index and re-measure. Then run pgbench at growing client counts until p99 degrades, insert PgBouncer, and measure again. Write down the three numbers you'd show in a design review.",
      hints: [
        "Use generate_series() with random data; ANALYZE after loading.",
        "pgbench -c 50 -j 4 -T 60 custom script for steady-state numbers.",
        "Watch pg_stat_activity wait events to name the bottleneck precisely.",
      ],
    },
  },

  {
    slug: "kafka",
    track: "data-systems",
    num: 2,
    title: "Kafka & Event Streaming",
    subtitle:
      "Topics, partitions, consumer groups, delivery semantics — the backbone of event-driven architecture and the source of subtlest bugs.",
    minutes: 26,
    skills: ["messaging", "distributed"],
    concepts: ["kafka", "event-driven", "exactly-once", "consumer-lag", "backpressure", "outbox"],
    blocks: [
      {
        t: "p",
        md: "A message queue says: deliver this work once and forget it. An **event log** says: record everything that happened, forever, in order, and let any number of consumers replay it independently. Kafka is the second thing, and that reframing — from commands to facts — is what makes event-driven architecture powerful.",
      },
      { t: "h", text: "The mental model" },
      {
        t: "diagram",
        height: 250,
        caption:
          "Producers append to partitioned logs. Consumer groups split partitions among members; each group keeps its own offset cursor.",
        graph: {
          nodes: [
            { id: "p1", label: "Order Service", sub: "producer", kind: "app", x: 20, y: 95 },
            { id: "t", label: "Topic: orders", sub: "3 partitions · ordered per-partition", kind: "queue", x: 270, y: 95 },
            { id: "c1", label: "Billing group", sub: "consumer 1 ← P0,P1", kind: "app", x: 560, y: 30 },
            { id: "c2", label: "", sub: "consumer 2 ← P2", kind: "app", x: 560, y: 160 },
            { id: "n", label: "Notifications group", sub: "independent cursor", kind: "app", x: 800, y: 95 },
          ],
          edges: [
            { from: "p1", to: "t", label: "key=user_id" },
            { from: "t", to: "c1" },
            { from: "t", to: "c2" },
            { from: "t", to: "n", label: "replays same log" },
          ],
        },
      },
      {
        t: "list",
        items: [
          "**Topic** — a named log. **Partition** — its parallel unit: append-only, ordered, replicated.",
          "**Ordering guarantee:** only within a partition. Route by key (`user_id`) so one user's events stay ordered.",
          "**Consumer group** — workers share partitions (each partition → exactly one member). Scale consumers up to partition count; beyond that they idle.",
          "**Offsets** — consumers commit their position. Replay from anywhere: reprocess yesterday, rebuild a downstream store, audit history.",
        ],
      },
      { t: "h", text: "Delivery semantics: the honest table" },
      {
        t: "table",
        head: ["Semantics", "How", "Reality"],
        rows: [
          ["At-most-once", "Commit offset before processing", "Crash loses messages — fine for metrics"],
          ["At-least-once", "Process, then commit", "Default setup; duplicates WILL happen → make handlers idempotent"],
          ["Exactly-once", "Idempotent producer + transactions / consume-transform-produce", "Within Kafka pipelines only; end-to-end still needs idempotent sinks"],
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "'Exactly-once' is a marketing term",
        md: "Kafka transactions make produce+commit atomic inside Kafka. But the moment a consumer writes to Postgres and dies before committing its offset, you have processed twice. The industry truth: **systems are effectively-once because side effects are idempotent**, not because a checkbox exists. Design every consumer to survive duplicate delivery — dedupe keys, upserts, conditional writes.",
      },
      { t: "h", text: "The patterns that matter" },
      {
        t: "code",
        lang: "python",
        title: "Transactional outbox: writing to DB and Kafka atomically",
        code: `# Problem: INSERT order in Postgres + publish event to Kafka
# cannot be one atomic operation. Crash between them = ghost.

# Solution: same-DB transaction writes both.
with db.transaction():
    db.execute("INSERT INTO orders ...")
    db.execute(
        "INSERT INTO outbox (topic, key, payload) VALUES (%s,%s,%s)",
        "orders.events", order.user_id, json.dumps(event),
    )

# A separate relay (Debezium CDC or poller) publishes outbox rows
# to Kafka and marks them sent. At-least-once + idempotent consumers
# = the exactly-once illusion, done honestly.`,
      },
      {
        t: "list",
        items: [
          "**Dead letter queue** — poison messages go to `orders.DLQ` after N retries instead of blocking the partition forever. Alert on DLQ depth.",
          "**Backpressure via lag** — consumer lag IS your queue depth metric. Alert on sustained growth; autoscale consumers up to partition count.",
          "**Compacted topics** — log compaction keeps latest value per key: perfect for changefeed/state topics.",
          "**Schema registry** — protobuf/Avro schemas with compatibility rules stop one producer deploy from silently breaking forty consumers.",
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the rebalance storm",
        md: "Consumers process slowly (200ms/message). Kubernetes liveness probe times out during a long GC pause; the pod restarts mid-batch; its partitions rebalance to peers; peers were already behind, now more so; another probe times out. The group spends 40 minutes churning instead of consuming, lag hits 12M messages. **Fixes:** decouple liveness from processing (background heartbeat), tune `max.poll.interval_ms` above worst-case batch, cap batch sizes, and add partition headroom (partitions ≥ 2× max consumers).",
      },
    ],
    quiz: [
      {
        id: "kf-q1",
        q: "You need strict per-user ordering of events. How do you produce?",
        options: [
          "Round-robin across partitions for even load",
          "Key messages by user_id so they land on one partition",
          "Use one partition only",
          "Order doesn't matter in Kafka",
        ],
        correct: [1],
        explain:
          "Ordering exists only within a partition. Keying by user_id pins a user's events to one partition, preserving their relative order while other users parallelize elsewhere.",
      },
      {
        id: "kf-q2",
        q: "Consumer processes a message, crashes before committing offset. On restart it reprocesses the same message. What semantic is this, and what must you do?",
        options: [
          "Exactly-once; nothing needed",
          "At-least-once; handler must be idempotent",
          "At-most-once; increase poll interval",
          "Broken configuration",
        ],
        correct: [1],
        explain:
          "Process-then-commit gives at-least-once: no loss, possible duplicates. Idempotency (dedupe keys, upserts, conditional writes) converts duplicates into harmless replays.",
      },
      {
        id: "kf-q3",
        q: "Topic has 6 partitions; the consumer group scales to 12 pods. What happens?",
        options: [
          "All 12 consume concurrently",
          "6 pods consume; 6 sit idle",
          "Kafka auto-adds partitions",
          "Consumers alternate batches",
        ],
        correct: [1],
        explain:
          "Each partition assigns to exactly one group member. Extra consumers idle — plan partition count above maximum expected parallelism (over-partition early; shrinking is painful).",
      },
      {
        id: "kf-q4",
        q: "Service writes to Postgres then publishes to Kafka; process dies between the two. Which pattern fixes the inconsistency?",
        options: [
          "Two-phase commit across Postgres and Kafka",
          "Transactional outbox: event written in the same DB transaction, relayed async",
          "Retry the Kafka publish forever",
          "Write to Redis first",
        ],
        correct: [1],
        explain:
          "The outbox makes the DB the atomic point: order row + event row commit together, then a relay publishes. Combined with idempotent consumers this yields the effective exactly-once behavior.",
      },
    ],
    exercise: {
      prompt:
        "Run Kafka locally (Redpanda works too). Create a 6-partition topic keyed by user_id; verify per-user ordering with two producers. Then kill a consumer mid-batch and observe duplicate delivery — implement deduplication with a processed-messages table and prove it holds.",
      hints: [
        "kafka-console-producer supports --property parse.key=true --property key.separator=,",
        "Track consumer lag with kafka-consumer-groups --describe.",
        "Dedupe table: PRIMARY KEY (topic, partition, offset) — cheap and exact.",
      ],
    },
  },
];
