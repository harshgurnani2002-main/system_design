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
/*  LINKEDIN                                                           */
/* ================================================================== */

const linkedin: CaseStudy = {
  slug: "linkedin",
  name: "LinkedIn",
  tagline: "Connection graphs, feed ranking under privacy constraints, and people-search at recruiting scale.",
  category: "Professional Network",
  difficulty: "Standard",
  minutes: 26,

  problem: [
    "LinkedIn looks like another social feed until you price the graph. The median member holds ~500 connections, so the naive 2nd-degree set is 500 × 500 = 250K candidates — and a 30K-connection open networker explodes past 10 million before a single card renders. Every product surface (feed, People You May Know, recruiter search) is a graph query wearing a UI, and unbounded traversal is the default way such systems die.",
    "The second constraint is privacy. Posts and profiles carry visibility tiers — anyone, connections-only, private — and those tiers are query parameters, not rendering hints. A recruiter faceted search over engineering managers in Berlin must be computed exclusively over profiles the searcher may see. Architecture follows: enforce at the index and hydration layers, because app-layer filtering leaks through counts, timing, and cached aggregates.",
  ],

  requirements: {
    functional: [
      "Connect with members; 1st/2nd/3rd-degree labels displayed everywhere",
      "Home feed mixing connection activity with recommendations, ranked",
      "People You May Know suggestions refreshed regularly",
      "People search with filters and facets for recruiters (title, company, location)",
      "Posts carry visibility tiers: anyone / connections-only",
      "Skill endorsements with visible counts",
    ],
    nonFunctional: [
      "1B+ registered members; feed open < 250ms p95",
      "Interactive graph queries bounded to 2nd degree; deeper work is batch-only",
      "Privacy leakage across tiers is a severity-1 incident — zero tolerance",
      "Suggestion freshness of ~24h acceptable; counters may lag seconds",
      "Feed stays available via chronological fallback if ranking degrades",
    ],
  },

  capacity: [
    { label: "Registered members", value: "1B+", note: "hundreds of millions active" },
    { label: "Median connections", value: "~500", note: "long tail to 30K+ open networkers" },
    { label: "Typical 2nd-degree set", value: "~250K", note: "500 × 500 minus overlap" },
    { label: "Hub-member 2nd-degree set", value: "10M+", note: "why unbounded BFS is banned interactively" },
    { label: "Feed refreshes/day", value: "~4B", note: "~46K avg QPS, 200K+ evening peaks" },
    { label: "Recruiter search QPS", value: "~30K peak", note: "Tuesday–Thursday business-hours waves" },
    { label: "PYMK batch window", value: "~4h nightly", note: "rescores hundreds of millions of suggestion lists" },
  ],

  api: [
    { method: "GET", path: "/v2/feed?cursor=", desc: "Ranked, privacy-filtered timeline page; ids from cache, hydrated top-N" },
    { method: "GET", path: "/v2/graph/distance?to={id}", desc: "Degree path between members; capped at 2nd degree interactively" },
    { method: "GET", path: "/v2/people/search?q=&facets=", desc: "Faceted recruiter search over visibility-partitioned indexes" },
    { method: "GET", path: "/v2/pymk", desc: "Suggestions read from nightly-materialized Redis sets" },
    { method: "POST", path: "/v2/network/invitations", desc: "Connect request; writes degree-tagged edges, emits graph event" },
    { method: "POST", path: "/v2/reactions/{postId}", desc: "Idempotent reaction; enqueued to activity pipeline" },
  ],

  dataModel: [
    { name: "members", fields: "id, name, headline, privacy_tier, created_at", note: "PostgreSQL; profile cached in Redis" },
    { name: "connections", fields: "member_a, member_b, degree_label, since", note: "Cassandra sharded by member; degree written once at connect time, never re-derived" },
    { name: "posts", fields: "post_id, author_id, body, visibility(anyone|connections), created_at", note: "visibility drives hydration predicates" },
    { name: "timeline_ids", fields: "member_id → ZSET(post_id, epoch_ms)", note: "Redis; bounded recent window per member" },
    { name: "pymk", fields: "member_id → SET(candidate_id, reason)", note: "rebuilt nightly by feature pipeline; O(1) serve" },
    { name: "endorsement_counts", fields: "(member_id, skill) → approx_count", note: "denormalized, async-aggregated; UI shows '500+'" },
  ],

  architecture: {
    nodes: [
      n("members", "Members", "client", 20, 260),
      n("gw", "API Gateway", "app", 245, 260, "auth · quotas"),
      n("feed", "Feed Service", "app", 470, 100, "ranker"),
      n("graph", "Graph Service", "app", 470, 300, "1st·2nd·3rd° edges"),
      n("psearch", "People Search", "app", 470, 460, "recruiter facets"),
      n("rtc", "Redis", "cache", 695, 100, "timeline ids"),
      n("kafka", "Kafka", "queue", 695, 340, "activity.events"),
      n("idx", "Search Index", "data", 920, 100, "inverted profiles"),
      n("rgc", "Redis", "cache", 920, 260, "degree lists · PYMK"),
      n("feat", "Feature Worker", "app", 920, 420, "PYMK nightly batch"),
      n("store", "Cassandra / PG", "data", 1145, 260, "edges · posts · profiles"),
      n("mon", "Monitoring", "infra", 1370, 260),
    ],
    edges: [
      { from: "members", to: "gw", label: "HTTPS", flow: true },
      { from: "gw", to: "feed", protocol: "gRPC", label: "GET /feed", flow: true },
      { from: "gw", to: "graph", protocol: "gRPC", label: "distance query" },
      { from: "gw", to: "psearch", label: "people search" },
      { from: "feed", to: "rtc", label: "candidate ids", flow: true },
      { from: "feed", to: "graph", dashed: true, label: "degree features" },
      { from: "feed", to: "store", dashed: true, label: "privacy-filtered hydrate" },
      { from: "feed", to: "kafka", label: "like · comment events", flow: true },
      { from: "graph", to: "rgc", label: "cached degree lists" },
      { from: "graph", to: "store", label: "edge shards" },
      { from: "psearch", to: "idx", label: "faceted query" },
      { from: "kafka", to: "feat", flow: true },
      { from: "feat", to: "rgc", label: "rebuild PYMK", flow: true },
      { from: "store", to: "mon", dashed: true },
    ],
    flows: [
      { id: "li-feed", path: ["members", "gw", "feed", "rtc"], color: "#2563EB", speed: 300, label: "feed read" },
      { id: "li-graph", path: ["members", "gw", "graph", "store"], color: "#16A34A", speed: 260, label: "degree lookup" },
    ],
  },

  archNotes: [
    "Degrees are LABELS written onto edges when the connection forms — traversals never re-derive them. A 2nd-degree query is a set operation over pre-labeled adjacency lists, not a walk.",
    "Feed reads pull candidate post ids from a bounded Redis ZSET, let the ranker reorder, then hydrate only the top N under visibility predicates. Cost is O(page), never O(graph).",
    "Endorsement and connection counters are denormalized and eventually consistent; the UI truncates ('500+') because nobody litigates a counter that settles in seconds.",
    "People-search indexes are physically partitioned by visibility tier — recruiter queries cannot touch private profiles regardless of application bugs.",
    "Activity events (reactions, comments, impressions) fan out through Kafka so counter aggregation and ML features never sit on the interactive path.",
  ],

  requestFlow: [
    { title: "Open the app", detail: "Gateway validates the JWT locally, applies per-member quotas, routes to the Feed Service. No session store on this path.", edge: ["members", "gw"], tag: "~3ms" },
    { title: "Candidate ids from cache", detail: "Feed Service ZREVRANGEs the member's bounded timeline ZSET — recent post ids from connections and followed entities, already materialized by writers.", edge: ["feed", "rtc"], nodes: ["feed", "rtc"], tag: "~0.5ms" },
    { title: "Ranker scores candidates", detail: "Per candidate, the ranker pulls graph-distance features (1st vs 2nd degree to the author) plus engagement-probability features, then orders the page. Strictly deadline-budgeted: timeout falls back to cache order.", edge: ["feed", "graph"], nodes: ["graph"], tag: "distance × P(engage)" },
    { title: "Privacy-filtered hydration", detail: "Only the top N ids hydrate. Each fetch applies visibility predicates against the VIEWER's relationships — connections-only posts from non-connections are dropped here, making leaks structural impossibilities rather than code-review hopes.", edge: ["feed", "store"], tag: "top N only" },
    { title: "Engagement streams out", detail: "Reactions, comments, and impressions publish to activity.events. Counter aggregation and feature extraction are independent consumers — nothing on the read path waits for them.", edge: ["feed", "kafka"], nodes: ["kafka"], tag: "async" },
    { title: "PYMK rebuilt nightly", detail: "The feature pipeline joins recent activity with the connection graph, rescores suggestion sets, and swaps them into Redis atomically. Serving stays a single SET read; freshness is deliberately ~24h.", edge: ["feat", "rgc"], nodes: ["feat"], tag: "batch, not online" },
  ],

  deepDives: [
    {
      topic: "The arithmetic that forces degree bounds",
      body: "Graph exploration grows multiplicatively, and the numbers stop being funny fast. Median member: ~500 1st-degree → ~500 × 500 = 250K 2nd-degree candidates. A 30K-connection hub: ~30K × 500 = 15M at 2nd degree. Composing 3rd degree over those sets exceeds any interactive budget ever agreed to in a design review.",
      bullets: [
        "Interactive paths cap traversal at depth 2 with hard per-node fanout limits.",
        "Candidates come from INTERSECTING sorted adjacency lists, not expanding outward from one member.",
        "3rd-degree reasoning (extended-network counts, PYMK exploration) happens in the nightly batch where a 4-hour window costs nothing.",
        "Degree labels are written once at connect time; no online query discovers a degree by walking.",
      ],
    },
    {
      topic: "Privacy tiers are query parameters",
      body: "Three visibility classes — anyone, connections-only, private — shape every read. Design rule: enforce at the index layer and the hydration layer, never solely in application code after ranking.",
      bullets: [
        "Search indexes partitioned per tier mean recruiter facet aggregates physically cannot include invisible profiles.",
        "Hydration re-checks visibility against the viewer's relationship set, not merely the author's claim.",
        "App-layer-only filtering fails three ways: leaked counts inside facets, timing side channels, cached aggregates computed over invisible rows.",
        "Connections-only posts never enter caches shared across tier boundaries — cache keys carry the tier.",
      ],
    },
    {
      topic: "PYMK: why nightly batch beats online traversal",
      body: "Suggestions could be live 2nd-degree queries. For 1B members at tens of thousands of QPS, that multiplies into millions of graph expansions per second — economically absurd for a feature whose honest tolerance is a day.",
      bullets: [
        "Features: shared employers, schools, recency-weighted 2nd-degree overlap, invitation acceptance rates.",
        "Online serving is one Redis SET read per profile view — O(1), boring, correct.",
        "A fresh connection triggers TARGETED delta rescoring for affected members, not a global rebuild.",
        "Batch also enables experimentation: score models swap nightly without touching serving paths.",
      ],
    },
  ],

  failures: [
    {
      id: "hotkey-stampede",
      title: "Celebrity-profile cache stampede",
      fail: [],
      degrade: ["rtc"],
      story: "An influencer announces a job change. Their profile cache key expires mid-surge and thousands of concurrent requests miss simultaneously, hammering the profile store in a thundering herd.",
      reroute: ["gw", "feed", "store"],
      metrics: [
        { label: "Store read QPS", before: "4K", after: "210K", bad: true },
        { label: "Feed p95", before: "120ms", after: "1.4s", bad: true },
        { label: "Error rate", before: "0.01%", after: "0.4%", bad: true },
      ],
      lessons: [
        "Single-flight locking: one request rebuilds the cold key while everyone else subscribes to its result.",
        "Probabilistic early expiration refreshes hot keys BEFORE TTL expiry instead of after.",
        "Stale-while-revalidate: serve the previous value instantly, refresh in background — staleness beats a herd.",
        "TTL jitter (±10%) prevents synchronized expiry avalanches across popular keys.",
      ],
    },
    {
      id: "ranker-outage",
      title: "Ranking service outage — chronological fallback holds",
      fail: [],
      degrade: ["feed"],
      story: "The ranker fleet wedges on a bad model deployment. Feed requests exceed their ranking deadline, trip the circuit breaker, and serve reverse-chronological order from the same cached timeline ids. Engagement drops sharply; availability does not move.",
      reroute: ["members", "gw", "feed", "rtc"],
      metrics: [
        { label: "Engagement/session", before: "baseline", after: "-32%", bad: true },
        { label: "Availability", before: "99.97%", after: "99.97%", bad: false },
        { label: "Feed p95", before: "140ms", after: "60ms", bad: false },
      ],
      lessons: [
        "Ranking is an enhancement, not a dependency — deadline plus circuit breaker converts an outage into a quality dip.",
        "Chronological fallback reads the SAME cached timeline ids; there is no second system to keep warm.",
        "Isolation lesson: the expensive ML tier failing must never take the cheap deterministic tier down with it.",
        "Alert on ranker deadline-trip rate, not just ranker process health.",
      ],
    },
  ],

  scaling: [
    { stage: "10K members", action: "Single PostgreSQL; recursive CTEs answer degree questions", why: "Trivial at this scale; ship product." },
    { stage: "1M", action: "Graph service extracted; Redis read-through degree caches", why: "Graph QPS outgrew the primary database's headroom." },
    { stage: "50M", action: "Cassandra edge shards keyed by member; nightly PYMK replaces online suggestions", why: "Write scale and the economics of online traversal both demand it." },
    { stage: "200M", action: "Visibility-partitioned search tier; regional read replicas", why: "Recruiter search became its own workload with its own compliance surface." },
    { stage: "1B", action: "Batch feature pipelines dominate; interactive paths serve almost entirely from caches", why: "Every interactive millisecond is bought with precomputation." },
  ],

  tradeoffs: [
    {
      a: "Precomputed 2nd-degree lists",
      b: "On-demand BFS",
      aBlurb: "Maintain candidate sets ahead of time",
      bBlurb: "Walk the graph at query time",
      dims: [
        { name: "Read latency", a: "Set intersection, ~1ms", b: "Multi-hop walk, variable tens of ms", winner: "a" },
        { name: "Freshness", a: "Stale until next rebuild/delta", b: "Always current", winner: "b" },
        { name: "Storage cost", a: "O(edges × avg degree) of cached lists", b: "Just the raw graph", winner: "b" },
        { name: "Hub-connect storms", a: "Rebuild churn when hubs connect", b: "Immune — nothing precomputed to invalidate", winner: "b" },
      ],
      verdict: "Production runs both: precomputed lists serve PYMK and feed features where 24h staleness is free; bounded on-demand BFS answers the rare how-are-we-connected interaction.",
    },
    {
      a: "Chronological professional feed",
      b: "Ranked professional feed",
      aBlurb: "Recency order from cached ids",
      bBlurb: "Model-scored ordering",
      dims: [
        { name: "Predictability", a: "Members can trust the order", b: "Opaque; missing-post complaints", winner: "a" },
        { name: "Session engagement", a: "Baseline", b: "Materially higher; surfaces relevant posts recency buried", winner: "b" },
        { name: "Infrastructure cost", a: "Merge + hydrate", b: "Feature pipeline + ranker fleet + fallback wiring", winner: "a" },
        { name: "Failure behavior", a: "Already the fallback", b: "Requires disciplined deadlines + breakers", winner: "a" },
      ],
      verdict: "Ranked wins commercially at scale — but only because the chronological path stays warm underneath it, as the ranker-outage scenario proves.",
    },
  ],

  alternatives: [
    "Graph database (Neo4j-style) for the connection graph — elegant traversals, harsh write-scale economics at billions of edges; most deployments stay on sharded wide-column edges with degree labels.",
    "Stream-realtime PYMK (update suggestions per connection event) — fresher, but turns every celebrity connection into a distributed computation; batch wins on economics.",
    "Single document store for members, edges, and posts — operationally simple until edge-shard write volume forces polyglot persistence anyway.",
  ],

  interview: {
    prompt: "Design LinkedIn's core: the connection graph with degree queries, the ranked home feed under privacy tiers, and recruiter-scale people search — for 1B+ members.",
    stages: [
      { name: "Requirements", expect: "State the interactive degree cap (2nd), the ~24h PYMK freshness budget, and that cross-tier privacy leakage is severity-1." },
      { name: "Estimation", expect: "Derive the ~250K typical 2nd-degree set from median 500 connections, show hubs exploding past 10M, and justify degree bounds BEFORE drawing boxes." },
      { name: "Data model", expect: "Degree-labeled edges written at connect time; bounded per-member timeline ZSET; nightly-materialized suggestion sets; visibility tier as a column." },
      { name: "Architecture", expect: "Separate graph service from feed ranker; Kafka between actions and side effects; people-search index partitioned by visibility tier." },
      { name: "Deep dive", expect: "Walk the numeric explosion unprompted (500×500=250K; hubs → millions), then explain intersection-based candidates and batch for depth ≥3." },
      { name: "Failure & scale", expect: "Hot-key stampede → single-flight + stale-while-revalidate; ranker outage → deadline breaker to chronological with availability intact. Close on ML-tier isolation." },
    ],
  },

  production: [
    "Visibility-tier regressions get continuous synthetic probes: cross-tier checks run against staging hydration and facet endpoints on every deploy.",
    "Timeline ZSETs for dormant members are evicted and rebuilt lazily on return — terabytes reclaimed.",
    "Invitation spam is rate-limited per sender AND per graph position; open-networker accounts run under stricter budgets.",
    "Weekly reconciliation compares denormalized endorsement counts against source aggregates; alarms fire on drift percentage, not absolute deltas.",
  ],

  costs: [
    "The search tier is the largest fixed cost — sized for Tuesday–Thursday recruiter peaks and idle on weekends; spot capacity absorbs batch rescoring.",
    "Redis memory splits between timeline ids (latency-critical) and PYMK sets (batch-refreshed, compressible, TTL-evictable).",
    "Feature-pipeline compute scales with graph churn, not member count — monitor edges-written/day as the true cost driver.",
  ],
};

