"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchCanvas } from "@/components/diagram/ArchCanvas";
import type { Graph, NodeKind } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal, Tabs } from "@/components/ui/Controls";

/* ------------------------------------------------------------------ */
/*  Types & palette                                                    */
/* ------------------------------------------------------------------ */

interface BNode {
  id: string;
  label: string;
  sub?: string;
  kind: NodeKind;
  x: number;
  y: number;
}
interface BEdge {
  from: string;
  to: string;
}
interface Doc {
  nodes: BNode[];
  edges: BEdge[];
}

const PALETTE: { kind: NodeKind; label: string; sub: string }[] = [
  { kind: "client", label: "Browser", sub: "web client" },
  { kind: "client", label: "Mobile", sub: "native app" },
  { kind: "infra", label: "DNS", sub: "traffic entry" },
  { kind: "infra", label: "Firewall", sub: "edge filter" },
  { kind: "cache", label: "CDN", sub: "edge cache" },
  { kind: "app", label: "Load Balancer", sub: "L7 routing" },
  { kind: "app", label: "API Gateway", sub: "auth + quotas" },
  { kind: "app", label: "Service", sub: "stateless api" },
  { kind: "app", label: "Worker", sub: "async jobs" },
  { kind: "cache", label: "Redis", sub: "cache · counters" },
  { kind: "data", label: "PostgreSQL", sub: "source of truth" },
  { kind: "data", label: "Replica", sub: "read scaling" },
  { kind: "data", label: "Object Store", sub: "blobs · S3" },
  { kind: "queue", label: "Kafka", sub: "event log" },
  { kind: "queue", label: "Queue", sub: "task buffer" },
  { kind: "infra", label: "Kubernetes", sub: "orchestration" },
  { kind: "infra", label: "Docker", sub: "runtime" },
  { kind: "infra", label: "Monitoring", sub: "metrics · alerts" },
];

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

