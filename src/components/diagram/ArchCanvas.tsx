"use client";

/**
 * DiagramCanvas (ArchCanvas) — the single rendering engine for every
 * architecture diagram in the academy.
 *
 * Rendering architecture:
 *
 *   DiagramContainer (measured via ResizeObserver)
 *     → ResponsiveSVG (pixel-sized from a readability-floored scale)
 *       → Diagram coordinate system (tight bbox, no dead whitespace)
 *         → Regions / Edges / Packets / Nodes / Labels / Tooltips
 *
 * Static mode: content always fills the container width; height follows the
 * diagram's own aspect ratio; if the readability floor requires more room than
 * the container offers, the container scrolls horizontally instead of
 * shrinking text into microscopic sizes.
 *
 * Explore/Edit modes: full pan/zoom viewport with on-canvas controls.
 *
 * Every instance namespaces its <defs> ids so multiple diagrams never share
 * markers/filters (the old cross-SVG bleeding bug).
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DiagramEdge, DiagramFlow, DiagramNode, Graph, NodeKind, NodeInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export const NODE_W = 154;
export const NODE_H = 48;
export const NODE_H_SUB = 60;

/** Smallest allowed render scale — keeps node labels ≥ ~10px real pixels. */
const MIN_SCALE = 0.88;
const MAX_SCALE = 1.25;

/* ------------------------------------------------------------------ */
/*  Geometry & sizing helpers                                          */
/* ------------------------------------------------------------------ */

export function nodeW(n: DiagramNode): number {
  if (n.w && n.w > 0) return n.w;
  const labelChars = n.label ? n.label.length : 0;
  const subChars = n.sub ? n.sub.length : 0;
  const hasBadge = n.state === "down" || n.state === "warn" || n.state === "hot";

  const labelWidth = labelChars * 7.5 + (hasBadge ? 58 : 38);
  const subWidth = subChars ? subChars * 5.8 + (hasBadge ? 56 : 38) : 0;
  const needed = Math.max(labelWidth, subWidth);

  return Math.max(NODE_W, Math.min(220, Math.ceil(needed)));
}

export function nodeH(n: DiagramNode): number {
  return n.sub ? NODE_H_SUB : NODE_H;
}

export function graphBBox(graph: Graph) {
  const pad = 42;
  if (!graph.nodes || graph.nodes.length === 0) {
    return { x: 0, y: 0, w: 800, h: 300 };
  }

  const xs = graph.nodes.map((n) => n.x);
  const ys = graph.nodes.map((n) => n.y);
  const xe = graph.nodes.map((n) => n.x + nodeW(n));
  const ye = graph.nodes.map((n) => n.y + nodeH(n));

  if (graph.regions && graph.regions.length > 0) {
    graph.regions.forEach((r) => {
      xs.push(r.x);
      ys.push(r.y);
      xe.push(r.x + r.w);
      ye.push(r.y + r.h);
    });
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xe);
  const maxY = Math.max(...ye);

  const x = minX - pad;
  const y = minY - pad;
  return {
    x,
    y,
    w: Math.max(240, maxX - minX + pad * 2),
    h: Math.max(160, maxY - minY + pad * 2),
  };
}

interface Pt {
  x: number;
  y: number;
}

type Face = "top" | "bottom" | "left" | "right";

interface AnchorResult {
  p1: Pt;
  p2: Pt;
  face1: Face;
  face2: Face;
}

function anchor(a: DiagramNode, b: DiagramNode): AnchorResult {
  const aw = nodeW(a);
  const bw = nodeW(b);
  const ah = nodeH(a);
  const bh = nodeH(b);

  const acx = a.x + aw / 2;
  const bcx = b.x + bw / 2;
  const acy = a.y + ah / 2;
  const bcy = b.y + bh / 2;

  const dx = bcx - acx;
  const dy = bcy - acy;

  // Clear horizontal separation
  if (b.x >= a.x + aw - 12) {
    return {
      p1: { x: a.x + aw, y: acy },
      p2: { x: b.x, y: bcy },
      face1: "right",
      face2: "left",
    };
  }
  if (a.x >= b.x + bw - 12) {
    return {
      p1: { x: a.x, y: acy },
      p2: { x: b.x + bw, y: bcy },
      face1: "left",
      face2: "right",
    };
  }

  // Mostly vertical alignment or stacked
  if (Math.abs(dx) < Math.max(aw, bw) * 0.75 || Math.abs(dy) > Math.abs(dx) * 1.1) {
    if (dy >= 0) {
      return {
        p1: { x: acx, y: a.y + ah },
        p2: { x: bcx, y: b.y },
        face1: "bottom",
        face2: "top",
      };
    } else {
      return {
        p1: { x: acx, y: a.y },
        p2: { x: bcx, y: b.y + bh },
        face1: "top",
        face2: "bottom",
      };
    }
  }

  // Fallback to dominant axis
  if (dx >= 0) {
    return {
      p1: { x: a.x + aw, y: acy },
      p2: { x: b.x, y: bcy },
      face1: "right",
      face2: "left",
    };
  } else {
    return {
      p1: { x: a.x, y: acy },
      p2: { x: b.x + bw, y: bcy },
      face1: "left",
      face2: "right",
    };
  }
}

/** Cubic Bezier calculation at parameter t */
function bezierPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