/* ================================================================== */
/*  SLACK                                                              */
/* ================================================================== */

const slack: CaseStudy = {
  slug: "slack",
  name: "Slack",
  tagline: "Workspace messaging — channels, WebSockets at team scale, presence, persistence and search.",
  category: "Collaboration",
  difficulty: "Standard",
  minutes: 24,

  problem: [
    "Chat architecture is connection management wearing a product. Tens of millions of persistent WebSockets, each expecting sub-300ms send-to-render, constant mobile-network flapping, and a hard rule that a message acknowledged as sent is never lost — even though the recipient's device may be in a tunnel for the next hour.",
    "The distinctive twist versus consumer chat is tenancy: a workspace is a natural shard containing all of a company's channels, members, and history. That buys beautiful blast-radius properties and creates one ugly problem — a single 500K-seat enterprise generates the load of a mid-sized country, and its #general fans every message out to 10K members at once.",
  ],

  requirements: {
    functional: [
      "Channel-based messaging within workspaces; threads; edits and deletes",
      "Persistent WebSocket delivery to online members; cursor-based sync for offline members",
      "Unread and mention badges, incremented reliably",
      "Presence indicators derived from heartbeats",
      "Per-workspace message search",
      "File attachments with previews",
      "Push notifications to offline devices, filtered by preferences, DND, and thread mutes",
    ],
    nonFunctional: [
      "10M+ concurrent sockets; p99 send → render < 300ms same-region",
      "Zero loss once the sender sees the checkmark — persist-before-ack",
      "Strict per-channel ordering; duplicates must never be displayable",
      "Presence is advisory: wrong presence wastes a push but must never lose a message",
      "Tenant isolation: one workspace's load or outage cannot degrade another's",
    ],
  },

  capacity: [
    { label: "Peak concurrent sockets", value: "10M+", note: "persistent WebSocket connections" },
    { label: "Messages/day", value: "5B+", note: "~58K/s average; Monday-morning spikes several-fold" },
    { label: "Send → render p99", value: "<300ms", note: "same-region, online recipient" },
    { label: "Presence heartbeats/s", value: "~330K", note: "10M sockets ÷ 30s heartbeat interval" },
    { label: "Largest tenants", value: "500K seats", note: "one workspace = one shard's worth of load — the hot-tenant problem" },
    { label: "File uploads/day", value: "~100M", note: "presigned PUTs; bytes never transit app servers" },
  ],

  api: [
    { method: "WS", path: "connect(workspace, auth)", desc: "Persistent socket; registers user → gateway in the routing registry" },
    { method: "MSG", path: "send(channel, client_msg_id, body)", desc: "Server assigns ts; (channel, client_msg_id) deduplicates retries for free" },
    { method: "MSG", path: "heartbeat()", desc: "30s cadence; TTL presence registry self-heals silent disconnects" },
    { method: "HTTP", path: "/sync?channel=&cursor=", desc: "Replay everything after last-seen ts — the offline catch-up contract" },
    { method: "GET", path: "/search?q=", desc: "Scoped strictly to the caller's workspace index" },
  ],

  dataModel: [
    { name: "workspaces", fields: "ws_id, shard_key, tier(shared|dedicated)", note: "tier routes jumbo tenants onto dedicated shards" },
    { name: "messages", fields: "channel_id, ts, sender, body, client_msg_id", note: "(channel_id, ts) UNIQUE — the ordering AND dedup contract" },
    { name: "unread", fields: "user_id, channel_id, count, last_read_ts", note: "incremented on-write from the event stream; reconciled nightly" },
    { name: "presence", fields: "user_id, gateway_id, expires_at", note: "TTL entries; absence means offline, never 'lost'" },
    { name: "routing", fields: "user_id → gateway_id (leased)", note: "epoch-stamped registry entries — the fan-out address book" },
  ],

  architecture: {
    nodes: [
      n("clients", "Clients", "client", 20, 280),
      n("wsgw", "WebSocket Gateway", "infra", 245, 280, "socket fleet"),
      n("reg", "Routing Registry", "cache", 470, 100, "user → gateway"),
      n("msgsvc", "Message Service", "app", 470, 280, "persist · ts idempotency"),
      n("presence", "Presence Service", "cache", 470, 440, "TTL heartbeats"),
      n("kafka", "Kafka", "queue", 695, 140, "channel.events"),
      n("pg", "PostgreSQL", "data", 695, 300, "workspace-sharded"),
      n("fanout", "Fan-out Workers", "app", 920, 100, "tiered broadcast"),
      n("unread", "Unread Counters", "app", 920, 280, "badges · mentions"),
      n("files", "Object Store", "data", 920, 440, "attachments"),
      n("searchidx", "Search Index", "data", 1145, 180, "per-workspace"),
      n("push", "Push Notifications", "app", 1145, 360, "APNs · FCM"),
      n("mon", "Monitoring", "infra", 1370, 280),
    ],
    edges: [
      { from: "clients", to: "wsgw", label: "WS connect · send", flow: true },
      { from: "wsgw", to: "reg", label: "register mapping" },
      { from: "wsgw", to: "msgsvc", label: "message frames", flow: true },
      { from: "wsgw", to: "presence", label: "heartbeat reports" },
      { from: "msgsvc", to: "pg", label: "INSERT (ts)" },
      { from: "msgsvc", to: "kafka", label: "channel.events", flow: true },
      { from: "msgsvc", to: "files", dashed: true, label: "presigned uploads" },
      { from: "kafka", to: "fanout", flow: true },
      { from: "fanout", to: "reg", label: "recipients → gateways" },
      { from: "fanout", to: "presence", dashed: true, label: "online?" },
      { from: "fanout", to: "wsgw", label: "push frames", flow: true },
      { from: "kafka", to: "unread", flow: true },
      { from: "unread", to: "pg", dashed: true, label: "counter deltas" },
      { from: "kafka", to: "searchidx", label: "index stream" },
      { from: "unread", to: "push", label: "mention triggers" },
      { from: "searchidx", to: "mon", dashed: true },
      { from: "push", to: "mon", dashed: true },
    ],
    flows: [
      { id: "sl-send", path: ["clients", "wsgw", "msgsvc", "kafka", "fanout"], color: "#2563EB", speed: 280, label: "send → broadcast" },
      { id: "sl-sync", path: ["clients", "wsgw", "msgsvc", "pg"], color: "#16A34A", speed: 320, label: "reconnect sync" },
    ],
  },

  archNotes: [
    "Order of operations is sacred: assign ts → persist → ack sender → publish event → fan out. Receivers therefore can never observe a message that failed to commit.",
    "Gateways are dumb pipes holding sockets and shuffling frames; ALL state (routing, presence, unread) lives behind stateless services, so gateways restart freely.",
    "Fan-out pays only for ONLINE members. Offline members cost nothing at send time and replay by cursor on reconnect — this caps a 10K-member channel's delivery bill at the number of people actually watching.",
    "Unread counters increment from the same channel.events stream that delivers messages, so badges can disagree with history by no more than consumer lag.",
    "Each workspace gets its own search index shard — tenant separation is a compliance feature as much as a performance one.",
  ],

  requestFlow: [
    { title: "Alice posts to #eng", detail: "Her client ships the message over its persistent socket with a client-generated client_msg_id. From this moment retries are free — the id is the dedup key.", edge: ["clients", "wsgw"], tag: "client_msg_id" },
    { title: "Persist first", detail: "Message service assigns the channel-scoped ts and INSERTs into the workspace shard. A retried duplicate violates uniqueness and returns the original — idempotency enforced by constraint, not by hope.", edge: ["msgsvc", "pg"], tag: "ack = durable" },
    { title: "Event published", detail: "Committed messages publish to channel.events. Delivery, badges, indexing, and notifications are independent consumers of one truth.", edge: ["msgsvc", "kafka"], nodes: ["kafka"] },
    { title: "Fan-out resolves targets", detail: "Workers resolve channel membership, consult presence for the online set, then translate user ids into gateway addresses via the routing registry — one leased-map lookup per recipient.", edge: ["fanout", "reg"], nodes: ["reg"], tag: "online-only" },
    { title: "Frames pushed", detail: "Delivery frames reach each holder gateway and exit over live sockets. Same-region online recipients render well inside the 300ms p99 budget.", edge: ["fanout", "wsgw"], tag: "<300ms p99" },
    { title: "Bob's unread increments", detail: "The counter consumer batches per-user deltas and flushes to the unread table; mention detection flags Bob's badge and may trigger a notification.", edge: ["kafka", "unread"], nodes: ["unread"], tag: "+1 batched" },
    { title: "Offline Charlie syncs", detail: "Charlie was in a tunnel. On reconnect his socket re-registers, the client sends its last-seen cursor per channel, and the message service replays exactly the delta from the shard — nothing lost, nothing duplicated.", edge: ["clients", "wsgw"], tag: "cursor replay" },
  ],

  deepDives: [
    {
      topic: "Workspace-as-tenant: the sharding unit and its hot-tenant problem",
      body: "Colocating all channels, memberships, and history for one workspace on one shard gives perfect blast radius: a corrupt migration or runaway bot hurts exactly one customer. It also concentrates your biggest customers onto your least-distributed resource.",
      bullets: [
        "Shared pool: thousands of small workspaces per shard with statistically smooth load.",
        "Jumbo tenants (100K–500K seats) get DEDICATED shards — their peaks would otherwise be everyone's outage.",
        "In-shard relief: split a giant workspace's channel set across a shard pair; channel_id carries the routing hint.",
        "Admission control per shard with explicit priority: when #general floods, presence ticks shed before messages do.",
      ],
    },
    {
      topic: "The routing registry is the soft underbelly",
      body: "Every delivered frame depends on answering which gateway holds this user right now. The registry is a leased, heartbeated map — and nearly every chat failure mode is ultimately a registry failure mode.",
      bullets: [
        "Leases expire in seconds; a crashed gateway's entries self-heal without operator action.",
        "Gateway restart triggers a re-registration STORM — jittered backoff turns the pile-on into a smooth ramp.",
        "Registry partitions (split-brain) can issue two owners for one user, producing duplicate frames. Epochs shrink the window; they cannot close it.",
        "Therefore the CLIENT deduplicates by (channel, ts). At-least-once delivery plus endpoint idempotency beats pretending exactly-once exists.",
      ],
    },
    {
      topic: "Why persist-then-broadcast beats broadcast-then-persist",
      body: "Delivering from gateway memory before committing saves one hop — and breaks the product two ways: receivers can see messages the store later loses, and reconnect sync diverges from what users saw live.",
      bullets: [
        "The server-assigned ts doubles as ordering guarantee and sync cursor — one number, two contracts.",
        "Ack-to-sender fires immediately after commit; the checkmark MEANS durable.",
        "Badges, search, and notifications consume the committed stream, so every derived view shares one truth.",
        "The persistence hop costs single-digit milliseconds against a 300ms budget — the cheapest correctness ever purchased.",
      ],
    },
  ],

  failures: [
    {
      id: "general-herd",
      title: "Hot-channel thundering herd (#general, 10K members)",
      fail: [],
      degrade: ["fanout"],
      story: "An incident room swells to 10K members while 100 messages/minute pour in. Naive fan-out attempts a million individual deliveries per 100-message window; worker queues balloon and lag explodes for every channel sharing the fleet.",
      reroute: ["kafka", "fanout", "wsgw"],
      metrics: [
        { label: "Fan-out lag", before: "0.4s", after: "18s", bad: true },
        { label: "Deliveries/message", before: "10K naive", after: "~900 online", bad: false },
        { label: "Gateway queue drops", before: "0", after: "2% (presence first)", bad: true },
      ],
      lessons: [
        "Tiered fan-out: push only to ONLINE sockets; everyone else syncs by cursor — the herd becomes the audience.",
        "Coalesce bursts per channel in a tens-of-ms window so 20 rapid messages become one batched frame pass.",
        "Bound per-gateway send queues with explicit eviction order: presence ticks die first, messages never.",
        "Alert on fan-out lag growth RATE — absolute lag pages you only after users already noticed.",
      ],
    },
    {
      id: "registry-split-brain",
      title: "Registry split-brain causes duplicate deliveries",
      fail: [],
      degrade: ["reg"],
      story: "A network partition leaves two registry halves each convinced they hold the truth; some users map to gateways on both sides and receive every channel message twice for the duration of the incident.",
      reroute: ["clients", "wsgw", "msgsvc"],
      metrics: [
        { label: "Duplicate frames/user", before: "0", after: "2", bad: true },
        { label: "Visible duplicates in UI", before: "0", after: "0", bad: false },
        { label: "Registry convergence", before: "ms", after: "minutes", bad: true },
      ],
      lessons: [
        "Client-side dedup by (channel, ts) is the FINAL idempotency net — infrastructure reduces duplicates; the endpoint removes them.",
        "Epoch numbers on registry leases let gateways reject commands from deposed registrations.",
        "Design for at-least-once everywhere; exactly-once claims dissolve exactly during partitions.",
        "Duplicate-frame rate deserves a first-class dashboard, not anecdotal triage.",
      ],
    },
  ],

  scaling: [
    { stage: "1K seats", action: "One PostgreSQL, HTTP polling", why: "Prove the product; polling is adequate and honest." },
    { stage: "50K", action: "WebSocket gateways + routing registry", why: "Polling dies here; persistent connections begin." },
    { stage: "5M", action: "Kafka fan-out; unread counters on-write; TTL presence", why: "Delivery, badges, indexing decouple into independent consumers." },
    { stage: "10M+", action: "Workspace shards with dedicated hot-tenant tier; online-only fan-out; per-workspace search", why: "Tenancy concentration and mega-channels are the remaining walls." },
  ],

  tradeoffs: [
    {
      a: "Workspace-sharded tenancy",
      b: "Global message bus",
      aBlurb: "All state for one customer colocated",
      bBlurb: "Uniform partitioned log for all traffic",
      dims: [
        { name: "Blast radius", a: "One customer per incident", b: "Everyone shares every incident", winner: "a" },
        { name: "Hot-tenant absorption", a: "One 500K-seat firm saturates its shard", b: "Partitions spread spikes evenly", winner: "b" },
        { name: "Compliance & deletion", a: "Delete = retire a shard", b: "Tenant data smeared across the log", winner: "a" },
        { name: "Operational model", a: "Shard maps, migrations, tiering", b: "One system, one dial", winner: "b" },
      ],
      verdict: "Shard by workspace, give jumbo tenants a dedicated tier, and reserve a global bus for analytics — tenancy alignment beats uniformity for B2B chat.",
    },
    {
      a: "Unread counts computed on-write",
      b: "Unread counts computed on-read",
      aBlurb: "Increment counters as messages flow",
      bBlurb: "Aggregate unread rows when asked",
      dims: [
        { name: "Badge/open latency", a: "Precomputed, O(1) per view", b: "Aggregation over 100+ channels per open", winner: "a" },
        { name: "Write amplification", a: "One delta per (user, channel) per message", b: "Zero extra writes", winner: "b" },
        { name: "Drift behavior", a: "Accumulates silently; needs reconciliation", b: "Cannot drift — derived fresh", winner: "b" },
        { name: "Replay handling", a: "Must absorb out-of-order/replayed deltas", b: "Trivially correct", winner: "b" },
      ],
      verdict: "On-write wins because badge reads happen orders of magnitude more often than writes — provided nightly reconciliation repairs drift before users notice.",
    },
  ],

  alternatives: [
    "MQTT broker fabric for connection management — proven at extreme scale, but ordering and tenant semantics leave your codebase.",
    "Pull-only clients (no push; poll on focus) — dramatically simpler and the reason some competitors feel slower; cursor sync still required for correctness.",
    "Cassandra instead of sharded PostgreSQL for messages — better raw write scale, weaker story for transactional unread/membership bookkeeping.",
  ],

  interview: {
    prompt: "Design Slack: channels, persistent WebSocket delivery, presence, and search for 10M+ concurrent users — where one customer owns 500K seats.",
    stages: [
      { name: "Requirements", expect: "Define the checkmark contract (persist-before-ack), per-channel ordering, cursor-based offline sync, and name tenancy as THE structural decision." },
      { name: "Estimation", expect: "10M sockets ÷ 30s → ~330K heartbeats/s; 5B msgs/day → ~58K/s average with sharp diurnal peaks; p99 <300ms shapes the happy path only." },
      { name: "Protocol sketch", expect: "client_msg_id for retry idempotency; server-assigned channel-scoped ts doubling as the sync cursor; (channel, ts) uniqueness." },
      { name: "Architecture", expect: "Dumb socket-holding gateways; leased routing registry; persist → publish → fan-out ordering; unread/search/push as independent Kafka consumers." },
      { name: "Deep dive", expect: "Handle #general at 10K members (online-only tiered fan-out, burst coalescing, queue eviction priorities) and the 500K-seat tenant (dedicated shards)." },
      { name: "Failure", expect: "Split-brain duplicates killed by client-side dedup; gateway-crash registration storms tamed with jittered backoff; end on at-least-once + endpoint idempotency." },
    ],
  },

  production: [
    "Retention and export jobs run per-workspace shard — deletion requests are satisfied by construction, not by scrubbing a shared log.",
    "Presence TTLs tune per platform (mobile flaps more); misclassified presence wastes pushes but never loses messages — keep it advisory.",
    "Notification suppression (DND, keyword filters, thread mutes) evaluates BEFORE third-party push spend, not after.",
    "Gateway deploys drain sockets gradually — stop-accept, migrate, kill; a big-bang restart is a self-inflicted reconnect storm.",
  ],

  costs: [
    "Socket-holding gateways are RAM-bound: fleet size = concurrent sockets ÷ per-pod ceiling. Connection count drives the bill, not message volume.",
    "Per-workspace search indexes multiply fixed overhead across small tenants — pack small workspaces onto shared index pods; isolate regulated industries.",
    "Third-party push (APNs/FCM) meters per notification; suppression rules are a cost-control feature as much as a UX one.",
  ],
};

