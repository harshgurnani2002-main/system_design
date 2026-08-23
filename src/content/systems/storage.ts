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
/*  GOOGLE DRIVE                                                       */
/* ================================================================== */

const googleDrive: CaseStudy = {
  slug: "google-drive",
  name: "Google Drive",
  tagline: "Metadata-first file storage: chunked resumable uploads, sharing permissions, sync protocols, versioning at consumer scale.",
  category: "Storage",
  difficulty: "Hard",
  minutes: 30,

  problem: [
    "Drive presents as a folder that follows you across devices, but the engineering lives underneath: people upload multi-gigabyte videos over hotel Wi-Fi, expect them on every screen minutes later, share them with links that must respect folder permissions, and never forgive a lost byte. Meeting that contract takes two systems wearing one trench coat — a precise metadata brain and a dumb, durable byte warehouse.",
    "The defining decisions: slice large files into content-addressed chunks so uploads resume after failures and duplicate content costs nothing; treat the metadata service as the single source of truth (a blob without metadata simply does not exist); and propagate every mutation through a change log so millions of sync clients converge without hammering the API tier.",
  ],

  requirements: {
    functional: [
      "Upload/download any file type up to 5TB with resumable, restartable transfers",
      "Folder hierarchy with moves, renames, and nested sharing inheritance",
      "Share to users, groups, or anyone-with-link; roles viewer / commenter / editor",
      "Multi-device sync with change notifications within seconds of commit",
      "Version history and trash with recovery windows",
      "Thumbnails and inline previews for common formats",
    ],
    nonFunctional: [
      "2B+ accounts; metadata reads p95 <100ms",
      "Uploads resume at chunk granularity — a multi-GB transfer never restarts from zero",
      "Committed bytes survive at eleven nines; metadata replicated synchronously in-region",
      "A committed change reaches collaborator devices in <5s typical",
      "Read availability degrades gracefully when non-critical subsystems (search, previews) fail",
    ],
  },

  capacity: [
    { label: "Registered users", value: "2B+", note: "consumer + Workspace seats" },
    { label: "Stored data", value: "~1EB", note: "exabyte class; video dominates bytes" },
    { label: "Average file size", value: "~500KB", note: "median far lower; tail reaches multi-TB" },
    { label: "Requests/day", value: "100B+", note: ">90% metadata ops, not byte transfer" },
    { label: "Average metadata QPS", value: "~1.2M", note: "100B ÷ 86,400s" },
    { label: "Peak metadata QPS", value: "~6M", note: "5× diurnal spread" },
    { label: "Chunk strategy", value: "8MB × 3 parallel", note: "≈24MB in flight per upload; the resume unit" },
    { label: "Dedup savings", value: "10–20%", note: "physical vs logical bytes; honest ceiling" },
  ],

  api: [
    { method: "POST", path: "/upload/sessions", desc: "Allocates session, chunk size (8MB), signed URL template; returns session id" },
    { method: "PUT", path: "/upload/sessions/{sid}/{seq}", desc: "Registers one chunk receipt; bytes went client-to-store via signed URL" },
    { method: "POST", path: "/upload/sessions/{sid}/commit", desc: "Atomic manifest swap — ordered chunk hashes become the new file version" },
    { method: "GET", path: "/files/{id}/content", desc: "Permission check, then 302 to short-lived signed URL(s)" },
    { method: "POST", path: "/files/{id}/shares", desc: "Grant user/group role, or mint an anyone-with-link token" },
    { method: "GET", path: "/changes?cursor=", desc: "Cursor delta feed; the fallback sync channel when push is lost" },
  ],

  dataModel: [
    { name: "files", fields: "file_id, owner_id, parent_folder, name, size, current_version", note: "sharded by file_id; the tree is self-referencing rows" },
    { name: "chunks", fields: "chunk_hash (PK), refcount, storage_key", note: "content-addressed; the hash doubles as checksum" },
    { name: "file_chunks", fields: "file_id, seq, chunk_hash", note: "ordered manifest; replay reconstructs exact bytes" },
    { name: "acl", fields: "resource_id, principal, role", note: "folders inherit downward unless overridden" },
    { name: "share_links", fields: "token, resource_id, expiry, scope", note: "capability URL checked at edge; revocable centrally" },
  ],

  architecture: {
    nodes: [
      n("clients", "Desktop / Mobile / Web", "client", 20, 240, "sync agents"),
      n("ws", "WebSocket", "infra", 250, 160, "persistent sync channels"),
      n("lb", "Load Balancer", "app", 250, 320),
      n("aclsvc", "Sharing / ACL Service", "app", 480, 80, "grants · link tokens"),
      n("gw", "API Gateway", "app", 480, 320, "auth · quotas"),
      n("meta", "Metadata Service", "app", 710, 320, "source of truth"),
      n("pg", "PostgreSQL", "data", 940, 160, "sharded by file_id"),
      n("dedup", "Dedup Index", "cache", 710, 400, "chunk hash → refcount"),
      n("store", "Object Store", "data", 1170, 240, "content-addressed chunks"),
      n("kafka", "Kafka", "queue", 1170, 400, "change.events"),
      n("mon", "Monitoring", "infra", 1400, 160),
      n("notify", "Notification Service", "app", 1400, 320, "device targeting"),
      n("searchidx", "Search Indexer", "app", 1400, 460, "names · OCR text"),
    ],
    edges: [
      { from: "clients", to: "lb", label: "HTTPS", flow: true },
      { from: "clients", to: "ws", label: "connect · subscribe" },
      { from: "ws", to: "clients", label: "push deltas", dashed: true },
      { from: "clients", to: "store", label: "chunk bytes via signed URL" },
      { from: "lb", to: "gw" },
      { from: "gw", to: "meta", protocol: "gRPC", flow: true },
      { from: "gw", to: "aclsvc", label: "share ops" },
      { from: "aclsvc", to: "pg" },
      { from: "meta", to: "pg" },
      { from: "meta", to: "dedup", label: "lookup chunk hashes", flow: true },
      { from: "dedup", to: "store", label: "write unseen chunks", flow: true },
      { from: "meta", to: "store", label: "mint signed URLs", dashed: true },
      { from: "meta", to: "kafka", label: "commit events", flow: true },
      { from: "kafka", to: "notify", flow: true },
      { from: "notify", to: "ws", label: "device push", flow: true },
      { from: "kafka", to: "searchidx", label: "index stream" },
      { from: "pg", to: "mon", dashed: true },
    ],
    flows: [
      { id: "gd-upload", path: ["clients", "lb", "gw", "meta", "dedup", "store"], color: "#2563EB", speed: 260, label: "resumable upload" },
      { id: "gd-change", path: ["meta", "kafka", "notify", "ws", "clients"], color: "#16A34A", speed: 300, label: "change propagation" },
    ],
  },

  archNotes: [
    "The metadata service is the sole source of truth: a file exists iff its metadata row does. Blobs without metadata are invisible garbage awaiting GC; metadata without blobs is an outage — never silent deletion.",
    "Bytes bypass the API tier entirely: uploads and downloads ride presigned URLs straight to/from the object store. Application servers coordinate intent; they never proxy content.",
    "Chunk hashes are content addresses — the identifier IS the checksum. Dedup, integrity verification, and crash-safe resumes are one mechanism, not three.",
    "Everything downstream consumes the same change log: sync push, search indexing, preview generation. One Kafka topic replaces millions of clients asking 'anything new?'",
    "Docs coexistence: collaborative editing runs on separate OT infrastructure. A .gdoc in Drive is a thin pointer into that world, not a synced binary.",
  ],

  requestFlow: [
    { title: "Create upload session", detail: "The client POSTs name, size, and MIME type. The metadata service allocates a session, fixes the 8MB chunk size, and returns signed URL templates. Nothing durable exists yet — the file is invisible until commit.", edge: ["clients", "lb"], nodes: ["gw"], tag: "~50ms" },
    { title: "Chunk, hash, stream", detail: "The 4GB video splits into 512 × 8MB chunks, each SHA-256 hashed locally. Three chunks upload in parallel straight to the object store — API servers never see a byte.", edge: ["clients", "store"], nodes: ["store"], tag: "512 chunks" },
    { title: "Server acks free chunks", detail: "Each chunk receipt hits the dedup index: 40 hashes already exist because this clip circulated before. Those PUTs collapse into refcount increments — zero bytes transferred.", edge: ["gw", "meta"], nodes: ["dedup"], tag: "40 skipped" },
    { title: "Commit the manifest", detail: "All chunks registered; the client commits the ordered hash list. One transaction swaps the manifest and bumps v1 → v2. The file becomes visible atomically — partial states were never observable.", edge: ["meta", "pg"], nodes: ["pg"], tag: "atomic" },
    { title: "Async derivatives", detail: "The commit event lands on Kafka. Workers generate the thumbnail, transcode a preview, and queue AV scanning. None of it blocks the uploader or the visibility of the file.", edge: ["meta", "kafka"], nodes: ["kafka"], tag: "off critical path" },
    { title: "Share link created", detail: "The owner mints an anyone-with-link share. The ACL service writes the grant plus capability token; every future open evaluates folder inheritance before honoring it.", edge: ["gw", "aclsvc"], nodes: ["aclsvc"], tag: "~30ms" },
    { title: "Collaborators see it instantly", detail: "The change event fans out through the notification service onto persistent WebSocket channels. A co-editor's machine refreshes its file listing without ever polling.", edge: ["notify", "ws"], nodes: ["ws"], tag: "<2s" },
  ],

  deepDives: [
    {
      topic: "Anatomy of a resumable upload",
      body: "Multi-GB transfers over real networks will fail repeatedly. The design goal: any interruption costs at most one 8MB chunk, and recovery requires no special protocol — just re-listing what landed.",
      bullets: [
        "Session state lives server-side: which chunk seqs arrived is queryable, so a replacement device can resume where the dead one stopped.",
        "Chunks upload out-of-order-safe with bounded concurrency; each completion is recorded independently.",
        "Only commit makes the file visible — partial uploads remain invisible garbage scheduled for GC.",
        "Client-computed hashes let the server skip transfer entirely for content it already holds.",
      ],
    },
    {
      topic: "Content addressing does triple duty",
      body: "Hashing chunks once at the client buys three properties with one mechanism. Dedup, integrity verification, and resume safety are all the same trick viewed from different angles.",
      bullets: [
        "Address = SHA-256 of bytes: identical content anywhere maps to one stored copy (the 10–20% savings).",
        "Assembly re-verifies every chunk hash — corruption is detectable but never silently served.",
        "Refcounts gate GC: a chunk dies only when no manifest references it, which is also what makes version history nearly free.",
        "Cost: hundreds of index rows per large file. Below a few MB, whole-file objects win.",
      ],
    },
    {
      topic: "Sharing: inheritance, links, evaluation",
      body: "Permissions are the product. A file inside a shared folder must respect the folder's audience, and revoking folder access must cut off children — inheritance semantics decide whether sharing composes at scale.",
      bullets: [
        "ACL rows bind principal to resource with a role; effective permission walks up the ancestor chain.",
        "Link sharing mints an opaque capability token scoped to a role with optional expiry — checked at the edge, revocable centrally.",
        "'Shared with me' views come from an inverted index per principal, maintained incrementally from change events.",
        "Deny-by-default everywhere: absence of a grant is a rejection, never a question.",
      ],
    },
  ],

  failures: [
    {
      id: "meta-shard-outage",
      title: "Metadata shard loses quorum",
      fail: ["meta"],
      story: "A rack switch partition silences one metadata shard's primary. Every file hashing to that shard vanishes from listings and opens — while its blobs sit untouched in object storage. To users, metadata loss IS data loss.",
      metrics: [
        { label: "Files reachable", before: "100%", after: "96.2%", bad: true },
        { label: "Blob integrity", before: "intact", after: "intact", bad: false },
        { label: "Tree-op errors", before: "0.01%", after: "31%", bad: true },
      ],
      lessons: [
        "Blast radius equals shard-key range: hash file ids so a shard maps to a random ~4% slice, never to one team's folder tree.",
        "Synchronous in-region replication plus automated promotion targets sub-minute recovery; async cross-region replicas absorb the worst case.",
        "Blob GC freezes whenever metadata health degrades — deleting bytes referenced by unreachable manifests is how 'temporary outage' becomes 'permanent deletion'.",
      ],
    },
    {
      id: "push-channel-loss",
      title: "WebSocket fleet restart drops all subscriptions",
      fail: [],
      degrade: ["ws"],
      reroute: ["clients", "lb", "gw", "meta"],
      story: "A bad deploy recycles every sync channel at once. Clients detect the disconnect and fall back to cursor-based polling against /changes — sync slows from seconds to poll-interval minutes, but no change is missed.",
      metrics: [
        { label: "Change latency", before: "<2s", after: "~90s avg", bad: true },
        { label: "Live sockets", before: "60M", after: "0", bad: true },
        { label: "Metadata QPS", before: "1.1M", after: "1.5M", bad: true },
      ],
      lessons: [
        "Push is an optimization; cursor-based sync is the correctness floor. Build the floor first.",
        "Resubscribe with jittered backoff — a synchronized reconnect stampede would DDoS your own gateway fleet.",
        "Alert on socket-count drop rate, not just latency: mass disconnect is visible before users complain.",
      ],
    },
    {
      id: "dedup-index-drift",
      title: "Dedup index drift points at wrong bytes",
      fail: [],
      degrade: ["dedup"],
      reroute: ["meta", "store"],
      story: "A migration bug corrupts hash-to-storage-key mappings for a slice of chunks. Assembly fetches wrong bytes — but the end-to-end checksum mismatch trips instantly, the chunk is re-read from canonical storage, and affected files queue for rebuild. Users see nothing.",
      metrics: [
        { label: "Checksum mismatches", before: "0/day", after: "~200/hr", bad: true },
        { label: "User-visible corruption", before: "0", after: "0", bad: false },
        { label: "Rebuild backlog", before: "0", after: "45K objects", bad: true },
      ],
      lessons: [
        "Content addressing makes verification free: the address IS the checksum, checked on every assembly.",
        "The dedup index is a cache, not truth — the manifest's hash list defines the file.",
        "Scrubbers reconcile refcounts continuously; GC pauses on any anomaly rather than racing corruption.",
      ],
    },
  ],

  scaling: [
    { stage: "10K users", action: "Single Postgres + local-disk blobs", why: "Ship the product; learn what people actually store." },
    { stage: "500K", action: "Blobs evicted to object storage; DB keeps metadata only", why: "Disk-full deploys and backup windows force the split." },
    { stage: "10M", action: "Content-addressed chunking + dedup index", why: "Multi-GB uploads need resumability; the storage bill needs dedup." },
    { stage: "500M", action: "Shard metadata by file_id; Kafka change log; socket fleet", why: "One SQL box cannot serve 100B requests/day; sync needs push." },
    { stage: "2B+", action: "Cell-based metadata regions; async cross-region GC", why: "Blast-radius isolation and jurisdictional placement dominate." },
  ],

  tradeoffs: [
    {
      a: "Content-addressed chunks",
      b: "Whole-file objects",
      dims: [
        { name: "Flaky-network uploads", a: "Resume at last 8MB chunk", b: "Restart the multi-GB transfer", winner: "a" },
        { name: "Dedup potential", a: "Cross-user, block-level: 10–20%", b: "Whole-file matches only — rare", winner: "a" },
        { name: "Metadata volume", a: "~130 rows per 1GB file", b: "One row per file", winner: "b" },
        { name: "Small-file overhead", a: "Chunk bookkeeping dominates", b: "Natural single-object fit", winner: "b" },
      ],
      verdict: "Hybrid in production: chunk large files, store small ones whole — content-address both so dedup and integrity stay uniform. Below a few MB the chunk machinery costs more than it saves.",
    },
    {
      a: "Push notifications",
      b: "Periodic polling",
      dims: [
        { name: "Change latency", a: "<2s typical", b: "Poll-interval bound", winner: "a" },
        { name: "Battery cost", a: "One socket serves all changes", b: "Wakeups scale with poll rate", winner: "a" },
        { name: "Server cost", a: "Socket fleets + pub/sub fan-out", b: "Stateless, cache-friendly", winner: "b" },
        { name: "Failure behavior", a: "Needs a poll fallback anyway", b: "Degrades gracefully by construction", winner: "b" },
      ],
      verdict: "Run both: sockets for instant UX, a cheap cursor poll as the safety net. Engineer the poll path first — push is the accelerator, never the foundation.",
    },
  ],

  alternatives: [
    "End-to-end encrypted zero-knowledge storage — kills server-side dedup, previews, and search; a different product, not a strictly better one.",
    "Whole-file objects with byte-range deltas — far simpler metadata, but resumability granularity and dedup savings evaporate.",
    "Peer-to-peer sync mesh (Syncthing-style) — removes server costs, forfeits link sharing, versioning, and any global namespace.",
  ],

  interview: {
    prompt: "Design Google Drive: multi-GB resumable uploads, granular sharing, and multi-device sync for 2B users.",
    stages: [
      { name: "Requirements", expect: "Split the world into a metadata plane and a byte plane; state budgets explicitly — bytes are never lost, sync is eventual within seconds." },
      { name: "Estimation", expect: "100B+ requests/day mostly metadata reads sizes the METADATA tier, not bandwidth; 8MB chunks × concurrency sets bytes in flight per upload." },
      { name: "API & Data", expect: "Session-based resumable uploads ending in an atomic manifest commit; chunks keyed by hash; cursor-based /changes endpoint." },
      { name: "Architecture", expect: "Metadata service + CAS blob store + dedup index + change bus; bytes bypass the API tier via signed URLs." },
      { name: "Deep dive", expect: "Walk the dedup race: two users upload identical chunks concurrently — both registrations land idempotently, refcount reconciles, nobody waits on a lock." },
      { name: "Failure & scale", expect: "Metadata shard death = partial outage with intact blobs; push loss falls back to polling; close on GC safety under metadata degradation." },
    ],
  },

  production: [
    "Refcount reconciliation is the dedup system's immune system — run it continuously and page on drift velocity, not absolute counts.",
    "Signed URL TTLs in minutes, not hours; link revocation beats token expiry via edge deny lists.",
    "Isolate preview/transcode workers: a malicious or exotic file may crash them, never the upload path.",
    "TTL abandoned upload sessions aggressively or the sessions table becomes the next incident.",
  ],

  costs: [
    "Object-storage capacity and egress dominate the bill — dedup savings apply directly to the largest line item.",
    "Metadata shards are small but ferocious: RAM-heavy instances with read replicas; caches hide most reads but not commits.",
    "Preview fleets scale on upload volume; spot capacity absorbs nightly waves, on-demand headroom covers viral spikes.",
  ],
};

