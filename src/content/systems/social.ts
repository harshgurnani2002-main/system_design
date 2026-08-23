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
/*  INSTAGRAM                                                          */
/* ================================================================== */

const instagram: CaseStudy = {
  slug: "instagram",
  name: "Instagram",
  tagline: "Photo sharing at planetary scale: media pipelines, feed fan-out and the celebrity problem.",
  category: "Social",
  difficulty: "Hard",
  minutes: 40,

  problem: [
    "Users upload photos and short videos; followers expect them in their feed within seconds of opening the app. The hard part is invisible: a single post from an account with 100M followers cannot be pushed to 100M feeds synchronously, and every like on a viral post hammers one counter row.",
    "The system is brutally read-skewed (~1000:1 read/write for feeds), media-heavy (megabytes per post vs bytes of metadata), and socially skewed (1% of accounts generate most of the fan-out pain). Every architectural choice follows from those three facts.",
  ],

  requirements: {
    functional: [
      "Upload photo/video with caption; multiple resolution variants generated",
      "Home feed: posts from followed accounts, reverse-chronological or ranked",
      "Like / comment / follow / share interactions with counts visible",
      "Push notifications for engagement on your posts",
      "Explore/search: trending and personalized discovery grid",
      "Stories: ephemeral posts expiring after 24h",
    ],
    nonFunctional: [
      "100M+ DAU; feed open < 200ms p95",
      "Post visible to followers < 30s after publish (eventual OK)",
      "Like counts may lag seconds (eventual consistency acceptable)",
      "Media durability: never lose an uploaded photo (99.999999999% durability)",
      "Read availability trumps consistency — degraded mode still serves",
    ],
  },

  capacity: [
    { label: "Registered users", value: "2B", note: "marketing number" },
    { label: "DAU", value: "200M" },
    { label: "Feed opens/day", value: "4B", note: "20 sessions × 200M" },
    { label: "Feed requests/sec", value: "~46K avg", note: "4B ÷ 86400 ≈ 46K" },
    { label: "Peak feed QPS", value: "~230K", note: "5× evening peak factor" },
    { label: "Uploads/day", value: "100M photos + 50M videos" },
    { label: "Storage growth/day", value: "~80TB", note: "photo 500KB×3 variants + video" },
    { label: "Egress bandwidth", value: ">1TB/s peak", note: "CDN absorbs nearly all" },
  ],

  api: [
    { method: "POST", path: "/media/upload-url", desc: "Returns presigned S3 URL — bytes never touch API servers" },
    { method: "POST", path: "/posts", desc: "Create post after upload completes; emits PostCreated event" },
    { method: "GET", path: "/feed?cursor=", desc: "Pre-materialized timeline page (cursor = last post id)" },
    { method: "POST", path: "/posts/{id}/like", desc: "Idempotent like; enqueued to async counter pipeline" },
    { method: "POST", path: "/users/{id}/follow", desc: "Write follow edge; triggers timeline backfill for new follower" },
  ],

  dataModel: [
    { name: "users", fields: "id, username, follower_count (approx), created_at", note: "profile cached in Redis" },
    { name: "follows", fields: "follower_id, followee_id, since", note: "sharded by follower_id; the fan-out source" },
    { name: "posts", fields: "id, user_id, media_keys[], caption, created_at", note: "metadata only — blobs live in object storage" },
    { name: "timeline", fields: "user_id, post_id, score(epoch_ms)", note: "Redis ZSET per user — the materialized feed" },
    { name: "like_counts", fields: "post_id, count, updated_at", note: "async-aggregated; hot rows sharded into buckets" },
  ],

  architecture: {
    nodes: [
      n("app", "Mobile App", "client", 20, 180),
      n("cdn", "CDN", "cache", 240, 60),
      n("gw", "API Gateway", "app", 240, 300, "auth · quotas"),
      n("feed", "Feed Service", "app", 470, 180),
      n("postsvc", "Post Service", "app", 470, 320),
      n("fanout", "Fan-out Worker", "app", 700, 420, "timeline writes"),
      n("media", "Media Worker", "app", 700, 540, "resize · transcode"),
      n("redis", "Redis", "cache", 700, 180, "timelines · counts"),
      n("kafka", "Kafka", "queue", 930, 420, "engagement.events"),
      n("pg", "PostgreSQL", "data", 930, 240, "metadata shard map"),
      n("s3", "Object Store", "data", 1160, 540, "originals + variants"),
      n("mon", "Monitoring", "infra", 1400, 300, "RED · SLO burn"),
    ],
    edges: [
      { from: "app", to: "cdn", label: "media reads", flow: true },
      { from: "app", to: "gw", label: "HTTPS", flow: true },
      { from: "gw", to: "feed", protocol: "gRPC" },
      { from: "gw", to: "postsvc", protocol: "gRPC" },
      { from: "feed", to: "redis", label: "read timeline", flow: true },
      { from: "feed", to: "pg", dashed: true, label: "cache miss" },
      { from: "postsvc", to: "s3", label: "presigned PUT" },
      { from: "postsvc", to: "kafka", label: "PostCreated" },
      { from: "kafka", to: "fanout", flow: true },
      { from: "fanout", to: "redis", label: "push to timelines", flow: true },
      { from: "kafka", to: "media" },
      { from: "media", to: "s3", label: "variants" },
      { from: "postsvc", to: "pg" },
      { from: "redis", to: "mon", dashed: true },
    ],
    flows: [
      { id: "ig-upload", path: ["app", "gw", "postsvc", "kafka", "fanout", "redis"], color: "#2563EB", speed: 260, label: "publish pipeline" },
      { id: "ig-read", path: ["app", "gw", "feed", "redis"], color: "#16A34A", speed: 300, label: "feed read" },
    ],
  },

  archNotes: [
    "Uploads use presigned URLs: API servers validate intent, not bytes. A 25MB video never transits application memory.",
    "Timelines are pre-materialized Redis ZSETs for regular accounts — feed reads are O(page size), not O(following).",
    "Celebrity accounts (≥~100K followers) are EXCLUDED from push fan-out; their posts merge into feeds at read time. One Kim Kardashian post would otherwise cost 100M Redis writes.",
    "Likes flow through Kafka to batching workers: thousands of likes collapse into periodic merged UPDATEs. Counts lag by design.",
    "Media workers generate 3–5 resolution variants; CDN serves them for effectively forever (immutable keys).",
  ],

  requestFlow: [
    { title: "Open app → GET /feed", detail: "Gateway validates JWT locally (no session lookup), applies per-user rate limits, routes to the nearest Feed Service pod.", edge: ["app", "gw"], nodes: ["gw"], tag: "~3ms" },
    { title: "Timeline lookup", detail: "Feed Service ZREVRANGEs the user's timeline list in Redis — already materialized by fan-out workers. This is one O(20) call.", edge: ["feed", "redis"], nodes: ["feed", "redis"], tag: "~0.8ms" },
    { title: "Hydrate the page", detail: "Post metadata comes from a Redis-backed KV; anything missing falls to the metadata shards (rare — hit rates >97%).", edge: ["feed", "pg"], nodes: ["pg"], tag: "miss only" },
    { title: "Media via CDN", detail: "The app renders <img> tags pointing at CDN URLs. The origin serves a variant exactly once per PoP per object; everything else is edge-cached.", edge: ["app", "cdn"], nodes: ["cdn"], tag: "~15ms global" },
    { title: "User likes a post", detail: "POST /like is acknowledged immediately after dedup check — the user sees instant feedback. The write itself enters Kafka.", edge: ["gw", "postsvc"], nodes: ["postsvc"], tag: "ack fast" },
    { title: "Async aggregation", detail: "Counter consumers batch thousands of like events into merged UPDATEs against sharded count buckets. No row-lock storm, ever.", edge: ["kafka", "fanout"], nodes: ["fanout"], tag: "÷1000 writes" },
    { title: "New post published", detail: "Post service writes metadata, uploads finish client-side, and PostCreated lands in Kafka. Fan-out workers push the post id into follower timelines — except celebrities, who wait for read-time merge.", edge: ["fanout", "redis"], nodes: ["redis"], tag: "<30s visible" },
  ],

  deepDives: [
    {
      topic: "Hybrid fan-out: the core tradeoff",
      body: "Pure push (write-time fan-out) gives O(1) reads but explodes on celebrities. Pure pull (read-time assembly) makes every feed open expensive. Real systems split accounts by follower count.",
      bullets: [
        "Regular users (<100K followers): push. Fan-out worker inserts post_id into each follower's ZSET.",
        "Celebrities: skip fan-out entirely. Feed service fetches their recent post ids separately and interleaves.",
        "Threshold is tunable infrastructure, not dogma — it moves with Redis capacity economics.",
        "Unfollows/deletes: lazy tombstone filtering at read beats rewriting thousands of timelines.",
      ],
    },
    {
      topic: "Why likes must be asynchronous",
      body: "A viral post receives 100K+ likes/minute aimed at ONE counter row. Synchronous UPDATEs serialize on the row lock — throughput caps near hundreds/sec no matter how big the database.",
      bullets: [
        "Queue + batcher converts N likes into ~N/5000 UPDATE statements.",
        "Counts become eventually consistent (seconds of lag nobody notices).",
        "Hot rows additionally split into 16 buckets summed on read — the hot-key fix.",
        "Full interactive version lives in the Caching chapter's Like Storm simulation.",
      ],
    },
    {
      topic: "Why media never touches app servers",
      body: "Presigned uploads move byte-transfer responsibility to object storage directly. Apps coordinate; storage stores.",
      bullets: [
        "App issues scoped, expiring PUT URL after permission checks.",
        "Client uploads directly; completion webhook triggers variant generation.",
        "At 10x scale this decision saves entire server fleets worth of bandwidth and memory.",
      ],
    },
  ],

  failures: [
    {
      id: "redis-down",
      title: "Redis timeline cluster dies",
      fail: ["redis"],
      story: "Feed reads can't find materialized timelines. Without a plan this is a total feed outage; with one it's a slow-motion degradation.",
      metrics: [
        { label: "Feed p95", before: "120ms", after: "900ms", bad: true },
        { label: "DB read QPS", before: "8K", after: "180K", bad: true },
        { label: "Error rate", before: "0.1%", after: "0.3%", bad: true },
      ],
      lessons: [
        "Fall back to pull-based assembly: query followed accounts' recent posts directly (slow but alive).",
        "Cache-node loss should trip an alert in <30s; warm-up procedures prevent recovery stampedes.",
        "TTL jitter on timeline entries prevents synchronized expiry avalanches.",
      ],
    },
    {
      id: "kafka-lag",
      title: "Fan-out consumer lag explodes",
      fail: [],
      degrade: ["kafka"],
      story: "A viral event triples posts/minute. Fan-out workers fall behind; new posts appear late in follower feeds.",
      reroute: ["kafka", "fanout", "redis"],
      metrics: [
        { label: "Consumer lag", before: "2K msgs", after: "14M msgs", bad: true },
        { label: "Post visibility", before: "<5s", after: "~90s", bad: true },
        { label: "Order API health", before: "healthy", after: "healthy", bad: false },
      ],
      lessons: [
        "Alert on lag growth rate, not absolute lag alone.",
        "Autoscale consumers on lag (KEDA) up to partition count — over-partition topics early.",
        "Celebrity-path independence means the worst-case posts aren't even in this queue.",
      ],
    },
    {
      id: "region-loss",
      title: "Whole region goes dark",
      fail: ["gw", "feed", "postsvc"],
      story: "An east-coast AZ evacuation removes half the API fleet. Global LB health checks shift traffic to remaining regions.",
      reroute: ["app", "cdn", "redis"],
      metrics: [
        { label: "Capacity", before: "100%", after: "55%", bad: true },
        { label: "p95 latency", before: "140ms", after: "310ms", bad: true },
        { label: "Availability", before: "99.95%", after: "99.5%", bad: true },
      ],
      lessons: [
        "Stateless services make regions interchangeable — the reason V3 demanded statelessness.",
        "Multi-region data replication is async: failover may lose seconds of writes (accepted for posts, NOT for DMs).",
        "Quarterly GameDays rehearse evacuation so runbooks aren't fiction.",
      ],
    },
  ],

  scaling: [
    { stage: "10K users", action: "Single Postgres + local disks", why: "Ship product; learn what matters." },
    { stage: "500K", action: "Object storage + CDN for media", why: "Disk-full deploys and egress costs force blobs out of the app tier." },
    { stage: "5M", action: "Redis cache-aside for profiles/posts", why: "Read skew demands a cache; DB p99 grows linearly without one." },
    { stage: "50M", action: "Materialized timelines + async counters", why: "Feed assembly and like storms both exceed synchronous budgets." },
    { stage: "200M+", action: "Shard metadata by user_id; hybrid fan-out; multi-region", why: "Write ceilings and global latency end vertical scaling forever." },
  ],

  tradeoffs: [
    {
      a: "Fan-out on write",
      b: "Fan-out on read",
      aBlurb: "Materialize timelines at publish time",
      bBlurb: "Assemble feeds at request time",
      dims: [
        { name: "Feed read latency", a: "O(1) — one list range", b: "O(following) queries per open", winner: "a" },
        { name: "Publish cost", a: "O(followers) writes", b: "O(1)", winner: "b" },
        { name: "Celebrity handling", a: "Catastrophic (100M writes/post)", b: "Natural — they're just another account", winner: "b" },
        { name: "Storage", a: "Timeline lists ≈ TBs in Redis", b: "Nothing extra", winner: "b" },
      ],
      verdict: "Hybrid wins in production: push for the 99.9%, pull-merge for celebrities. Thresholds are operational levers, not ideology.",
    },
    {
      a: "Sync like counting",
      b: "Async batched counting",
      dims: [
        { name: "Freshness", a: "Exact instantly", b: "Lags 1–5s", winner: "a" },
        { name: "Viral-post throughput", a: "~500/s (row lock)", b: "Millions/s", winner: "b" },
        { name: "Complexity", a: "Trivial", b: "Queue + batcher + reconciliation", winner: "a" },
      ],
      verdict: "Nobody sues over a like count that settles in two seconds. Choose eventual consistency wherever the business allows — spend your strong-consistency budget where money moves.",
    },
  ],

  alternatives: [
    "Graph database (Neo4j-style) for the social graph — powerful traversals, brutal write-scale economics; most shops stay on sharded relational edges.",
    "Full pull-based feeds (early Twitter style) — simpler, but 200M DAU makes read-time assembly unaffordable.",
    "Cassandra-style wide-column store instead of Redis timelines — better write scale, worse interactive latency patterns for ZSET-like ranking.",
  ],

  interview: {
    prompt: "Design Instagram's core: media upload, home feed, and engagement — for 200M daily active users.",
    stages: [
      { name: "Requirements", expect: "Separate media plane from metadata plane; state staleness budgets explicitly (likes OK stale, post visibility <30s)." },
      { name: "Estimation", expect: "Arrive at ~230K peak feed QPS and ~80TB/day media growth; let those numbers justify CDN + object storage immediately." },
      { name: "API & Data", expect: "Presigned upload endpoint; cursor-paginated feed; timeline as (user_id, post_id, score) materialized list." },
      { name: "Architecture", expect: "Draw the hybrid fan-out with celebrity exclusion; Kafka between post creation and side effects." },
      { name: "Deep dive", expect: "When asked 'what about Beyoncé?' — explain threshold-based fan-out switching and read-time merge." },
      { name: "Failure & scale", expect: "Redis death → pull fallback; like storms → batching; close with SLO burn alerts rather than CPU alarms." },
    ],
  },

  production: [
    "Image pipelines must strip EXIF (privacy) and verify content safety BEFORE CDN propagation.",
    "Timeline TTLs for inactive users reclaim terabytes — resurrect on login via backfill.",
    "Per-account fan-out rate limits stop a spam account from writing millions of timeline entries.",
    "Canary ranking changes against engagement SLOs, not just error rates.",
  ],

  costs: [
    "CDN egress dominates: >1TB/s peak means media delivery is the #1 line item — negotiate committed-use pricing.",
    "Redis timeline memory scales with active-user timelines: TTL inactive accounts aggressively.",
    "Transcoding fleets autoscale on queue depth; spot capacity handles nightly upload waves.",
  ],
};