/* ================================================================== */
/*  REDDIT                                                             */
/* ================================================================== */

const reddit: CaseStudy = {
  slug: "reddit",
  name: "Reddit",
  tagline: "Voting, ranking algorithms (hot/new/top), comment trees, and moderation at community scale.",
  category: "Community",
  difficulty: "Standard",
  minutes: 26,

  problem: [
    "Reddit is a voting machine attached to a discussion forest. Over 50M votes can land in a peak hour, every vote must be idempotent (one user, one thing, one direction), and several ranking algorithms — hot, new, top, best — continuously reinterpret the same vote stream into different orderings. None of it may corrupt, because scores decide what millions see first.",
    "The quiet giant is anonymity. More than 90% of pageviews come from logged-out visitors scrolling frontpages and deep-linked threads. If anonymous traffic reaches origin, no cache tier saves you — the architecture must make the CDN the anonymous product itself, reserving origin for the logged-in minority and the write path.",
  ],

  requirements: {
    functional: [
      "Submit posts and nested comment threads (depth-capped)",
      "Up/down votes, one per user per thing, changeable until archive",
      "Multiple rankings over one vote stream: hot (score + decay), new, top (windowed), best (comments)",
      "Per-community hot lists merged into a personalized frontpage",
      "Moderation queues with report intake and AutoMod rule hooks",
      "Logged-out browsing of all public content",
    ],
    nonFunctional: [
      "90%+ of pageviews served WITHOUT touching origin",
      "Vote → visible re-rank within seconds",
      "Votes idempotent forever — replays and retries cannot double-count",
      "Scores eventually consistent within seconds; displayed precision intentionally fuzzy",
      "100K+-comment megathreads remain browsable at interactive latency",
    ],
  },

  capacity: [
    { label: "Active communities", value: "100K+", note: "of millions registered" },
    { label: "Peak votes/hour", value: "50M+", note: "~14K/s sustained; spikes run multiples higher" },
    { label: "Logged-out pageviews", value: "90%+", note: "must terminate at CDN — origin cannot see them" },
    { label: "Comments/day", value: "~200M", note: "nesting bounded by depth caps" },
    { label: "Megathread size", value: "100K+ comments", note: "tree served as cached slices, never whole" },
  ],

  api: [
    { method: "GET", path: "/frontpage?after=", desc: "CDN-cacheable frontpage slice; anonymous requests end here" },
    { method: "GET", path: "/r/{sub}/hot", desc: "Recomputed ZSET slice; short-TTL edge cached" },
    { method: "POST", path: "/api/vote?id={thing}&dir=", desc: "Idempotent via UNIQUE(user, thing); emits vote event" },
    { method: "GET", path: "/comments/{post}?sort=&cursor=", desc: "Paginated tree slices by materialized-path prefix" },
    { method: "POST", path: "/api/report", desc: "Feeds the moderation queue; AutoMod evaluates on the stream" },
  ],

  dataModel: [
    { name: "things", fields: "id, kind(post|comment), author_id, parent_path, depth, created_at", note: "parent_path = materialized ancestry '000004.000017.'" },
    { name: "votes", fields: "user_id, thing_id, dir(+1|-1), ts", note: "UNIQUE(user_id, thing_id) — idempotency lives in the schema" },
    { name: "scores", fields: "thing_id, up, down, score", note: "denormalized from the vote stream; reconciliation repairs drift" },
    { name: "rankings", fields: "ZSET per scope: hot::{sub}, top::{sub}:{window}", note: "Redis sorted sets; recomputed continuously by workers" },
    { name: "modqueue", fields: "item_id, reasons[], reporter, automod_verdict", note: "community-scoped; AutoMod pre-fills verdicts" },
  ],

  architecture: {
    nodes: [
      n("web", "Apps / Web", "client", 20, 260),
      n("cdn", "CDN", "cache", 245, 100, "anon pageviews · media"),
      n("gw", "API Gateway", "app", 245, 340, "auth · rate limits"),
      n("post", "Post Service", "app", 470, 100),
      n("comment", "Comment Service", "app", 470, 300, "materialized-path inserts"),
      n("vote", "Vote Service", "app", 470, 460, "(user, thing) unique"),
      n("kaf", "Kafka", "queue", 695, 100, "vote · comment events"),
      n("cstore", "Comment Store", "data", 695, 300, "materialized paths"),
      n("zsets", "Redis", "cache", 695, 460, "rankings: hot · top · best"),
      n("workers", "Recompute Workers", "app", 920, 100, "hot/trend windows"),
      n("modq", "Mod Queue Service", "app", 920, 300, "reports · AutoMod"),
      n("mon", "Monitoring", "infra", 1145, 300),
    ],
    edges: [
      { from: "web", to: "cdn", label: "anon pageviews", flow: true },
      { from: "web", to: "gw", label: "signed-in APIs", flow: true },
      { from: "gw", to: "post", label: "submit" },
      { from: "gw", to: "comment", label: "reply" },
      { from: "gw", to: "vote", label: "cast vote", flow: true },
      { from: "vote", to: "zsets", label: "ZINCRBY", flow: true },
      { from: "vote", to: "kaf", label: "vote.events", flow: true },
      { from: "comment", to: "cstore", label: "path INSERT" },
      { from: "comment", to: "kaf", label: "comment.events" },
      { from: "post", to: "cstore", label: "post rows" },
      { from: "kaf", to: "workers", flow: true },
      { from: "workers", to: "zsets", label: "rescore windows", flow: true },
      { from: "kaf", to: "modq", dashed: true, label: "AutoMod hooks" },
      { from: "gw", to: "zsets", dashed: true, label: "frontpage slice reads" },
      { from: "modq", to: "mon", dashed: true },
      { from: "workers", to: "mon", dashed: true },
    ],
    flows: [
      { id: "rd-vote", path: ["web", "gw", "vote", "kaf", "workers", "zsets"], color: "#2563EB", speed: 260, label: "vote → recompute" },
      { id: "rd-anon", path: ["web", "cdn"], color: "#16A34A", speed: 340, label: "anonymous lurker" },
    ],
  },

  archNotes: [
    "Vote idempotency is a schema constraint, not application discipline: UNIQUE(user_id, thing_id) makes retries, replays, and double-taps structurally harmless.",
    "Displayed scores are denormalized approximations that settle within seconds; fuzzing final digits is deliberate — exact counts invite vote-brigading games.",
    "Hot ZSETs recompute continuously per community; the logged-in frontpage merges subscribed slices with personalization interleaved AT READ — the expensive part stays precomputed.",
    "AutoMod is just another stream consumer: rules evaluate on activity events and quarantine items into mod queues BEFORE they gain wide visibility.",
    "Depth caps (~10 levels) plus breadth pagination bound any thread fetch to a subtree slice — a 100K-comment megathread has no unbounded read.",
  ],

  requestFlow: [
    { title: "Anonymous scroll", detail: "A logged-out visitor loads the frontpage. The request terminates at the CDN edge on cached JSON slices keyed by path with second-scale TTLs. Origin never learns this visit happened.", edge: ["web", "cdn"], tag: "90%+ of pageviews" },
    { title: "Signed-in member upvotes", detail: "Authentication flips traffic to origin APIs. The gateway validates the session and applies per-user and per-IP rate limits before the vote service sees anything.", edge: ["web", "gw"], tag: "POST /api/vote" },
    { title: "Idempotent vote row", detail: "The vote service INSERTs (user, thing, dir) against a unique constraint. A revote UPDATEs in place; a retry hits the constraint and still returns success — the schema absorbs every duplication mechanism upstream.", edge: ["gw", "vote"], nodes: ["vote"], tag: "UNIQUE(user, thing)" },
    { title: "Score bumps immediately", detail: "ZINCRBY nudges the thing's score entry for instant feedback while vote.events publishes downstream. Accepted consistency: displayed totals converge asynchronously.", edge: ["vote", "zsets"], tag: "ZINCRBY · event out" },
    { title: "Hot worker repositions", detail: "Recompute workers consume the stream and rescore affected community ZSETs. Log-decay weighting means early votes dominate momentum; the post settles into position within seconds.", edge: ["workers", "zsets"], nodes: ["workers"], tag: "<5s visible" },
    { title: "Nested comment lands", detail: "The reply INSERTs carrying its parent's materialized path plus its own segment. Subtree fetches become single prefix-range scans — deep links stay cheap even inside megathreads.", edge: ["comment", "cstore"], tag: "path append" },
    { title: "OP notified; AutoMod watches", detail: "comment.events fans out: a notifier pings the original poster while AutoMod rules (link patterns, account age, slur lists) evaluate the same event and can quarantine straight into the mod queue.", edge: ["kaf", "modq"], nodes: ["modq"], tag: "pre-publication" },
  ],

  deepDives: [
    {
      topic: "Ranking formulas, concretely",
      body: "Every sort is a function over the same vote stream; differences are pure math, and the math encodes editorial policy.",
      bullets: [
        "HOT: log10(max(|score|,1)) + sign(score) × age_seconds / 45000. The log compresses brigades (first ten votes outweigh the next hundred); the divisor makes the first ~10 hours decay like ~10 points — freshness fights momentum.",
        "TOP: pure windowed sums over partitioned vote history (hour/day/month/year/all) — no decay, deterministic, trivially cacheable per window.",
        "BEST (comments): Wilson score LOWER bound at ~95% confidence. A 1-up/0-down comment averages 1.00 but carries Wilson LB ≈ 0.21; a 45-up/5-down comment (raw 0.90) sits near LB ≈ 0.79. Small samples sink until evidence accumulates.",
        "Why Wilson beats raw average: averages reward tiny denominators; the lower bound answers how good this is GIVEN uncertainty — exactly the question a ranking asks.",
      ],
    },
    {
      topic: "Comment trees as materialized paths",
      body: "Nested threads need subtree reads, depth answers, and stable ordering. Materialized paths deliver all three with one indexed column: each comment stores ancestry as concatenated fixed-width segments ('000004.000017.').",
      bullets: [
        "Insert = copy parent's path, append your segment. No cascading updates, no closure-table maintenance.",
        "Fetch-this-reply-chain = one prefix range scan on the path index — the only read pattern deep links need.",
        "Depth cap (~10) plus per-node breadth pagination decompose even 100K-comment threads into bounded slices.",
        "Moves are forbidden (paths would rewrite); deletes are tombstones. Rigidity traded deliberately for predictability.",
      ],
    },
    {
      topic: "The 90%-anonymous CDN wall",
      body: "Capacity planning for Reddit is capacity planning for the logged-out majority. Anonymous browsing is treated as a CDN product with an origin fallback — not web traffic with a cache bolted in front.",
      bullets: [
        "Frontpage, community listings, and comment-page JSON render identically for all anonymous viewers → safely edge-cacheable at second-scale TTLs.",
        "Origin sees only cache misses, logged-in personalized variants, and the write path; sizing assumes the minority.",
        "Deep links bypass frontpage caches — megathread surges get absorbed by caching TREE SLICES keyed (post id, sort, cursor).",
        "Relaxed invalidation is deliberate: a few stale seconds of scores for anonymous users is undetectable in practice.",
      ],
    },
  ],

  failures: [
    {
      id: "vote-ring",
      title: "Bot vote-ring skews r/all before detection",
      fail: [],
      degrade: ["vote"],
      story: "A coordinated farm upvotes a target post through hundreds of aged accounts. Legitimate hot-list entries are displaced for minutes until velocity anomalies flag the pattern and the ring's votes are reversed.",
      reroute: ["kaf", "workers", "zsets"],
      metrics: [
        { label: "r/all rank distortion", before: "—", after: "+40% artificial", bad: true },
        { label: "Detection lag", before: "hours (legacy)", after: "minutes", bad: true },
        { label: "Legit post reach", before: "baseline", after: "-25% during ring", bad: true },
      ],
      lessons: [
        "Vote-velocity anomaly detection against per-community baselines catches rings faster than account-level heuristics.",
        "Layered limits per account, IP, and ASN raise the farm operator's cost curve before quality systems engage.",
        "Weight vote influence by account age and history — fresh accounts buy less ranking power by construction.",
        "Idempotent, auditable vote rows make bulk reversal cheap: poison in, poison out, scores restored.",
      ],
    },
    {
      id: "megathread-storm",
      title: "Viral megathread deep-link explosion",
      fail: [],
      degrade: ["cstore"],
      story: "A breaking-news megathread hits 100K+ comments while social media hammers deep links straight into mid-thread replies — bypassing every frontpage cache and piling origin load onto tree reads.",
      reroute: ["cdn", "gw", "cstore"],
      metrics: [
        { label: "Tree-read QPS", before: "8K", after: "300K", bad: true },
        { label: "Thread p99", before: "40ms", after: "2.1s", bad: true },
        { label: "Slice cache hit ratio", before: "warm", after: ">97% after warmup", bad: false },
      ],
      lessons: [
        "Cache tree SLICES (post id + sort + cursor) at CDN and Redis so deep links hit edges like frontpages do.",
        "Materialized-path pagination bounds every fetch regardless of thread size — worst case stays a slice.",
        "Depth caps keep pathological threads from growing pathological reads.",
        "Admit surge traffic with slice caches as shock absorbers; origin serves misses only.",
      ],
    },
  ],

  scaling: [
    { stage: "1K users", action: "Single PostgreSQL; ORDER BY score computed live", why: "One box honestly serves early-scale voting." },
    { stage: "100K", action: "Denormalized score columns + async counter aggregation", why: "Vote storms serialize on hot count rows otherwise." },
    { stage: "1M+", action: "Redis ZSET rankings fed by recompute workers; CDN for logged-out pages", why: "Ranking moves off the read path; anonymity off the origin." },
    { stage: "10M+", action: "Materialized-path trees, slice caching, anomaly-driven vote hygiene", why: "Megathreads and brigading become the design constraints." },
  ],

  tradeoffs: [
    {
      a: "Periodic hot-list recompute",
      b: "Rank-at-read",
      aBlurb: "Workers refresh ZSETs continuously",
      bBlurb: "Score and sort on each request",
      dims: [
        { name: "Origin cost", a: "Bounded, independent of reader count", b: "Scales with every pageview — fatal at 90%+ anon", winner: "a" },
        { name: "Freshness", a: "Seconds of staleness", b: "Exact at evaluation time", winner: "b" },
        { name: "Traffic-spike behavior", a: "Readers hit warm sorted sets", b: "Spikes multiply scoring work", winner: "a" },
        { name: "Per-user personalization", a: "Limited to read-time interleave", b: "Fully custom per request", winner: "b" },
      ],
      verdict: "Recompute community lists periodically, then personalize at read as a thin interleave over precomputed slices — heavy math once, cheap assembly always.",
    },
    {
      a: "Eager denormalized scores",
      b: "Compute scores on demand",
      aBlurb: "Maintain up/down/score columns",
      bBlurb: "COUNT/CASE over votes when asked",
      dims: [
        { name: "Sort/read speed", a: "Indexed integers, ZSET-friendly", b: "Aggregations per query — unusable for rankings", winner: "a" },
        { name: "Write throughput", a: "Extra update per vote (async)", b: "Append-only vote rows", winner: "b" },
        { name: "Consistency model", a: "Eventually consistent, reconcilable", b: "Always exact", winner: "b" },
        { name: "Failure recovery", a: "Rebuild from immutable vote log", b: "Nothing to rebuild", winner: "b" },
      ],
      verdict: "Eager scores win because rankings read orders of magnitude more often than votes write — and the immutable vote log means drift is always repairable.",
    },
  ],

  alternatives: [
    "Graph database for comment threading — elegant traversals, unnecessary when a single indexed path column already makes subtree fetches O(log n).",
    "Stream-processing (Flink-style) continuous rankings instead of periodic workers — tighter freshness, materially heavier operational surface for seconds-level gains nobody perceives.",
    "Serve anonymous pages from origin with aggressive micro-caching — simpler invalidation story, and it collapses precisely during the viral moments that define the product.",
  ],

  interview: {
    prompt: "Design Reddit: idempotent voting, hot/top/best ranking algorithms, nested comment trees, moderation, and a frontpage where 90%+ of readers are logged out.",
    stages: [
      { name: "Requirements", expect: "Call out vote idempotency as a schema constraint, second-scale rank freshness, and the logged-out majority as a first-class capacity constraint." },
      { name: "Estimation", expect: "50M votes/hour ≈ 14K/s sustained with spikes; 90%+ anon pageviews forces the CDN-wall conclusion before any server drawing." },
      { name: "Data model", expect: "UNIQUE(user, thing) vote rows; denormalized score columns; materialized parent_path with depth caps; per-community ranking ZSETs." },
      { name: "Architecture", expect: "Write services emit events; recompute workers own rankings; AutoMod and notifications are stream consumers; gateway reads frontpage slices from Redis." },
      { name: "Deep dive", expect: "Recite hot's log-decay shape, top's windowed sums, and explain WHY Wilson's lower bound beats raw averages for few-vote comments — with the 1-up vs 45-up example." },
      { name: "Failure", expect: "Brigading → velocity anomalies + weighted influence + reversible rows; megathread deep links → cached tree slices. End on the anonymous-traffic isolation lesson." },
    ],
  },

  production: [
    "Score fuzzing and delayed rank application blunt vote-brigading strategies that depend on exact real-time feedback.",
    "Moderation actions (removals, bans) propagate as tombstone events so CDN slices purge quickly without full invalidation storms.",
    "Archive jobs freeze old posts' rankings and compact their vote rows — hot storage holds what users actually browse.",
    "AutoMod rule changes ship behind per-community audit logs; a bad regex must never silently silence a subreddit.",
  ],

  costs: [
    "CDN egress for anonymous traffic dominates spend — negotiate committed-use pricing around it; it is the product.",
    "Redis memory tracks active communities × windows, not total content: archive cold subreddits' ZSETs to disk-backed tiering.",
    "Vote-event retention is cheap and priceless: every score, ranking, and reversal reconstructs from the immutable log.",
  ],
};

export const COLLAB_SYSTEMS: CaseStudy[] = [linkedin, slack, reddit];
