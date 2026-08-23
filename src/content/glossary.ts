import type { GlossaryTerm } from "@/lib/types";

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "cap-theorem",
    term: "CAP Theorem",
    category: "Distributed Systems",
    simple: "When the network splits, you must pick: stay consistent or stay available.",
    technical:
      "In the presence of a network partition (P), a distributed system cannot simultaneously provide linearizable consistency (C) and full availability (A). Partitions are rare, so PACELC extends this: Else, latency and consistency trade off.",
    example:
      "During a datacenter link failure, a bank rejects writes on the minority side (choosing C); a shopping cart accepts both sides' updates and merges later (choosing A).",
    related: ["pacelc", "eventual-consistency", "linearizability", "split-brain"],
  },
  {
    id: "quorum",
    term: "Quorum",
    category: "Distributed Systems",
    simple: "Require a majority of nodes to agree before accepting a read or write.",
    technical:
      "With N replicas, write W and read R such that W + R > N guarantees read-write overlap. Consensus protocols require a strict majority (>N/2) to elect leaders and commit entries.",
    example:
      "Dynamo-style store with N=3, W=2, R=2: reads see at least one replica holding the latest write. Raft with 5 nodes commits only with 3 acknowledgments.",
    related: ["consensus", "raft", "cap-theorem"],
  },
  {
    id: "idempotency",
    term: "Idempotency",
    category: "API Design",
    simple: "Doing it twice has the same effect as doing it once.",
    technical:
      "An operation f is idempotent if f(f(x)) = f(x). In APIs, clients pass an idempotency key so servers can recognize retries and replay the original response instead of re-executing side effects.",
    example:
      "Payment POST retried after a timeout must not double-charge: the server stores key `pay_9f3` → response, returning the stored result on duplicate.",
    related: ["exactly-once", "outbox", "saga"],
  },
  {
    id: "fanout",
    term: "Fan-out",
    category: "Architecture Patterns",
    simple: "One event delivered to many recipients.",
    technical:
      "Fan-out-on-write materializes per-recipient views at publish time (fast reads, expensive writes); fan-out-on-read assembles feeds at request time (cheap writes, expensive reads). Hybrid approaches threshold by follower count.",
    example:
      "Twitter pushes celebrity tweets to millions of timelines (write fan-out) but falls back to pull for mega-celebrities — the classic hybrid feed.",
    related: ["hot-key", "eventual-consistency"],
  },
  {
    id: "backpressure",
    term: "Backpressure",
    category: "Reliability",
    simple: "Downstream tells upstream 'slow down' before it drowns.",
    technical:
      "Mechanisms that propagate capacity limits upstream: bounded queues that block or reject, consumer lag signals, load shedding, and admission control — preventing unbounded buffering collapse.",
    example:
      "A Kafka consumer processing slower than producers publish shows rising lag; autoscaling consumers or rate-limiting producers applies backpressure before memory exhausts.",
    related: ["consumer-lag", "load-shedding", "circuit-breaker"],
  },
  {
    id: "circuit-breaker",
    term: "Circuit Breaker",
    category: "Reliability",
    simple: "Stop calling a failing dependency; fail fast and probe recovery.",
    technical:
      "Wraps calls with state machine closed→open→half-open. Consecutive failures trip the circuit; during open, calls fail immediately without network cost; half-open admits trial requests to test recovery.",
    example:
      "After 5 consecutive recommendation-service timeouts, checkout serves 'popular items' fallback for 10s instead of queueing 30s-timeout victims.",
    related: ["bulkhead", "retry-backoff", "graceful-degradation"],
  },
  {
    id: "saga",
    term: "Saga",
    category: "Architecture Patterns",
    simple: "Multi-service transaction via sequenced local transactions plus compensations.",
    technical:
      "A sequence of local ACID transactions where each step's failure triggers compensating transactions for completed prior steps. Coordinated by choreography (events) or orchestration (central state machine).",
    example:
      "Order flow: charge card → reserve stock → ship. If shipping fails, compensations refund the charge and release stock — no cross-service locks held.",
    related: ["outbox", "idempotency", "event-driven"],
  },
  {
    id: "outbox",
    term: "Transactional Outbox",
    category: "Architecture Patterns",
    simple: "Write the event into your database in the same transaction; relay publishes it.",
    technical:
      "Solves dual-write inconsistency: domain change + outbox row commit atomically in the service DB; a separate relay (poller or CDC like Debezium) publishes rows to the broker and marks them sent. At-least-once delivery requires idempotent consumers.",
    example:
      "OrderService INSERTs order + outbox event in one transaction; Debezium tails the WAL into Kafka. A crash between business write and publish becomes impossible.",
    related: ["kafka", "idempotency", "inbox"],
  },
  {
    id: "replication",
    term: "Replication",
    category: "Data Systems",
    simple: "Keep copies of data on multiple machines for scale and survival.",
    technical:
      "Leader-based (single writer ships log/changes to followers), multi-leader (conflict resolution required), or leaderless (quorum reads/writes). Synchronous replication acks after follower receipt; asynchronous risks tail loss on failover.",
    example:
      "Postgres streaming replication ships WAL to replicas serving read traffic; promotion on primary loss can lose the last async-committed transactions.",
    related: ["sharding", "read-replica", "split-brain"],
  },
  {
    id: "sharding",
    term: "Sharding",
    category: "Data Systems",
    simple: "Split data across machines by key so writes scale horizontally.",
    technical:
      "Horizontal partitioning across nodes using hash or range of a shard key. Effective sharding makes common queries single-shard; cross-shard queries/joins/transactions carry heavy complexity, and resharding is operationally expensive.",
    example:
      "Users sharded by user_id hash: each shard owns a subset; profile lookups hit one shard. Choosing created_at instead would scatter every user across all shards.",
    related: ["partitioning", "hot-key", "replication"],
  },
  {
    id: "partitioning",
    term: "Partitioning",
    category: "Data Systems",
    simple: "Split one big table into pieces on the same database.",
    technical:
      "Range/list/hash partitioning within a single instance: prunes scans, bounds index size, enables cheap retention drops. Unlike sharding, no machine-level distribution — doesn't add CPU/RAM/network capacity.",
    example:
      "Events partitioned monthly: dashboards query one partition; last month's partition DETACHes in milliseconds for archival.",
    related: ["sharding", "index"],
  },
  {
    id: "eventual-consistency",
    term: "Eventual Consistency",
    category: "Distributed Systems",
    simple: "Replicas may disagree briefly; if writes stop, they converge.",
    technical:
      "Consistency model guaranteeing that absent new updates, all replicas eventually reflect the latest values. Requires conflict resolution (LWW, CRDTs, application merge) and UI patterns for visible staleness.",
    example:
      "Like counts differ across regions for seconds after a burst; DNS changes propagate over TTL windows; Cassandra replicas anti-entropy repair toward convergence.",
    related: ["cap-theorem", "read-your-writes", "vector-clock"],
  },
  {
    id: "linearizability",
    term: "Linearizability",
    category: "Distributed Systems",
    simple: "The system behaves as if one machine executed everything instantly in real time.",
    technical:
      "Each operation appears atomic at some point between its invocation and response, respecting real-time ordering. Strongest single-object model; costs latency (quorum round trips) and availability under partitions.",
    example:
      "A distributed lock service must be linearizable or two holders exist. etcd/ZooKeeper provide it via consensus; caches deliberately do not.",
    related: ["consensus", "cap-theorem", "sequential-consistency"],
  },
  {
    id: "leader-election",
    term: "Leader Election",
    category: "Distributed Systems",
    simple: "Nodes agree on one coordinator; when it dies, pick a new one safely.",
    technical:
      "Bully, ring, or consensus-based election. Correctness demands safety (at most one leader per term) even under partitions — naive heartbeat elections cause split-brain, hence Raft's randomized timeouts and majority voting.",
    example:
      "Kafka KRaft controllers elect an active controller via Raft; a partitioned candidate lacking majority cannot win, preventing two controllers.",
    related: ["raft", "consensus", "split-brain"],
  },
  {
    id: "consensus",
    term: "Consensus",
    category: "Distributed Systems",
    simple: "Getting multiple nodes to agree on one value despite failures.",
    technical:
      "Agreement problem requiring termination, validity, and agreement despite crash faults (Paxos, Raft solvable) or Byzantine faults (PBFT needed). Underpins replicated state machines, locks, and configuration stores.",
    example:
      "etcd replicates every Kubernetes API write through Raft consensus: a majority storing the entry means any surviving majority preserved it.",
    related: ["raft", "quorum", "leader-election"],
  },
  {
    id: "raft",
    term: "Raft",
    category: "Distributed Systems",
    simple: "Understandable consensus: elect a leader, replicate its log, commit on majority.",
    technical:
      "Decomposes consensus into leader election (randomized timeouts, majority vote, up-to-date-log check), log replication (AppendEntries), and safety (committed entries survive leadership change via log matching).",
    example:
      "3-node etcd loses its leader; followers time out in ~300–600ms, increment terms, one wins with 2 votes, cluster continues — clients retry against the new leader.",
    related: ["consensus", "leader-election", "quorum"],
  },
  {
    id: "split-brain",
    term: "Split Brain",
    category: "Failure Modes",
    simple: "Two nodes both believe they're the leader and accept writes.",
    technical:
      "Occurs when failure detection errs and multiple primaries serve concurrently, diverging data. Prevented by quorum gating (fencing), lease-based leadership with monotonic epochs, or STONITH mechanisms.",
    example:
      "A slow primary GC-pauses past its lease; standby promotes; old primary wakes and writes. Fencing tokens (epoch numbers checked by storage) reject its stale writes.",
    related: ["leader-election", "fencing", "network-partition"],
  },
  {
    id: "mvcc",
    term: "MVCC",
    category: "Data Systems",
    simple: "Readers never block writers: keep old row versions until nobody needs them.",
    technical:
      "Multi-Version Concurrency Control stores row versions tagged with creating/expiring transaction IDs; snapshots determine visibility. Enables non-blocking reads and repeatable-read isolation; requires vacuum/compaction to reclaim dead versions.",
    example:
      "Postgres serves a 4-minute analytics query from old versions while OLTP writes continue; long queries pin the horizon, bloating tables until VACUUM catches up.",
    related: ["isolation-levels", "vacuum", "transactions"],
  },
  {
    id: "cache-stampede",
    term: "Cache Stampede",
    category: "Caching",
    simple: "Hot key expires; thousands of requests hit the database simultaneously.",
    technical:
      "Concurrent misses on one expired key trigger parallel recomputation. Mitigations: single-flight/coalescing, distributed locks around rebuild, probabilistic early expiration (XFetch), stale-while-revalidate.",
    example:
      "Homepage product list TTL lapses during a sale; 8K req/s hit Postgres at once vs the 1 query/s it expects — connection pool exhaustion follows.",
    related: ["cache-avalanche", "ttl", "single-flight"],
  },
  {
    id: "hot-key",
    term: "Hot Key",
    category: "Caching",
    simple: "One key gets disproportionate traffic, saturating its shard while others idle.",
    technical:
      "Skewed access concentrates load on a single partition/node regardless of cluster size. Mitigations: key replication across shards with client-side selection, in-process micro-caching, splitting counters into buckets, or salting keys.",
    example:
      "Celebrity post ID receives 500K likes/s; its Redis shard maxes CPU at 100% while 11 siblings idle — the Instagram Like Storm scenario.",
    related: ["fanout", "sharding", "async-counters"],
  },
  {
    id: "consumer-lag",
    term: "Consumer Lag",
    category: "Messaging",
    simple: "How many messages are waiting that consumers haven't processed yet.",
    technical:
      "Offset difference between log-end-offset and committed-offset per partition. Sustained growth indicates under-provisioned consumers or poison messages; it is the primary backpressure and health signal for streaming pipelines.",
    example:
      "Alert fires at lag > 100K for 5 min; scaling consumers from 6→12 pods (≤ partition count) drains the backlog before SLA breach.",
    related: ["kafka", "backpressure", "dead-letter-queue"],
  },
  {
    id: "exactly-once",
    term: "Exactly-Once Semantics",
    category: "Messaging",
    simple: "Every effect happens once — achieved honestly via dedup, not magic.",
    technical:
      "End-to-end exactly-once is impossible without idempotent effects; systems approximate it: Kafka transactions give atomic produce+commit within Kafka; effective-once combines at-least-once delivery with idempotent sinks (dedupe tables, upserts, conditional writes).",
    example:
      "Consumer writes payment + processed-message row in one DB transaction; redelivered message finds its ID present and skips — duplicates become harmless.",
    related: ["idempotency", "outbox", "kafka"],
  },
  {
    id: "connection-pool",
    term: "Connection Pooling",
    category: "Data Systems",
    simple: "Reuse a small set of database connections instead of opening thousands.",
    technical:
      "Client-side pools amortize connection setup; server-side poolers (PgBouncer transaction mode) multiplex many client connections onto few server connections. Transaction-mode pooling forbids session state (SET, advisory locks, prepared statements spanning transactions).",
    example:
      "200 pods × 20 connections = 4000 demanded; Postgres handles ~200 well. PgBouncer maps 4000 client conns onto 40 server conns transparently.",
    related: ["postgres", "saturation"],
  },
  {
    id: "rate-limiting",
    term: "Rate Limiting",
    category: "Security",
    simple: "Cap how many requests a caller can make in a time window.",
    technical:
      "Algorithms: fixed/sliding window counters, token bucket (burst-tolerant), leaky bucket (smoothed). Distributed implementations need atomic shared state (Redis Lua INCR+EXPIRE); edge limits handle volumetric abuse, gateway limits enforce quotas.",
    example:
      "API returns 429 with Retry-After when a client exceeds 1000 req/min; token bucket allows bursts of 50 above the sustained 100/min rate.",
    related: ["token-bucket", "backpressure", "ddos"],
  },
  {
    id: "cdn",
    term: "CDN",
    category: "Networking",
    simple: "Servers worldwide caching content close to users.",
    technical:
      "Geographically distributed reverse proxies serving cached responses from points of presence; origin shield hierarchies reduce origin fetches. Handles static assets, video segments, and increasingly dynamic content via edge compute.",
    example:
      "A viral image served from Tokyo POP at 15ms instead of Virginia origin at 180ms — while absorbing 95% of request volume entirely.",
    related: ["reverse-proxy", "cache-hit", "latency"],
  },
  {
    id: "reverse-proxy",
    term: "Reverse Proxy",
    category: "Networking",
    simple: "A front door that forwards client requests to backend servers.",
    technical:
      "Terminates TLS, routes by host/path, compresses, buffers, retries, rate-limits, and adds observability. L7 proxies (Nginx, Envoy) understand HTTP; often paired behind L4 balancers for raw throughput.",
    example:
      "Nginx fronts three app instances: TLS ends there, /api/* routes to v2, static files serve directly, slow clients buffered away from app workers.",
    related: ["load-balancer", "cdn", "api-gateway"],
  },
  {
    id: "api-gateway",
    term: "API Gateway",
    category: "Networking",
    simple: "Single managed entry point handling cross-cutting API concerns.",
    technical:
      "Centralizes authentication, rate limiting/quota, request transformation, protocol translation, canary routing, and analytics. Differs from plain proxy by policy enforcement depth and per-consumer accounting.",
    example:
      "Kong/Envoy validates OAuth tokens, enforces per-API-key quotas, strips internal headers, then routes /payments/* to the payments service mesh.",
    related: ["reverse-proxy", "rate-limiting", "authentication"],
  },
  {
    id: "correlation-id",
    term: "Correlation ID",
    category: "Observability",
    simple: "One ID following a request through every service and log line.",
    technical:
      "Generated at the edge (or derived from trace_id), propagated via headers (traceparent/W3C), included in all logs/metrics/spans. Enables reconstructing one logical request across dozens of processes.",
    example:
      "Support gives you order ID; grep logs for its correlation ID and watch the full journey: gateway auth 12ms → orders svc → payment timeout at broker X.",
    related: ["distributed-tracing", "observability"],
  },
  {
    id: "distributed-tracing",
    term: "Distributed Tracing",
    category: "Observability",
    simple: "Timing breakdown of one request across every service it touched.",
    technical:
      "Spans (named, timed operations with attributes) form trees rooted at the entry request, sharing trace_id. OpenTelemetry standardizes instrumentation; sampling controls cost; exemplars link metrics to traces.",
    example:
      "Checkout p99 jumped 800ms: traces show the new fraud-check span consuming 750ms — pinpointed in minutes rather than bisecting deploys.",
    related: ["correlation-id", "span", "opentelemetry"],
  },
  {
    id: "red-metrics",
    term: "RED Method",
    category: "Observability",
    simple: "For each endpoint measure Rate, Errors, Duration.",
    technical:
      "Request-driven golden signals: request rate per endpoint/status, error rate fraction, duration histograms (p50/p95/p99). USE method complements it for resources: Utilization, Saturation, Errors.",
    example:
      "Grafana row per endpoint: RPS graph, error-ratio graph, latency heatmap — the first dashboard built for any new service.",
    related: ["observability", "slo", "percentiles"],
  },
  {
    id: "slo",
    term: "SLO / Error Budget",
    category: "Observability",
    simple: "Promised reliability level; the allowed unreliability is your budget.",
    technical:
      "Service Level Objective: target on SLIs (e.g., 99.9% of requests < 300ms over 28 days). Error budget = 1 − target; burn-rate alerts page when budget consumes too fast, balancing reliability vs velocity decisions.",
    example:
      "99.9% availability = 43min/month budget. Two regional blips consume 60% — feature deploys pause while reliability work burns down risk.",
    related: ["red-metrics", "observability"],
  },
  {
    id: "canary",
    term: "Canary Deployment",
    category: "Delivery",
    simple: "Send a small slice of traffic to the new version; expand only if healthy.",
    technical:
      "Progressive rollout with automated analysis comparing canary vs baseline on error rate/latency/saturation; abort on regression. Reduces blast radius from fleet-wide to percentage-wide.",
    example:
      "5% traffic for 15 minutes: error delta +0.4% triggers automatic rollback before the other 95% ever sees the bug.",
    related: ["blue-green", "rollback", "github-actions"],
  },
  {
    id: "blue-green",
    term: "Blue-Green Deployment",
    category: "Delivery",
    simple: "Run two full environments; switch traffic between them instantly.",
    technical:
      "Identical stacks (blue=current, green=new); deploy and verify green out-of-band, then flip the router. Instant rollback = flip back. Costs double resources during transition and requires careful connection draining.",
    example:
      "Financial platform flips LB weight blue→green in seconds for zero-downtime major version upgrades, keeping blue warm for 24h as instant rollback.",
    related: ["canary", "rollback"],
  },
  {
    id: "hpa",
    term: "Horizontal Pod Autoscaler",
    category: "Infrastructure",
    simple: "Kubernetes adding/removing pod replicas based on metrics.",
    technical:
      "Control loop comparing current metric utilization (CPU/memory custom/external) against targets on resource requests. Requires requests set and metrics-server; combine with PodDisruptionBudgets and graceful termination for safe scale-in.",
    example:
      "HPA target 70% CPU: morning ramp scales api 3→14 pods over minutes; evening scale-in respects terminationGracePeriod draining connections.",
    related: ["kubernetes", "autoscaling"],
  },
  {
    id: "statefulset",
    term: "StatefulSet",
    category: "Infrastructure",
    simple: "Pods with stable names and storage that survive rescheduling.",
    technical:
      "Ordered, unique identity workload (pod-0..n) with per-pod PersistentVolumeClaims surviving restarts. Provides stable network identity and ordered deployment/scaling — necessary but not sufficient for running databases well.",
    example:
      "Kafka brokers run as StatefulSet: broker-2 keeps its PVC (data) and DNS (broker-2.kafka.svc) across node failures, letting peers reconnect deterministically.",
    related: ["kubernetes", "persistent-volume"],
  },
  {
    id: "jwt",
    term: "JWT",
    category: "Security",
    simple: "Signed JSON token carrying claims — verify without a lookup.",
    technical:
      "JWS-signed claims (header.payload.signature) enabling stateless authn; validation checks signature, exp, iss, aud. Tradeoffs: revocation difficulty (needs denylists/short TTL), size overhead, and algorithm confusion pitfalls if libraries misconfigured.",
    example:
      "Gateway validates RS256 JWT against JWKS, injects X-User-ID header downstream; services need no session store — logout handled via 15-min expiry + refresh rotation.",
    related: ["oauth", "session", "authentication"],
  },
  {
    id: "oauth",
    term: "OAuth 2.0 / OIDC",
    category: "Security",
    simple: "Delegated authorization: let apps act on your behalf without your password.",
    technical:
      "Authorization framework with grant flows (authorization code + PKCE for public clients); OIDC layers identity (ID tokens) atop. Separates resource owner, client, authorization server, resource server with scoped, revocable access tokens.",
    example:
      "'Sign in with Google': app receives scoped access token + OIDC ID token; it never sees your Google password and access revokes centrally.",
    related: ["jwt", "authentication", "authorization"],
  },
  {
    id: "rbac",
    term: "RBAC",
    category: "Security",
    simple: "Permissions attach to roles; users get roles.",
    technical:
      "Role-Based Access Control maps subjects→roles→permissions, enabling least privilege at scale versus per-user ACLs. Kubernetes RBAC binds subjects to roles/clusterroles via rolebindings scoped by namespace.",
    example:
      "CI service account gets deployments/apps patch rights in prod namespace only — nothing else — limiting blast radius of leaked CI credentials.",
    related: ["authorization", "least-privilege", "kubernetes"],
  },
];