/* ================================================================== */
/*  TWITTER / X                                                        */
/* ================================================================== */

const twitter: CaseStudy = {
  slug: "twitter",
  name: "Twitter / X",
  tagline: "Text at firehose scale: timelines, retweets, trending — and the purest celebrity problem in tech.",
  category: "Social",
  difficulty: "Hard",
  minutes: 35,

  problem: [
    "Every second, hundreds of thousands of tweets are posted while tens of millions of people scroll timelines built from the accounts they follow. Unlike Instagram, the median tweet has zero media and near-zero value — but ONE tweet from the right account reaches 100M people.",
    "Twitter's defining engineering artifacts are the hybrid timeline strategy, real-time trend detection over the full firehose, and search indexing that lags publication by seconds.",
  ],

  requirements: {
    functional: [
      "Post text tweets ≤280 chars with optional media",
      "Home timeline: reverse-chronological or ranked from followed accounts",
      "Retweet, quote, like, reply threading",
      "Search all public tweets; trending topics computed continuously",
      "Follow/unfollow with notification fan-out",
    ],
    nonFunctional: [
      "150M+ DAU; timeline load <250ms p95",
      "Tweet searchable <10s after posting",
      "Firehose ingestion ≥1M tweets/sec peak events",
      "Your own new tweet appears in YOUR profile instantly (read-your-writes)",
    ],
  },

  capacity: [
    { label: "DAU", value: "250M" },
    { label: "Tweets/day", value: "500M", note: "~6K/s average" },
    { label: "Timeline loads/day", value: "3B", note: "12 per DAU" },
    { label: "Timeline QPS", value: "~35K avg", note: "~175K peak" },
    { label: "Search QPS", value: "~10K avg" },
    { label: "Firehose events/s", value: ">1M peak", note: "tweets+likes+retweets+opens" },
    { label: "Tweet storage/day", value: "~150GB", note: "tiny text, huge index" },
  ],

  api: [
    { method: "POST", path: "/tweets", desc: "Create tweet; returns id immediately, fan-out proceeds async" },
    { method: "GET", path: "/home-timeline?cursor=", desc: "Serves merged view: pushed timelines + celeb merge-at-read" },
    { method: "GET", path: "/search?q=&f=live", desc: "Earlybird-style inverted index query" },
    { method: "POST", path: "/tweets/{id}/retweet", desc: "Idempotent; increments counts asynchronously" },
    { method: "GET", path: "/trends?woeid=", desc: "Precomputed per-location trend lists" },
  ],

  dataModel: [
    { name: "tweets", fields: "id(snowflake), author_id, text, created_at, reply_to", note: "snowflake ids encode time — sortable without index" },
    { name: "follows", fields: "follower_id, followee_id", note: "the fan-out adjacency, sharded by follower" },
    { name: "home_timeline", fields: "owner_id, tweet_id, score", note: "Redis/Memcached lists, ~800 entries trimmed" },
    { name: "tweet_index", fields: "inverted: term → [tweet_ids]", note: "search tier rebuilt continuously from firehose" },
  ],

  architecture: {
    nodes: [
      n("c", "Clients", "client", 20, 200),
      n("lb", "Load Balancer", "app", 230, 200),
      n("tsvc", "Tweet Service", "app", 450, 90),
      n("tsl", "Timeline Service", "app", 450, 310),
      n("srch", "Search Service", "app", 680, 90),
      n("trnd", "Trend Aggregator", "app", 680, 210),
      n("kf", "Kafka Firehose", "queue", 680, 430, "all events"),
      n("fw", "Fan-out Workers", "app", 910, 430),
      n("rc", "Redis Timelines", "cache", 1140, 310, "ZSET per user"),
      n("idx", "Search Index", "data", 1140, 90, "inverted lists"),
      n("pg", "PostgreSQL Shards", "data", 1370, 310, "by tweet/author"),
      n("mon", "Monitoring", "infra", 1370, 90),
    ],
    edges: [
      { from: "c", to: "lb", flow: true },
      { from: "lb", to: "tsvc", label: "post" },
      { from: "lb", to: "tsl", label: "read timeline", flow: true },
      { from: "tsvc", to: "kf", label: " TweetCreated", flow: true },
      { from: "tsl", to: "rc", label: "fetch page", flow: true },
      { from: "kf", to: "fw", flow: true },
      { from: "fw", to: "rc", label: "insert entries", flow: true },
      { from: "kf", to: "srch", label: "index stream" },
      { from: "srch", to: "idx" },
      { from: "kf", to: "trnd", label: "counted window" },
      { from: "fw", to: "pg" },
      { from: "tsvc", to: "pg" },
      { from: "trnd", to: "mon", dashed: true },
    ],
    flows: [
      { id: "tw-post", path: ["c", "lb", "tsvc", "kf", "fw", "rc"], color: "#2563EB", speed: 280 },
      { id: "tw-read", path: ["c", "lb", "tsl", "rc"], color: "#16A34A", speed: 320 },
    ],
  },

  archNotes: [
    "Everything flows through the firehose: posting, searching, trending and fan-out are all independent consumers of the same event stream.",
    "Snowflake IDs (timestamp + machine + sequence) sort chronologically without a secondary index — pagination is free.",
    "Timeline pages hold ~800 entries; eviction keeps Redis working sets bounded as accounts grow.",
    "Trending is a sliding-window count over the firehose with velocity weighting — spikes beat volume.",
  ],

  requestFlow: [
    { title: "Compose & post", detail: "Client POSTs 280 chars. Tweet service assigns a snowflake ID, persists to the author's shard, ACKs. Total budget <50ms.", edge: ["c", "lb"], tag: "sync <50ms" },
    { title: "Into the firehose", detail: "TweetCreated hits Kafka. From here the tweet is 'published' — every downstream system catches up independently.", edge: ["tsvc", "kf"], nodes: ["kf"] },
    { title: "Fan-out (normal users)", detail: "Workers look up followers and prepend the tweet id to each timeline ZSET. Median ~300 inserts — trivial.", edge: ["fw", "rc"], nodes: ["fw"], tag: "~300 writes" },
    { title: "Celebrity bypass", detail: "Authors with >1M followers skip fan-out entirely. Their tweets ride along the read path instead.", nodes: ["rc"], tag: "skip fan-out" },
    { title: "Reading the timeline", detail: "Timeline service merges your pushed ZSET page with recent tweets from followed celebrities, filters tombstones, returns 30 items.", edge: ["tsl", "rc"], nodes: ["tsl"], tag: "<250ms total" },
    { title: "Search catches up", detail: "The same event streams into indexers; within ~10s the tweet appears in live search results worldwide.", edge: ["srch", "idx"], nodes: ["srch", "idx"], tag: "~10s lag" },
    { title: "Trends update", detail: "Sliding-window counters notice 'earthquake' velocity spiking 400×; the term enters regional trend lists.", edge: ["trnd", "mon"], nodes: ["trnd"], tag: "velocity > volume" },
  ],

  deepDives: [
    {
      topic: "The 100M-follower tweet",
      body: "Naive fan-out would perform 100M Redis writes for one button press. Twitter's answer predates most of today's infra: don't push what you can merge on read.",
      bullets: [
        "Celebrity set is small and cacheable per user (you follow maybe 2–5 mega-accounts).",
        "Read path fetches their latest K tweet ids from a tiny hot cache — microseconds.",
        "Merge happens in the timeline service, ranked interleaved with pushed entries.",
        "Result: viral moments stress NOTHING proportionally to audience size.",
      ],
    },
    {
      topic: "Why snowflake IDs matter",
      body: "Auto-increment IDs require coordinated sequences across shards; UUIDs sort randomly. Snowflakes give globally unique, time-sortable, generator-local IDs.",
      bullets: [
        "41 bits ms timestamp → 69-year horizon; 10 bits machine; 12 bits sequence.",
        "Pagination by id = time travel; 'tweets newer than X' needs no index.",
        "Sharding by author becomes safe because ordering lives IN the id.",
      ],
    },
    {
      topic: "Trending: statistics as a product",
      body: "Raw volume favors 'the' and 'I'. Trend detection weights velocity (rate of change) against baseline frequency per locale.",
      bullets: [
        "Sliding windows (5–30 min) over firehose counts per term/hashtag.",
        "Burst detection (z-score against historical hourly baselines).",
        "Spam damping: accounts-weighted, duplicate-suppressed counting.",
      ],
    },
  ],

  failures: [
    {
      id: "fanout-storm",
      fail: [],
      title: "Fan-out workers saturate during breaking news",
      degrade: ["fw"],
      story: "A major event doubles posting rate; normal-user fan-out backs up. Celebrity tweets (never fanned out) keep flowing — the design pays off exactly when traffic peaks.",
      reroute: ["kf", "fw", "rc"],
      metrics: [
        { label: "Fan-out lag", before: "sub-second", after: "45s", bad: true },
        { label: "Timeline freshness", before: "<5s", after: "~50s", bad: true },
        { label: "Celebrity visibility", before: "<5s", after: "<5s", bad: false },
      ],
      lessons: [
        "Over-partition the fan-out topic (≥4× max consumers) from day one.",
        "Priority: fan-out for high-follower-count authors first (most reach per unit work).",
        "Lag-based autoscaling absorbs minutes-long spikes without human paging.",
      ],
    },
    {
      fail: [],
      id: "search-degrade",
      title: "Search indexers fall behind",
      degrade: ["srch"],
      story: "Indexing pipeline stalls; live search shows tweets minutes old while timelines stay fresh.",
      metrics: [
        { label: "Search freshness", before: "~10s", after: "~8 min", bad: true },
        { label: "Timeline health", before: "OK", after: "OK", bad: false },
        { label: "User-visible blast radius", before: "—", after: "search only", bad: false },
      ],
      lessons: [
        "Decoupled consumers mean one pipeline degrading doesn't take down timelines.",
        "Index lag is itself an SLO — alert at >30s p99 publication-to-searchable.",
        "Backpressure: pause non-critical consumers (analytics) before search starves.",
      ],
    },
  ],

  scaling: [
    { stage: "100K users", action: "Pull-only timelines from SQL", why: "Following counts small enough for JOINs." },
    { stage: "10M", action: "Push fan-out to cached timeline lists", why: "Median reads must not scan follows." },
    { stage: "100M", action: "Hybrid celebrity merge + snowflake sharding", why: "Viral authors break naive push." },
    { stage: "Global", action: "Regional read replicas of timelines; single-writer firehose", why: "Latency is regional; consistency of the log is global." },
  ],

  tradeoffs: [
    {
      a: "Chronological timeline",
      b: "Ranked (ML) timeline",
      dims: [
        { name: "Predictability", a: "Perfect — users can trust it", b: "Opaque", winner: "a" },
        { name: "Engagement/session", a: "Baseline", b: "+20–40%", winner: "b" },
        { name: "Infra complexity", a: "Simple merge", b: "Feature store + ranker fleet", winner: "a" },
        { name: "Celebrity merge", a: "Required either way", b: "Ranker hides merge seams better", winner: "tie" },
      ],
      verdict: "Ship chronological first; ranking is a product decision layered ON TOP of the same materialized timeline, not a different architecture.",
    },
  ],

  alternatives: [
    "Pull-everything with aggressive caching (works until following counts explode).",
    "Event-sourced everything with Kafka Streams materializations — elegant, operationally heavier.",
    "Graph DB for follow graph traversal-driven discovery — niche win, poor primary store.",
  ],

  interview: {
    prompt: "Design Twitter's timeline and search for 250M DAU with 1M-follower celebrity accounts.",
    stages: [
      { name: "Requirements", expect: "Call out read-your-writes for own profile, ~10s search freshness, and the celebrity constraint explicitly." },
      { name: "Estimation", expect: "~175K peak timeline QPS drives materialization; 1M events/s drives the firehose abstraction." },
      { name: "Data model", expect: "Snowflake IDs for time-ordering without indexes; timeline as bounded ZSET per user." },
      { name: "Architecture", expect: "One firehose, many consumers: fan-out, search, trends as independent failure domains." },
      { name: "Deep dive", expect: "Walk the exact celebrity path: skip fan-out, hot-cache recent ids, merge at read, rank around it." },
      { name: "Failure", expect: "Breaking-news surge: priority fan-out, lag autoscaling, and why celebrities stay unaffected." },
    ],
  },

  production: [
    "Duplicate suppression at fan-out (dedup key author+epoch bucket) protects against Kafka replays.",
    "Timeline eviction policy = ring buffer semantics: newest 800, rest discarded (history lives in the shard).",
    "Rate limits differentiate compose (expensive fan-out) from reads (cheap) by orders of magnitude.",
  ],

  costs: [
    "Redis timeline memory is the dominant fixed cost — trim lengths, TTL inactive accounts.",
    "Firehose retention is cheap; reprocessing yesterday for a new ranking feature is the whole point.",
    "Search tier sized for peak news cycles, not averages — plan 5× diurnal headroom.",
  ],
};

