import type { Chapter } from "@/lib/types";

export const SKILL_LABELS: Record<string, string> = {
  networking: "Networking & Protocols",
  architecture: "Architecture & Estimation",
  databases: "Database Systems",
  caching: "Caching",
  distributed: "Distributed Systems",
  messaging: "Event-Driven Systems",
  infra: "Infrastructure (Docker/K8s/CI)",
  observability: "Observability",
  security: "Security",
  interview: "Interview Readiness",
};

export const SKILLS = Object.keys(SKILL_LABELS);

export function computeSkills(
  chapters: Pick<Chapter, "slug" | "skills">[],
  completed: Record<string, number>
): Record<string, { done: number; total: number }> {
  const map: Record<string, { done: number; total: number }> = {};
  for (const ch of chapters) {
    for (const sk of ch.skills) {
      if (!map[sk]) map[sk] = { done: 0, total: 0 };
      map[sk].total++;
      if (completed[ch.slug]) map[sk].done++;
    }
  }
  return map;
}