/* ================================================================== */
/*  DROPBOX                                                            */
/* ================================================================== */

const dropbox: CaseStudy = {
  slug: "dropbox",
  name: "Dropbox",
  tagline: "Delta sync engineering: block-level diffs, conflict resolution without merge hell, LAN sync — the client as a first-class system.",
  category: "Storage",
  difficulty: "Standard",
  minutes: 24,

  problem: [
    "Dropbox's product is synchronization, and its hardest engineering is making sync boring: save a file on your laptop and every other device converges within seconds — transferring as few bytes as possible, losing nothing when devices disagree. The server sees opaque files; understanding formats is someone else's job. That refusal to merge IS the architecture.",
    "Three mechanisms carry the design: block-level delta sync (only changed blocks travel), an append-only namespace journal giving every device a cursor to replay, and rename-on-conflict — when two devices disagree, the system preserves both versions under different names rather than guessing.",
  ],

  requirements: {
    functional: [
      "Sync folders across devices; changes propagate as block-level deltas",
      "Work fully offline; queued changes upload on reconnect, in order",
      "Share files/folders with links and per-member permissions",
      "Version history and deleted-file restore (30 days; longer on paid tiers)",
      "LAN sync: fetch blocks from peers on the same network",
    ],
    nonFunctional: [
      "700M registered users; active edits sync in seconds typical, <60s p95",
      "ZERO silent data loss — conflicts surface visibly, never resolved by overwrite",
      "Typical document edit transfers <1% of the file's bytes",
      "Clients tolerate arbitrary network partitions and resume without operator care",
    ],
  },

  capacity: [
    { label: "Registered users", value: "700M" },
    { label: "Paying subscribers", value: "~20M", note: "~3% conversion funds the infra" },
    { label: "Delta efficiency", value: "<1% of bytes", note: "typical doc edit vs shipping the file" },
    { label: "Block size", value: "4MB fixed", note: "fixed offsets; rolling-hash variants evaluated, shelved" },
    { label: "Physical block store", value: "~1EB class", note: "Magic Pocket fleet, after dedup" },
    { label: "Metadata QPS shape", value: "change-scan dominated", note: "per-device cursors replay journals" },
    { label: "LAN sync savings", value: "30–70% office WAN", note: "blocks served by peers on the same network" },
  ],

  api: [
    { method: "GET", path: "/list?cursor=", desc: "Delta: all namespace changes since cursor; holds long-poll open when empty" },
    { method: "PUT", path: "/blocks/{hash}", desc: "Idempotent block upload; immediate 200 if the hash already exists" },
    { method: "POST", path: "/commit", desc: "Append journal entry guarded by base_version precondition; 409 on stale base" },
    { method: "GET", path: "/blocks/{hash}", desc: "Fetch block; may redirect to a LAN-sync peer or CDN-fronted store" },
    { method: "POST", path: "/devices/register", desc: "Issue durable device_id + initial cursor; enroll into notify targeting" },
  ],

  dataModel: [
    { name: "namespaces", fields: "ns_id, root_owner, kind(personal|team)", note: "the shard key — everything sync-scoped lives beneath it" },
    { name: "journal", fields: "ns_id, seq, device_id, op, ts", note: "append-only; seq doubles as every device's sync cursor" },
    { name: "blocks", fields: "block_hash (PK), refcount, storage_key", note: "global content-addressed pool across all users" },
    { name: "devices", fields: "device_id, user_id, last_cursor, last_seen", note: "notify targeting + delta computation input" },
    { name: "conflict_events", fields: "file_id, losing_device, renamed_to, ts", note: "audit trail of every rename decision" },
  ],

  architecture: {
    nodes: [
      n("dc", "Desktop Client", "client", 20, 240, "watcher · indexer · uploader"),
      n("lb", "Load Balancer", "app", 250, 240),
      n("mc", "Mobile / Laptop", "client", 250, 400, "second devices"),
      n("redis", "Redis", "cache", 480, 80, "hot ns · cursors"),
      n("meta", "Metadata Service", "app", 480, 240, "append-only journal"),
      n("pg", "PostgreSQL", "data", 710, 160, "sharded by namespace"),
      n("blocksrv", "Block Server", "app", 710, 320, "verify · store blocks"),
      n("kafka", "Kafka", "queue", 940, 160, "delta stream"),
      n("s3", "Object Store", "data", 940, 320, "S3-style block storage"),
      n("notify", "Notify Service", "app", 1170, 160, "device targeting"),
      n("mon", "Monitoring", "infra", 1400, 240),
    ],
    edges: [
      { from: "dc", to: "lb", label: "HTTPS", flow: true },
      { from: "lb", to: "meta", label: "metadata ops" },
      { from: "lb", to: "blocksrv", label: "block bytes", flow: true },
      { from: "meta", to: "redis", label: "cache fill", dashed: true },
      { from: "meta", to: "pg" },
      { from: "meta", to: "blocksrv", label: "grant block access" },
      { from: "blocksrv", to: "s3", label: "PUT / GET blocks", flow: true },
      { from: "meta", to: "kafka", label: "journal deltas", flow: true },
      { from: "kafka", to: "notify", flow: true },
      { from: "notify", to: "mc", label: "push wakeups", flow: true },
      { from: "mc", to: "lb", label: "pull deltas" },
      { from: "kafka", to: "mon", dashed: true, label: "consumer lag" },
    ],
    flows: [
      { id: "db-edit-upload", path: ["dc", "lb", "meta", "blocksrv", "s3"], color: "#2563EB", speed: 260, label: "changed-block upload" },
      { id: "db-delta-download", path: ["kafka", "notify", "mc", "lb", "blocksrv", "s3"], color: "#16A34A", speed: 300, label: "delta to second device" },
    ],
  },

  archNotes: [
    "The desktop client is a first-class distributed system: watcher, indexer, upload scheduler, and a sync state machine run locally — the server trusts none of them blindly.",
    "Namespace journals are append-only; a device's last-seen seq is the ONLY per-device sync state the server stores.",
    "Blocks are globally content-addressed: uploading a block that exists anywhere in the system costs a metadata write, not bytes.",
    "Conflict policy is deliberately boring — first committer wins, the loser is renamed '(conflicted copy)'. No merge logic exists below the application layer.",
    "Magic Pocket: at exabyte scale Dropbox moved block storage in-house. Egress economics and latency control beat cloud rent.",
  ],

  requestFlow: [
    { title: "Save triggers the watcher", detail: "User saves a 200MB PSD. The watcher notices the mtime change; the indexer re-hashes fixed 4MB blocks and compares against its local snapshot: ~5MB actually differs.", nodes: ["dc"], tag: "5MB of 200MB" },
    { title: "Only changed blocks upload", detail: "Five blocks travel to the block server with their hashes. The server verifies checksums, stores new content, bumps refcounts — duplicates are acknowledged, not rewritten.", edge: ["lb", "blocksrv"], nodes: ["blocksrv"], tag: "~5MB wire" },
    { title: "Journal commit bumps version", detail: "The metadata service appends the new block list to the namespace journal, guarded by a base_version precondition. v412 → v413, transactionally.", edge: ["meta", "pg"], nodes: ["pg"], tag: "precondition held" },
    { title: "Delta published", detail: "The commit emits one delta event to Kafka, keyed by namespace: 'ns 8821 now at v413.' The event is bytes-small regardless of file size.", edge: ["meta", "kafka"], nodes: ["kafka"], tag: "one small event" },
    { title: "Other devices woken", detail: "The notify service targets the account's device list and pushes the delta summary to the phone and the second laptop: fetch whatever is newer than your cursor.", edge: ["notify", "mc"], nodes: ["mc"], tag: "<2s" },
    { title: "Second laptop pulls 5MB", detail: "It replays the journal diff, names the five missing block hashes, and downloads exactly those — reassembling the file locally. 200MB logical change, 5MB physical.", edge: ["mc", "lb"], nodes: ["blocksrv"], tag: "5MB, not 200MB" },
    { title: "Conflict: simultaneous edits", detail: "Two laptops edited from v412. First commit wins as v413; the second is rejected on stale base_version and its content becomes 'design (conflicted copy)'. No merge, no loss, no silence.", edge: ["lb", "meta"], nodes: ["meta"], tag: "rename, never merge" },
  ],

  deepDives: [
    {
      topic: "Fixed-size blocks vs rolling boundaries",
      body: "rsync popularized rolling-hash chunking to find block boundaries at arbitrary offsets. Dropbox shipped fixed 4MB blocks anyway — a decision about CPU economics and predictability, not ignorance.",
      bullets: [
        "Fixed blocks hash in microseconds; rolling hashes examine nearly every byte offset on every save — real cost on phones.",
        "Most real edits append or rewrite tails, where fixed blocks capture essentially the whole delta win.",
        "Mid-file inserts shift every subsequent fixed block — rolling chunking wins there, which is why backup tools (restic, borg) chose it.",
        "Determinism matters operationally: identical input producing identical block sets across client versions keeps dedup honest.",
      ],
    },
    {
      topic: "Rename-on-conflict: correctness by refusal",
      body: "Merging requires understanding file formats. A sync layer that sees opaque bytes cannot merge responsibly, so Dropbox refuses — and refusal is lossless.",
      bullets: [
        "Commits carry a base_version precondition: stale writers get rejected, not overwritten.",
        "The loser's full content becomes 'name (conflicted copy)'; the user — the only party who knows the intent — resolves.",
        "Last-writer-wins was explicitly rejected: an hour of edits vanishing without trace is unforgivable; a renamed copy is merely annoying.",
        "Products that genuinely merge (Sheets, Paper) layer CRDT/OT ABOVE sync, never inside it.",
      ],
    },
    {
      topic: "LAN sync: the office shortcut",
      body: "A popular 2GB file spreads through an office like gossip: the first laptop fetches from the WAN, everyone else fetches from each other.",
      bullets: [
        "Discovery via local broadcast; peers prove account identity with scoped tokens before serving a single block.",
        "Blocks fetched over LAN cost zero egress and arrive orders of magnitude faster.",
        "The trust boundary stays sharp: a peer serves only blocks whose hashes the requester can already name — no listings, no crawling.",
      ],
    },
  ],

  failures: [
    {
      id: "journal-split-brain",
      title: "Journal primary partitions from its quorum",
      fail: ["meta"],
      degrade: ["pg"],
      story: "A network partition isolates the journal shard's primary mid-write-storm. The deposed primary keeps accepting commits on one side while the quorum elects a successor on the other — two 'authoritative' orderings for one namespace. Unfenced, this forks history and silently drops whichever branch loses reconciliation: exactly the failure mode conflicted-copy naming exists to contain.",
      metrics: [
        { label: "Journal heads", before: "1", after: "2", bad: true },
        { label: "Updates at risk", before: "0", after: "~40 files", bad: true },
        { label: "Device sync errors", before: "0", after: "spike", bad: true },
      ],
      lessons: [
        "Fencing tokens (epochs) let storage reject a deposed primary's appends — split-brain becomes split-ATTEMPT.",
        "On healing, forked branches reconcile as conflicts: both sides survive as copies; nothing silently loses.",
        "Client-side base_version preconditions catch what the server failed to prevent — defense in depth is the product promise.",
      ],
    },
    {
      id: "blockserver-loss",
      title: "Half the block servers lose their AZ",
      fail: [],
      degrade: ["blocksrv"],
      reroute: ["lb", "blocksrv", "s3"],
      story: "An AZ evacuation removes half the block-server fleet. Upload throughput craters and queues grow; downloads continue almost untouched — reads shed across survivors and the object store itself.",
      metrics: [
        { label: "Upload throughput", before: "2GB/s", after: "600MB/s", bad: true },
        { label: "Download p95", before: "85ms", after: "90ms", bad: false },
        { label: "Pending-block queue", before: "shallow", after: "1.2M blocks", bad: true },
      ],
      lessons: [
        "Read/write isolation: downloads must never queue behind upload capacity — separate pools or admission control.",
        "Clients retry with jitter and resume at block granularity, so a 20-minute brownout costs throughput, not correctness.",
        "Evening edit-waves burst harder than traffic charts suggest; provision write headroom for the peak, not the mean.",
      ],
    },
  ],

  scaling: [
    { stage: "10K users", action: "One SQL database + filesystem blocks", why: "Prove sync correctness before scaling anything." },
    { stage: "1M", action: "Namespaces sharded; blocks to S3", why: "Journal scans need tenant isolation; blobs outgrow disks." },
    { stage: "50M", action: "Cursor-delta API + notify fleet", why: "Per-device change scans become the dominant QPS." },
    { stage: "300M", action: "Magic Pocket: in-house exabyte block store", why: "Egress rent and latency control justify owning hardware." },
    { stage: "700M", action: "Journals tiered hot/cold; LAN sync federated", why: "Change scans dominate cost; offices hold the locality." },
  ],

  tradeoffs: [
    {
      a: "Fixed-size blocks",
      b: "Content-defined chunking (rolling hash)",
      dims: [
        { name: "Client CPU", a: "Negligible — hash 4MB spans", b: "Rolling window over most bytes", winner: "a" },
        { name: "Mid-file insert handling", a: "Shifts every later block", b: "Boundaries re-align locally", winner: "b" },
        { name: "Cross-version determinism", a: "Guaranteed — trivial math", b: "Varies with algorithm/version", winner: "a" },
        { name: "Append-heavy real edits", a: "Captures nearly all delta savings", b: "No advantage for pure appends", winner: "a" },
      ],
      verdict: "Dropbox shipped fixed blocks: cheap, deterministic, and sufficient because real edits skew append-y. Rolling chunking earns its CPU only when mid-file inserts dominate — backup tools, not sync tools.",
    },
    {
      a: "Server-authoritative ordering",
      b: "Client-side merge attempts",
      dims: [
        { name: "Correctness reasoning", a: "One journal, one order", b: "Every device becomes a database", winner: "a" },
        { name: "Client complexity", a: "Thin state machine + cursor", b: "Merge engine per platform", winner: "a" },
        { name: "Data-loss exposure", a: "None — losers renamed", b: "Merge bugs corrupt silently", winner: "a" },
        { name: "Collaborative UX ceiling", a: "'Conflicted copy' moments", b: "Seamless when merges succeed", winner: "b" },
      ],
      verdict: "Authority plus rename-on-conflict keeps sync auditable and lossless. Merge is a product feature built above the sync layer (Docs, Sheets) — never a property OF the sync layer.",
    },
  ],

  alternatives: [
    "CRDT-native sync engine — eliminates conflict renames for formats it owns, at the price of format awareness the sync layer deliberately refuses.",
    "Full rolling-hash chunking everywhere — better insert behavior, worse battery/CPU on mobile clients; revisit only if telemetry shows mid-file inserts dominating.",
    "P2P block exchange (BitTorrent/Resilio style) — LAN sync already captures the locality win without NAT traversal or new security surfaces.",
  ],

  interview: {
    prompt: "Design Dropbox's sync engine: block-level delta sync across devices for 700M users with zero silent data loss.",
    stages: [
      { name: "Requirements", expect: "Define correctness FIRST: no silent loss ever, staleness in seconds, offline-first clients. Delta efficiency (<1% transfer) is the differentiator." },
      { name: "Estimation", expect: "Delta math dominates: 5MB changed in a 200MB file means 2.5% transferred; device count × change scans drives metadata sizing." },
      { name: "Protocol", expect: "Cursor-per-device against an append-only journal; content-addressed blocks; base_version preconditions on every commit." },
      { name: "Architecture", expect: "Fat client (watcher / indexer / uploader), thin trusting-nothing server; strict separation of metadata and block planes." },
      { name: "Deep dive", expect: "Narrate simultaneous edits end-to-end: first commit wins, second draws 409, renames to conflicted copy — and defend why last-writer-wins was rejected." },
      { name: "Failure & scale", expect: "Split-brain journals need fencing tokens and conflict-preserving reconciliation; AZ loss throttles uploads while downloads continue untouched." },
    ],
  },

  production: [
    "Block GC runs on refcounts with a tombstone window; in-flight commits pin blocks past naive refcount-zero.",
    "Watcher debounce rules ignore editor temp/lock files (Office's ~$ artifacts) or every autosave becomes a sync storm.",
    "Conflicted-copy names embed device and timestamp, capped per file — runaway loops must not manufacture thousands of copies.",
    "Cursor checkpoints persist at account level so reinstalls resume instead of rescanning entire histories.",
  ],

  costs: [
    "Owning block storage (Magic Pocket) trades capex for egress control — at exabyte scale the rent math flips decisively.",
    "Client engineering across six platforms is the quiet mega-line-item: sync bugs burn support headcount, not just compute.",
    "Notify long-poll fleets are RAM-cheap but connection-count-bound; efficiency comes from wakeup batching, not instance size.",
  ],
};

export const STORAGE_SYSTEMS: CaseStudy[] = [googleDrive, dropbox];
