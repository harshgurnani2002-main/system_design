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
/*  AMAZON                                                             */
/* ================================================================== */

const amazon: CaseStudy = {
  slug: "amazon",
  name: "Amazon",
  tagline: "Planet-scale commerce: catalog, search, cart, inventory, orders, payments, recommendations and reviews — an infinite read plane wrapped around a provably correct money path.",
  category: "Commerce",
  difficulty: "Expert",
  minutes: 38,

  problem: [
    "Commerce at this scale is two problems wearing one trench coat. The first is reading: hundreds of millions of shoppers browse a ~600-million-item catalog through search and product pages, where latency, cache hit rates and freshness budgets dominate every decision. The second is writing: checkout is a legally binding financial transaction spread across payment authorization, inventory commitment and fulfillment promises — exactly the territory where 'just wrap it in a transaction' stops working, because the participants are independent services that share no database.",
    "Prime Day compresses both problems into hours: order rates spike ten to twenty times baseline, flash deals turn individual SKUs into single-row write hotspots, and every millisecond of checkout friction is measurable revenue. The architecture's job is to keep the browsing plane effectively infinite and happily seconds-stale while making the money path boring, auditable and correct under any failure — including failures of third-party payment processors.",
  ],

  requirements: {
    functional: [
      "Browse and search a ~600M-item catalog; product detail page serves <200ms p95",
      "Cart persists across devices; guest carts merge deterministically on login",
      "Checkout creates an order with payment authorization and inventory commitment as one logical operation",
      "Order lifecycle tracking: pending, confirmed, shipped, delivered, refunded",
      "Personalized recommendations on home and product pages",
      "Customer reviews with rating aggregation and fraud filtering before display",
    ],
    nonFunctional: [
      "300M+ monthly shoppers; search p95 <300ms at 150K QPS peaks",
      "Zero double charges — payment idempotency is absolute, not best-effort",
      "Zero oversell of physical stock; the last unit of a deal is decided atomically",
      "Checkout success >99.9%; every degraded mode preserves the cart above all else",
      "Recommendations and review aggregates may lag minutes — eventual consistency spent only off the money path",
    ],
  },

  capacity: [
    { label: "Monthly active users", value: "300M+", note: "unique shoppers per month" },
    { label: "Visits/day", value: "~1.5B", note: "~17K entry events/sec averaged" },
    { label: "Peak order rate", value: "~100K orders/min", note: "Prime Day record, sustained for hours" },
    { label: "Catalog size", value: "~600M items", note: "+ millions of seller listings daily" },
    { label: "Peak search QPS", value: "~150K", note: "search is ~40% of all API calls" },
    { label: "Cart operations/sec", value: "~500K peak", note: "reads outnumber writes ~20:1" },
    { label: "Order metadata/day", value: "~30M orders ≈ 60GB", note: "+ ledger entries per reservation" },
    { label: "Media growth/day", value: "~15TB", note: "seller uploads + derived image variants" },
  ],

  api: [
    { method: "GET", path: "/products/{id}", desc: "Product detail aggregate; served from cache, availability badge best-effort" },
    { method: "GET", path: "/search?q=&page=&filters=", desc: "Inverted-index recall plus learned ranking; facet counts included" },
    { method: "POST", path: "/cart/items", desc: "Add item to session cart; guest cart merges into user cart on login" },
    { method: "POST", path: "/checkout", desc: "Header Idempotency-Key REQUIRED; creates PENDING order and runs the saga" },
    { method: "GET", path: "/orders/{id}", desc: "Status timeline assembled from sharded order rows and projected events" },
    { method: "POST", path: "/inventory/check", desc: "Atomic availability check with optional reservation quote for SKUs" },
  ],

  dataModel: [
    { name: "products", fields: "product_id, seller_id, title, brand, price, attributes(jsonb), image_keys[]", note: "attribute soup denormalized for PDP reads; normalized only inside seller tooling" },
    { name: "cart_items", fields: "cart_id(user/session), product_id, qty, price_at_add, saved_for_later", note: "Redis hash is primary; Postgres shadow copy via write-behind survives cache flushes" },
    { name: "orders", fields: "order_id(snowflake), customer_id, status, totals, currency, placed_at", note: "sharded by customer_id; transitions driven by saga + events, never ad-hoc UPDATEs" },
    { name: "order_items", fields: "order_id, line_no, sku, qty, unit_price, fulfillment_node", note: "co-located with the parent order row so confirmation is ONE shard-local transaction" },
    { name: "inventory_ledger", fields: "sku, ts, reason(reserve|decrement|restock|cancel), order_id, delta, expires_at", note: "append-only; available(sku) = SUM(delta); reservations carry expiry and are swept" },
  ],

  architecture: {
    nodes: [
      n("c", "Clients", "client", 20, 240),
      n("cdn", "CDN", "cache", 240, 80),
      n("gw", "API Gateway", "app", 240, 300, "authn · quotas"),
      n("srch", "Search Service", "app", 470, 60, "recall · rank"),
      n("cat", "Catalog Service", "app", 470, 170, "detail pages · price"),
      n("cart", "Cart Service", "app", 470, 300),
      n("ord", "Order Service", "app", 470, 420, "saga orchestrator"),
      n("es", "Search Index Cluster", "data", 700, 60, "inverted index shards"),
      n("s3", "Object Store", "data", 700, 170, "product media"),
      n("redis", "Redis", "cache", 700, 300, "cart sessions · holds"),
      n("pay", "Payment Service", "app", 700, 420, "vault · PSP adapters"),
      n("inv", "Inventory Service", "app", 700, 540, "reserve · ledger"),
      n("kafka", "Kafka", "queue", 930, 300, "order.events"),
      n("pg", "PostgreSQL", "data", 930, 540, "orders sharded by customer"),
      n("mon", "Monitoring", "infra", 1160, 300),
    ],
    edges: [
      { from: "c", to: "cdn", label: "images · static", flow: true },
      { from: "c", to: "gw", label: "HTTPS", flow: true },
      { from: "gw", to: "srch", protocol: "gRPC", label: "queries", flow: true },
      { from: "gw", to: "cat", protocol: "gRPC" },
      { from: "gw", to: "cart", label: "add · view cart", flow: true },
      { from: "cart", to: "redis", label: "load / save cart", flow: true },
      { from: "srch", to: "es", label: "term → postings", flow: true },
      { from: "cat", to: "s3", label: "media ingest" },
      { from: "cdn", to: "s3", dashed: true, label: "origin pull" },
      { from: "gw", to: "ord", label: "checkout", flow: true },
      { from: "ord", to: "pay", label: "authorize", flow: true },
      { from: "pay", to: "ord", dashed: true, label: "signed webhook" },
      { from: "ord", to: "inv", label: "reserve items", flow: true },
      { from: "ord", to: "pg", label: "commit order + items" },
      { from: "ord", to: "kafka", label: "OrderPlaced", flow: true },
      { from: "kafka", to: "inv", dashed: true, label: "async decrement" },
      { from: "inv", to: "pg", label: "ledger append" },
      { from: "kafka", to: "mon", dashed: true },
    ],
    flows: [
      { id: "amz-cart", path: ["c", "gw", "cart", "redis"], color: "#2563EB", speed: 300, label: "add to cart" },
      { id: "amz-order", path: ["c", "gw", "ord", "kafka", "inv", "pg"], color: "#EA580C", speed: 220, label: "order saga → events" },
      { id: "amz-search", path: ["c", "gw", "srch", "es"], color: "#16A34A", speed: 320, label: "search read path" },
    ],
  },

  archNotes: [
    "Two planes, one platform: the browsing plane (catalog, search, images) is cacheable and happily seconds-stale; the money plane (orders, payments, inventory) is strongly consistent within a shard and event-driven across services.",
    "Idempotency keys are minted client-side at checkout start and enforced at the gateway AND the order service — double-click protection is a protocol contract, not UI hygiene.",
    "Kafka is the commerce spine: one OrderPlaced event feeds fulfillment, notifications, analytics and recommendation training; no consumer can stall the checkout path.",
    "Inventory truth is an append-only ledger; every visible number — cart badges, search facets, PDP counts — is a rebuildable projection of it.",
    "Search serves staleness on purpose: availability badges lag by seconds and add-to-cart revalidates authoritatively. Freshness is bought only where money moves.",
  ],

  requestFlow: [
    { title: "Add to cart", detail: "POST /cart/items carries product id and quantity. The Cart Service revalidates price and availability against the catalog cache, then writes a Redis hash keyed by session id with a 30-day sliding TTL. Guest carts ride a device cookie and merge into the user cart on login. A write-behind job persists carts to Postgres so a Redis flush costs warmth, never data.", edge: ["gw", "cart"], nodes: ["cart", "redis"], tag: "~15ms p95" },
    { title: "Checkout opens — the key is minted", detail: "The client SDK generates a UUID when the checkout page loads and sends it as an Idempotency-Key header on every checkout call and retry. The gateway rejects requests missing one; the Order Service stores key → response snapshot in Redis with a 24h TTL BEFORE doing any work. A double-click or flaky-network retry replays the stored response instead of creating a second order.", edge: ["gw", "ord"], nodes: ["gw"], tag: "Idempotency-Key" },
    { title: "Order created PENDING", detail: "Order Service validates the cart server-side — catalog prices were only hints until now — computes totals and writes the order row with status=PENDING to the customer's shard. The order now exists even if every later step fails, which is precisely what gives compensations something concrete to compensate.", edge: ["ord", "pg"], nodes: ["pg"], tag: "state machine" },
    { title: "Payment authorization", detail: "Payment Service pulls the tokenized instrument from the vault — card numbers never touch our fleet, keeping PCI scope tiny — and asks the PSP to AUTHORIZE only. The issuing bank places a hold on funds; nothing is captured until the order truly confirms. Authorization buys a multi-day charge window.", edge: ["ord", "pay"], nodes: ["pay"], tag: "auth ≠ capture" },
    { title: "Webhook confirms", detail: "Card networks answer asynchronously. The PSP calls a signed webhook; Payment Service verifies the HMAC signature, dedupes on the transaction id and advances the saga idempotently. The user's spinner is driven by THIS callback, never by the original checkout HTTP response. A reconciliation poller compares local PENDING state against the PSP API in case webhooks go missing.", edge: ["pay", "ord"], nodes: ["pay"], tag: "async webhook" },
    { title: "Inventory reservation", detail: "The saga instructs the Inventory Service to RESERVE stock: a ledger entry (reason=reserve, expires_at=+15min) is appended under a conditional atomic UPDATE that refuses to drive availability below zero. Stock is pinned for the minutes checkout is live — not while items merely sit in carts.", edge: ["ord", "inv"], nodes: ["inv"], tag: "soft hold" },
    { title: "Commit and emit OrderPlaced", detail: "Order + items flip to CONFIRMED in one shard-local transaction, and OrderPlaced lands on Kafka. Fulfillment, notification emails, analytics and recommendation trainers each consume independently — none of them can stall checkout, and each retries or dead-letters on its own terms.", edge: ["ord", "kafka"], nodes: ["kafka"], tag: "<50ms fan-out" },
    { title: "Async decrement; search stays fast", detail: "The inventory consumer converts the reservation into a definitive decrement asynchronously. Meanwhile the read plane is untouched by any of it: GET /search recalls candidates from inverted-index shards and re-ranks by a learned scorer (relevance, margin, delivery promise), serving availability badges that are seconds stale by design.", edge: ["kafka", "inv"], nodes: ["es"], tag: "eventual" },
  ],

  deepDives: [
    {
      topic: "Why there is no distributed transaction",
      body: "Checkout touches payment, inventory and order state across independent services. Two-phase commit would make them correct together — and fragile together. Production systems replace atomicity with orchestrated sagas: each step is a local transaction paired with a named, business-level compensation.",
      bullets: [
        "What kills 2PC: a crashed coordinator leaves participants holding locks; one slow PSP freezes every checkout in flight; latency multiplies by voting rounds.",
        "The saga: authorize payment → reserve inventory → commit order. Compensation runs in reverse: void auth, release reservation, mark order FAILED.",
        "Compensations are business actions, not undo logs — an emailed confirmation cannot be rolled back, so notification steps go LAST in the chain.",
        "Every step is idempotent by construction (idempotency key + entity state), so retries after crashes converge instead of duplicating.",
        "Saga progress is persisted state: a crashed orchestrator resumes from disk rather than re-deciding what already happened.",
      ],
    },
    {
      topic: "Inventory is an append-only ledger",
      body: "'How many are left?' looks like a counter; treating it as one is how oversells happen. The ledger pattern records every stock change as an immutable fact and derives availability from history.",
      bullets: [
        "available(sku) = SUM(delta) over ledger rows with reasons: restock, reserve, decrement, cancel-release.",
        "Reservations carry expires_at; a sweeper converts dead reservations into cancel entries, releasing phantom holds.",
        "The decrement itself is a conditional atomic UPDATE ... SET available = available - n WHERE available >= n — the database, not the application, owns the invariant.",
        "Hot deal SKUs shard the projection into N counter buckets summed on read; one Prime Deal row would otherwise serialize an entire event.",
        "Projections (Redis counts, search badges) rebuild from the ledger at any time; continuous reconciliation alarms on drift.",
      ],
    },
    {
      topic: "Search: inverted index meets ranking",
      body: "Recall finds the ten thousand candidates matching a query; ranking chooses the twenty that earn the page. Different data structures, different freshness budgets, one API surface.",
      bullets: [
        "The inverted index maps normalized terms to sorted posting lists, sharded by document; queries fan out and merge top-k per shard.",
        "Ranking blends textual relevance with price competitiveness, margin, delivery promise and stock state via a learned scorer.",
        "Index updates stream from catalog change events; publication-to-searchable lag is an SLO measured in seconds.",
        "Facet counts and 'frequently bought together' are precomputed, never aggregated per query.",
        "Stale availability inside results is accepted UX debt — the authoritative check happens at add-to-cart and costs one conditional update.",
      ],
    },
    {
      topic: "The recommendations event loop",
      body: "Recommendations form a closed loop: behavior generates events, events train models, models shape impressions, impressions generate behavior. The loop must never touch the buy path synchronously.",
      bullets: [
        "Impressions, clicks, add-to-carts and purchases land on Kafka; stream jobs build session features and co-view graphs.",
        "Batch trainers refresh embeddings nightly; an online experimentation layer tunes within guardrails.",
        "Serving reads a precomputed store keyed by customer and segment — microseconds, never a model invocation inside the request path.",
        "Pipeline lag degrades relevance gracefully toward popularity fallbacks; it structurally cannot degrade checkout.",
        "Loop hygiene matters: impression debiasing and forced exploration stop the model from admiring its own suggestions.",
      ],
    },
    {
      topic: "Reviews: fraud filtering before aggregation",
      body: "Ratings directly drive purchases, which makes review spam a revenue attack surface. Aggregation happens strictly downstream of fraud filtering — a fake star is worth more than a fake order.",
      bullets: [
        "Ingestion is asynchronous: review events queue through classifiers (spam, incentivized, off-topic) before they affect any count.",
        "Graph signals expose collusion rings — clusters of accounts reviewing the same sellers in coordinated bursts.",
        "Verified-purchase weighting and reviewer trust scores adjust INFLUENCE, not existence; nothing is deleted, everything is discounted with a reason code.",
        "The displayed rating is a filtered aggregate with a confidence interval that widens for low-review-count items.",
        "Every suppression keeps an audit trail feeding both appeals and regulator queries.",
      ],
    },
  ],

  failures: [
    {
      id: "flash-sale-oversell",
      title: "Flash-sale oversell race",
      fail: [],
      degrade: ["inv"],
      story: "A Prime Day deal lists its final 10 units while 80K checkouts per minute converge on that SKU. Naive read-then-write decrements oversell massively — every customer who passed the availability check believes they won. With atomic guards, the database simply refuses the losers.",
      reroute: ["c", "gw", "cart"],
      metrics: [
        { label: "Oversold units", before: "0", after: "~1,200", bad: true },
        { label: "Ledger drift alerts", before: "0/hr", after: "38/hr", bad: true },
        { label: "Forced refunds", before: "0", after: "~1,200", bad: true },
      ],
      lessons: [
        "Never trust application-level check-then-set under concurrency — express the invariant as a conditional atomic UPDATE and let the database arbitrate.",
        "The append-only ledger makes every stock mutation auditable and every projection rebuildable after the dust settles.",
        "Flash sales need admission control — queueing plus token buckets — BEFORE traffic reaches the inventory tier; shedding happens at the cart layer against cached counters.",
        "Oversell costs more than a lost sale: forced cancellations, refunds, support load and eroded trust. Correctness here is cheaper than it looks.",
      ],
    },
    {
      id: "psp-outage",
      title: "Primary PSP outage mid-day",
      fail: ["pay"],
      story: "The primary payment processor starts returning 5xx and timeouts during peak hours. The payment service circuit breaker trips once its error budget burns, new authorizations route to the secondary PSP, and in-flight payments sit in PENDING until webhooks or reconciliation drain them.",
      reroute: ["ord", "kafka", "inv", "pg"],
      metrics: [
        { label: "Auth success rate", before: "98.6%", after: "41%", bad: true },
        { label: "Checkout conversion", before: "baseline", after: "-18%", bad: true },
        { label: "PENDING drain time", before: "seconds", after: "<15 min", bad: false },
      ],
      lessons: [
        "Circuit breakers are per-PSP with exponential probe recovery — one provider's bad day must not consume the whole error budget.",
        "Idempotent authorization means replaying against a backup PSP cannot double-charge: distinct auth ids, single capture, reconciled by intent id.",
        "Orders stay PENDING with honest customer messaging instead of failing silently; carts survive, preserving most of the conversion.",
        "Webhook endpoints are PSP-agnostic by contract — adding a processor is configuration, not an incident-response project.",
      ],
    },
    {
      id: "recs-lag",
      title: "Recommendation pipeline falls behind",
      fail: [],
      degrade: ["kafka"],
      story: "Prime Day event volume hits 6x baseline and the recommendations consumer lag balloons from twelve seconds to forty-five minutes. Product pages quietly switch from personalized picks to generic top-sellers. Because recommendations are served from a precomputed store, the degradation is staleness — not an outage.",
      metrics: [
        { label: "Consumer lag", before: "12s", after: "46 min", bad: true },
        { label: "PDP relevance", before: "personalized", after: "generic", bad: true },
        { label: "Checkout success", before: "99.95%", after: "99.95%", bad: false },
      ],
      lessons: [
        "Isolation by design: recommendations are materialized ahead of time and never joined synchronously into the checkout path, so their failure domain ends at relevance.",
        "Alert on lag GROWTH RATE, not absolute lag — minutes of warning beat hours of hindsight.",
        "Popularity fallback lists are a product feature, not an apology: measure their conversion penalty and keep them warm.",
        "Backpressure policy pauses training jobs before serving staleness breaches its published SLO.",
      ],
    },
  ],

  scaling: [
    { stage: "10K users", action: "Single Postgres, modular monolith", why: "Ship the buying experience; one healthy database is plenty." },
    { stage: "100K", action: "Extract catalog + cart; Redis session carts; CDN for images", why: "First boundaries follow read skew — browsing must never compete with buying for resources." },
    { stage: "5M", action: "Dedicated inverted-index search cluster; object storage offload", why: "SQL LIKE scans and image bytes leave the OLTP database permanently." },
    { stage: "50M", action: "Shard orders by customer_id; Kafka decouples fulfillment; saga orchestration", why: "Write ceilings and blast radius force partitioning; cross-service workflows need explicit compensation." },
    { stage: "300M+", action: "Multi-region reads; regional order placement under a global idempotency namespace; per-region inventory pools reconciled centrally", why: "Latency is physics; consistency contracts get documented per data class and enforced in review." },
  ],

  tradeoffs: [
    {
      a: "Reserve-on-add-to-cart",
      b: "Decrement-on-order-confirm",
      aBlurb: "Pin stock when item is carted; TTL lease per hold",
      bBlurb: "Stock moves only when payment succeeds",
      dims: [
        { name: "Oversell risk", a: "Near zero — stock pinned to a cart", b: "Race window requires atomic guards", winner: "a" },
        { name: "Stock utilization", a: "Poor — abandoned carts pin 5-10% of catalog", b: "Full stock always sellable", winner: "b" },
        { name: "UX honesty", a: "'In your cart' is always true", b: "Can sell out between click and confirm", winner: "a" },
        { name: "Mechanism complexity", a: "Lease TTLs + release sweeper mandatory", b: "Plain counter math", winner: "b" },
      ],
      verdict: "Large retailers reserve at CHECKOUT START, not add-to-cart: browsing pins nothing, a short synchronous reservation covers the minutes of payment, and confirmation decrements. Reserve windows belong where intent converts — nowhere earlier.",
    },
    {
      a: "Strongly consistent orders (2PC)",
      b: "Sharded orders + saga compensation",
      aBlurb: "Distributed transactions across services",
      bBlurb: "Shard-local ACID, explicit compensations",
      dims: [
        { name: "Correctness reasoning", a: "Trivially correct — one atomic commit", b: "Correct via sagas + idempotency; harder to prove", winner: "a" },
        { name: "Peak write scale", a: "Consensus ceiling ~5K orders/s", b: "Linear with shards — 100K+/min proven", winner: "b" },
        { name: "Coordination overhead", a: "Blocking locks; coordinator is a standing SPOF", b: "Local commits only; failures become workflows", winner: "b" },
        { name: "Latency p99", a: "Multiple voting rounds per commit", b: "One shard-local commit", winner: "b" },
      ],
      verdict: "Keep strong consistency WITHIN a shard where money state lives, and replace cross-service atomicity with sagas whose compensations are real business actions. 2PC buys theoretical purity at the price of coupling uptime to the slowest participant.",
    },
  ],

  alternatives: [
    "Document-store catalog (DynamoDB-class): flexible per-category attribute schemas beat relational modeling at 600M heterogeneous items; accepted cost is weaker ad-hoc joins and analytics.",
    "Event-sourced orders with the log as system of record: perfect audit and replay, but every UX query needs an explicit projection; adopt when regulatory replay outweighs query ergonomics.",
    "Globally distributed SQL spanning orders across regions: removes sharding pain, adds cross-region commit latency to EVERY purchase; regional shards win while checkout stays regional.",
  ],

  interview: {
    prompt: "Design Amazon's core commerce platform — catalog, search, cart, checkout with payments and inventory — for 300M+ monthly shoppers and Prime Day spikes.",
    stages: [
      { name: "Requirements", expect: "Split the browsing plane from the money plane explicitly; declare the absolutes — no double charge, no oversell — and mark everything else tunable staleness." },
      { name: "Estimation", expect: "Derive ~17K visits/s average, ~150K peak search QPS, ~1.7K orders/sec peak, ~15TB/day media; let CDN, caching and sharding fall out of arithmetic, not fashion." },
      { name: "API & data", expect: "Idempotency-Key contract on checkout; cursor pagination everywhere; ledger-shaped inventory; order + items co-located in one shard for single-transaction confirmation." },
      { name: "Architecture", expect: "Saga orchestration across payment/inventory/order, Kafka as the event spine, webhook-driven PSP integration, search cluster fully off the OLTP path." },
      { name: "Deep dive", expect: "Walk the flash-sale oversell from naive check-then-set failure to conditional atomic update with bucketed counters; justify sagas over 2PC using the slow-PSP freeze scenario." },
      { name: "Failure & scale", expect: "PSP outage choreography — breaker trip, secondary routing, PENDING drain; recommendation-lag isolation; close with SLOs: checkout success, search p95, inventory accuracy, webhook freshness." },
    ],
  },

  production: [
    "Webhook handlers verify HMAC signatures, dedupe on transaction ids, acknowledge fast and process asynchronously — PSPs retaliate against slow callbacks with retry storms.",
    "Idempotency records persist key + response snapshot for at least 24h; a duplicate key carrying a different payload returns 422 rather than silently replaying.",
    "Continuous reconcilers diff ledger truth against Redis, search and cart-badge projections; drift beyond 0.1% pages an engineer.",
    "Flash deals pre-shard counters, pre-warm caches and cap admission BEFORE doors open; limits tie to measured order-service headroom, not marketing optimism.",
  ],

  costs: [
    "Search dominates compute spend: index memory for hundreds of millions of items is the largest technical line item — tier indices hot/warm/cold by traffic and cache aggressively.",
    "Payment fees scale linearly with GMV: raising auth success a few basis points through retry logic, smart routing and tokenization outvalues most infrastructure savings.",
    "Image pipeline and CDN egress follow close behind: modern codecs and origin-shield tuning measurably bend the second-biggest curve.",
  ],
};

