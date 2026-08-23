import type { Graph } from "@/lib/types";
import type { CapacityRow, TechTradeoff } from "@/components/diagram/DiagramExtras";
import type { FlowStep } from "@/components/diagram/RequestFlowPlayer";
import type { FailureScenario } from "@/components/diagram/DiagramExtras";

export interface ApiEndpoint {
  method: string;
  path: string;
  desc: string;
}

export interface DataEntity {
  name: string;
  fields: string;
  note?: string;
}

export interface ScalingStep {
  stage: string;
  action: string;
  why: string;
}

export interface InterviewStage {
  name: string;
  expect: string;
}

export interface CaseStudy {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  difficulty: "Warm-up" | "Standard" | "Hard" | "Expert";
  minutes: number;

  /** Problem statement paragraphs. */
  problem: string[];

  requirements: {
    functional: string[];
    nonFunctional: string[];
  };

  /** Capacity estimation chain — users → DAU → RPS → storage. */
  capacity: CapacityRow[];

  api: ApiEndpoint[];
  dataModel: DataEntity[];

  /** High-level architecture. Node ids are referenced by flows/failures. */
  architecture: Graph;
  archNotes: string[];

  /** Step-by-step narrated request walkthrough. */
  requestFlow: FlowStep[];

  deepDives: { topic: string; body: string; bullets: string[] }[];

  failures: FailureScenario[];

  scaling: ScalingStep[];

  tradeoffs: TechTradeoff[];
  alternatives: string[];

  interview: {
    prompt: string;
    stages: InterviewStage[];
  };

  production: string[];
  costs: string[];
}