function edgePath(
  a: DiagramNode,
  b: DiagramNode,
  allNodes?: DiagramNode[]
): { d: string; mid: Pt } {
  const { p1, p2, face1, face2 } = anchor(a, b);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);

  let cp1: Pt;
  let cp2: Pt;

  const curvature = Math.min(Math.max(dist * 0.4, 28), 160);

  if (face1 === "right" && face2 === "left") {
    cp1 = { x: p1.x + curvature, y: p1.y };
    cp2 = { x: p2.x - curvature, y: p2.y };
  } else if (face1 === "left" && face2 === "right") {
    cp1 = { x: p1.x - curvature, y: p1.y };
    cp2 = { x: p2.x + curvature, y: p2.y };
  } else if (face1 === "bottom" && face2 === "top") {
    cp1 = { x: p1.x, y: p1.y + curvature };
    cp2 = { x: p2.x, y: p2.y - curvature };
  } else if (face1 === "top" && face2 === "bottom") {
    cp1 = { x: p1.x, y: p1.y - curvature };
    cp2 = { x: p2.x, y: p2.y + curvature };
  } else if (face1 === "right" && face2 === "top") {
    cp1 = { x: p1.x + curvature, y: p1.y };
    cp2 = { x: p2.x, y: p2.y - curvature };
  } else if (face1 === "right" && face2 === "bottom") {
    cp1 = { x: p1.x + curvature, y: p1.y };
    cp2 = { x: p2.x, y: p2.y + curvature };
  } else if (face1 === "bottom" && face2 === "left") {
    cp1 = { x: p1.x, y: p1.y + curvature };
    cp2 = { x: p2.x - curvature, y: p2.y };
  } else {
    cp1 = { x: p1.x + dx * 0.4, y: p1.y + dy * 0.1 };
    cp2 = { x: p2.x - dx * 0.4, y: p2.y - dy * 0.1 };
  }

  const d = `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;

  // Find candidate midpoint on bezier
  let bestT = 0.5;
  let mid = bezierPoint(p1, cp1, cp2, p2, bestT);

  // Check collision against intermediate nodes
  if (allNodes && allNodes.length > 0) {
    const isColliding = (pt: Pt) => {
      for (const n of allNodes) {
        if (n.id === a.id || n.id === b.id) continue;
        const nw = nodeW(n);
        const nh = nodeH(n);
        if (
          pt.x >= n.x - 14 &&
          pt.x <= n.x + nw + 14 &&
          pt.y >= n.y - 12 &&
          pt.y <= n.y + nh + 12
        ) {
          return true;
        }
      }
      return false;
    };

    if (isColliding(mid)) {
      const midA = bezierPoint(p1, cp1, cp2, p2, 0.3);
      const midB = bezierPoint(p1, cp1, cp2, p2, 0.7);
      if (!isColliding(midA)) {
        mid = midA;
      } else if (!isColliding(midB)) {
        mid = midB;
      } else {
        mid = { x: mid.x, y: mid.y - 28 };
      }
    }
  }

  return { d, mid };
}

/* ------------------------------------------------------------------ */
/*  Kind styling                                                       */
/* ------------------------------------------------------------------ */

export const KIND_STYLE: Record<NodeKind, { bg: string; border: string; text: string; dot: string }> = {
  client: { bg: "#FFFFFF", border: "#D4D4D8", text: "#18181B", dot: "#52525B" },
  app: { bg: "#EFF6FF", border: "#93C5FD", text: "#1E40AF", dot: "#2563EB" },
  data: { bg: "#F5F3FF", border: "#C4B5FD", text: "#5B21B6", dot: "#7C3AED" },
  cache: { bg: "#F0FDF4", border: "#86EFAC", text: "#166534", dot: "#16A34A" },
  queue: { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412", dot: "#EA580C" },
  infra: { bg: "#F4F4F5", border: "#D4D4D8", text: "#3F3F46", dot: "#71717A" },
};

export const KIND_LABEL: Record<NodeKind, string> = {
  client: "Client",
  app: "Service",
  data: "Data",
  cache: "Cache",
  queue: "Event",
  infra: "Infra",
};

/* ------------------------------------------------------------------ */
/*  Component knowledge base — powers "Why?" hovers academy-wide       */
/* ------------------------------------------------------------------ */

const LIB: Record<string, NodeInfo> = {
  dns: { purpose: "Translates domain names into IP addresses before any connection starts.", latency: "~2–30ms cached · ~150ms cold", uses: ["first cache in every request", "traffic steering via records"], why: "Humans remember names; networks route numbers. DNS decouples the two.", fails: "Resolver outage = site unreachable regardless of server health. Always run secondary providers." },
  firewall: { purpose: "Filters traffic at the network edge by rules — IPs, ports, protocols.", latency: "<1ms", uses: ["blocking unwanted sources", "segmenting networks"], why: "Cheapest place to stop unwanted traffic is before it costs you compute.", fails: "Overly strict rules block legitimate users; rule sprawl becomes unauditable." },
  cdn: { purpose: "Globally distributed caches serving content from points of presence near users.", latency: "~10–40ms globally", uses: ["static assets & media", "absorbing spikes & DDoS", "TLS termination at edge"], why: "Physics: a PoP in Tokyo answers in 15ms what Virginia answers in 180ms — and absorbs ~95% of request volume.", fails: "Origin shield misconfig → cache-miss storm back to origin during incidents." },
  "load balancer": { purpose: "Distributes requests across healthy backends using health checks and algorithms like least-connections.", latency: "<1ms overhead", uses: ["horizontal scaling", "zero-downtime deploys", "failover"], why: "One box caps throughput and every failure is an outage. The LB turns 'a server' into 'a service'.", fails: "LB is itself critical infrastructure — run pairs. Bad health checks route to corpses." },
  "api gateway": { purpose: "Single managed entry point: auth, rate limits, quotas, routing, analytics.", latency: "+2–5ms policy checks", uses: ["per-client quotas", "protocol translation", "canary routing"], why: "Cross-cutting API concerns belong in one audited place, not copy-pasted across forty services.", fails: "Gateway outage = total outage; deploy it redundantly." },
  redis: { purpose: "In-memory data structure server: sub-millisecond reads for hot data, counters, locks and queues.", latency: "~0.1–2ms", uses: ["caching hot reads", "sessions", "rate-limit counters", "leaderboards"], why: "A 90% hit rate removes almost an entire read workload from the database — the highest-leverage performance tool that exists.", fails: "Cache death = instant 100% miss rate thundering onto the DB. Fail open to direct reads + warm up slowly." },
  postgresql: { purpose: "The durable source of truth: ACID transactions, rich indexes, constraints and decades of tooling.", latency: "~5–50ms per query", uses: ["system of record", "transactions", "complex joins & reporting"], why: "Correctness first: everything else in the architecture may be rebuildable — this table's data must not be.", fails: "Single primary = single point of failure. Replicate for HA; shard only when writes truly exceed vertical capacity." },
  database: { purpose: "Durable system of record with transactions and queryable structure.", latency: "~5–50ms", uses: ["source of truth", "transactions"], why: "Derived stores can be rebuilt; the database cannot lose a committed transaction.", fails: "Backups without restore drills are fiction. Test recovery quarterly." },
  kafka: { purpose: "Distributed event log: durable, ordered per partition, replayable by any number of consumers.", latency: "~5–15ms produce", uses: ["decoupling side effects", "event sourcing", "stream pipelines"], why: "Turning 'do X now' into 'record that X happened' lets consumers fail, restart and catch up independently.", fails: "Consumer lag IS your backlog metric — alert on growth, not just CPU." },
  queue: { purpose: "Buffers work between producers and consumers, absorbing bursts and isolating failures.", latency: "async", uses: ["smoothing spikes", "retryable jobs", "backpressure signal"], why: "Request paths should stay fast; slow work belongs off the hot path where it can retry safely.", fails: "Unbounded queues hide overload until memory dies. Bound them and shed load." },
  worker: { purpose: "Background processor consuming async work: media processing, emails, aggregations.", latency: "async", uses: ["image/video pipelines", "batched writes", "notifications"], why: "Scaling workers independently from APIs means a viral image never slows checkout.", fails: "Poison messages need DLQs, or one bad job blocks the lane forever." },
  monitoring: { purpose: "Metrics, logs and traces: the difference between diagnosing in minutes versus folklore.", latency: "—", uses: ["RED dashboards", "SLO burn alerts", "distributed traces"], why: "Users report symptoms minutes after dashboards could have paged you. Observability is an uptime feature.", fails: "Alert fatigue kills response; page only on user-visible pain." },
  kubernetes: { purpose: "Declarative container orchestration: scheduling, self-healing, rolling deploys, autoscaling.", latency: "—", uses: ["replicas & health gates", "rollouts + rollback", "resource isolation"], why: "Desired-state reconciliation turns fleet operations into reviewed YAML.", fails: "Wrong probes convert degradation into outages: liveness local, readiness honest." },
  docker: { purpose: "Packages apps with exact dependencies into immutable images running identically everywhere.", latency: "~ms cold start", uses: ["dev/prod parity", "immutable artifacts", "local stacks"], why: "'Works on my machine' dies here — the artifact, not the host, is the unit of deployment.", fails: "Untagged layers and dangling images fill disks; prune schedules are production hygiene." },
  "object store": { purpose: "Effectively-infinite durable blob storage (S3-style) with lifecycle and CDN integration.", latency: "~50–100ms first byte", uses: ["images & video originals", "backups", "data lakes"], why: "Petabyte-scale blobs never belong in a database — object storage plus CDN serves them cheaper and faster.", fails: "Bucket policies leak data; treat public access as an explicit, audited exception." },
  websocket: { purpose: "Persistent bidirectional socket over TCP for push updates both ways.", latency: "~ms per message", uses: ["chat", "live location", "collaboration"], why: "Polling wastes requests; WebSockets deliver events the moment they exist.", fails: "Connection lifecycle is state: track disconnects or leak presence maps until OOM." },
};

function libInfo(n: DiagramNode): NodeInfo | undefined {
  if (n.info) return n.info;
  const key = n.label.toLowerCase().trim();
  return LIB[key];
}

/* ------------------------------------------------------------------ */
/*  Reduced motion                                                     */
/* ------------------------------------------------------------------ */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */
/*  Edge rendering                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Edge rendering                                                     */
/* ------------------------------------------------------------------ */

const EDGE_STROKE = "#A1A1AA";

function EdgeEl({
  edge,
  a,
  b,
  allNodes,
  animated,
  selected,
  highlighted,
  dimmed,
  ids,
  onClick,
}: {
  edge: DiagramEdge;
  a: DiagramNode;
  b: DiagramNode;
  allNodes?: DiagramNode[];
  animated?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  ids: { arrow: string; arrowSel: string };
  onClick?: () => void;
}) {
  const { d, mid } = useMemo(() => edgePath(a, b, allNodes), [a, b, allNodes]);
  const color = selected || highlighted ? "#2563EB" : EDGE_STROKE;
  const labelText = edge.label ?? edge.protocol;
  const hasLatency = !!edge.latency;

  const pillWidth = useMemo(() => {
    if (!labelText) return 0;
    const len = labelText.length;
    return Math.max(36, Math.round(len * 6.8 + 18));
  }, [labelText]);

  const pillHeight = hasLatency ? 30 : 18;

  return (
    <g opacity={dimmed ? 0.22 : 1}>
      {onClick && (
        <path
          d={d}
          stroke="transparent"
          strokeWidth={16}
          fill="none"
          className="cursor-pointer"
          onClick={onClick}
        />
      )}
      <path
        d={d}
        stroke={color}
        strokeWidth={selected ? 2.25 : highlighted ? 2 : 1.5}
        fill="none"
        strokeDasharray={edge.dashed ? "5 5" : animated ? "6 8" : undefined}
        className={animated ? "animate-dashflow" : undefined}
        markerEnd={`url(#${selected || highlighted ? ids.arrowSel : ids.arrow})`}
      />
      {labelText && (
        <g transform={`translate(${mid.x}, ${mid.y})`}>
          {/* Background Badge Pill */}
          <rect
            x={-pillWidth / 2}
            y={-pillHeight / 2}
            width={pillWidth}
            height={pillHeight}
            rx={pillHeight / 2}
            fill="#FFFFFF"
            stroke={selected || highlighted ? "#93C5FD" : "#E4E4E7"}
            strokeWidth={1}
            filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"
          />
          {/* Label Text */}
          <text
            x={0}
            y={hasLatency ? -4 : 0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9.8}
            fontWeight={500}
            fontFamily="var(--font-mono)"
            fill={selected || highlighted ? "#1D4ED8" : "#3F3F46"}
          >
            {labelText}
          </text>
          {/* Latency sub-badge */}
          {hasLatency && (
            <text
              x={0}
              y={7}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8.2}
              fontWeight={600}
              fontFamily="var(--font-mono)"
              fill="#2563EB"
            >
              {edge.latency}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Node rendering                                                     */
/* ------------------------------------------------------------------ */

function KindGlyph({ kind }: { kind: NodeKind }) {
  const c = KIND_STYLE[kind];
  const common = { fill: "none", stroke: c.dot, strokeWidth: 1.4 } as const;
  switch (kind) {
    case "client":
      return (
        <svg viewBox="0 0 14 14" width={14} height={14} className="h-3.5 w-3.5" aria-hidden>
          <rect x="1.5" y="2.5" width="11" height="7" rx="1" {...common} />
          <path d="M5 12h4M7 9.5V12" {...common} strokeLinecap="round" />
        </svg>
      );
    case "app":
      return (
        <svg viewBox="0 0 14 14" width={14} height={14} className="h-3.5 w-3.5" aria-hidden>
          <rect x="2" y="2" width="10" height="10" rx="2" {...common} />
          <path d="M2 5.5h10M5.5 5.5V12" {...common} />
        </svg>
      );
    case "data":
      return (
        <svg viewBox="0 0 14 14" width={14} height={14} className="h-3.5 w-3.5" aria-hidden>
          <ellipse cx="7" cy="3.4" rx="5" ry="1.9" {...common} />
          <path d="M2 3.4v7.2c0 1.05 2.24 1.9 5 1.9s5-.85 5-1.9V3.4M2 7c0 1.05 2.24 1.9 5 1.9S12 8.05 12 7" {...common} />
        </svg>
      );
    case "cache":
      return (
        <svg viewBox="0 0 14 14" width={14} height={14} className="h-3.5 w-3.5" aria-hidden>
          <path d="M7.8 1.5 3 8h3l-.8 4.5L10 6H7l.8-4.5Z" {...common} strokeLinejoin="round" />
        </svg>
      );
    case "queue":
      return (
        <svg viewBox="0 0 14 14" width={14} height={14} className="h-3.5 w-3.5" aria-hidden>
          <path d="M2 4h10M2 7h10M2 10h6" {...common} strokeLinecap="round" />
        </svg>
      );
    case "infra":
      return (
        <svg viewBox="0 0 14 14" width={14} height={14} className="h-3.5 w-3.5" aria-hidden>
          <rect x="2" y="2.5" width="10" height="4" rx="1" {...common} />
          <rect x="2" y="8" width="10" height="4" rx="1" {...common} />
          <circle cx="4.4" cy="4.5" r="0.55" fill={c.dot} />
          <circle cx="4.4" cy="10" r="0.55" fill={c.dot} />
        </svg>
      );
  }
}

function statusVisual(n: DiagramNode) {
  switch (n.state) {
    case "down": return { border: "#DC2626", bg: "#FEF2F2", badge: "✕" };
    case "hot": return { border: "#EA580C", bg: "#FFF7ED", badge: "!" };
    case "warn": return { border: "#D97706", bg: "#FFFBEB", badge: "⚠" };
    default: return null;
  }
}

function NodeEl({
  n,
  ids,
  selected,
  dimmed,
  highlighted,
  hovered,
  interactive,
  onPointerDown,
  onHandleDown,
  linking,
  onEnter,
  onLeave,
  onClick,
}: {
  n: DiagramNode;
  ids: { arrow: string; arrowSel: string; glow: string; lift: string };
  selected?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  hovered?: boolean;
  interactive?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onHandleDown?: (e: React.PointerEvent) => void;
  linking?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}) {
  const w = nodeW(n);
  const h = nodeH(n);
  const s = KIND_STYLE[n.kind];
  const sv = statusVisual(n);
  const borderColor = sv?.border ?? s.border;
  const bgColor = sv?.bg ?? s.bg;
  const info = libInfo(n);

  // Dynamic font sizing for long labels
  const labelLen = n.label.length;
  const labelFontSize = labelLen > 22 ? 11.0 : labelLen > 16 ? 11.8 : 12.5;

  const subLen = n.sub ? n.sub.length : 0;
  const subFontSize = subLen > 24 ? 8.8 : 9.4;

  return (
    <g
      transform={`translate(${n.x}, ${n.y})`}
      opacity={dimmed ? 0.25 : 1}
      style={{ cursor: interactive ? "pointer" : undefined }}
      onPointerDown={onPointerDown}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
      data-node-id={n.id}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      aria-label={interactive ? `${n.label}: ${info?.purpose ?? n.sub ?? KIND_LABEL[n.kind]}` : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Fat hit area */}
      {interactive && <rect x={-6} y={-6} width={w + 12} height={h + 12} fill="transparent" />}
      {highlighted && (
        <rect
          x={-4}
          y={-4}
          width={w + 8}
          height={h + 8}
          rx={14}
          fill="none"
          stroke="#2563EB"
          strokeWidth={1.75}
          strokeDasharray="4 3"
          opacity={0.9}
        />
      )}
      {/* Node Box */}
      <rect
        width={w}
        height={h}
        rx={10}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={selected ? 2.25 : 1.35}
        filter={hovered && !selected ? `url(#${ids.lift})` : selected ? `url(#${ids.glow})` : undefined}
      />
      {/* Status indicator badge */}
      {n.state === "down" || n.state === "warn" || n.state === "hot" ? (
        <g transform={`translate(${w - 20}, 7)`}>
          <circle
            cx={7}
            cy={7}
            r={6.5}
            fill={n.state === "down" ? "#DC2626" : n.state === "hot" ? "#EA580C" : "#D97706"}
          />
          {n.state === "down" ? (
            <text x={7} y={9.8} textAnchor="middle" fontSize={8} fontWeight={800} fill="#fff">
              ✕
            </text>
          ) : (
            <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
          )}
        </g>
      ) : null}
      {/* Kind icon glyph */}
      <g transform={`translate(12, ${h / 2 - (n.sub ? 13 : 7)})`} aria-hidden>
        <KindGlyph kind={n.kind} />
      </g>
      {/* Node Label — Full Text, never cut off */}
      <text
        x={33}
        y={n.sub ? h / 2 - 5 : h / 2 + 1}
        dominantBaseline={n.sub ? undefined : "central"}
        fontSize={labelFontSize}
        fontWeight={600}
        fontFamily="var(--font-sans)"
        fill={sv?.border === "#DC2626" ? "#991B1B" : s.text}
        style={{ textDecoration: n.state === "down" ? "line-through" : undefined }}
      >
        {n.label}
      </text>
      {/* Node Subtitle — Full Subtitle */}
      {n.sub && (
        <text
          x={33}
          y={h / 2 + 11}
          fontSize={subFontSize}
          fontWeight={500}
          fontFamily="var(--font-mono)"
          fill="#52525B"
        >
          {n.sub}
        </text>
      )}
      {/* Edit Mode connector handle */}
      {onHandleDown && !linking && (
        <circle
          cx={w}
          cy={h / 2}
          r={6.5}
          fill="#fff"
          stroke="#71717A"
          strokeWidth={1.5}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandleDown(e);
          }}
          data-handle="true"
        />
      )}
      {linking && <circle cx={w} cy={h / 2} r={6.5} fill="#2563EB" />}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG-native hover tooltip                                           */
/* ------------------------------------------------------------------ */

function NodeTooltip({ n, bb }: { n: DiagramNode; bb: { x: number; y: number; w: number; h: number } }) {
  const info = libInfo(n);
  if (!info) return null;
  const w = nodeW(n);
  const cx = n.x + w / 2;
  const tw = 220;
  const lines: string[] = [];
  const words = info.purpose.split(" ");
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length > 34) {
      lines.push(cur.trim());
      cur = word;
    } else cur += " " + word;
  }
  if (cur.trim()) lines.push(cur.trim());
  const th = 26 + lines.length * 13 + (info.latency ? 16 : 0) + 8;
  const above = n.y - bb.y > th + 18;
  const ty = above ? n.y - th - 12 : n.y + nodeH(n) + 12;
  let tx = Math.min(Math.max(cx - tw / 2, bb.x + 6), bb.x + bb.w - tw - 6);

  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={tw} height={th} rx={9} fill="#18181B" opacity={0.96} filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))" />
      <path d={`M ${cx - 5} ${above ? ty + th : ty} l 5 ${above ? 5 : -5} l 5 ${above ? -5 : 5} z`} fill="#18181B" />
      <text x={tx + 12} y={ty + 17} fontSize={11} fontWeight={700} fontFamily="var(--font-sans)" fill="#fff">
        {n.label}
      </text>
      {info.latency && (
        <text x={tx + tw - 12} y={ty + 17} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="#93C5FD">
          {info.latency}
        </text>
      )}
      {lines.map((ln, i) => (
        <text key={i} x={tx + 12} y={ty + 33 + i * 13} fontSize={9.5} fontFamily="var(--font-sans)" fill="#D4D4D8">
          {ln}
        </text>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Packet animation layer                                             */
/* ------------------------------------------------------------------ */

interface WaypointPath {
  pts: Pt[];
  cum: number[];
  total: number;
}

function buildWaypoints(flow: DiagramFlow, nodeMap: Map<string, DiagramNode>): WaypointPath | null {
  const pts: Pt[] = [];
  for (const id of flow.path) {
    const n = nodeMap.get(id);
    if (!n) return null;
    pts.push({ x: n.x + nodeW(n) / 2, y: n.y + nodeH(n) / 2 });
  }
  if (pts.length < 2) return null;
  const cum = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(total);
  }
  return { pts, cum, total };
}

function PacketLayer({
  flows,
  nodeMap,
  paused,
  reducedMotion,
  colorFor,
}: {
  flows: DiagramFlow[];
  nodeMap: Map<string, DiagramNode>;
  paused: boolean;
  reducedMotion: boolean;
  colorFor: (f: DiagramFlow) => string;
}) {
  const groupRef = useRef<SVGGElement>(null);
  const circleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const built = useMemo(
    () =>
      flows
        .map((f) => ({ flow: f, wp: buildWaypoints(f, nodeMap) }))
        .filter((x): x is { flow: DiagramFlow; wp: WaypointPath } => !!x.wp),
    [flows, nodeMap]
  );

  useEffect(() => {
    if (reducedMotion || paused || built.length === 0) return;
    let raf = 0;
    let last = performance.now();
    const progress = built.map(() => 0);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      built.forEach(({ flow, wp }, i) => {
        if (!flow.loop) {
          progress[i] += ((flow.speed ?? 240) * dt) / wp.total;
          if (progress[i] > 1) progress[i] = 0;
        } else {
          progress[i] = (progress[i] + ((flow.speed ?? 240) * dt) / wp.total) % 1;
        }
        const dist = progress[i] * wp.total;
        let seg = 0;
        while (seg < wp.cum.length - 2 && wp.cum[seg + 1] < dist) seg++;
        const t = (dist - wp.cum[seg]) / Math.max(0.0001, wp.cum[seg + 1] - wp.cum[seg]);
        const x = wp.pts[seg].x + (wp.pts[seg + 1].x - wp.pts[seg].x) * t;
        const y = wp.pts[seg].y + (wp.pts[seg + 1].y - wp.pts[seg].y) * t;
        const c = circleRefs.current[i];
        if (c) c.setAttribute("transform", `translate(${x.toFixed(1)}, ${y.toFixed(1)})`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [built, paused, reducedMotion]);

  if (reducedMotion || built.length === 0) return null;

  let idx = 0;
  return (
    <g ref={groupRef}>
      {built.map(({ flow }, i) => (
        <circle
          key={flow.id ?? i}
          ref={(el) => {
            circleRefs.current[idx++] = el;
          }}
          r={4.5}
          fill={colorFor(flow)}
          opacity={paused ? 0.35 : 0.95}
        >
          <animate attributeName="opacity" values="0.95;0.55;0.95" dur="0.9s" repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Zoom controls                                                      */
/* ------------------------------------------------------------------ */

function ZoomControls({
  k,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  k: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const btn = "flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-ink-mute transition-colors hover:border-accent hover:text-accent font-mono text-xs";
  return (
    <div
      className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-line bg-surface/95 p-1 shadow-pop backdrop-blur-sm z-10"
      role="group"
      aria-label="Diagram zoom controls"
    >
      <button className={btn} onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
        −
      </button>
      <span className="tabular w-11 text-center font-mono text-2xs text-ink-faint">
        {Math.round(k * 100)}%
      </span>
      <button className={btn} onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
        +
      </button>
      <button className={btn} onClick={onReset} aria-label="Fit to screen" title="Fit to screen">
        ⌂
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export interface ArchCanvasProps {
  graph: Graph;
  mode?: "static" | "explore" | "edit";
  /** Fixed viewport height for explore/edit modes. Ignored in static mode (height derives from content). */
  height?: number;
  /** Max rendered height for static mode (readability floor may exceed it → scroll). */
  maxHeight?: number;
  className?: string;
  selectedId?: string | null;
  selectedEdge?: number | null;
  onSelectNode?: (id: string | null) => void;
  onSelectEdge?: (idx: number | null) => void;
  onMoveNode?: (id: string, x: number, y: number) => void;
  onConnect?: (from: string, to: string) => void;
  highlightNodes?: string[];
  dimExcept?: string[] | null;
  activeFlowEdges?: string[];
  gridBg?: boolean;
  /** Show hover tooltips with component explanations. Default true outside edit mode. */
  tooltips?: boolean;
  /** Pause packet animations externally. */
  packetsPaused?: boolean;
  /** Render packet flows from graph.flows. Default true. */
  packets?: boolean;
  /** Force focus dimming around selectedId even without onSelectNode. */
  focusOnSelect?: boolean;
}

export function ArchCanvas({
  graph,
  mode = "static",
  height,
  maxHeight,
  className,
  selectedId,
  selectedEdge,
  onSelectNode,
  onSelectEdge,
  onMoveNode,
  onConnect,
  highlightNodes,
  dimExcept,
  activeFlowEdges,
  gridBg,
  tooltips,
  packetsPaused,
  packets = true,
  focusOnSelect,
}: ArchCanvasProps) {
  const rawId = useId();
  const uidStr = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const ids = useMemo(
    () => ({
      arrow: `arw-${uidStr}`,
      arrowSel: `arws-${uidStr}`,
      glow: `glow-${uidStr}`,
      lift: `lift-${uidStr}`,
    }),
    [uidStr]
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const editing = mode === "edit";
  const exploring = mode === "explore";
  const reduced = usePrefersReducedMotion();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const bb = useMemo(() => graphBBox(graph), [graph]);

  const initialView = useMemo(() => {
    if (!exploring) return { x: 40, y: 30, k: 1 };
    const estW = 860;
    const estH = height ?? 440;
    const scaleX = estW / bb.w;
    const scaleY = estH / bb.h;
    const k = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.92, 0.45), 1.15);
    return {
      k,
      x: (estW - bb.w * k) / 2 - bb.x * k,
      y: (estH - bb.h * k) / 2 - bb.y * k,
    };
  }, [exploring, bb, height]);

  const [view, setView] = useState(initialView);

  /* ---- measured responsive scaling for static mode ---- */
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerW(r.width);
      setContainerH(r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const staticScale = useMemo(() => {
    if (editing || exploring) return 1;
    if (containerW === 0) return MIN_SCALE;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, containerW / bb.w));
  }, [editing, exploring, containerW, bb]);

  const svgPx = editing || exploring ? null : Math.round(bb.w * staticScale);
  const svgPy = editing || exploring ? null : Math.round(bb.h * staticScale);
  const overflowing = !editing && !exploring && svgPx !== null && svgPx > containerW + 1;

  /* ---- viewport transform for explore/edit ---- */
  const drag = useRef<
    | null
    | { type: "pan"; sx: number; sy: number; ox: number; oy: number }
    | { type: "node"; id: string; dx: number; dy: number }
    | { type: "link"; from: string }
  >(null);
  const [ghost, setGhost] = useState<Pt | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const interactedRef = useRef(false);

  const nodeMap = useMemo(() => {
    const m = new Map<string, DiagramNode>();
    (graph.nodes ?? []).forEach((n) => m.set(n.id, n));
    return m;
  }, [graph.nodes]);

  /* neighbor sets for focus dimming */
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of graph.edges ?? []) {
      if (!m.has(e.from)) m.set(e.from, new Set());
      if (!m.has(e.to)) m.set(e.to, new Set());
      m.get(e.from)!.add(e.to);
      m.get(e.to)!.add(e.from);
    }
    return m;
  }, [graph.edges]);

  const toCanvas = useCallback(
    (clientX: number, clientY: number): Pt => {
      const rect = svgRef.current!.getBoundingClientRect();
      if (editing || exploring) {
        return { x: (clientX - rect.left - view.x) / view.k, y: (clientY - rect.top - view.y) / view.k };
      }
      const scale = staticScale;
      return { x: (clientX - rect.left) / scale + bb.x, y: (clientY - rect.top) / scale + bb.y };
    },
    [editing, exploring, view, staticScale, bb]
  );

  /* ---------- pointer handlers ---------- */
  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (!(editing || exploring)) return;
    if ((e.target as Element).closest("[data-node-id]")) return;
    interactedRef.current = true;
    onSelectNode?.(null);
    onSelectEdge?.(null);
    drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onNodePointerDown = (n: DiagramNode) => (e: React.PointerEvent) => {
    if (!editing) return;
    e.stopPropagation();
    onSelectNode?.(n.id);
    onSelectEdge?.(null);
    const p = toCanvas(e.clientX, e.clientY);
    drag.current = { type: "node", id: n.id, dx: p.x - n.x, dy: p.y - n.y };
  };

  const onHandleDown = (n: DiagramNode) => (e: React.PointerEvent) => {
    if (!editing) return;
    e.stopPropagation();
    drag.current = { type: "link", from: n.id };
    setLinkFrom(n.id);
    setGhost({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!(editing || exploring)) return;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.type === "pan") {
        setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
      } else if (d.type === "node") {
        const p = toCanvas(e.clientX, e.clientY);
        const nx = Math.round((p.x - d.dx) / 7) * 7;
        const ny = Math.round((p.y - d.dy) / 7) * 7;
        onMoveNode?.(d.id, nx, ny);
      } else if (d.type === "link") {
        setGhost({ x: e.clientX, y: e.clientY });
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (d?.type === "link") {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const g = el?.closest("[data-node-id]") as HTMLElement | null;
        const target = g?.dataset.nodeId;
        if (target && target !== d.from) onConnect?.(d.from, target);
        setLinkFrom(null);
        setGhost(null);
      }
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [editing, exploring, toCanvas, onMoveNode, onConnect]);

  /* wheel zoom for explore/edit */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !(editing || exploring)) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && editing === false && exploring) {
        if (!e.ctrlKey) return;
      }
      e.preventDefault();
      interactedRef.current = true;
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.35, v.k * (e.deltaY > 0 ? 0.92 : 1.08)));
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editing, exploring]);

  const zoomBy = (factor: number) => {
    interactedRef.current = true;
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.35, v.k * factor));
      return { ...v, k };
    });
  };

  /* fit-to-content transform for explore mode */
  const fitView = useCallback(() => {
    if (!bb || (graph.nodes ?? []).length === 0) return;
    const el = wrapRef.current;
    const rect = el ? el.getBoundingClientRect() : null;
    const targetW = rect && rect.width > 0 ? rect.width : (containerW > 0 ? containerW : 860);
    const targetH = rect && rect.height > 0 ? rect.height : (containerH > 0 ? containerH : (height ?? 440));

    const scaleX = targetW / bb.w;
    const scaleY = targetH / bb.h;
    const optimalScale = Math.min(scaleX, scaleY);
    const k = Math.min(Math.max(optimalScale * 0.93, 0.42), 1.18);

    setView({
      k,
      x: (targetW - bb.w * k) / 2 - bb.x * k,
      y: (targetH - bb.h * k) / 2 - bb.y * k,
    });
  }, [bb, graph.nodes, containerW, containerH, height]);

  useEffect(() => {
    if (!exploring) return;
    if (!interactedRef.current) fitView();
  }, [exploring, containerW, containerH, fitView]);

  const resetView = () => {
    interactedRef.current = false;
    fitView();
  };

  const ghostLine = useMemo(() => {
    if (!linkFrom || !ghost || !svgRef.current) return null;
    const from = nodeMap.get(linkFrom);
    if (!from) return null;
    const p = toCanvas(ghost.x, ghost.y);
    const start = { x: from.x + nodeW(from), y: from.y + nodeH(from) / 2 };
    return { d: `M ${start.x} ${start.y} L ${p.x} ${p.y}` };
  }, [linkFrom, ghost, nodeMap, toCanvas]);

  /* ---- derived visual state ---- */
  const dimSet = dimExcept ? new Set(dimExcept) : null;
  const hlSet = highlightNodes ? new Set(highlightNodes) : null;
  const flowSet = new Set(activeFlowEdges ?? []);
  const showTooltips = tooltips !== undefined ? tooltips : !editing;
  const hoverNode = hoverId ? nodeMap.get(hoverId) : null;

  /* focus dimming: when a node is selected (and caller didn't supply dimExcept),
     keep it + neighbors lit and dim the rest */
  const effectiveDim =
    dimExcept ??
    (focusOnSelect && selectedId
      ? (graph.nodes ?? [])
          .map((n) => n.id)
          .filter((id) => id === selectedId || neighbors.get(selectedId)?.has(id))
      : null);

  const flowsEnabled = packets && !!graph.flows?.length;

  const inner = (
    <>
      {graph.regions?.map((r) => (
        <g key={r.id}>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={14}
            fill="#FAFAF9"
            stroke="#E4E4E7"
            strokeDasharray="6 5"
          />
          <text
            x={r.x + 14}
            y={r.y + 20}
            fontSize={10.5}
            fontWeight={600}
            fontFamily="var(--font-mono)"
            fill="#A1A1AA"
            letterSpacing={1.2}
          >
            {r.label.toUpperCase()}
          </text>
        </g>
      ))}

      {(graph.edges ?? []).map((e, i) => {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) return null;
        const flowing = e.flow || flowSet.has(`${e.from}->${e.to}`);
        const isHl = flowSet.has(`${e.from}->${e.to}`);
        return (
          <EdgeEl
            key={`${e.from}-${e.to}-${i}`}
            edge={e}
            a={a}
            b={b}
            allNodes={graph.nodes}
            animated={flowing}
            highlighted={isHl}
            selected={selectedEdge === i}
            dimmed={effectiveDim ? !effectiveDim.includes(a.id) || !effectiveDim.includes(b.id) : false}
            ids={ids}
            onClick={editing ? () => onSelectEdge?.(i) : undefined}
          />
        );
      })}

      {flowsEnabled && (
        <PacketLayer
          flows={graph.flows!}
          nodeMap={nodeMap}
          paused={!!packetsPaused}
          reducedMotion={reduced}
          colorFor={(f) => f.color ?? "#2563EB"}
        />
      )}

      {(graph.nodes ?? []).map((n) => {
        const isSel = selectedId === n.id;
        const isNb = selectedId ? neighbors.get(selectedId)?.has(n.id) ?? false : false;
        return (
          <NodeEl
            key={n.id}
            n={n}
            ids={ids}
            selected={isSel}
            highlighted={hlSet?.has(n.id)}
            hovered={hoverId === n.id}
            interactive={!editing}
            dimmed={effectiveDim ? !effectiveDim.includes(n.id) && !(focusOnSelect && selectedId && isNb) : false}
            onPointerDown={editing ? onNodePointerDown(n) : undefined}
            onHandleDown={editing ? onHandleDown(n) : undefined}
            linking={linkFrom === n.id}
            onEnter={() => setHoverId(n.id)}
            onLeave={() => setHoverId((h) => (h === n.id ? null : h))}
            onClick={
              !editing && onSelectNode
                ? () => onSelectNode(selectedId === n.id ? null : n.id)
                : undefined
            }
          />
        );
      })}

      {showTooltips && hoverNode && !editing && <NodeTooltip n={hoverNode} bb={bb} />}

      {ghostLine && <path d={ghostLine.d} stroke="#2563EB" strokeWidth={1.75} strokeDasharray="5 4" fill="none" />}
    </>
  );

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative rounded-xl border border-line bg-[#FBFBFA]",
        editing
          ? "overflow-hidden grid-paper"
          : overflowing
            ? "overflow-x-auto"
            : "overflow-hidden",
        className
      )}
      style={{ height: (editing || exploring) && height ? height : undefined }}
    >
      <svg
        ref={svgRef}
        className={cn("block select-none", editing || exploring ? "h-full w-full touch-none" : "max-w-none")}
        role="img"
        aria-label={(graph.nodes ?? []).length ? `Architecture diagram with ${(graph.nodes ?? []).length} components` : "Empty diagram"}
        width={editing || exploring ? undefined : (svgPx ?? undefined)}
        height={editing || exploring ? undefined : (svgPy ?? undefined)}
        style={
          editing || exploring
            ? undefined
            : { width: svgPx ? `${svgPx}px` : "100%", height: svgPy ? `${svgPy}px` : "auto", maxWidth: "none" }
        }
        viewBox={
          editing || exploring
            ? undefined
            : `${bb.x} ${bb.y} ${Math.max(bb.w, 200)} ${Math.max(bb.h, 120)}`
        }
        preserveAspectRatio={editing || exploring ? undefined : "xMidYMid meet"}
        onPointerDown={onSvgPointerDown}
      >
        <defs>
          <marker
            id={ids.arrow}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 1.5 L9 5 L0 8.5 z" fill={EDGE_STROKE} />
          </marker>
          <marker
            id={ids.arrowSel}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 1.5 L9 5 L0 8.5 z" fill="#2563EB" />
          </marker>
          <filter id={ids.glow} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#2563EB" floodOpacity="0.38" />
          </filter>
          <filter id={ids.lift} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#18181B" floodOpacity="0.14" />
          </filter>
        </defs>

        {editing || exploring ? (
          <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>{inner}</g>
        ) : (
          inner
        )}
      </svg>

      {(editing || exploring) && (graph.nodes ?? []).length > 0 && (
        <ZoomControls k={view.k} onZoomIn={() => zoomBy(1.18)} onZoomOut={() => zoomBy(0.85)} onReset={resetView} />
      )}

      {/* minimap for edit mode */}
      {editing && (graph.nodes ?? []).length > 0 && <Minimap graph={graph} view={view} />}

      {/* scroll affordance */}
      {overflowing && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-line bg-surface/95 px-2 py-1 font-mono text-2xs text-ink-faint shadow-node">
          scroll →
        </div>
      )}
    </div>
  );
}

