import type { CaseStudy } from "@/lib/caseTypes";
import { SOCIAL_SYSTEMS } from "./social";
import { MEDIA_SYSTEMS } from "./media";
import { RIDE_DELIVERY_SYSTEMS } from "./ride";
import { COMMERCE_SYSTEMS } from "./commerce";
import { STORAGE_SYSTEMS } from "./storage";
import { COLLAB_SYSTEMS } from "./collab";
import { PRIMITIVE_SYSTEMS } from "./primitives";

export const SYSTEMS: CaseStudy[] = [
  ...SOCIAL_SYSTEMS,
  ...MEDIA_SYSTEMS,
  ...RIDE_DELIVERY_SYSTEMS,
  ...COMMERCE_SYSTEMS,
  ...STORAGE_SYSTEMS,
  ...COLLAB_SYSTEMS,
  ...PRIMITIVE_SYSTEMS,
];

export function getSystem(slug: string): CaseStudy | undefined {
  return SYSTEMS.find((s) => s.slug === slug);
}

/** Ordered learning path: primitives → warm-ups → hard → expert. */
const DIFF_ORDER = { "Warm-up": 0, Standard: 1, Hard: 2, Expert: 3 } as const;

export const RECOMMENDED_ORDER: CaseStudy[] = [...SYSTEMS].sort(
  (a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]
);

export const CATEGORIES: string[] = [...new Set(SYSTEMS.map((s) => s.category))].sort();