/* ================================================================== */
/*  TICKET BOOKING                                                     */
/* ================================================================== */

const ticketBooking: CaseStudy = {
  slug: "ticket-booking",
  name: "Ticket Booking",
  tagline: "Two fans, one seat, ninety seconds: pessimistic leases, version checks and exactly-once reservations under onsale stampede load.",
  category: "Concurrency",
  difficulty: "Hard",
  minutes: 30,

  problem: [
    "A ticket onsale is the purest concurrency stress test in consumer software: at T0, half a million fans hit Refresh for twenty thousand seats, and thousands of them click the SAME good seat within the same hundred milliseconds. The product contract is brutal in both directions — a seat may never be sold twice, and a fan who did everything right still deserves an explicit, respectful 'no'.",
    "The engineering answer is layered guarantees: pessimistic leases pin a seat to one buyer for the payment window, version checks and unique constraints make double-sales physically unrepresentable, a virtual waiting room shapes the stampede into something the database can survive, and sweepers guarantee every abandoned hold returns to sale automatically. This case study is about reasoning through races slowly until the fast path becomes obvious.",
  ],

  requirements: {
    functional: [
      "Browse per-event seatmaps with live availability updates",
      "Hold a specific seat exclusively for a bounded payment window (8 minutes)",
      "Pay for a held seat; confirmation converts the hold into a binding booking",
      "Release or expire holds automatically; expired seats return to sale",
      "Virtual waiting room with fair admission during onsale windows",
      "Cancellation and refund returning seats to inventory promptly",
    ],
    nonFunctional: [
      "500K concurrent users at onsale instant; seatmap p95 <500ms under stampede",
      "ZERO double-sales — enforced by database constraints, not developer vigilance",
      "Hold and confirm complete in <200ms p99 for admitted sessions",
      "~85% first-attempt payment success; failures recycle seats within the sale",
      "All conflicts explicit: HTTP 409 with machine-readable reason codes, never silent loss",
    ],
  },

  capacity: [
    { label: "Concurrent users at onsale", value: "500K", note: "~2% admitted to the booking path initially" },
    { label: "Seats per event", value: "20K", note: "arena pop concert" },
    { label: "Sell-through time", value: "~90s", note: "20K seats gone in a minute and a half" },
    { label: "Peak hold attempts", value: "~400K/min", note: "each user tries 3-5 seats before settling" },
    { label: "Seatmap reads", value: "~50K/s peak", note: "snapshot + WebSocket deltas absorb most" },
    { label: "Hold window", value: "8 min", note: "payment deadline per lease" },
    { label: "First-pass payment success", value: "~85%", note: "failures requeue seats for other buyers" },
  ],

  api: [
    { method: "GET", path: "/events/{id}/seatmap", desc: "Snapshot + version; subsequent deltas arrive over the WebSocket channel" },
    { method: "POST", path: "/events/{id}/holds", desc: "Body {seat_id}; returns 201 with lease expiry, or 409 SEAT_TAKEN with alternatives" },
    { method: "DELETE", path: "/holds/{id}", desc: "Early voluntary release; seat re-listed immediately" },
    { method: "POST", path: "/holds/{id}/payment-intent", desc: "Creates PSP intent bound to the hold; capture deferred to confirm" },
    { method: "POST", path: "/payments/webhook", desc: "Signed PSP callback; deduped on intent id, idempotent by construction" },
    { method: "POST", path: "/bookings/{id}/confirm", desc: "Conditional commit: status='held' AND version match, else idempotent replay" },
  ],

  dataModel: [
    { name: "seats", fields: "event_id, section, row, num, status(free|held|sold), hold_id, hold_expires_at, version", note: "unique (event_id, section, row, num); partial UNIQUE (event_id, seat) WHERE status='sold' is the last line of defense" },
    { name: "bookings", fields: "booking_id, user_id, event_id, seat_ref, status(pending|confirmed|expired|cancelled), total, created_at", note: "one row per seat — arena seating has no quantity field" },
    { name: "payments", fields: "payment_id, booking_id, intent_id UNIQUE, state(authorized|captured|refunded), amount, idempotency_key", note: "intent uniqueness neutralizes duplicated PSP retries" },
    { name: "waiting_room_tickets", fields: "ticket_id, user_id, event_id, issued_at, state(waiting|admitted|expired), admission_token", note: "signed single-use tokens; the gateway enforces their presence during onsale" },
  ],

  architecture: {
    nodes: [
      n("c", "Clients", "client", 20, 260),
      n("room", "Waiting Room", "app", 250, 260, "virtual queue · tokens"),
      n("ws", "WebSocket", "infra", 480, 460, "seatmap deltas"),
      n("gw", "API Gateway", "app", 480, 140, "authn · admission gate"),
      n("book", "Booking API", "app", 480, 300, "hold · confirm · cancel"),
      n("seats", "Seat Inventory", "data", 700, 140, "row locks · version cols"),
      n("redis", "Redis", "cache", 700, 340, "hold leases · TTL"),
      n("sweep", "Expiry Sweeper", "app", 930, 440, "leases → released"),
      n("pay", "Payment Service", "app", 930, 140, "intents · webhooks"),
      n("pg", "PostgreSQL", "data", 930, 280, "bookings · payments"),
      n("kafka", "Kafka", "queue", 1160, 280, "booking.events"),
      n("mon", "Monitoring", "infra", 1160, 140),
    ],
    edges: [
      { from: "c", to: "room", label: "onsale surge", flow: true },
      { from: "room", to: "gw", label: "admit · mint token", flow: true },
      { from: "c", to: "gw", dashed: true, label: "off-peak direct" },
      { from: "gw", to: "book", protocol: "gRPC", flow: true },
      { from: "book", to: "seats", label: "SELECT FOR UPDATE", flow: true },
      { from: "book", to: "redis", label: "SET lease EX 480s", flow: true },
      { from: "book", to: "pay", label: "create intent", flow: true },
      { from: "pay", to: "book", dashed: true, label: "signed webhook" },
      { from: "book", to: "pg", label: "commit booking" },
      { from: "book", to: "ws", label: "publish deltas", flow: true },
      { from: "ws", to: "c", label: "push updates", flow: true },
      { from: "pg", to: "kafka", label: "outbox relay", flow: true },
      { from: "kafka", to: "mon", dashed: true },
      { from: "sweep", to: "pg", label: "expire stale holds" },
      { from: "sweep", to: "seats", dashed: true, label: "status → free" },
      { from: "sweep", to: "redis", dashed: true, label: "clear dead leases" },
    ],
    flows: [
      { id: "tb-hold", path: ["c", "room", "gw", "book", "redis"], color: "#2563EB", speed: 300, label: "hold a seat" },
      { id: "tb-confirm", path: ["c", "room", "gw", "book", "pg"], color: "#16A34A", speed: 300, label: "confirm after payment" },
      { id: "tb-release", path: ["sweep", "seats"], color: "#D97706", speed: 260, label: "expired holds return to sale" },
    ],
  },

  archNotes: [
    "The seat row is the serialization point: status, hold_id, hold_expires_at and version — plus a partial unique index on sold — make double-sale physically unrepresentable rather than merely discouraged.",
    "Redis leases answer 'is this seat takeable' in O(1) without touching locked rows; Postgres remains the legal source of truth and the sweeper repairs drift between the two.",
    "The Waiting Room mints signed single-use admission tokens; during onsale the gateway drops tokenless traffic outright — bypass resistance is enforced at protocol level, not encouraged by policy.",
    "Losers receive machine-readable 409s with live alternatives; spinners and blind retry loops are exactly how stampedes amplify themselves.",
    "Every transition (SeatHeld, SeatReleased, BookingConfirmed) commits with an outbox row relayed to Kafka; seatmap clients subscribe to compact deltas and never poll.",
  ],

  requestFlow: [
    { title: "Onsale opens — the room absorbs the surge", detail: "At T0 half a million connections arrive for twenty thousand seats. Admission control admits a shuffled trickle matched to measured booking-path capacity and hands each admittee a signed, single-use token; everyone else sees an honest queue position. The stampede never reaches the API tier — refresh storms die in the lobby.", edge: ["c", "room"], nodes: ["room"], tag: "500K → ~10K admitted" },
    { title: "Both users load the seatmap", detail: "Alice and Bob both fetch the current seatmap snapshot and subscribe to WebSocket deltas. Seat 14F renders as available to BOTH — correctly, because neither holds it yet. Availability is a shared read; ownership begins only at HOLD.", edge: ["book", "seats"], nodes: ["seats"], tag: "shared view" },
    { title: "Alice attempts HOLD", detail: "POST /events/e1/holds {seat: 14F}. The Booking API opens a transaction, takes SELECT FOR UPDATE on the seat row, verifies status='free', writes status='held' with her hold id and an 8-minute expiry, and commits. The row lock serializes exactly one writer per seat — the entire race is decided here in about 3ms.", edge: ["book", "seats"], nodes: ["book"], tag: "row lock" },
    { title: "Bob attempts HOLD — and loses honestly", detail: "Bob's identical request blocks on the row lock for the lifetime of Alice's transaction, rechecks, and receives an explicit 409 CONFLICT with reason code SEAT_TAKEN — not a spinner, not silence. His payload carries live alternatives (adjacent 14G, same-section pairs) so his client converts the loss into one tap. Honest conflicts are what keep retry storms from amplifying the stampede.", nodes: ["book"], tag: "409 SEAT_TAKEN" },
    { title: "Alice owns a lease", detail: "The hold is mirrored into Redis as a lease key (hold:e1:14F → booking_id, EX 480). Subsequent availability checks reject on the lease in O(1) without touching locked Postgres rows; the database stays the source of truth while Redis plays fast bouncer. The sweeper reconciles any drift between the two stores.", edge: ["book", "redis"], nodes: ["redis"], tag: "TTL 480s" },
    { title: "The payment window", detail: "Booking API creates a payment intent bound to the hold id. Payment Service tokenizes the instrument and AUTHORIZES; capture happens only at confirm. Roughly one in six cards fails here — the seat stays leased briefly for one automatic retry, then requeues for someone else.", edge: ["book", "pay"], nodes: ["pay"], tag: "~85% first pass" },
    { title: "Webhook arrives", detail: "The PSP result lands on a signed webhook. Booking API verifies the signature, matches it to the open hold, and dedupes on the intent id — PSP retries are free. Capture is permitted only after re-validating that the lease is STILL ALIVE at capture time; that single check eliminates the entire paid-for-a-ghost-seat bug class.", edge: ["pay", "book"], nodes: ["book"], tag: "signed · deduped" },
    { title: "Confirm commits exactly once", detail: "Confirm runs UPDATE seats SET status='sold', version=version+1 WHERE seat=14F AND status='held' AND hold_id=? AND version=?, inserts the confirmed booking and payment rows, and commits atomically. Even if the client fires CONFIRM five times concurrently, the partial unique index on sold seats lets exactly one transaction win — the rest replay its stored response idempotently.", edge: ["book", "pg"], nodes: ["pg"], tag: "version-guarded" },
    { title: "The map tells everyone", detail: "A SeatSold event fans out and the WebSocket gateway pushes a one-line delta — 14F turns gray — to every subscribed client, including Bob's, whose UI simultaneously highlights his suggested alternative. Had Alice abandoned her cart instead, the sweeper would have expired the lease, flipped the seat free and broadcast the release; the seat quietly returns to someone else's story.", edge: ["ws", "c"], nodes: ["ws"], tag: "delta push" },
  ],

  deepDives: [
    {
      topic: "The anatomy of a seat race",
      body: "Two users want seat 14F within the same hundred milliseconds. Walk the timeline slowly and every design decision falls out of what SHOULD happen at each step.",
      bullets: [
        "Both seatmaps show 'available' — correct, since availability is a property of the map, not a promise.",
        "Alice's HOLD takes the row lock; Bob's blocks for the ~3ms of her transaction — invisible to him, decisive for the outcome.",
        "After her commit, his recheck fails cleanly: 409 SEAT_TAKEN with reason code and freshly computed alternatives.",
        "The client treats loss as first-class UX — one tap to hold 14G — instead of an error to retry blindly.",
        "Under pessimistic locking the 'loser waits' cost is milliseconds; optimistic-only defers discovery to write time, when disappointment is expensive.",
      ],
    },
    {
      topic: "Why the hold lives twice (Redis + Postgres)",
      body: "The lease exists in both stores on purpose. Each answers a different question, and the sweeper exists because they can disagree.",
      bullets: [
        "Redis answers 'can this seat be held right now' in O(1), shielding locked rows from the 50K-read/s curiosity stampede.",
        "Postgres owns legality: status, hold_id and hold_expires_at decide who REALLY owns the seat in any dispute.",
        "If Redis dies, Postgres constraints still guarantee correctness — holds degrade to slower checks, never to double-sales.",
        "If Postgres lags under load, Redis leases shed the read pressure that would have made it worse.",
        "The sweeper diffs the stores every few seconds, expiring dead leases and re-listing freed seats — reconciliation is scheduled, not heroic.",
      ],
    },
    {
      topic: "Expiry races and the compensation saga",
      body: "The nastiest bug class in ticketing: payment succeeds AFTER the seat was released. Handling it well is the difference between a footnote and congressional hearings.",
      bullets: [
        "Capture re-validates lease liveness SERVER-SIDE at the capture moment — the webhook handler decides, never the client.",
        "Grace window: the lease TTL exceeds the payment deadline by minutes of clock-skew and network slack, so honest slow payers never collide with the sweeper.",
        "An orphaned capture triggers an idempotent auto-refund keyed on the payment intent; equal-tier reseat is attempted BEFORE refunding.",
        "Sweeps are frequent and idempotent; a lost sweep cycle fails LOUD via staleness alarms, never silently stale.",
        "Metrics that matter: orphaned captures per event, refund latency p99, and seats re-listed per minute during the sale's tail.",
      ],
    },
    {
      topic: "Waiting room mathematics",
      body: "Admission control is applied queueing theory: admit at the rate the booking path can convert, in an order that resists gaming.",
      bullets: [
        "Admission rate = measured booking-path capacity divided by expected hold-to-buy conversion — derived from p99s and error budgets, not vibes.",
        "Shuffled FIFO blunts the low-latency-bot advantage; position updates are honest and periodic.",
        "Admission tokens are signed, single-use, short-TTL, bound to user + event — sharing or scripting them dies at the gateway.",
        "Sticky sessions preserve queue position across refreshes, removing the incentive to refresh-storm.",
        "Degradation ladder before refusal: drop map fidelity, lengthen countdown intervals, widen admission spacing — protect holds at all costs.",
      ],
    },
  ],

  failures: [
    {
      id: "lease-expiry-mid-payment",
      title: "Lease expires mid-payment",
      fail: [],
      degrade: ["redis"],
      story: "Alice completes payment at minute 8:01; her lease died at 8:00 and the sweeper has already re-listed 14F. Her capture succeeds against a seat that just sold to someone else. Without machinery this is the worst failure class in ticketing — real money taken for nothing, discovered through support tickets hours later.",
      reroute: ["pay", "book", "pg"],
      metrics: [
        { label: "Orphaned captures", before: "~0", after: "~120/event", bad: true },
        { label: "Refund latency", before: "days (manual)", after: "<60s (auto)", bad: false },
        { label: "Support contacts", before: "hundreds", after: "near zero", bad: false },
      ],
      lessons: [
        "Capture validates lease liveness server-side at the capture moment — the webhook handler, not the client, is the checkpoint.",
        "Grace windows absorb reality: lease TTL exceeds the payment deadline by minutes of skew and network slack.",
        "Orphaned captures fire an idempotent refund saga keyed on the payment intent; equal-tier reseat is tried before any money moves back.",
        "Sweeps are frequent and observable — a stalled sweep cycle pages before listings go stale, because staleness compounds into oversell pressure.",
      ],
    },
    {
      id: "waiting-room-bypass",
      title: "Waiting room bypassed by scrapers",
      fail: [],
      degrade: ["room"],
      story: "Bots discover a legacy seatmap endpoint that predates admission tokens and pull 200K req/s straight into the API tier. Admitted fans starve behind scrapers while the booking path thrashes on connection churn.",
      reroute: ["c", "gw"],
      metrics: [
        { label: "Seatmap p99", before: "180ms", after: "9s", bad: true },
        { label: "Bot share of reads", before: "<2%", after: "71%", bad: true },
        { label: "Human hold success", before: "healthy", after: "starved", bad: true },
      ],
      lessons: [
        "During onsale the gateway REJECTS tokenless requests outright — admission enforcement is protocol-level, not a polite queue suggestion.",
        "Tokens are signed, single-use, short-TTL and bound to user + event; token resale dies with binding and device attestation.",
        "Cheap static endpoints (maps, media, help) scale on an independent tier so the expensive booking path is never their shield.",
        "Track fairness SLOs by cohort — successful-hold share for humans versus suspected bots — because aggregate availability hides exactly this failure.",
      ],
    },
    {
      id: "double-confirm-race",
      title: "Double-confirm race",
      fail: [],
      degrade: ["book"],
      story: "Alice's flaky connection times out on CONFIRM; her client retries twice while the original request is still executing. Three concurrent confirms hit the same held seat within milliseconds. This is the race every ticketing system must survive by construction rather than discipline.",
      metrics: [
        { label: "Duplicate sold rows", before: "possible (naive)", after: "0 — constraint", bad: false },
        { label: "Double charges", before: "real risk", after: "0 — intent dedup", bad: false },
        { label: "Client-visible errors", before: "sporadic 500s", after: "none — replay", bad: false },
      ],
      lessons: [
        "The partial unique index on (event_id, seat) WHERE status='sold' makes double-sale physically unrepresentable — the constraint, not the code path, is the guarantee.",
        "Version-guarded conditional UPDATE means losing confirms mutate NOTHING; they cannot corrupt state even momentarily.",
        "Losing confirms replay the winner's stored response via the idempotency key — retries converge instead of erroring.",
        "Constraint violations here are expected control flow: log at INFO with correlation ids and alert only on RATE spikes, which signal client bugs or attacks.",
      ],
    },
  ],

  scaling: [
    { stage: "1K buyers", action: "Single Postgres; seat status column + transactions", why: "One machine serializes the whole event; correctness comes free." },
    { stage: "20K", action: "Cached seatmap snapshots + WebSocket deltas", why: "Map polling melts the database long before holds do." },
    { stage: "100K", action: "TTL hold leases + expiry sweeper", why: "Abandoned carts must self-clean without human intervention." },
    { stage: "500K", action: "Virtual waiting room with admission tokens", why: "Shaping demand always beats outbuilding it." },
    { stage: "Multi-event global", action: "Regional booking cells; inventory homed per event", why: "Per-seat cross-region consensus is unaffordable; locality is the only price that closes." },
  ],

  tradeoffs: [
    {
      a: "Pessimistic lease (hold the row)",
      b: "Optimistic versioned writes",
      aBlurb: "Lock the seat row; TTL lease pins it",
      bBlurb: "Read version, commit WHERE version = seen",
      dims: [
        { name: "Hot-seat conflicts", a: "Loser waits ms, gets a clean 409", b: "Both proceed; loser discovers at write time", winner: "a" },
        { name: "Behavior under contention", a: "Locks serialize — queueing IS correct for one seat", b: "Retry storms grow WITH contention", winner: "a" },
        { name: "Abandonment handling", a: "Needs TTL sweeper + lease GC", b: "Self-cleaning — nothing pinned", winner: "b" },
        { name: "Cold-path efficiency", a: "Two writes (lease, then confirm)", b: "Single CAS write", winner: "b" },
      ],
      verdict: "Seats are scarce, single-winner and violently contended — pessimistic leases match the domain. Optimism survives as belt-and-braces: the version column guards confirm against residual races, and the partial unique index is the final arbiter.",
    },
    {
      a: "Virtual waiting room",
      b: "Raw traffic to the stack",
      aBlurb: "Queue + admission tokens shape demand",
      bBlurb: "Everyone hits booking directly",
      dims: [
        { name: "Database survival", a: "Booking tier sees ~2% of demand", b: "Connection pools die in seconds", winner: "a" },
        { name: "Fairness", a: "Shuffled queue blunts bot advantage", b: "Fastest bot wins", winner: "a" },
        { name: "Fan experience", a: "Honest position + countdown", b: "Timeouts and refresh spirals", winner: "a" },
        { name: "Cost & complexity", a: "Queue fleet + token plumbing year-round", b: "Nearly free until the disaster", winner: "b" },
      ],
      verdict: "Admission control converts an unmeterable stampede into a meterable queue. Run it only during onsales behind a feature flag; idle cost otherwise is a few warm pods — cheap insurance against the industry's most public outages.",
    },
  ],

  alternatives: [
    "Consensus-backed locks (etcd/ZooKeeper/Redlock) for holds: stronger coordination semantics, heavier steady-state machinery; Redis TTL leases plus DB constraints reach identical guarantees with fewer moving parts.",
    "Holding database transactions open across the payment window — the naively 'correct' design; locks and connections cannot survive minutes of human payment UX.",
    "Pure optimistic concurrency (CAS-only, no leases): simpler write path, but hot seats generate retry storms whose load scales WITH contention — exactly the wrong direction.",
  ],

  interview: {
    prompt: "Design an arena ticket onsale: 500K concurrent users racing for 20K seats, zero double-sales guaranteed, fair access under bot pressure.",
    stages: [
      { name: "Requirements", expect: "Quantify the race — 500K users, 20K seats, ~90s sellout — then declare invariants: zero oversell ever, money moves only for confirmed holds, losers get explicit outcomes." },
      { name: "Estimation", expect: "~400K hold attempts/min, ~50K seatmap reads/s absorbed by snapshots + deltas, and the key insight that an 8-minute window bounds pinned seats by SEAT COUNT, not user count." },
      { name: "Data model", expect: "Seat row as THE serialization point: status, hold_id, hold_expires_at, version; partial unique index on sold as the last-resort invariant; payments deduped on intent id." },
      { name: "Architecture", expect: "Waiting room mints signed admission tokens enforced at the gateway; Booking API takes row leases; Redis mirrors holds with TTL; sweeper reconciles drift on a schedule." },
      { name: "Deep dive", expect: "Walk Alice-vs-Bob hop by hop: who blocks where, what the 409 payload contains, why the lease lives in BOTH stores, and why capture re-validates liveness server-side." },
      { name: "Failure", expect: "Lease-expiry-mid-payment refund/reseat saga end to end; waiting-room bypass containment via token enforcement; double-confirm killed by constraint; close on fairness SLOs by cohort." },
    ],
  },

  production: [
    "Only server clocks decide expiry; client countdowns are cosmetic hints padded generously for skew — never authoritative.",
    "Daily chaos runs fire concurrent HOLD/CONFIRM storms against staging; the sold-seats unique index and version guards are regression-tested like payment code.",
    "Admission rates track measured booking-path headroom (p99 + error budget), widening automatically as capacity frees up mid-sale.",
    "Post-sale graph analysis clusters scalper rings by fingerprint and behavior signals; confirmed bans feed the same admission blacklist the waiting room consults.",
  ],

  costs: [
    "Idle-year economics: waiting-room and WebSocket fleets serve four monster days annually — reserved baseline plus aggressive autoscale, not steady-state provisioning.",
    "The lease store trades throughput for durability: replicated, persisted Redis sized modestly but monitored like payment infrastructure.",
    "Every orphaned capture is refunded margin plus support cost — capture-time validation and tuned grace windows are revenue engineering, not hygiene.",
  ],
};

export const COMMERCE_SYSTEMS: CaseStudy[] = [amazon, ticketBooking];
