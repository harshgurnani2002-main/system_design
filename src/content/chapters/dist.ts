import type { Chapter } from "@/lib/types";

export const distChapters: Chapter[] = [
  {
    slug: "distributed-systems",
    track: "distributed",
    num: 1,
    title: "Distributed Systems",
    subtitle:
      "CAP, PACELC, consistency models, quorums, Raft consensus, clocks and partitions — what actually breaks when one machine becomes twenty.",
    minutes: 35,
    skills: ["distributed", "architecture"],
    concepts: ["cap-theorem", "quorum", "consensus", "raft", "eventual-consistency", "linearizability", "split-brain", "vector-clock"],
    blocks: [
      {
        t: "p",
        md: "A single machine is honest: it sees every operation in order, and when it dies, everything stops cleanly. Distribute state across machines and you inherit three new physics: **messages get lost or delayed**, **nodes crash at arbitrary moments**, and **there is no shared clock**. Distributed systems is the discipline of building correct behavior on top of those facts.",
      },
      { t: "h", text: "CAP and its fine print" },
      {
        t: "diagram",
        height: 250,
        caption:
          "A partition splits the cluster. Choosing C rejects writes on the minority side; choosing A accepts them and diverges data.",
        graph: {
          nodes: [
            { id: "c1", label: "Client A", kind: "client", x: 20, y: 30 },
            { id: "n1", label: "Node 1", sub: "accepts writes", kind: "data", x: 230, y: 30 },
            { id: "n2", label: "Node 2", sub: "unreachable", kind: "data", x: 560, y: 30, state: "down" },
            { id: "c2", label: "Client B", kind: "client", x: 790, y: 30 },
            { id: "n3", label: "Node 3", sub: "minority side", kind: "data", x: 560, y: 150 },
            { id: "x", label: "✕ network cut", kind: "infra", x: 395, y: 95 },
          ],
          edges: [
            { from: "c1", to: "n1" },
            { from: "n1", to: "n2", dashed: true },
            { from: "n2", to: "c2" },
            { from: "n3", to: "n2", dashed: true },
          ],
        },
      },
      {
        t: "p",
        md: "**CAP:** under a network partition you choose Consistency (reject operations that can't be replicated) or Availability (serve locally and reconcile later). The fine print everyone misses: partitions are rare, so CAP governs a small slice of life. **PACELC** completes the picture — *else*, even without partitions, you trade **L**atency against **C**onsistency. Waiting for quorum agreement is slower than answering from one node. Every replicated store is a point on this spectrum.",
      },
      { t: "h", text: "Consistency models, ranked by strength" },
      {
        t: "table",
        head: ["Model", "Guarantee", "Example"],
        rows: [
          ["Linearizability", "Every op appears atomic, in real time, as if one machine", "ZooKeeper etcd; bank balances"],
          ["Sequential", "Ops appear in some global order matching each process's order", "Single leader DB reads from primary"],
          ["Causal", "Effects visible after causes; concurrent ops may reorder", "Comments showing reply after parent"],
          ["Eventual", "Replicas converge if writes stop", "DNS, Cassandra default, like counts"],
        ],
      },
      {
        t: "callout",
        kind: "info",
        title: "Read-your-writes is usually the real requirement",
        md: "Users don't need linearizability everywhere — they need to see their own actions immediately. Session stickiness to the primary after a write, or version tokens checked against replicas, delivers perceived consistency at eventual-consistency prices. Choose the weakest model each feature tolerates.",
      },
      { t: "h", text: "Quorums: how Dynamo-style stores decide" },
      {
        t: "code",
        lang: "text",
        title: "N replicas, write W, read R",
        code: `N = 3 replicas per key

W = 2, R = 2   → W + R > N: reads overlap a latest write → consistent-ish
W = 1, R = 1   → fast, but stale reads and lost updates possible
W = 3, R = 1   → durable writes, fast reads
Sloppy quorums + hinted handoff → stay available during node loss (Dynamo)`,
      },
      {
        t: "p",
        md: "Quorum intersection reduces conflict windows but doesn't eliminate them — concurrent writers to the same key still need resolution: last-write-wins by timestamp (clocks lie!), or application merge, or CRDTs. This is why 'tunable consistency' requires an engineer who understands what tuning means.",
      },
      { t: "h", text: "Consensus: Raft in five minutes" },
      {
        t: "diagram",
        height: 240,
        caption:
          "Raft: elect a leader by majority; replicate log entries; commit once a majority stores them. Majorities can't overlap → split-brain impossible.",
        graph: {
          nodes: [
            { id: "l", label: "Leader", sub: "term 3 · appends entries", kind: "app", x: 300, y: 20 },
            { id: "f1", label: "Follower A", sub: "acked idx 42", kind: "app", x: 120, y: 160 },
            { id: "f2", label: "Follower B", sub: "acked idx 42", kind: "app", x: 480, y: 160 },
            { id: "f3", label: "Follower C", sub: "partitioned · term 2 stale", kind: "app", x: 760, y: 160, state: "warn" },
          ],
          edges: [
            { from: "l", to: "f1", label: "AppendEntries" },
            { from: "l", to: "f2", label: "AppendEntries" },
            { from: "l", to: "f3", dashed: true },
          ],
        },
      },
      {
        t: "list",
        ordered: true,
        items: [
          "**Election:** followers randomize election timeouts (150–300ms). No heartbeat? Become candidate, increment term, request votes. Majority wins → leader.",
          "**Replication:** leader appends client commands to its log, ships AppendEntries; entry commits once a majority acks; leader then applies and notifies clients.",
          "**Safety:** a candidate must have the most up-to-date log to win — committed entries survive leadership changes. The old leader's uncommitted tail gets overwritten safely.",
          "**Partitioned minority:** C's writes never commit (no majority); when the partition heals it truncates and catches up. Clients on the minority side time out — that's CAP choosing C.",
        ],
      },
      {
        t: "callout",
        kind: "info",
        title: "Where you'll meet Raft without knowing",
        md: "etcd (Kubernetes' brain), Consul, CockroachDB, TiKV, RethinkDB, Kafka's KRaft mode. You rarely implement it — but you MUST understand its two hard limits: commits need a live majority (lose 2 of 3 = read-only cluster), and latency includes a quorum round trip (cross-region majorities are slow).",
      },
      { t: "h", text: "Time is a lie" },
      {
        t: "table",
        head: ["Clock", "Property", "Use"],
        rows: [
          ["Physical (NTP)", "Wall time; can jump, skew ~ms", "Timestamps for humans, TTLs"],
          ["Logical (Lamport)", "Counter capturing happened-before", "Ordering events without wall time"],
          ["Vector clock", "Per-node counters → detects concurrency vs causality", "Dynamo conflict detection"],
          ["Hybrid (HLC)", "Wall + logical hybrid", "CockroachDB, Yugabyte serializable ops"],
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: last-write-wins deletes a payment",
        md: "Two datacenters accept updates to the same account row during a slow network. Both stamp 'last write' with local clocks — DC-B's clock is 400ms ahead. On reconciliation, DC-B's older-but-later-stamped balance overwrites DC-A's newer debit. Money vanishes. **Lesson:** LWW is only safe when losing a concurrent update is acceptable. For anything financial: single-writer-per-key design or CRDT/merge semantics.",
      },
      { t: "h", text: "Failure handling toolkit" },
      {
        t: "list",
        items: [
          "**Timeouts** — the only way to distinguish 'slow' from 'dead'. Derive from measured p99.9, not folklore.",
          "**Retries with exponential backoff + jitter** — `delay = min(cap, base × 2^attempt)` plus randomness. Jitter prevents synchronized retry waves (the thundering herd). Cap total attempts; make retries visible in metrics.",
          "**Idempotency keys** — retries are only safe if repeating has no extra effect. Pass a client-generated key; server dedupes.",
          "**Circuit breaker** — after N consecutive failures, fail fast locally for a cool-down instead of queuing more victims. Three states: closed → open → half-open probe.",
          "**Bulkhead** — isolate resource pools per dependency so one drowning integration can't drain the whole ship.",
          "**Hedged requests** — send a duplicate to another replica at p95; cuts tail latency when duplicates are safe (read-only work).",
        ],
      },
      {
        t: "code",
        lang: "python",
        title: "Retry with backoff + jitter + circuit breaker",
        code: `import random, time

def call_with_retry(fn, *, attempts=4, base=0.05, cap=1.0):
    for i in range(attempts):
        try:
            return fn()
        except TransientError:
            if i == attempts - 1:
                raise
            delay = min(cap, base * 2 ** i)
            time.sleep(random.uniform(0, delay))   # full jitter

class Breaker:
    def __init__(self, threshold=5, cooldown=10):
        self.failures, self.open_until = 0, 0
    def allow(self):
        return time.monotonic() >= self.open_until
    def record(self, ok):
        self.failures = 0 if ok else self.failures + 1
        if self.failures >= 5:
            self.open_until = time.monotonic() + 10`,
      },
    ],
    quiz: [
      {
        id: "ds-q1",
        q: "During a network partition, a system continues accepting writes on both sides and reconciles later. Which did it choose?",
        options: ["Consistency over availability", "Availability over consistency", "Linearizability", "It violated CAP"],
        correct: [1],
        explain:
          "Accepting writes on both sides keeps serving (availability) while risking divergence (consistency) until reconciliation. That's the A side of CAP's partition choice — a perfectly valid business decision for e.g. shopping carts, catastrophic for bank ledgers.",
      },
      {
        id: "ds-q2",
        q: "Raft cluster of 5, region A holds 3 nodes, region B holds 2. Region A fails entirely. What happens?",
        options: [
          "Region B promotes itself and continues",
          "No majority remains — cluster cannot commit; it stays read-only/unavailable rather than split-brain",
          "Both regions serve writes independently",
          "Automatic re-election across regions restores service",
        ],
        correct: [1],
        explain:
          "Consensus needs a live majority (3 of 5). Region B has 2 — no quorum, no commits, by design: refusing to diverge IS the safety property. This is why production deployments place voters carefully (e.g., 2/2/1 with a witness).",
      },
      {
        id: "ds-q3",
        q: "Why add jitter to exponential backoff?",
        options: [
          "To reduce average latency",
          "To prevent synchronized retry waves from many clients re-overloading the recovering service",
          "Because TCP requires it",
          "To prioritize important clients",
        ],
        correct: [1],
        explain:
          "Without jitter, all clients that failed together retry together — recreating the spike that caused the failure. Randomized delays spread load smoothly across the recovery window.",
      },
      {
        id: "ds-q4",
        q: "A service shows p99 latency climbing, connection pool exhaustion, and errors on ONE downstream dependency. Other endpoints are healthy. Best first response?",
        options: [
          "Restart all service pods",
          "Open the circuit breaker on that dependency and shed its traffic with graceful fallback",
          "Scale the whole service 3×",
          "Increase timeouts to 60s",
        ],
        correct: [1],
        explain:
          "One sick dependency shouldn't consume the whole fleet's threads/pools. Circuit breaking isolates the blast radius (bulkhead principle); scaling everything treats symptoms expensively; longer timeouts deepen queueing collapse.",
      },
      {
        id: "ds-q5",
        q: "Which statement about vector clocks is TRUE?",
        options: [
          "They provide exact wall-clock timestamps",
          "They can tell whether two versions are causally ordered or genuinely concurrent",
          "They replace the need for quorum writes",
          "They only work with three nodes",
        ],
        correct: [1],
        explain:
          "Comparing vector clocks yields 'A before B' or 'concurrent'. Concurrency signals a real conflict needing merge/resolution — far better information than LWW's silent overwrite.",
      },
    ],
    exercise: {
      prompt:
        "Implement a minimal Raft-style leader election (no log replication) for 3–5 simulated nodes over UDP or in-process channels. Kill the leader; measure election time. Then partition the minority and verify it never accepts writes. Finally remove jitter from timeouts and observe election storms.",
      hints: [
        "Randomize timeout in [T, 2T]; start with T=300ms.",
        "Track terms everywhere; ignore stale-term messages.",
        "The MIT 6.824 diagrams are your reference — implement from the paper's Figure 2.",
      ],
    },
  },
];
