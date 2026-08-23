import type { CaseStudy } from "@/lib/caseTypes";

const n = (id: string, label: string, kind: CaseStudy["architecture"]["nodes"][number]["kind"], x: number, y: number, sub?: string) => ({
  id,
  label,
  kind,
  x,
  y,
  ...(sub ? { sub } : {}),
});

/* ================================================================== */
/*  YOUTUBE                                                            */
/* ================================================================== */

const youtube: CaseStudy = {
  slug: "youtube",
  name: "YouTube",
  tagline: "Video at planetary scale: upload pipelines, transcoding fleets, adaptive streaming and recommendation gravity.",
  category: "Media",
  difficulty: "Expert",
  minutes: 38,

  problem: [
    "An hour of content is uploaded every second. Each upload must become a dozen renditions (resolutions/bitrates), ship to a CDN with points of presence in every metro, and start playing within a click — while recommendations decide which of billions of videos anyone sees next.",
    "Video changes every rule: bytes are enormous, latency tolerance is different (startup time matters more than total time), storage is append-mostly, and the transcoding pipeline is embarrassingly parallel but brutally expensive.",
  ],

  requirements: {
    functional: [
      "Upload video (any size) with resumable/chunked transfer",
      "Transcode to multiple resolutions & bitrates (ladder: 240p→4K)",
      "Stream with adaptive bitrate (switch quality mid-play seamlessly)",
      "Views, likes, comments, subscriptions, watch-history",
      "Recommendations personalized per user",
      "Live streaming variant (segment ingest, HLS/DASH delivery)",
    ],
    nonFunctional: [
      "500M+ hours watched daily; startup <2s p90 globally",
      "Upload durability 11-nines; transcode completes <24h p99",
      "Rebuffer ratio <1% of watch time on broadband",
      "CDN offload >95% of bytes from origin",
    ],
  },

  capacity: [
    { label: "Hours uploaded/min", value: "~60+", note: "≈ 1 hour/second" },
    { label: "Daily active viewers", value: "1B+" },
    { label: "Streams/sec peak", value: ">10M concurrent", note: "global evenings" },
    { label: "Storage growth/day", value: "1–2PB raw", note: "before transcoding multiplier" },
    { label: "Egress", value: "tens of Tbps", note: "CDN absorbs ~all" },
    { label: "Transcode compute", value: "~100K core-hours/day", note: "dominant cost driver" },
  ],

  api: [
    { method: "POST", path: "/uploads (resumable session)", desc: "Chunked resumable protocol — survive mobile networks" },
    { method: "POST", path: "/videos/{id}/publish", desc: "Finalize metadata; enqueues transcode DAG" },
    { method: "GET", path: "/videos/{id}/manifest.mpd", desc: "DASH manifest describing the bitrate ladder" },
    { method: "GET", path: "/segments/{id}/{bitrate}/{seg}.m4s", desc: "2–4s media segments — the unit of playback & caching" },
    { method: "POST", path: "/events/playback", desc: "Watch-time telemetry driving QoE + recommendations" },
  ],

  dataModel: [
    { name: "videos", fields: "id, channel_id, title, duration_s, status(raw|transcoding|ready)", note: "status machine drives pipeline" },
    { name: "renditions", fields: "video_id, bitrate_kbps, resolution, segment_pattern", note: "the ladder manifest references these" },
    { name: "watch_events", fields: "user_id, video_id, ts, position_s, device", note: "append-only firehose → recsys training" },
    { name: "channel_subs", fields: "user_id, channel_id, notify_level" },
  ],

  architecture: {
    nodes: [
      n("creator", "Creator", "client", 20, 120),
      n("up", "Upload Service", "app", 230, 120, "resumable chunks"),
      n("raw", "Object Store (raw)", "data", 450, 40),
      n("tc", "Transcode Fleet", "app", 680, 200, "spot autoscaled"),
      n("meta", "Metadata DB", "data", 450, 320, "sharded SQL"),
      n("pack", "Packager", "app", 910, 200, "DASH/HLS manifests"),
      n("cdn", "CDN", "cache", 1140, 200, "segments"),
      n("viewer", "Viewer", "client", 1360, 320),
      n("rec", "Recsys Trainer", "app", 1140, 430, "watch events"),
      n("kf", "Event Pipeline", "queue", 910, 430, "playback telemetry"),
      n("mon", "Monitoring", "infra", 1360, 90),
    ],
    edges: [
      { from: "creator", to: "up", label: "chunked PUT", flow: true },
      { from: "up", to: "raw", flow: true },
      { from: "up", to: "meta", label: "register" },
      { from: "meta", to: "tc", label: "enqueue DAG", dashed: true },
      { from: "tc", to: "pack", label: "renditions", flow: true },
      { from: "pack", to: "cdn", label: "push segments", flow: true },
      { from: "viewer", to: "cdn", label: "ABR playback", flow: true },
      { from: "cdn", to: "raw", dashed: true, label: "miss → origin" },
      { from: "viewer", to: "kf", label: "telemetry" },
      { from: "kf", to: "rec" },
      { from: "rec", to: "meta", dashed: true },
      { from: "pack", to: "mon", dashed: true },
    ],
    flows: [
      { id: "yt-upload", path: ["creator", "up", "raw"], color: "#2563EB", speed: 300 },
      { id: "yt-watch", path: ["viewer", "cdn"], color: "#16A34A", speed: 380 },
    ],
  },

  archNotes: [
    "The transcode DAG is a fan-out/fan-in: one input → N parallel encodes (per ladder rung) → packager assembles manifests. Spot fleets make it affordable.",
    "Segments (2–4s) are the universal currency: caching, caching keys, ABR switching and prefetch all operate on segments, never whole files.",
    "Playback telemetry is a first-class product: it trains recommendations AND measures QoE (startup, rebuffers) that gates deploys.",
  ],

  requestFlow: [
    { title: "Resumable upload", detail: "Creator's client PUTs 8MB chunks with offsets. A dropped train-tunnel connection resumes at byte N — no restart.", edge: ["creator", "up"], tag: "survives flaky nets" },
    { title: "Raw object lands", detail: "Chunks assemble into the raw master in object storage; metadata row flips status → transcoding.", edge: ["up", "raw"], nodes: ["raw"] },
    { title: "Parallel transcode", detail: "Each ladder rung (720p@3Mbps … 2160p@20Mbps) encodes independently across spot VMs. Failure of one rung retries alone.", edge: ["tc", "pack"], tag: "embarrassingly parallel" },
    { title: "Package & publish", detail: "Packager writes DASH manifest referencing all renditions; status → ready. The video is now a set of immutable segments.", edge: ["meta", "tc"], nodes: ["pack"] },
    { title: "Viewer presses play", detail: "Player fetches manifest, picks entry bitrate by heuristic, requests first segments from the nearest CDN edge.", edge: ["viewer", "cdn"], tag: "<2s startup target" },
    { title: "Adaptive switching", detail: "Throughput probes adjust requested bitrate per segment. WiFi→cellular handoff drops resolution without stalling.", nodes: ["cdn"], tag: "per-segment decision" },
    { title: "Telemetry loop", detail: "Every play event streams into Kafka → recsys trainers overnight. Tomorrow's homepage learns from tonight's watching.", edge: ["kf", "rec"], nodes: ["rec"] },
  ],

  deepDives: [
    {
      topic: "Why segments, not files",
      body: "Adaptive streaming requires changing quality MID-video. That's only possible if the unit of transfer is small enough to switch between.",
      bullets: [
        "Player downloads segment k at 1080p, decides segment k+1 should be 480p — seamless.",
        "CDN cache keys include rendition+segment: popular segments hit >99% at edges.",
        "Byte-range tricks (CMAF) let audio+video interleave for even faster start.",
      ],
    },
    {
      topic: "Transcoding economics",
      body: "Compute is the cost center. Ladders are chosen jointly for quality-per-bit AND encode cost.",
      bullets: [
        "Spot/preemptible fleets with checkpoint-retry per rung cut cost 60–80%.",
        "Per-title encoding: complex content gets more rungs/bitrates than talking-head video.",
        "Newer codecs (AV1) save ~30% bandwidth but transcode slower — staged rollout by popularity.",
      ],
    },
    {
      topic: "Cold start vs rebuffer tradeoff",
      body: "Players can start fast at low quality or probe longer for higher entry quality. Every product tunes this curve differently.",
      bullets: [
        "Startup budget ~2s p90: begin at conservative bitrate, ramp aggressively.",
        "Throughput estimation uses harmonic mean of recent segments, damped against spikes.",
        "Latency-sensitive live streams invert priorities: low-latency HLS trades stability for freshness.",
      ],
    },
  ],

  failures: [
    {
      id: "transcode-backlog",
      title: "Transcode fleet capacity collapses (spot reclaim)",
      fail: [],
      degrade: ["tc"],
      story: "Cloud provider reclaims 70% of spot capacity during a regional event. Uploads succeed but videos sit 'processing' for hours.",
      reroute: ["meta", "tc", "pack", "cdn"],
      metrics: [
        { label: "Time-to-ready p50", before: "8 min", after: "3.5 hrs", bad: true },
        { label: "Creator complaints", before: "baseline", after: "spike", bad: true },
        { label: "Viewing experience", before: "normal", after: "normal", bad: false },
      ],
      lessons: [
        "Mix spot with on-demand floor capacity sized for SLA-critical fraction.",
        "Priority queue: live events & monetized creators preempt cat videos.",
        "Publish 'processing' status honestly to creators instead of silence.",
      ],
    },
    {
      id: "cdn-origin-storm",
      title: "CDN misconfiguration → origin flood",
      fail: [],
      degrade: ["cdn"],
      story: "A bad cache-rule deploy sets TTL=0 for one content category. Every viewer request misses to origin simultaneously.",
      metrics: [
        { label: "Origin egress", before: "2% of total", after: "900× baseline", bad: true },
        { label: "Edge hit ratio", before: "97%", after: "31%", bad: true },
        { label: "Startup time", before: "1.2s", after: "6s+", bad: true },
      ],
      lessons: [
        "Cache-config changes ride the same canary/rollback rails as code.",
        "Origin shield tier absorbs miss storms even when edges misbehave.",
        "Alert on origin egress anomalies — it's the earliest single metric of cache disaster.",
      ],
    },
  ],

  scaling: [
    { stage: "10K users", action: "Direct file serving + ffmpeg cron", why: "Validate product before infrastructure." },
    { stage: "1M", action: "Object storage + basic ladder + CDN", why: "Bytes leave your servers forever." },
    { stage: "100M", action: "Segment-based ABR + multi-CDN + per-title encoding", why: "Global QoE requires edge intelligence." },
    { stage: "1B+", action: "Regional transcoding, codec rollout rings, recsys flywheel", why: "Cost per bit and engagement become the same optimization." },
  ],

  tradeoffs: [
    {
      a: "HLS (Apple lineage)",
      b: "DASH (open standard)",
      dims: [
        { name: "Device reach", a: "Universal incl. iOS/Safari", b: "Everything except old Safari", winner: "tie" },
        { name: "Latency modes", a: "LL-HLS maturing", b: "Low-latency mode matured earlier", winner: "b" },
        { name: "Tooling/ecosystem", a: "Extremely broad", b: "Broad, slightly smaller", winner: "a" },
      ],
      verdict: "Real products ship BOTH manifests from the same segments — packaging is cheap, player reach is not negotiable.",
    },
  ],

  alternatives: [
    "WebRTC-based delivery for ultra-low-latency interactive streams (different product: webinars/live shopping).",
    "Peer-assisted distribution (P2P overlays) — cost dream, NAT/reliability nightmare; niche wins only.",
  ],

  interview: {
    prompt: "Design YouTube: upload-to-watch pipeline for 1B daily viewers with global QoE targets.",
    stages: [
      { name: "Requirements", expect: "Separate creator path (throughput) from viewer path (latency); define QoE metrics (startup, rebuffer)." },
      { name: "Estimation", expect: "PB/day storage, tens of Tbps egress, 100K core-hours transcode — justify CDN + spot fleets numerically." },
      { name: "Data model", expect: "Videos + renditions + append-only watch events; segments as immutable cache units." },
      { name: "Architecture", expect: "Upload→raw→parallel ladder→packager→multi-CDN; telemetry loop closing back into recsys." },
      { name: "Deep dive", expect: "Explain mid-stream quality switching mechanics and why segments enable it." },
      { name: "Failure", expect: "Spot-reclaim backlog handling with priority classes; cache-misconfig origin storm detection." },
    ],
  },

  production: [
    "Content ID / rights checks run INSIDE the pipeline before publish completes, not after.",
    "Segment URLs are signed+expiring where monetization demands it (DRM separately).",
    "Multi-CDN steering by real-time QoE, not contracts — measure startup/rebuffer per PoP continuously.",
  ],

  costs: [
    "Encode cost per minute falls with codec generation but rises with ladder height — tune per title class.",
    "Egress is the whale: interconnect deals and CDN committed use dominate financial models.",
  ],
};

