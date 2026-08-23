/* ------------------------------------------------------------------ */
/*  Core domain types for the academy                                  */
/* ------------------------------------------------------------------ */

/** Semantic node categories — drive diagram colors everywhere. */
export type NodeKind = "client" | "app" | "data" | "cache" | "queue" | "infra";

export type NodeState = "ok" | "warn" | "down" | "hot";

export interface DiagramNode {
  id: string;
  label: string;
  sub?: string;
  kind: NodeKind;
  x: number; // canvas units
  y: number;
  w?: number; // default 148
  state?: NodeState;
  /** Rich hover/click explanation — falls back to the shared component library by label. */
  info?: NodeInfo;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  flow?: boolean; // animate traffic on this edge
  protocol?: string; // e.g. "HTTPS", "gRPC", "TCP"
  latency?: string; // e.g. "~2ms"
}

/** Multi-hop animated packet: travels through node ids in order. */
export interface DiagramFlow {
  id: string;
  path: string[]; // ["browser","cdn","lb","api"]
  label?: string;
  color?: string;
  speed?: number; // canvas units per second
  loop?: boolean; // default true
}

export interface Graph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  flows?: DiagramFlow[];
  regions?: { id: string; label: string; x: number; y: number; w: number; h: number }[];
}

/* ------------------------------------------------------------------ */
/*  Component knowledge base ("Why?" interactions)                     */
/* ------------------------------------------------------------------ */

export interface NodeInfo {
  purpose: string;
  latency?: string;
  uses?: string[];
  why?: string;
  fails?: string;
}

/* ------------------------------------------------------------------ */
/*  Content blocks                                                     */
/* ------------------------------------------------------------------ */

export type SimId =
  | "instagram-likes"
  | "token-bucket"
  | "capacity-calc"
  | "replication-lag";

export type Block =
  | { t: "p"; md: string }
  | { t: "h"; text: string }
  | { t: "list"; items: string[]; ordered?: boolean }
  | {
      t: "callout";
      kind: "info" | "warn" | "danger" | "ok";
      title?: string;
      md: string;
    }
  | { t: "code"; lang?: string; title?: string; code: string }
  | { t: "table"; head: string[]; rows: string[][]; caption?: string }
  | { t: "tradeoff"; a: string; b: string; rows: [string, string, string][]; verdict: string }
  | { t: "diagram"; graph: Graph; caption?: string; height?: number }
  | { t: "sim"; sim: SimId }
  | { t: "checklist"; title: string; items: string[] };

/* ------------------------------------------------------------------ */
/*  Quiz                                                               */
/* ------------------------------------------------------------------ */

export interface QuizQuestion {
  id: string;
  q: string;
  options: string[];
  correct: number[];
  multi?: boolean;
  explain: string;
}

/* ------------------------------------------------------------------ */
/*  Curriculum                                                         */
/* ------------------------------------------------------------------ */

export type SkillId =
  | "networking"
  | "architecture"
  | "databases"
  | "caching"
  | "distributed"
  | "messaging"
  | "infra"
  | "observability"
  | "security"
  | "interview";

export interface Chapter {
  slug: string;
  track: string;
  num: number;
  title: string;
  subtitle: string;
  minutes: number;
  skills: SkillId[];
  concepts: string[]; // glossary term ids
  blocks: Block[];
  quiz: QuizQuestion[];
  exercise?: { prompt: string; hints: string[] };
}

export interface Track {
  slug: string;
  name: string;
  group: "learn";
  level: string;
  blurb: string;
  chapters: Chapter[];
}

/* ------------------------------------------------------------------ */
/*  Labs / interview / glossary                                        */
/* ------------------------------------------------------------------ */

export interface Lab {
  slug: string;
  num: number;
  title: string;
  track: string;
  minutes: number;
  objective: string;
  prereqs: string[];
  architecture: Graph;
  instructions: { step: string; detail: string }[];
  code?: { title: string; lang: string; code: string }[];
  tasks: string[];
  hints: string[];
  solution: string;
  production: string[];
}

export interface InterviewQuestion {
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  minutes: number;
  summary: string;
  requirements: { functional: string[]; nonFunctional: string[] };
  estimation: { label: string; value: string }[];
  architectureNotes: string[];
  deepDives: { topic: string; points: string[] }[];
  tradeoffs: [string, string, string][];
  failureHandling: string[];
  checklist: string[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  simple: string;
  technical: string;
  example: string;
  related: string[];
  category: string;
}
