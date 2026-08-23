import type { Chapter } from "@/lib/types";

export const foundationsChapters: Chapter[] = [
  {
    slug: "how-the-internet-works",
    track: "foundations",
    num: 1,
    title: "How the Internet Works",
    subtitle:
      "DNS, TCP, TLS and HTTP — the request lifecycle that every system you will ever design sits on top of.",
    minutes: 25,
    skills: ["networking"],
    concepts: ["dns", "latency", "rtt", "cdn", "reverse-proxy", "tls", "throughput"],
    blocks: [
      {
        t: "p",
        md: "Every system design interview, every architecture document, every incident review eventually reduces to one thing: **a request travelling across a network**. Before we design systems that serve millions of users, we need to understand precisely what happens when one user types a URL and presses Enter.",
      },
      { t: "h", text: "The life of a request" },
      {
        t: "p",
        md: "When you type `https://example.com` into a browser, roughly seven things happen before the first pixel renders. Each step adds latency, each step can fail, and each step maps directly to a component you will later place in your architectures.",
      },
      {
        t: "list",
        ordered: true,
        items: [
          "**DNS resolution** — the browser asks the operating system, which asks a recursive resolver (`8.8.8.8`, your ISP's, or `1.1.1.1`), which walks the hierarchy `.com` → `example.com` → the answer. The IP is cached at every layer according to its TTL.",
          "**TCP handshake** — the browser opens a connection: `SYN` → `SYN-ACK` → `ACK`. That is **one full round trip** before any application data moves.",
          "**TLS handshake** — certificates are verified and session keys agreed. TLS 1.3 needs **one additional round trip** (or zero if resuming); TLS 1.2 needed two.",
          "**HTTP request** — the browser sends `GET /` with headers. This travels through possibly many hops: CDN edge, load balancer, reverse proxy, then your application.",
          "**Server work** — your service authenticates, queries caches and databases, and builds a response. In most real systems this is where 80% of latency lives.",
          "**Response** — status line, headers, body. The browser parses HTML, discovers CSS/JS/images, and repeats steps 4–6 for each asset — usually in parallel over the same connection.",
          "**Render** — layout, paint, and hydration.",
        ],
      },
      {
        t: "diagram",
        height: 240,
        caption:
          "A request traverses DNS, CDN, load balancer, service and database. Every hop adds latency and can fail independently.",
        graph: {
          nodes: [
            { id: "b", label: "Browser", kind: "client", x: 20, y: 100 },
            { id: "dns", label: "DNS Resolver", sub: "example.com → 93.184.216.34", kind: "infra", x: 210, y: 20 },
            { id: "cdn", label: "CDN Edge", sub: "cache static assets", kind: "cache", x: 210, y: 180 },
            { id: "lb", label: "Load Balancer", kind: "app", x: 420, y: 180 },
            { id: "api", label: "API Server", kind: "app", x: 630, y: 180 },
            { id: "db", label: "Database", kind: "data", x: 840, y: 180 },
          ],
          edges: [
            { from: "b", to: "dns", label: "1. resolve", dashed: true },
            { from: "dns", to: "b", label: "IP addr", dashed: true },
            { from: "b", to: "cdn", label: "2–5. HTTPS GET" },
            { from: "cdn", to: "lb", label: "miss → origin" },
            { from: "lb", to: "api" },
            { from: "api", to: "db", label: "query" },
          ],
        },
      },
      { t: "h", text: "DNS: the internet's phone book" },
      {
        t: "p",
        md: "DNS translates names to IP addresses through a **hierarchical, heavily-cached** system. A resolver first checks its cache; on a miss it asks a root server (which answers with the `.com` nameservers), then the TLD servers (which answer with `example.com`'s nameservers), then the authoritative server, which returns the actual record. The full walk can take hundreds of milliseconds; a warm cache takes single-digit milliseconds.",
      },
      {
        t: "table",
        head: ["Record", "Maps to", "Used for"],
        rows: [
          ["A / AAAA", "IPv4 / IPv6 address", "The primary record for a hostname"],
          ["CNAME", "Another hostname", "`www.example.com` → `example.com`"],
          ["ALIAS / ANAME", "Hostname at zone apex", "Pointing root domain at a CDN"],
          ["TXT", "Arbitrary text", "Domain verification, SPF, DKIM"],
          ["MX", "Mail servers", "Email routing with priority"],
          ["NS", "Authoritative nameservers", "Delegating a zone"],
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "TTL is an availability knob",
        md: "Every DNS record carries a **time-to-live** that controls how long resolvers may cache it. A low TTL (30–60s) lets you fail traffic over to a healthy region quickly — but multiplies query volume. A high TTL (24h) protects your DNS provider's quota but means a dead datacenter keeps receiving traffic for hours after you update the record. Production systems typically use 60s TTLs on load-balancer endpoints and rely on health checks closer to the app for fast failover.",
      },
      { t: "h", text: "TCP, UDP and why latency compounds" },
      {
        t: "p",
        md: "TCP gives you a reliable byte stream: ordering, retransmission, flow control and congestion control. That reliability costs round trips — the handshake alone is one RTT before your first byte. UDP sends datagrams with no guarantees; anything built on it (QUIC, video, gaming) implements exactly the guarantees it needs, and no more.",
      },
      {
        t: "table",
        head: ["Property", "TCP", "UDP"],
        rows: [
          ["Connection", "Handshake required (1 RTT)", "Connectionless"],
          ["Ordering & retries", "Guaranteed by protocol", "Your problem"],
          ["Head-of-line blocking", "Yes — one lost packet stalls the stream", "No (but app must cope)"],
          ["Typical uses", "HTTP/1.1, HTTP/2, databases, SSH", "QUIC/HTTP-3, DNS, video, games"],
        ],
      },
      {
        t: "callout",
        kind: "info",
        title: "Latency numbers every engineer should memorize",
        md: "L1 cache reference ~1ns · RAM access ~100ns · SSD random read ~150µs · same-datacenter RTT ~0.5ms · cross-continent RTT ~150ms · TLS handshake ~1–2 RTTs. Design decisions change completely at each scale: you can do synchronous calls within a datacenter, but a page that makes five sequential cross-ocean requests will never feel fast.",
      },
      { t: "h", text: "TLS in one paragraph" },
      {
        t: "p",
        md: "TLS wraps TCP in encryption, integrity and identity. The client validates the server's certificate against a chain of trust rooted in certificate authorities, then both sides derive symmetric session keys using ephemeral key exchange (usually X25519 ECDHE) — which is what makes forward secrecy work: stealing the server's private key later cannot decrypt past traffic. TLS 1.3 collapsed the handshake to a single round trip and removed legacy algorithms. Terminate TLS at the edge (CDN or load balancer) and re-encrypt internally if compliance requires it; plaintext inside a VPC is common but increasingly frowned upon.",
      },
      { t: "h", text: "HTTP/1.1 → HTTP/2 → HTTP/3" },
      {
        t: "table",
        head: ["Version", "Transport", "Key idea", "Remaining problem"],
        rows: [
          ["HTTP/1.1", "TCP", "One in-flight request per connection; browsers open 6+", "Head-of-line blocking at the HTTP layer"],
          ["HTTP/2", "TCP", "Binary framing multiplexes many streams over one connection", "One lost TCP packet stalls ALL streams"],
          ["HTTP/3", "QUIC over UDP", "Streams are independent even under packet loss; 0-RTT resume", "Middlebox/UDP throttling in some networks"],
        ],
      },
      {
        t: "p",
        md: "The pattern to internalize: **each generation moved a bottleneck from the protocol into the transport, until the transport itself was replaced.** HTTP/2 fixed application-layer head-of-line blocking but inherited TCP's; QUIC fixes it by making streams independent at the transport layer.",
      },
      { t: "h", text: "Ports, proxies and CDNs" },
      {
        t: "list",
        items: [
          "A **port** is just a 16-bit number that lets one IP host run many services: 443 for HTTPS, 5432 for PostgreSQL, 6379 for Redis. Firewalls filter on them; nothing more magical than that.",
          "A **reverse proxy** (Nginx, Envoy, HAProxy) sits in front of your services and handles TLS termination, compression, routing, rate limiting and observability. It is usually the first 'real' infrastructure component added to a growing system.",
          "A **CDN** is a globally distributed reverse proxy that serves cached content from points of presence near users. It cuts latency dramatically for static assets and shields your origin from traffic spikes and many DDoS patterns.",
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the retry storm",
        md: "A DNS resolver returns SERVFAIL. The client library retries immediately — 40 times per second per pod. You have 200 pods. Your DNS provider now sees 8,000 queries/second instead of 200, times out harder, and the outage amplifies itself. **Retries without backoff and jitter turn small failures into outages.** We will build the fix properly in the Distributed Systems track.",
      },
      {
        t: "code",
        lang: "bash",
        title: "See it yourself",
        code: `# Walk the DNS hierarchy and see caching in action
dig example.com +noall +answer
dig +trace example.com | tail -20

# Watch a full TLS + HTTP exchange with timing
curl -vsS -o /dev/null -w "dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer}\\n" https://example.com

# Inspect what protocol you actually got
curl -sI https://example.com | grep -i http/`,
      },
      {
        t: "p",
        md: "Run the `curl` command twice. The second run is faster almost entirely because of caches — DNS cache, TLS session resumption, CDN warmth. Most of performance engineering is learning to see these caches.",
      },
    ],
    quiz: [
      {
        id: "inet-q1",
        q: "A page makes 5 sequential HTTPS requests from Europe to a US origin (~150ms RTT), each needing a fresh TLS 1.3 handshake. Roughly how much time is spent on handshakes alone?",
        options: ["~75ms", "~450ms", "~900ms", "~1.5s"],
        correct: [2],
        explain:
          "Each request pays 1 RTT for TCP + 1 RTT for TLS 1.3 = ~300ms of pure handshake overhead, ×5 sequential requests ≈ 1.5s. This is exactly why keep-alive connections, connection pooling and CDNs exist.",
      },
      {
        id: "inet-q2",
        q: "Why does HTTP/2 still suffer from head-of-line blocking despite multiplexing?",
        options: [
          "Browsers limit concurrent streams",
          "All streams share one TCP connection, so a single lost packet stalls delivery of every stream",
          "Servers cannot prioritize responses",
          "Headers are not compressed in HTTP/2",
        ],
        correct: [1],
        explain:
          "Multiplexing removes HTTP-level blocking, but TCP guarantees a strict byte order. One dropped packet forces the OS to hold back all subsequent bytes — including bytes belonging to other streams. QUIC solves this by numbering streams independently over UDP.",
      },
      {
        id: "inet-q3",
        q: "You need to fail traffic away from a broken region within ~60 seconds using DNS only. What do you set?",
        options: [
          "TTL of 24h and rely on propagation",
          "TTL of 30–60s on the record pointing at the region",
          "A CNAME chain of three records",
          "Lower the MX priority",
        ],
        correct: [1],
        explain:
          "Resolvers honor the TTL when deciding how long to cache. A 30–60s TTL bounds staleness to about a minute. High TTLs are cheaper but freeze old answers in thousands of resolvers worldwide.",
      },
      {
        id: "inet-q4",
        q: "Which statement about ports is true?",
        options: [
          "Port 443 encrypts traffic; port 80 cannot ever be encrypted",
          "A port identifies a specific process on a machine so one IP can host many services",
          "Ports are assigned by DNS",
          "Two services on different machines cannot share a port number",
        ],
        correct: [1],
        explain:
          "A port is a local demultiplexing key — (IP, port, protocol) identifies a socket. Encryption is a property of the protocol spoken (HTTPS vs HTTP), not of the port number, though well-known ports carry conventions.",
      },
    ],
    exercise: {
      prompt:
        "Using dig and curl, measure the DNS time, TCP time, TLS time and TTFB for three websites of your choice. Which component dominates? Does a second visit change the profile?",
      hints: [
        "Use curl's -w variables: time_namelookup, time_connect, time_appconnect, time_starttransfer.",
        "Compare a large CDN-backed site against a small origin-only site.",
        "Clear caches between runs (e.g., use --resolve with a random subdomain) to force cold DNS lookups.",
      ],
    },
  },

  {
    slug: "http-and-apis",
    track: "foundations",
    num: 2,
    title: "HTTP, REST, gRPC & Real-Time Protocols",
    subtitle:
      "Choosing how services talk: REST, RPC, gRPC, WebSockets and Server-Sent Events — and the tradeoffs nobody mentions.",
    minutes: 22,
    skills: ["networking", "architecture"],
    concepts: ["rest", "grpc", "websocket", "sse", "idempotency", "http"],
    blocks: [
      {
        t: "p",
        md: "Once two programs need to talk, you face a design decision that outlives frameworks and teams: **what protocol and API style do they speak?** Get this wrong and you pay for a decade in integration friction. Get it right and services compose like Lego.",
      },
      { t: "h", text: "REST: resources over HTTP" },
      {
        t: "p",
        md: "REST models your API as **nouns (resources)** addressed by URLs, manipulated with HTTP verbs. `GET /orders/42` reads, `POST /orders` creates, `PATCH /orders/42` partially updates, `DELETE /orders/42` removes. Its superpower is leaning on HTTP semantics that proxies, caches, load balancers and browsers already understand: status codes, conditional requests (`ETag`, `If-None-Match`), cache headers, and standardized auth schemes.",
      },
      {
        t: "table",
        head: ["Verb", "Semantics", "Idempotent?", "Safe?"],
        rows: [
          ["GET", "Read a resource", "Yes", "Yes"],
          ["PUT", "Replace resource at known URL", "Yes", "No"],
          ["PATCH", "Partial update", "Not necessarily", "No"],
          ["POST", "Create / trigger action", "No", "No"],
          ["DELETE", "Remove resource", "Yes", "No"],
        ],
      },
      {
        t: "callout",
        kind: "warn",
        title: "Idempotency is a contract, not an accident",
        md: "Networks retry. Clients double-click. Kafka delivers duplicates. If `POST /payments` charges a card twice when retried, your API is broken in production regardless of how clean it looks in Postman. The standard fix: clients send an **idempotency key** header; the server stores the first response and replays it for duplicates. We build this exact mechanism in the Zomato case study.",
      },
      { t: "h", text: "RPC and gRPC: verbs over a wire" },
      {
        t: "p",
        md: "RPC says: forget resources, just call functions on another machine. **gRPC** is the dominant modern implementation: you define services and messages in a `.proto` file, codegen produces typed clients and servers in every language, and calls ride on HTTP/2 as binary protobuf frames — typically 3–10× smaller and much cheaper to parse than JSON.",
      },
      {
        t: "code",
        lang: "protobuf",
        title: "order.proto",
        code: `syntax = "proto3";

service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  rpc StreamOrderUpdates(OrderId) returns (stream OrderEvent);
}

message CreateOrderRequest {
  string user_id = 1;
  repeated Item items = 2;
  string idempotency_key = 3;
}`,
      },
      {
        t: "p",
        md: "gRPC shines **between your own services**: strong contracts, streaming both directions, deadlines propagated automatically, and mature load balancing. It is awkward at the browser edge (browsers don't expose HTTP/2 trailers), which is why public APIs usually stay REST/JSON and gRPC lives behind the gateway.",
      },
      { t: "h", text: "Real-time: WebSockets vs SSE" },
      {
        t: "diagram",
        height: 230,
        caption:
          "Polling wastes requests; SSE is a one-way stream over plain HTTP; WebSockets upgrade to a full-duplex socket.",
        graph: {
          nodes: [
            { id: "c", label: "Client", kind: "client", x: 20, y: 90 },
            { id: "poll", label: "Polling", sub: "GET /updates every 5s", kind: "app", x: 260, y: 10 },
            { id: "sse", label: "SSE", sub: "text/event-stream", kind: "app", x: 260, y: 90 },
            { id: "ws", label: "WebSocket", sub: "Upgrade: websocket", kind: "app", x: 260, y: 170 },
          ],
          edges: [
            { from: "c", to: "poll", label: "req → resp, repeat" },
            { from: "c", to: "sse", label: "server pushes forever" },
            { from: "c", to: "ws", label: "both push anytime" },
          ],
        },
      },
      {
        t: "table",
        head: ["", "Polling", "SSE", "WebSockets"],
        rows: [
          ["Direction", "Client pull", "Server → client", "Bidirectional"],
          ["Transport", "Plain HTTP", "Plain HTTP", "Upgraded TCP"],
          ["Overhead at idle", "High (requests every N s)", "One open connection", "One open connection"],
          ["Infra friendliness", "Trivial", "Good (proxy buffering to watch)", "Needs LB timeout tuning, sticky or shared state"],
          ["Best for", "Dashboards, slow data", "Feeds, notifications, progress", "Chat, multiplayer, collaborative editing"],
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the WebSocket memory leak",
        md: "A chat service holds 500K live sockets. A deploy restarts pods; connections drop and clients reconnect with exponential backoff — fine. But the team forgot to remove closed connections from their in-memory presence map. Over weeks, RSS climbs until the OOM killer terminates pods mid-shift. **Connection lifecycle is state management.** Track disconnects as rigorously as connects, and prefer externalizing presence to Redis.",
      },
      { t: "h", text: "Choosing: a decision table" },
      {
        t: "table",
        head: ["Situation", "Default choice"],
        rows: [
          ["Public API consumed by third parties", "REST + JSON"],
          ["Internal service-to-service, perf-sensitive", "gRPC"],
          ["Server → client one-way updates", "SSE"],
          ["True bidirectional, low-latency", "WebSockets"],
          ["Batch analytics export", "Async files to object storage, not an API at all"],
        ],
      },
      {
        t: "code",
        lang: "http",
        title: "A production-grade response",
        code: `HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, max-age=30
ETag: "33a64df5"
X-Request-Id: req_7f3a9c

{"id": "ord_42", "status": "confirmed"}

# Re-request with If-None-Match: "33a64df5"
HTTP/1.1 304 Not Modified`,
      },
      {
        t: "p",
        md: "Notice what this response gives you for free: caching guidance, change validation, and a correlation ID that ties every log line and trace span together. Boring headers are production engineering.",
      },
    ],
    quiz: [
      {
        id: "api-q1",
        q: "A payment endpoint sometimes receives duplicate POSTs because mobile clients retry on flaky networks. Cleanest fix?",
        options: [
          "Make the endpoint DELETE, which is idempotent",
          "Require an Idempotency-Key header and replay the stored first response",
          "Add a UNIQUE constraint on amount",
          "Disable client retries",
        ],
        correct: [1],
        explain:
          "An idempotency key lets the server recognize retries of the same logical operation and return the original result. Constraints on amount would wrongly reject legitimate repeat payments; disabling retries breaks reliability.",
      },
      {
        id: "api-q2",
        q: "You must stream server-generated price ticks to 50K concurrent browser clients, one-way. Best fit?",
        options: ["WebSockets", "SSE", "Polling every 1s", "gRPC bidi streaming"],
        correct: [1],
        explain:
          "SSE provides server→client streaming over plain HTTP with automatic reconnection built into browsers, at lower complexity than WebSockets. gRPC doesn't run natively in browsers; polling at 1s×50K = 50K QPS of waste.",
      },
      {
        id: "api-q3",
        q: "Why do internal microservices often prefer gRPC over REST?",
        options: [
          "gRPC is easier to debug with curl",
          "Typed contracts via proto codegen, efficient binary encoding, and native streaming over HTTP/2",
          "REST cannot use load balancers",
          "gRPC avoids the need for versioning",
        ],
        correct: [1],
        explain:
          "Codegen from .proto gives compile-time safety across languages; protobuf is compact and fast; HTTP/2 supports bidirectional streaming. Debugging with curl is actually harder — that's a real tradeoff.",
      },
      {
        id: "api-q4",
        q: "Which pair of HTTP methods is idempotent?",
        options: ["POST and PATCH", "PUT and DELETE", "POST and PUT", "GET and POST"],
        correct: [1],
        explain:
          "PUT replaces a resource at a known URL — repeating yields the same state. DELETE repeated on a gone resource still results in 'not there'. POST creates something new each time; PATCH depends on the patch semantics.",
      },
    ],
    exercise: {
      prompt:
        "Design the API surface (paths, verbs, status codes, idempotency strategy) for a URL shortener with create, redirect, and stats endpoints. Then defend one choice where you deliberately broke REST purity.",
      hints: [
        "Redirects are GET /{code} returning 301/302 — think about which one preserves analytics.",
        "Stats could be GET /{code}/stats — consider caching headers given counters lag anyway.",
        "Creating the same long URL twice: same short code (idempotent) or new codes each time? Both defensible — pick and justify.",
      ],
    },
  },
];