/* ================================================================== */
/*  WHATSAPP                                                           */
/* ================================================================== */

const whatsapp: CaseStudy = {
  slug: "whatsapp",
  name: "WhatsApp",
  tagline: "Billions of persistent sockets, guaranteed delivery states, offline sync — real-time done seriously.",
  category: "Social",
  difficulty: "Expert",
  minutes: 38,

  problem: [
    "Chat looks simple until you multiply: hundreds of millions of simultaneously-connected clients, message delivery measured in milliseconds, receipts that everyone trusts, and absolutely-zero tolerance for losing a message — even if the sender's train goes through a tunnel mid-send.",
    "WhatsApp's architecture is fundamentally about connection management (which gateway holds which user), durable store-and-forward (nothing is 'sent' until persisted), and per-conversation sequencing (order guarantees without global locks).",
  ],

  requirements: {
    functional: [
      "1:1 and group messaging with sent/delivered/read receipts",
      "Offline users receive messages on reconnect (store-and-forward)",
      "Media attachments (images/video/voice) via encrypted blobs",
      "Presence: online / last-seen indicators",
      "End-to-end encryption considerations for payloads",
    ],
    nonFunctional: [
      "500M+ concurrent connections; delivery <500ms p99 online-to-online",
      "ZERO message loss once the sender sees ✓ (durability before ack)",
      "Strict per-conversation ordering regardless of receiving device",
      "Receipts themselves are eventually-consistent and dedupable",
    ],
  },

  capacity: [
    { label: "Registered users", value: "2B+" },
    { label: "Concurrent connections", value: "500M+", note: "persistent sockets" },
    { label: "Messages/day", value: "100B", note: "~1.2M msg/s average" },
    { label: "Peak message rate", value: "5M msg/s", note: "new year spikes" },
    { label: "Message storage/day", value: "~25TB", note: "text ~200B avg" },
    { label: "Connection churn", value: "~50K connects/s", note: "mobile networks flap" },
  ],

  api: [
    { method: "WS", path: "connect (gateway)", desc: "Persistent authenticated socket; registers user→gateway mapping" },
    { method: "MSG", path: "send(conversation_id, client_msg_id, payload)", desc: "Client-dedupable id; server assigns conversation seq" },
    { method: "MSG", path: "ack(server_seq)", desc: "Server→sender receipt: message durably stored" },
    { method: "MSG", path: "deliver(seq_range)", desc: "Push to recipient gateways; delivered/read receipts flow back" },
    { method: "HTTP", path: "sync(since_per_conversation)", desc: "Offline catch-up: replay everything since last seen seq" },
  ],

  dataModel: [
    { name: "conversations", fields: "conv_id, type(direct/group), member_hashes, next_seq", note: "sequencer partition owns next_seq" },
    { name: "messages", fields: "conv_id, seq, sender, client_msg_id, ciphertext, ts", note: "(conv_id, seq) unique — the ordering contract" },
    { name: "mailbox", fields: "user_id, conv_id, last_delivered_seq, last_read_seq", note: "receipt state per user per conversation" },
    { name: "presence", fields: "user_id, gateway_id, last_heartbeat, expires_at", note: "TTL registry — silent disconnects self-heal" },
  ],

  architecture: {
    nodes: [
      n("alice", "Sender Device", "client", 20, 120),
      n("gw1", "Gateway Cluster", "infra", 240, 120, "holds sockets"),
      n("seq", "Sequencer", "app", 470, 40, "per-conv order"),
      n("store", "Message Store", "data", 470, 200, "durable first"),
      n("route", "Routing Layer", "app", 700, 120, "presence lookup"),
      n("presence", "Presence Registry", "cache", 930, 40, "TTL heartbeats"),
      n("gw2", "Gateway Cluster", "infra", 1160, 200, "recipient side"),
      n("bob", "Recipient Device", "client", 1390, 200),
      n("mq", "Delivery Queue", "queue", 700, 330, "offline replay"),
      n("mon", "Monitoring", "infra", 930, 330),
    ],
    edges: [
      { from: "alice", to: "gw1", label: "encrypted msg", flow: true },
      { from: "gw1", to: "seq", label: "assign seq" },
      { from: "seq", to: "store", label: "persist", flow: true },
      { from: "store", to: "gw1", label: "✓ ack sender", dashed: true },
      { from: "store", to: "route", label: "notify", flow: true },
      { from: "route", to: "presence", label: "where is bob?" },
      { from: "route", to: "gw2", label: "push", flow: true },
      { from: "gw2", to: "bob", label: "deliver", flow: true },
      { from: "bob", to: "gw2", label: "delivered ✓", dashed: true },
      { from: "route", to: "mq", label: "offline → queue" },
      { from: "mq", to: "gw2", dashed: true, label: "on reconnect" },
      { from: "presence", to: "mon", dashed: true },
    ],
    flows: [
      { id: "wa-msg", path: ["alice", "gw1", "seq", "store", "route", "gw2", "bob"], color: "#16A34A", speed: 340 },
    ],
  },

  archNotes: [
    "'Sent ✓' means PERSISTED, not transmitted. Store-before-ack is the zero-loss contract.",
    "Per-conversation sequencers assign strict order; different conversations sequence in parallel — no global lock exists.",
    "Gateways are dumb pipes holding sockets; ALL state lives in the routing/presence/store tier, so gateways restart freely.",
    "Group messages fan out through the same pipeline per recipient; supergroups cap membership or switch to shared-topic delivery.",
  ],

  requestFlow: [
    { title: "Send message", detail: "Alice's client sends ciphertext + client_msg_id over its persistent socket. The id lets the server dedupe retries for free.", edge: ["alice", "gw1"], tag: "idempotent" },
    { title: "Sequence assignment", detail: "The conversation's sequencer atomically increments next_seq. Order is now locked for this conversation.", edge: ["gw1", "seq"], nodes: ["seq"] },
    { title: "Persist BEFORE acknowledging", detail: "The message row (conv_id, seq, ciphertext) commits durably. Only now does the sender's UI show ✓.", edge: ["seq", "store"], tag: "zero-loss point" },
    { title: "Route to recipient", detail: "Routing asks presence: which gateway holds Bob right now? Answer resolves via TTL heartbeat registry.", edge: ["store", "route"], nodes: ["presence"] },
    { title: "Deliver or queue", detail: "Online: push frames to Bob's socket. Offline: the message already lives in the store; delivery queues nothing but a wake-up.", edge: ["route", "gw2"], nodes: ["bob"], tag: "<500ms p99" },
    { title: "Receipts flow back", detail: "Bob's device emits delivered/read markers — themselves messages, deduped by (user, conv, seq). Everyone's ticks update eventually.", edge: ["bob", "gw2"], tag: "eventual" },
    { title: "Reconnect sync", detail: "Bob's train exits a tunnel; his client sends per-conversation last-seen seqs and replays exactly the delta. Nothing was lost, nothing duplicated.", edge: ["mq", "gw2"], nodes: ["mq"], tag: "delta replay" },
  ],

  deepDives: [
    {
      topic: "Ordering without global consensus",
      body: "Global message ordering across billions of conversations would serialize everything through one bottleneck. WhatsApp orders WITHIN conversations only — which is the only order humans can perceive.",
      bullets: [
        "Each conversation maps to one sequencer partition (consistent hashing by conv_id).",
        "(conv_id, seq) uniqueness is enforced by the store — conflicts impossible by construction.",
        "Cross-conversation ordering (delivery receipts racing messages) is handled by seq comparison, not clocks.",
      ],
    },
    {
      topic: "The connection lifecycle IS the product",
      body: "Mobile networks drop sockets constantly. Architecture assumes constant reconnects rather than fighting them.",
      bullets: [
        "Heartbeats every ~30s; presence TTL ~90s self-heals silent deaths.",
        "Reconnect storm after tower outage: jittered backoff prevents gateway pile-ons.",
        "Presence updates batched through pub/sub — broadcasting 500M states raw is impossible.",
      ],
    },
    {
      topic: "Encryption shapes the pipeline",
      body: "E2E encryption means servers store ciphertext — no server-side search, no server-side rendering. Infrastructure choices follow.",
      bullets: [
        "Media blobs uploaded encrypted; servers see opaque bytes + keys travel in messages.",
        "Server-side features (search, anti-spam on content) are structurally limited — metadata analysis remains possible and is the honest discussion.",
      ],
    },
  ],

  failures: [
    {
      id: "gateway-crash",
      title: "Gateway cluster loses 20K sockets",
      fail: ["gw1"],
      story: "A bad deploy drops connections mid-flight. Senders with unacked messages retry; recipients reconnect and sync.",
      reroute: ["alice", "seq", "store", "route", "gw2", "bob"],
      metrics: [
        { label: "In-flight messages", before: "~0 lost", after: "~0 lost", bad: false },
        { label: "Reconnect burst", before: "baseline", after: "20K sockets", bad: true },
        { label: "Delivery delay", before: "<500ms", after: "2–8s during drain", bad: true },
      ],
      lessons: [
        "Store-before-ack means crashed gateways lose NOTHING durable — retries just work.",
        "Jittered reconnect backoff turns a stampede into a smooth ramp.",
        "Graceful drain (stop accepting, flush deliveries) precedes any intentional restart.",
      ],
    },
    {
      id: "seq-partition",
      title: "Sequencer partition becomes unavailable",
      fail: ["seq"],
      story: "One conversation-shard's sequencer hangs. Messages for THOSE conversations stall; all others continue untouched.",
      metrics: [
        { label: "Blast radius", before: "—", after: "~1/N of conversations", bad: true },
        { label: "Other conversations", before: "healthy", after: "healthy", bad: false },
        { label: "Stuck senders see", before: "instant ✓", after: "clock spinner", bad: true },
      ],
      lessons: [
        "Partitioned sequencers isolate failure horizontally — no global outage.",
        "Raft-replicated sequencer partitions promote a follower within seconds.",
        "Clients show honest pending state; the message sends on promotion (no loss, brief delay).",
      ],
    },
    {
      id: "presence-flap",
      title: "Presence registry under heartbeat flood",
      fail: [],
      degrade: ["presence"],
      story: "A network event causes mass reconnects; heartbeat writes overwhelm the registry and routing decisions go stale.",
      metrics: [
        { label: "Registry p99", before: "2ms", after: "800ms", bad: true },
        { label: "Misroutes (fallback queue)", before: "0.1%", after: "4%", bad: true },
        { label: "Messages lost", before: "0", after: "0", bad: false },
      ],
      lessons: [
        "Stale presence is SAFE: fallback to store-and-forward queue delivery.",
        "Shard presence by user hash; flaps localize.",
        "Debounce flapping devices (min interval between status flips).",
      ],
    },
  ],

  scaling: [
    { stage: "10K users", action: "One gateway + Postgres + polling", why: "Prove the receipt UX before scaling craft." },
    { stage: "1M", action: "Gateway fleet + presence registry + WS push", why: "Polling dies here; connection affinity begins." },
    { stage: "50M", action: "Partitioned sequencers + dedicated message stores", why: "Ordering and durability need horizontal homes." },
    { stage: "500M", action: "Multi-region gateways; store replication async per region", why: "Latency is physics; durability contracts documented per data class." },
  ],

  tradeoffs: [
    {
      a: "Store-and-forward (durable-first)",
      b: "Direct relay (lowest latency)",
      dims: [
        { name: "Loss guarantee", a: "None once acked", b: "Possible loss on crash", winner: "a" },
        { name: "Online p99 latency", a: "+~20ms persistence hop", b: "Minimal", winner: "b" },
        { name: "Offline support", a: "Native (replay by seq)", b: "Requires separate inbox anyway", winner: "a" },
        { name: "Storage cost", a: "All messages retained", b: "Minimal", winner: "b" },
      ],
      verdict: "Chat without the zero-loss promise isn't chat. Pay the 20ms — it buys the entire offline model for free.",
    },
  ],

  alternatives: [
    "MQTT broker fabric (EMQX-style) for connection management — proven pattern, less control over ordering semantics.",
    "Kafka as the message backbone per-conversation-partition — great durability story, tail latency harder at 500M sockets.",
    "CRDT-based mesh sync (Matrix-style federation) — different product goals entirely.",
  ],

  interview: {
    prompt: "Design WhatsApp: 500M concurrent users, zero message loss, per-conversation ordering, offline sync.",
    stages: [
      { name: "Requirements", expect: "Define the ✓ contract precisely ('persisted', not 'delivered'); ordering scope = per conversation." },
      { name: "Estimation", expect: "5M peak msg/s and 50K connects/s shape gateway and registry sizing." },
      { name: "Protocol sketch", expect: "client_msg_id for idempotency; server-assigned seq; sync-by-last-seen for catch-up." },
      { name: "Architecture", expect: "Dumb gateways, smart routing tier, durable store on the critical ack path, TTL presence." },
      { name: "Deep dive", expect: "Explain reconnect storms: backoff+jitter, delta replay, and why stale presence fails safe." },
      { name: "Failure", expect: "Sequencer partition loss = partial, recoverable, honest-to-user — walk the promotion." },
    ],
  },

  production: [
    "Receipt dedup tables grow forever — compact by (conversation, epoch) bucketing.",
    "Connection auth tokens rotate WITHOUT dropping sockets (zero-downtime credential refresh).",
    "Abuse detection runs on metadata (rates, graph patterns), not content, given E2E.",
  ],

  costs: [
    "Socket-holding gateways are RAM-bound: connection count ÷ per-pod ceiling drives fleet math.",
    "Message retention is the biggest storage line — define and enforce retention windows per region/law.",
  ],
};

export const SOCIAL_SYSTEMS: CaseStudy[] = [instagram, twitter, whatsapp];