/* ================================================================== */
/*  NETFLIX                                                            */
/* ================================================================== */

const netflix: CaseStudy = {
  slug: "netflix",
  name: "Netflix",
  tagline: "Stateless microservices, regional isolation, chaos engineering — streaming reliability as a discipline.",
  category: "Media",
  difficulty: "Hard",
  minutes: 32,

  problem: [
    "Netflix serves 250M+ subscribers from three cloud regions with one rule above all: the stream must not stop. Their architectural identity was forged by a database outage in 2008 that left DVDs unshipped for days — everything since optimizes for graceful degradation under partial failure.",
    "The famous pieces — stateless services, no shared databases between domains, client-side fallbacks, Chaos Monkey — are all one idea: any component may vanish at any moment and the user still watches their show.",
  ],

  requirements: {
    functional: [
      "Browse catalog, search titles, manage profiles & lists",
      "Playback with adaptive bitrate + DRM licensing",
      "Personalized rows (Top 10, Continue Watching, Because you watched…)",
      "Multi-region operation with independent survivability",
    ],
    nonFunctional: [
      "Playback start <2s; zero-rebuffer bias over max quality",
      "Region loss degrades browsing, NEVER playback of started sessions",
      "Deploy velocity: thousands of changes/day with instant rollback",
      "Open-source observability (Atlas, Mantis) instrumenting everything",
    ],
  },

  capacity: [
    { label: "Subscribers", value: "250M+" },
    { label: "Peak concurrency", value: "~15M streams", note: "evenings" },
    { label: "Egress peak", value: "~15% of internet traffic", note: "varies by region" },
    { label: "Microservices", value: "1000+", note: "team-owned boundaries" },
    { label: "Deploys/day", value: "thousands", note: "red-black rollouts" },
  ],

  api: [
    { method: "GET", path: "/browse?profile=", desc: "Assembled page: server-side row orchestration via federation" },
    { method: "POST", path: "/licensing/drm", desc: "Short-lived license tokens per device/session" },
    { method: "GET", path: "/manifest?title=&device=", desc: "Per-device manifest (codec support, DRM, CDN tokens)" },
    { method: "POST", path: "/playback-events", desc: "QoE telemetry feeding both ops and personalization" },
  ],

  dataModel: [
    { name: "titles", fields: "id, metadata_json, availability_window, artwork_refs", note: "served from EV-cache backed stores" },
    { name: "profiles", fields: "profile_id, account_id, preferences, maturity", note: "regional home region with cross-reads" },
    { name: "view_history", fields: "profile_id, title_id, position, completed", note: "Continue Watching source" },
    { name: "recommendation_features", fields: "offline-computed feature vectors per profile", note: "precomputed, served from caches" },
  ],

  architecture: {
    nodes: [
      n("dev", "Devices", "client", 20, 220),
      n("oc", "Open Connect CDN", "cache", 230, 80, "ISP-embedded appliances"),
      n("fe", "Front Gateway", "infra", 230, 360, "AWS regions"),
      n("api", "API Orchestration", "app", 450, 360, "federated rows"),
      n("auth", "Auth Service", "app", 680, 260),
      n("rec", "Personalization", "app", 680, 460, "precomputed"),
      n("drm", "License Service", "app", 900, 360),
      n("cache", "EV Cache Tier", "cache", 900, 200, "in-mem data grid"),
      n("db", "Persistent Stores", "data", 1130, 360, "per-domain"),
      n("chaos", "Chaos Automation", "infra", 1130, 520, "continuous experiments"),
      n("mon", "Atlas Telemetry", "infra", 1350, 360),
    ],
    edges: [
      { from: "dev", to: "oc", label: "video segments", flow: true },
      { from: "dev", to: "fe", label: "control plane", flow: true },
      { from: "fe", to: "api" },
      { from: "api", to: "auth", label: "session" },
      { from: "api", to: "rec", label: "row data" },
      { from: "api", to: "drm", label: "license token" },
      { from: "auth", to: "cache" },
      { from: "rec", to: "cache" },
      { from: "drm", to: "db" },
      { from: "api", to: "db", dashed: true },
      { from: "chaos", to: "api", dashed: true, label: "terminates instances" },
      { from: "api", to: "mon", dashed: true },
    ],
    flows: [
      { id: "nf-play", path: ["dev", "fe", "api", "drm", "db"], color: "#2563EB", speed: 320 },
      { id: "nf-stream", path: ["dev", "oc"], color: "#16A34A", speed: 420 },
    ],
  },

  archNotes: [
    "Open Connect Appliances sit INSIDE ISP networks: Netflix ships pre-positioned content on their own hardware — the most aggressive CDN strategy in existence.",
    "Control plane (API) and data plane (video) fail independently: losing browsing must never interrupt an in-flight stream.",
    "Every service owns its persistence; cross-domain access happens via APIs with client-side circuit breakers (Hystrix heritage → resilience4j patterns).",
  ],

  requestFlow: [
    { title: "Device boots app", detail: "Client hits regional front gateway; session validated against auth service backed by EV-cache, not disk.", edge: ["dev", "fe"], tag: "stateless check" },
    { title: "Page assembly", detail: "API orchestrator fans out to personalization + catalog services concurrently, assembling rows with per-service timeouts.", edge: ["api", "rec"], tag: "fallbacks armed" },
    { title: "Pick a title", detail: "User presses play. Client requests a manifest tailored to device codec/DRM capabilities.", edge: ["dev", "fe"], nodes: ["api"] },
    { title: "License issuance", detail: "License service validates entitlement, returns short-lived DRM token bound to this session/device pair.", edge: ["drm", "db"], nodes: ["drm"] },
    { title: "Stream from ISP closet", detail: "Segments stream from Open Connect hardware inside the user's own ISP — often <1ms network hops.", edge: ["dev", "oc"], tag: "physics won" },
    { title: "Chaos does its job", detail: "Meanwhile automation randomly kills API instances. Circuit breakers trip, fallback rows render, nobody notices.", edge: ["chaos", "api"], tag: "by design" },
  ],

  deepDives: [
    {
      topic: "Why stateless changed everything (the 2008 lesson)",
      body: "A corrupted database took Netflix down for days because state and logic were entangled. The migration to AWS + stateless services separated failure domains permanently.",
      bullets: [
        "Services hold NO session affinity; any instance serves any request.",
        "State retreats to purpose-built stores (EV-cache, Cassandra, Dynamo-style) behind each domain.",
        "Result: rolling deploys mid-day, region evacuations rehearsed quarterly.",
      ],
    },
    {
      topic: "Degradation as a product feature",
      body: "Netflix designs WHAT you see when things fail. Recommendations down? Show 'Trending Now'. Personalization down? Show generic rows ordered alphabetically.",
      bullets: [
        "Every downstream call has a typed fallback response, tested like a feature.",
        "'Continue Watching' persists locally on device as last-resort UX.",
        "Playback NEVER depends on browsing health after start.",
      ],
    },
    {
      topic: "Chaos engineering as confidence infrastructure",
      body: "You don't discover weaknesses during incidents; you schedule them. Experiments run continuously against production with blast-radius guardrails.",
      bullets: [
        "Kill instances, inject latency, black-hole AZs — automated, observed, reverted.",
        "Abort conditions tie to SLO burn; experiments stop themselves.",
        "Cultural output: engineers design for failure because failure is guaranteed to visit.",
      ],
    },
  ],

  failures: [
    {
      id: "region-evac",
      title: "Full US-East region evacuation",
      fail: ["fe", "api", "db"],
      story: "A regional cloud event removes east-coast control planes. Global steering shifts traffic west/eu; in-flight streams continue from CDN unaffected.",
      reroute: ["dev", "oc"],
      metrics: [
        { label: "Active streams", before: "15M", after: "15M", bad: false },
        { label: "Browse availability", before: "100%", after: "degraded rows", bad: true },
        { label: "New plays started", before: "baseline", after: "-8% during failover", bad: true },
      ],
      lessons: [
        "Data-plane independence means the headline metric (streams) doesn't move.",
        "Control-plane failover is practiced via continuous traffic-shifting experiments.",
        "Per-region persistent stores replicate async; entitlement checks tolerate seconds of lag.",
      ],
    },
    {
      id: "recsys-down",
      title: "Personalization service outage",
      fail: ["rec"],
      story: "The ML serving tier crashes entirely. Rows must still render — from cached and static strategies.",
      reroute: ["dev", "fe", "api", "cache"],
      metrics: [
        { label: "Row render success", before: "99.9%", after: "98%", bad: true },
        { label: "Engagement/session", before: "100%", after: "-15%", bad: true },
        { label: "Errors shown to users", before: "0", after: "0", bad: false },
      ],
      lessons: [
        "Fallback content beats error states — always have a boring answer.",
        "Precomputed features in cache tiers shrink the blast radius of model-serving failures.",
        "Measure engagement SLOs so degradation is visible in business terms.",
      ],
    },
  ],

  scaling: [
    { stage: "DVD era", action: "Monolith + relational DB", why: "It worked until it didn't — the outage forced the pivot." },
    { stage: "Cloud migration", action: "Stateless microservices + NoSQL per domain", why: "Failure isolation over elegance." },
    { stage: "Global scale", action: "Open Connect + multi-region control plane", why: "Physics: put bytes in ISPs, logic near users." },
    { stage: "Continuous", action: "Chaos automation + SLO-gated rollouts", why: "Scale is now measured in change-safety, not servers." },
  ],

  tradeoffs: [
    {
      a: "Microservices (Netflix style)",
      b: "Modular monolith",
      dims: [
        { name: "Team autonomy at 1000+ engineers", a: "Independent deploys, ownership", b: "Coordination tax grows linearly", winner: "a" },
        { name: "Small-team velocity", a: "Distributed-systems tax everywhere", b: "Refactor freely, ship faster", winner: "b" },
        { name: "Failure containment", a: "Per-service bulkheads", b: "One memory leak kills all", winner: "a" },
        { name: "Operational overhead", a: "Massive (needs platform teams)", b: "Minimal", winner: "b" },
      ],
      verdict: "Microservices buy autonomy with complexity — worth it past dozens of teams, premature below that. Copy the DISCIPLINE (statelessness, bulkheads, fallbacks) regardless of topology.",
    },
  ],

  alternatives: [
    "Single-region active/passive with fast restore — cheaper, accepts minutes of global downtime.",
    "Edge-compute control plane (serve browse from PoPs) — emerging direction for latency, adds consistency complexity.",
  ],

  interview: {
    prompt: "Design Netflix playback + browse for 250M subscribers where 'the stream never stops' is the prime directive.",
    stages: [
      { name: "Requirements", expect: "Split control/data planes up front; define degradation hierarchy for every dependency." },
      { name: "Estimation", expect: "Peak concurrency and egress justify ISP-embedded CDN; thousands of deploys/day justify statelessness." },
      { name: "Architecture", expect: "Gateway → orchestrated federated API → domain services with owned storage; DRM on the critical play path." },
      { name: "Deep dive", expect: "Walk a region evacuation: what keeps working (streams), what degrades (browse), how traffic moves." },
      { name: "Failure culture", expect: "Propose concrete chaos experiments with abort conditions tied to SLOs." },
    ],
  },

  production: [
    "DRM license endpoints are DDoS-prime targets — separate scaling and shielding from the rest.",
    "Artwork/metadata updates propagate through cache invalidations with versioned keys (no purge storms).",
    "Per-ISP throughput telemetry steers encoding ladder selection regionally.",
  ],

  costs: [
    "Open Connect capex+logistics replaces massive cloud egress bills — a rare build-over-buy win.",
    "ML serving fleets idle most of the day: batch-precompute features, serve from cheap caches.",
  ],
};