const TEMPLATES: { name: string; desc: string; doc: Doc }[] = [
  {
    name: "Scalable Web App",
    desc: "CDN → LB → stateless services → cache → replicated Postgres",
    doc: {
      nodes: [
        { id: "dns", label: "DNS", sub: "traffic entry", kind: "infra", x: 20, y: 140 },
        { id: "cdn", label: "CDN", sub: "edge cache", kind: "cache", x: 190, y: 140 },
        { id: "lb", label: "Load Balancer", sub: "L7 routing", kind: "app", x: 380, y: 140 },
        { id: "api1", label: "Service", sub: "api #1", kind: "app", x: 600, y: 50 },
        { id: "api2", label: "Service", sub: "api #2", kind: "app", x: 600, y: 230 },
        { id: "redis", label: "Redis", sub: "hot reads", kind: "cache", x: 830, y: 50 },
        { id: "pg", label: "PostgreSQL", sub: "primary", kind: "data", x: 830, y: 230 },
        { id: "rep", label: "Replica", sub: "read scaling", kind: "data", x: 1050, y: 230 },
        { id: "mon", label: "Monitoring", sub: "metrics · alerts", kind: "infra", x: 1050, y: 50 },
      ],
      edges: [
        { from: "dns", to: "cdn" },
        { from: "cdn", to: "lb" },
        { from: "lb", to: "api1" },
        { from: "lb", to: "api2" },
        { from: "api1", to: "redis" },
        { from: "api2", to: "redis" },
        { from: "api1", to: "pg" },
        { from: "api2", to: "pg" },
        { from: "pg", to: "rep" },
      ],
    },
  },
  {
    name: "Event-Driven Pipeline",
    desc: "Producers → Kafka → worker fleet → database",
    doc: {
      nodes: [
        { id: "gw", label: "API Gateway", sub: "auth + quotas", kind: "app", x: 20, y: 130 },
        { id: "svc", label: "Order Service", sub: "producer", kind: "app", x: 220, y: 130 },
        { id: "kafka", label: "Kafka", sub: "orders.events", kind: "queue", x: 450, y: 130 },
        { id: "w1", label: "Worker", sub: "billing", kind: "app", x: 680, y: 40 },
        { id: "w2", label: "Worker", sub: "notifications", kind: "app", x: 680, y: 220 },
        { id: "pg", label: "PostgreSQL", sub: "source of truth", kind: "data", x: 900, y: 130 },
        { id: "rc", label: "Redis", sub: "dedup keys", kind: "cache", x: 900, y: 250 },
      ],
      edges: [
        { from: "gw", to: "svc" },
        { from: "svc", to: "kafka" },
        { from: "kafka", to: "w1" },
        { from: "kafka", to: "w2" },
        { from: "w1", to: "pg" },
        { from: "w2", to: "rc" },
      ],
    },
  },
  {
    name: "Media Platform",
    desc: "Upload pipeline with object storage + processing workers",
    doc: {
      nodes: [
        { id: "c", label: "Browser", sub: "web client", kind: "client", x: 20, y: 120 },
        { id: "lb", label: "Load Balancer", sub: "L7 routing", kind: "app", x: 210, y: 120 },
        { id: "api", label: "Service", sub: "upload api", kind: "app", x: 420, y: 120 },
        { id: "s3", label: "Object Store", sub: "originals", kind: "data", x: 650, y: 40 },
        { id: "q", label: "Queue", sub: "process tasks", kind: "queue", x: 650, y: 200 },
        { id: "wk", label: "Worker", sub: "resize · transcode", kind: "app", x: 870, y: 200 },
        { id: "cdno", label: "CDN", sub: "serve variants", kind: "cache", x: 1080, y: 120 },
      ],
      edges: [
        { from: "c", to: "lb" },
        { from: "lb", to: "api" },
        { from: "api", to: "s3" },
        { from: "api", to: "q" },
        { from: "q", to: "wk" },
        { from: "wk", to: "s3" },
        { from: "s3", to: "cdno" },
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Intelligence engine                                                */
/* ------------------------------------------------------------------ */

type Severity = "ok" | "info" | "warn" | "critical";
interface Finding {
  severity: Severity;
  title: string;
  detail: string;
  fix: string[];
  nodes: string[];
}

function analyze(doc: Doc): Finding[] {
  const f: Finding[] = [];
  const { nodes, edges } = doc;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isData = (n?: BNode) => !!n && n.kind === "data";
  const isCache = (n?: BNode) => !!n && n.kind === "cache";
  const isApp = (n?: BNode) => !!n && n.kind === "app";

  const dataNodes = nodes.filter((n) => n.kind === "data");
  const cacheNodes = nodes.filter((n) => n.kind === "cache");
  const appNodes = nodes.filter((n) => n.kind === "app");
  const queueNodes = nodes.filter((n) => n.kind === "queue");
  const infraNodes = nodes.filter((n) => n.kind === "infra");
  const clientNodes = nodes.filter((n) => n.kind === "client");

  if (nodes.length === 0) return f;

  /* Redis as sole source of truth */
  const redisOnly =
    nodes.some((n) => n.label.toLowerCase().includes("redis")) && dataNodes.length === 0;
  if (redisOnly) {
    f.push({
      severity: "critical",
      title: "Redis appears to be the only durable store",
      detail:
        "Redis is generally inappropriate as the only source of truth for transactional data: failover can lose recent writes, memory bounds eviction, and there are no cross-key transactions under concurrency.",
      fix: ["Add PostgreSQL as the system of record", "Treat Redis as derived/cache state only"],
      nodes: nodes.filter((n) => n.label.toLowerCase().includes("redis")).map((n) => n.id),
    });
  }

  /* Database single point of failure */
  if (dataNodes.length === 1 && (appNodes.length >= 2 || clientNodes.length >= 1)) {
    const db = dataNodes[0];
    f.push({
      severity: "critical",
      title: `${db.label} is a single point of failure`,
      detail:
        "One database instance means every failure is an outage: hardware death, deploys, even maintenance windows take the product down.",
      fix: ["Add a standby replica with automatic failover", "Or adopt a managed database with built-in HA"],
      nodes: [db.id],
    });
  }

  /* Connection exhaustion */
  for (const d of dataNodes) {
    const sources = [...new Set(edges.filter((e) => e.to === d.id && byId.get(e.from)?.kind !== "data").map((e) => e.from))];
    if (sources.length >= 4) {
      f.push({
        severity: "warn",
        title: `Potential connection pool exhaustion at ${d.label}`,
        detail: `${sources.length} services connect directly to this database. Each holds a pool of 10–25 connections; Postgres degrades badly beyond a few hundred.`,
        fix: [
          "Put PgBouncer (transaction mode) between services and the database",
          "Give each service its own database schema/database",
          "Route more reads through the cache tier",
        ],
        nodes: [d.id, ...sources],
      });
    }
  }

  /* Queue without consumer */
  for (const q of queueNodes) {
    const consumed = edges.some((e) => e.from === q.id);
    if (!consumed) {
      f.push({
        severity: "warn",
        title: `${q.label} has no consumer`,
        detail: "Events published here go nowhere: unbounded memory growth and silent feature loss.",
        fix: ["Attach a worker/consumer service", "Alert on queue depth as backpressure signal"],
        nodes: [q.id],
      });
    }
  }

  /* Clients bypassing load balancer */
  for (const c of clientNodes) {
    const targets = edges.filter((e) => e.from === c.id).map((e) => byId.get(e.to));
    const directApps = targets.filter(isApp);
    const hasBalancer = nodes.some(
      (n) => (isApp(n) || isCache(n)) && /balancer|gateway/i.test(n.label)
    );
    if (directApps.length >= 2 && !hasBalancer) {
      f.push({
        severity: "warn",
        title: "Multiple services exposed without a load balancer",
        detail:
          "Clients routing themselves across instances can't do health checks, canary weights, or graceful drain — and amplifies failure during deploys.",
        fix: ["Insert a load balancer or API gateway in front of the service tier"],
        nodes: [c.id, ...directApps.map((n) => n!.id)],
      });
    }
  }

  /* No caching layer with real read traffic implied */
  if (dataNodes.length > 0 && cacheNodes.length === 0 && nodes.length >= 6) {
    f.push({
      severity: "info",
      title: "No caching layer in front of the database",
      detail:
        "Most production workloads are read-heavy. Without a cache, every feed/profile/detail view pays full database latency and capacity.",
      fix: ["Add Redis cache-aside for hot reads", "Use a CDN for static assets and media"],
      nodes: dataNodes.map((n) => n.id),
    });
  }

  /* Observability */
  if (nodes.length >= 8 && !infraNodes.some((n) => /monitor|metric|trac|log|alert/i.test(n.label))) {
    f.push({
      severity: "info",
      title: "No observability component",
      detail:
        "Without metrics/logs/traces, the first signal of overload will be user complaints — minutes after dashboards could have paged you.",
      fix: ["Add metrics collection (Prometheus) and structured logs", "Trace requests across service hops (OpenTelemetry)"],
      nodes: [],
    });
  }

  /* Positive reinforcement */
  const lb = nodes.find((n) => /balancer/i.test(n.label));
  if (lb && appNodes.length >= 2 && dataNodes.length >= 2 && cacheNodes.length >= 1) {
    f.push({
      severity: "ok",
      title: "Production-grade topology detected",
      detail:
        "Balanced service tier, redundant data layer and a caching path — this shape survives node loss and traffic spikes.",
      fix: [],
      nodes: [],
    });
  }

  return f;
}

/* ------------------------------------------------------------------ */
/*  Persistence helpers                                                */
/* ------------------------------------------------------------------ */

const CURRENT_KEY = "sda-builder-current";
const LIB_KEY = "sda-builder-library";

function loadCurrent(): Doc | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? (JSON.parse(raw) as Doc) : null;
  } catch {
    return null;
  }
}
function saveCurrent(doc: Doc) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(doc));
  } catch {}
}
function library(): { name: string; ts: number; doc: Doc }[] {
  try {
    return JSON.parse(localStorage.getItem(LIB_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveLibrary(list: { name: string; ts: number; doc: Doc }[]) {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(list.slice(-19)));
  } catch {}
}

function deepCopy(d: Doc): Doc {
  return JSON.parse(JSON.stringify(d)) as Doc;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BuilderClient({ template }: { template?: string }) {
  const initial = useMemo<Doc>(() => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#diagram=")) {
      try {
        const raw = decodeURIComponent(window.location.hash.slice(9));
        const parsed = JSON.parse(atob(raw)) as Doc;
        if (parsed && Array.isArray(parsed.nodes)) return parsed;
      } catch {}
    }
    const t = TEMPLATES.find((x) => x.name === template);
    if (t) return deepCopy(t.doc);
    return (
      loadCurrent() ?? {
        nodes: [
          { id: "c", label: "Browser", sub: "web client", kind: "client", x: 60, y: 150 },
          { id: "api", label: "Service", sub: "stateless api", kind: "app", x: 320, y: 150 },
          { id: "db", label: "PostgreSQL", sub: "source of truth", kind: "data", x: 600, y: 150 },
        ],
        edges: [
          { from: "c", to: "api" },
          { from: "api", to: "db" },
        ],
      }
    );
  }, [template]);

  const [doc, setDoc] = useState<Doc>(initial);
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<number | null>(null);
  const [tab, setTab] = useState<"inspect" | "intel">("intel");
  const [libOpen, setLibOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const commit = useCallback((next: Doc | ((d: Doc) => Doc)) => {
    setDoc((cur) => {
      const n = typeof next === "function" ? next(cur) : next;
      setPast((p) => [...p.slice(-49), cur]);
      setFuture([]);
      return n;
    });
  }, []);

  /* autosave */
  useEffect(() => {
    const t = setTimeout(() => saveCurrent(doc), 400);
    return () => clearTimeout(t);
  }, [doc]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  /* ---------- mutations ---------- */
  const addNode = (item: (typeof PALETTE)[number]) => {
    const id = uid();
    commit((d) => ({
      ...d,
      nodes: [
        ...d.nodes,
        {
          id,
          label: item.label,
          sub: item.sub,
          kind: item.kind,
          x: 420 + Math.round(Math.random() * 200),
          y: 200 + Math.round(Math.random() * 140),
        },
      ],
    }));
    setSelNode(id);
  };

  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const draggingRef = useRef<string | null>(null);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    if (draggingRef.current !== id) {
      // first frame of a new drag: snapshot pre-drag state for undo
      draggingRef.current = id;
      setPast((p) => [...p.slice(-49), docRef.current]);
      setFuture([]);
    }
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  }, []);

  const connect = useCallback(
    (from: string, to: string) => {
      commit((d) =>
        d.edges.some((e) => e.from === from && e.to === to) || from === to
          ? d
          : { ...d, edges: [...d.edges, { from, to }] }
      );
    },
    [commit]
  );

  const deleteSelection = useCallback(() => {
    if (selNode) {
      commit((d) => ({
        nodes: d.nodes.filter((n) => n.id !== selNode),
        edges: d.edges.filter((e) => e.from !== selNode && e.to !== selNode),
      }));
      setSelNode(null);
    } else if (selEdge !== null) {
      commit((d) => ({ ...d, edges: d.edges.filter((_, i) => i !== selEdge) }));
      setSelEdge(null);
    }
  }, [selNode, selEdge, commit]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prevDoc = p[p.length - 1];
      setDoc((cur) => {
        setFuture((f) => [cur, ...f].slice(0, 50));
        return prevDoc;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nextDoc = f[0];
      setDoc((cur) => {
        setPast((p) => [...p, cur]);
        return nextDoc;
      });
      return f.slice(1);
    });
  }, []);

  const duplicateNode = useCallback(() => {
    if (!selNode) return;
    const src = doc.nodes.find((n) => n.id === selNode);
    if (!src) return;
    const id = uid();
    commit((d) => ({
      nodes: [...d.nodes, { ...src, id, x: src.x + 40, y: src.y + 40 }],
      edges: d.edges,
    }));
    setSelNode(id);
  }, [selNode, doc.nodes, commit]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateNode();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const lib = library();
        lib.push({ name: `Architecture ${new Date().toLocaleString()}`, ts: Date.now(), doc: deepCopy(doc) });
        saveLibrary(lib);
        flash("Saved to library");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "Escape") {
        setSelNode(null);
        setSelEdge(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelection, duplicateNode, doc]);

  /* ---------- export & sharing ---------- */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architecture.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Exported architecture.json");
  };

  const exportSvg = () => {
    const svg = document.querySelector("svg[role='img']");
    if (!svg) {
      flash("Failed to capture diagram SVG");
      return;
    }
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architecture.svg";
    a.click();
    URL.revokeObjectURL(url);
    flash("Exported architecture.svg");
  };

  const exportPng = () => {
    const svg = document.querySelector("svg[role='img']");
    if (!svg) {
      flash("Failed to capture diagram");
      return;
    }
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const img = new Image();
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const bbox = svg.getBoundingClientRect();
      const scale = 2; // 2x high resolution
      canvas.width = (bbox.width || 800) * scale;
      canvas.height = (bbox.height || 500) * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FAF9F6";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = "architecture.png";
        a.click();
        flash("Exported architecture.png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const copyShareLink = () => {
    try {
      const encoded = encodeURIComponent(btoa(JSON.stringify(doc)));
      const shareUrl = `${window.location.origin}${window.location.pathname}#diagram=${encoded}`;
      navigator.clipboard?.writeText(shareUrl);
      flash("Permalink copied to clipboard!");
    } catch {
      flash("Failed to copy permalink");
    }
  };

  const findings = useMemo(() => analyze(doc), [doc]);
  const sel = doc.nodes.find((n) => n.id === selNode) ?? null;

  const highlight = useMemo(() => {
    const activeFinding = findings.find((f) => f.severity === "critical" || f.severity === "warn");
    return activeFinding?.nodes ?? [];
  }, [findings]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-3 py-2">
        <ToolBtn onClick={undo} disabled={past.length === 0} label="Undo (⌘Z)">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3L2.5 6.5 6 10M2.5 6.5H10a3.5 3.5 0 010 7H8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </ToolBtn>
        <ToolBtn onClick={redo} disabled={future.length === 0} label="Redo (⌘⇧Z)">
          <svg viewBox="0 0 16 16" className="h-4 w-4 scale-x-[-1]" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3L2.5 6.5 6 10M2.5 6.5H10a3.5 3.5 0 010 7H8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </ToolBtn>
        <span className="mx-1 h-5 w-px bg-line" />
        <Button size="sm" variant="ghost" onClick={() => setTplOpen(true)}>Templates</Button>
        <Button size="sm" variant="ghost" onClick={() => setLibOpen(true)}>Open…</Button>
        <Button size="sm" variant="ghost" onClick={copyShareLink}>Share Link</Button>
        <span className="mx-1 h-5 w-px bg-line" />
        <Button size="sm" variant="ghost" onClick={exportPng}>PNG</Button>
        <Button size="sm" variant="ghost" onClick={exportSvg}>SVG</Button>
        <Button size="sm" variant="ghost" onClick={exportJson}>JSON</Button>
        <span className="mx-1 h-5 w-px bg-line" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm("Clear the canvas?")) {
              commit({ nodes: [], edges: [] });
              setSelNode(null);
            }
          }}
        >
          Clear
        </Button>
        <div className="ml-auto flex items-center gap-2 font-mono text-2xs text-ink-faint">
          <span>{doc.nodes.length} nodes · {doc.edges.length} links</span>
          <kbd className="rounded border border-line px-1">del</kbd> remove
          <kbd className="rounded border border-line px-1">⌘z</kbd> undo
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* palette */}
        <aside aria-label="Component palette" className="hidden w-44 shrink-0 overflow-y-auto border-r border-line bg-surface p-2 md:block">
          <p className="px-1 pb-1.5 font-mono text-2xs uppercase tracking-widest text-ink-faint">Components</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PALETTE.map((item) => (
              <button
                key={item.label}
                onClick={() => addNode(item)}
                className="group flex flex-col items-start rounded-lg border border-line bg-paper px-2 py-1.5 text-left transition-colors hover:border-accent hover:bg-accent-soft/40"
                title={`Add ${item.label}`}
              >
                <span className="text-[11px] font-medium leading-tight text-ink group-hover:text-accent-ink">{item.label}</span>
                <span className="text-2xs leading-tight text-ink-faint">{item.sub}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 px-1 text-2xs leading-relaxed text-ink-faint">
            Click to place. Drag the ○ handle on a node&apos;s right edge onto another node to connect.
          </p>
        </aside>

        {/* canvas */}
        <div
          className="relative min-w-0 flex-1"
          onPointerUp={() => {
            draggingRef.current = null;
          }}
        >
          <ArchCanvas
            graph={doc as unknown as Graph}
            mode="edit"
            className="h-full rounded-none border-0"
            selectedId={selNode}
            selectedEdge={selEdge}
            onSelectNode={(id) => {
              setSelNode(id);
              setSelEdge(null);
              if (id) setTab("inspect");
            }}
            onSelectEdge={(i) => {
              setSelEdge(i);
              setSelNode(null);
            }}
            onMoveNode={moveNode}
            onConnect={connect}
            highlightNodes={highlight.length ? highlight : undefined}
          />
          {/* drop hint */}
          {doc.nodes.length <= 3 && (
            <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-line bg-surface/90 px-3 py-1 font-mono text-2xs text-ink-mute shadow-node">
              add components from the left · drag ○ to connect
            </div>
          )}
          {toast && (
            <div className="animate-fadeUp absolute bottom-14 left-1/2 -translate-x-1/2 rounded-lg bg-ink px-3 py-1.5 font-mono text-2xs text-white shadow-pop">
              {toast}
            </div>
          )}
        </div>

        {/* right panel */}
        <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-surface lg:flex">
          <Tabs
            tabs={[
              { id: "intel", label: "Design Review", count: findings.length },
              { id: "inspect", label: "Inspector" },
            ]}
            active={tab}
            onChange={(t) => setTab(t as "inspect" | "intel")}
            className="m-3 w-fit"
          />

          {tab === "intel" && (
            <div className="flex flex-col gap-2 px-3 pb-6">
              {findings.length === 0 && (
                <p className="rounded-lg border border-line bg-paper p-3 text-xs leading-relaxed text-ink-mute">
                  Add components and connections — the design reviewer evaluates your architecture live: single points of
                  failure, pool exhaustion, missing consumers and observability gaps.
                </p>
              )}
              {findings.map((fnd, i) => (
                <article
                  key={i}
                  className={cn(
                    "rounded-lg border p-3",
                    fnd.severity === "critical" && "border-danger-border bg-danger-soft",
                    fnd.severity === "warn" && "border-warn-border bg-warn-soft",
                    fnd.severity === "info" && "border-accent-border bg-accent-soft",
                    fnd.severity === "ok" && "border-ok-border bg-ok-soft"
                  )}
                >
                  <h3
                    className={cn(
                      "text-xs font-semibold",
                      fnd.severity === "critical" && "text-danger-ink",
                      fnd.severity === "warn" && "text-warn-ink",
                      fnd.severity === "info" && "text-accent-ink",
                      fnd.severity === "ok" && "text-ok-ink"
                    )}
                  >
                    {fnd.severity === "critical" ? "✕ " : fnd.severity === "warn" ? "⚠ " : fnd.severity === "ok" ? "✓ " : "ℹ "}
                    {fnd.title}
                  </h3>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-soft">{fnd.detail}</p>
                  {fnd.fix.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {fnd.fix.map((fx, j) => (
                        <li key={j} className="flex gap-1.5 text-2xs text-ink-mute">
                          <span className="text-accent">→</span> {fx}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}

          {tab === "inspect" &&
            (sel ? (
              <div className="flex flex-col gap-3 px-3 pb-6">
                <label className="block">
                  <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-ink-faint">Name</span>
                  <input
                    value={sel.label}
                    onChange={(e) =>
                      commit((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === sel.id ? { ...n, label: e.target.value } : n)) }))
                    }
                    className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                    aria-label="Component name"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-ink-faint">Subtitle</span>
                  <input
                    value={sel.sub ?? ""}
                    placeholder="e.g. stateless api"
                    onChange={(e) =>
                      commit((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === sel.id ? { ...n, sub: e.target.value } : n)) }))
                    }
                    className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    aria-label="Component subtitle"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-ink-faint">Category</span>
                  <select
                    value={sel.kind}
                    onChange={(e) =>
                      commit((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === sel.id ? { ...n, kind: e.target.value as NodeKind } : n)) }))
                    }
                    className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                    aria-label="Component category"
                  >
                    {(["client", "app", "cache", "data", "queue", "infra"] as NodeKind[]).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <div className="mt-1 flex gap-2">
                  <Button size="sm" onClick={duplicateNode}>Duplicate (⌘D)</Button>
                  <Button size="sm" variant="danger" onClick={() => { deleteSelection(); }}>Delete</Button>
                </div>
                <dl className="mt-2 space-y-1 border-t border-line-soft pt-3 font-mono text-2xs text-ink-faint">
                  <div className="flex justify-between"><dt>position</dt><dd>{Math.round(sel.x)}, {Math.round(sel.y)}</dd></div>
                  <div className="flex justify-between"><dt>connections</dt><dd>{doc.edges.filter((e) => e.from === sel.id || e.to === sel.id).length}</dd></div>
                </dl>
              </div>
            ) : (
              <p className="px-3 pb-6 text-xs leading-relaxed text-ink-mute">
                Select a node on the canvas to rename it, change its category, or remove it. Select an edge to delete the
                connection.
              </p>
            ))}
        </aside>
      </div>

      {/* templates modal */}
      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Start from a template">
        <div className="flex flex-col gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => {
                commit(deepCopy(t.doc));
                setTplOpen(false);
                setSelNode(null);
                flash(`Loaded “${t.name}”`);
              }}
              className="rounded-lg border border-line px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent-soft/30"
            >
              <div className="text-sm font-medium text-ink">{t.name}</div>
              <div className="text-xs text-ink-mute">{t.desc}</div>
            </button>
          ))}
        </div>
      </Modal>

      {/* library modal */}
      <Modal open={libOpen} onClose={() => setLibOpen(false)} title="Saved architectures">
        {library().length === 0 && (
          <p className="text-sm text-ink-mute">
            Nothing saved yet. Press ⌘S or use Save in the toolbar to snapshot the current canvas.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {library()
            .slice()
            .reverse()
            .map((item) => (
              <li key={item.ts} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">{item.name}</div>
                  <div className="font-mono text-2xs text-ink-faint">{item.doc.nodes.length} nodes</div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      commit(deepCopy(item.doc));
                      setLibOpen(false);
                      flash("Loaded from library");
                    }}
                  >
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      saveLibrary(library().filter((l) => l.ts !== item.ts));
                      setLibOpen(false);
                      setLibOpen(true);
                    }}
                    aria-label={`Delete ${item.name}`}
                  >
                    ✕
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      </Modal>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-ink-mute transition-colors hover:bg-zinc-100 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
