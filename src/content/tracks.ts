import type { Track } from "@/lib/types";

/**
 * Curriculum registry. Chapters are grouped into tracks; every track page,
 * sidebar entry and search result derives from this single source of truth.
 */
export const TRACKS: Track[] = [
  {
    slug: "foundations",
    name: "Engineering Foundations",
    group: "learn",
    level: "Level 0",
    blurb:
      "How the internet actually moves a request: DNS, TCP, TLS, HTTP and the protocol landscape every system sits on top of.",
    chapters: [],
  },
  {
    slug: "core-design",
    name: "Core System Design",
    group: "learn",
    level: "Levels 1–2",
    blurb:
      "Requirements, capacity estimation and the building blocks of every scalable architecture: load balancers, caches, rate limiters and Redis.",
    chapters: [],
  },
  {
    slug: "data-systems",
    name: "Data Systems",
    group: "learn",
    level: "Level 3",
    blurb:
      "Databases under real load: PostgreSQL internals and scaling, Kafka for event-driven systems, delivery semantics and the outbox pattern.",
    chapters: [],
  },
  {
    slug: "distributed",
    name: "Distributed Systems",
    group: "learn",
    level: "Level 4",
    blurb:
      "What breaks when you have more than one machine: consistency models, CAP/PACELC, quorums, Raft consensus, clocks and failure handling.",
    chapters: [],
  },
  {
    slug: "scalability",
    name: "Scalability",
    group: "learn",
    level: "Level 5",
    blurb:
      "The canonical evolution from one server to a global system — each step forced by a real bottleneck, not fashion.",
    chapters: [],
  },
  {
    slug: "reliability",
    name: "Reliability",
    group: "learn",
    level: "Production",
    blurb:
      "Designing for the day things break: timeouts, retries with jitter, circuit breakers, bulkheads, graceful degradation and chaos practice.",
    chapters: [],
  },
  {
    slug: "advanced",
    name: "Advanced Architecture",
    group: "learn",
    level: "Principal",
    blurb:
      "Event-driven coordination at scale: sagas, transactional outboxes, CQRS projections and the honest exactly-once illusion.",
    chapters: [],
  },
  {
    slug: "infrastructure",
    name: "Production Infrastructure",
    group: "learn",
    level: "Platform",
    blurb:
      "Ship and operate what you design: Docker, Kubernetes, Git & GitHub workflows, CI/CD pipelines and observability.",
    chapters: [],
  },
];