/* ================================================================== */
/*  SPOTIFY                                                            */
/* ================================================================== */

const spotify: CaseStudy = {
  slug: "spotify",
  name: "Spotify",
  tagline: "Audio streaming: event-driven personalization, offline-first clients and the economics of tiny files.",
  category: "Media",
  difficulty: "Standard",
  minutes: 26,

  problem: [
    "Music looks easier than video — files are small — but the product lives on discovery: playlists, radio, Discover Weekly. That means heavy event collection (every skip is a signal), offline batch training loops, and a catalog metadata graph (artists↔tracks↔albums) queried constantly.",
    "The distinctive challenges are event-driven personalization at scale, delivering reliable playback across spotty mobile networks (offline mode), and rights management that varies by geography.",
  ],

  requirements: {
    functional: [
      "Search & browse catalog; artist/album/playlist pages",
      "Streaming playback with gapless transitions + crossfade",
      "Playlist CRUD with real-time collaboration sync",
      "Offline downloads with expiry/licensing rules",
      "Personalized surfaces: Discover Weekly, Daily Mixes, Radio",
    ],
    nonFunctional: [
      "600M+ users; track start <1s p90",
      "Skip events ingested <5s for real-time features",
      "Offline licenses expire correctly even with clock tampering attempts",
      "Catalog metadata reads dominate: cache aggressively",
    ],
  },

  capacity: [
    { label: "MAU", value: "600M+" },
    { label: "Tracks streamed/day", value: "~4B" },
    { label: "Track starts/sec peak", value: "~80K" },
    { label: "Events/day (plays, skips…)", value: ">100B", note: "personalization fuel" },
    { label: "Catalog size", value: "~150M tracks", note: "audio ≈ 100TB-ish compressed" },
  ],

  api: [
    { method: "GET", path: "/tracks/{id}/stream-url", desc: "Signed CDN URL honoring geo/rights + offline entitlements" },
    { method: "PUT", path: "/me/player/state", desc: "Position sync across devices (continue-on-phone)" },
    { method: "POST", path: "/events/batch", desc: "Batched client events: plays, skips, completions" },
    { method: "GET", path: "/playlists/{id}", desc: "Playlist with ETag; collaborative edits via delta sync" },
  ],

  dataModel: [
    { name: "tracks", fields: "id, artist_ids[], album_id, duration_ms, popularity_score" },
    { name: "playlists", fields: "id, owner, track_list[], version, collaborators[]" , note: "version vector for merge" },
    { name: "interactions", fields: "user_id, track_id, event(play|skip|complete), ts", note: "append-only event log" },
    { name: "offline_entitlements", fields: "device_id, track_id, expires_at, license_blob" },
  ],

  architecture: {
    nodes: [
      n("app", "Mobile/Desktop", "client", 20, 160),
      n("gw", "API Gateway", "app", 220, 160),
      n("cat", "Catalog Service", "app", 430, 60, "metadata"),
      n("play", "Playback Service", "app", 430, 260, "rights · urls"),
      n("ev", "Event Ingestion", "queue", 650, 260, "Kafka"),
      n("bc", "Batch Training", "app", 870, 360, "Discover Weekly"),
      n("rt", "Realtime Features", "app", 870, 160, "recent skips"),
      n("cdns", "Audio CDN", "cache", 1090, 260),
      n("obj", "Object Storage", "data", 1300, 260, "masters"),
      n("sync", "Playlist Sync", "app", 650, 60, "CRDT-ish deltas"),
    ],
    edges: [
      { from: "app", to: "gw", flow: true },
      { from: "gw", to: "cat", label: "metadata reads", flow: true },
      { from: "gw", to: "play", label: "get stream url" },
      { from: "play", to: "cdns", label: "signed url" },
      { from: "app", to: "cdns", label: "audio bytes", flow: true },
      { from: "cdns", to: "obj", dashed: true },
      { from: "gw", to: "ev", label: "batched events", flow: true },
      { from: "ev", to: "rt", flow: true },
      { from: "ev", to: "bc", dashed: true },
      { from: "gw", to: "sync", label: "playlist deltas" },
      { from: "sync", to: "cat", dashed: true },
    ],
    flows: [
      { id: "sp-play", path: ["app", "gw", "play", "cdns"], color: "#16A34A", speed: 340 },
      { id: "sp-event", path: ["app", "gw", "ev", "rt"], color: "#EA580C", speed: 300 },
    ],
  },

  archNotes: [
    "Events are the product's nervous system: real-time consumers power immediate features (Radio queues), nightly batches train the big recommenders (Discover Weekly).",
    "Playlists sync via versioned deltas — collaborative editing without a realtime CRDT runtime, just optimistic versions and merges.",
    "Rights checks happen at URL-signing time; geo rules live there too, keeping the hot path (bytes) dumb and fast.",
  ],

  requestFlow: [
    { title: "Search & pick", detail: "Metadata reads hit heavily-cached catalog services; artist graph traversals stay sub-ms from in-memory graphs.", edge: ["gw", "cat"], tag: "cached" },
    { title: "Request playback", detail: "Playback service validates subscription + geo rights, then returns a SHORT-LIVED signed CDN URL.", edge: ["gw", "play"], tag: "rights gate" },
    { title: "Audio from edge", detail: "Track bytes stream from CDN; prefetching the next track hides network variance between songs.", edge: ["app", "cdns"], tag: "<1s start" },
    { title: "Every gesture is data", detail: "Plays, skips, seeks batch locally and flush — 100B events/day feed both realtime and offline paths.", edge: ["gw", "ev"], tag: "signal firehose" },
    { title: "Realtime ripples", detail: "Skip events update recent-behavior features instantly — your Radio adapts within this session.", edge: ["ev", "rt"], tag: "<5s effect" },
    { title: "Monday morning magic", detail: "Nightly batch jobs retrain on full history; Discover Weekly regenerates for hundreds of millions.", edge: ["ev", "bc"], tag: "batch loop" },
  ],

  deepDives: [
    {
      topic: "Two-speed personalization",
      body: "Users expect both instant reaction (skip this genre NOW) and long-horizon taste modeling (your year in review). One pipeline cannot serve both budgets.",
      bullets: [
        "Realtime lane: streaming aggregations into feature stores (minutes-fresh).",
        "Batch lane: matrix-factorization/deep models retrained daily on full history.",
        "Serving blends both scores at request time — freshness + depth.",
      ],
    },
    {
      topic: "Offline mode is a licensing problem wearing a networking costume",
      body: "Downloads must respect expiry windows, device counts and regional catalogs that can change while offline.",
      bullets: [
        "Entitlement blobs carry signed expiry; players enforce locally, servers reconcile later.",
        "Catalog changes (track removed in region X) revoke offline copies on next sync.",
        "Clock tampering handled by server-time receipts embedded in license refreshes.",
      ],
    },
  ],

  failures: [
    {
      id: "event-lag",
      fail: [],
      title: "Event pipeline backlog",
      degrade: ["ev"],
      story: "Ingestion falls behind during a viral moment; Radio stops adapting while core playback stays perfect.",
      metrics: [
        { label: "Playback health", before: "OK", after: "OK", bad: false },
        { label: "Feature freshness", before: "<5s", after: "~25 min", bad: true },
        { label: "DLQ depth", before: "0", after: "growing", bad: true },
      ],
      lessons: [
        "Decoupled consumers again: degradation isolates to intelligence features.",
        "Drop-to-sampled mode for non-critical events preserves critical ones under pressure.",
      ],
    },
  ],

  scaling: [
    { stage: "100K users", action: "Monolith + MP3s on disk + cron recommendations", why: "Ship the playlist magic early." },
    { stage: "10M", action: "Event pipeline + feature store + CDN audio", why: "Discovery becomes data-driven." },
    { stage: "100M+", action: "Two-speed personalization + offline entitlement service", why: "Freshness AND depth, plus licensing reality." },
  ],

  tradeoffs: [
    {
      a: "Batch-trained recommenders",
      b: "Realtime-only personalization",
      dims: [
        { name: "Depth of taste model", a: "Full history, high quality", b: "Recent window only", winner: "a" },
        { name: "Reaction speed", a: "Day-level cycles", b: "Seconds", winner: "b" },
        { name: "Infra complexity", a: "Two lanes to operate", b: "One hot path", winner: "b" },
      ],
      verdict: "Run both lanes blended — the industry consensus. Realtime adjusts, batch understands.",
    },
  ],

  alternatives: [
    "Third-party music APIs as catalog-of-record (licensing complexity explodes differently).",
    "On-device inference for personalization (privacy win, model-update logistics hard).",
  ],

  interview: {
    prompt: "Design Spotify streaming + Discover Weekly for 600M users with offline downloads.",
    stages: [
      { name: "Requirements", expect: "Call out two-speed personalization, offline licensing, geo-rights at URL signing." },
      { name: "Estimation", expect: "100B events/day justifies Kafka-first ingestion; 80K starts/s justifies aggressive metadata caching." },
      { name: "Architecture", expect: "Gateway → catalog/playback split; event spine feeding realtime + batch lanes; CDN for bytes." },
      { name: "Deep dive", expect: "Explain playlist collaborative sync via versioned deltas and conflict rules." },
      { name: "Failure", expect: "Event backlog scenario: what degrades (features) vs what must never (playback)." },
    ],
  },

  production: [
    "Signed URLs must be revocable for takedowns — short TTLs + denylists at edges.",
    "Skip-event schema versioning matters: models trained on drifted features silently rot.",
  ],

  costs: [
    "Audio egress is modest vs video — spend the savings on ML compute instead.",
    "Feature-store memory is the quiet line item; prune stale features quarterly.",
  ],
};

export const MEDIA_SYSTEMS: CaseStudy[] = [youtube, netflix, spotify];