function Minimap({ graph, view }: { graph: Graph; view: { x: number; y: number; k: number } }) {
  const bb = graphBBox(graph);
  const W = 132;
  const H = 88;
  const s = Math.min(W / bb.w, H / bb.h);
  return (
    <div className="absolute bottom-3 right-3 rounded-lg border border-line bg-surface/95 p-1.5 shadow-pop backdrop-blur-sm" aria-hidden>
      <svg width={W} height={H}>
        {(graph.edges ?? []).map((e, i) => {
          const a = graph.nodes.find((n) => n.id === e.from);
          const b = graph.nodes.find((n) => n.id === e.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={(a.x - bb.x) * s + 4}
              y1={(a.y - bb.y) * s + 4}
              x2={(b.x - bb.x) * s + 4}
              y2={(b.y - bb.y) * s + 4}
              stroke="#D4D4D8"
              strokeWidth="1"
            />
          );
        })}
        {(graph.nodes ?? []).map((n) => (
          <rect
            key={n.id}
            x={(n.x - bb.x) * s + 4}
            y={(n.y - bb.y) * s + 4}
            width={nodeW(n) * s}
            height={nodeH(n) * s}
            rx={2}
            fill={KIND_STYLE[n.kind].dot}
            opacity={0.75}
          />
        ))}
        <rect
          x={(-view.x / view.k - bb.x) * s + 4}
          y={(-view.y / view.k - bb.y) * s + 4}
          width={(900 / view.k) * s}
          height={(520 / view.k) * s}
          rx={3}
          fill="none"
          stroke="#2563EB"
          strokeWidth="1.25"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

export function DiagramLegend({ kinds }: { kinds?: NodeKind[] }) {
  const items: NodeKind[] = kinds ?? ["client", "app", "cache", "data", "queue", "infra"];
  const labels: Record<NodeKind, string> = {
    client: "Client",
    app: "Application",
    data: "Data layer",
    cache: "Cache / edge",
    queue: "Queue / event",
    infra: "Infrastructure",
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-2xs text-ink-mute">
          <span
            className="h-2.5 w-2.5 rounded-[3px] border"
            style={{ background: KIND_STYLE[k].bg, borderColor: KIND_STYLE[k].border }}
          />
          {labels[k]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-mute">
        <svg width="26" height="8" aria-hidden>
          <line x1="0" y1="4" x2="26" y2="4" stroke="#A1A1AA" strokeWidth="1.5" />
        </svg>
        sync request
      </span>
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-mute">
        <svg width="26" height="8" aria-hidden>
          <line x1="0" y1="4" x2="26" y2="4" stroke="#A1A1AA" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        async event
      </span>
    </div>
  );
}
