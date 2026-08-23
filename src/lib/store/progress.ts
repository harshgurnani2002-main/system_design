"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SkillId } from "@/lib/types";

interface QuizResult {
  correct: number;
  total: number;
  at: number;
}

interface ProgressState {
  completedChapters: Record<string, number>; // slug -> timestamp
  quizResults: Record<string, QuizResult>; // chapterSlug or quizId
  completedLabs: Record<string, number>;
  interviewDone: Record<string, number>;
  bookmarks: string[]; // chapter slugs
  notes: Record<string, string>; // chapterSlug -> markdown note
  visited: Record<string, number>; // any page id -> last visit ts

  completeChapter: (slug: string) => void;
  uncompleteChapter: (slug: string) => void;
  recordQuiz: (id: string, correct: number, total: number) => void;
  completeLab: (slug: string) => void;
  completeInterview: (slug: string) => void;
  toggleBookmark: (slug: string) => void;
  setNote: (slug: string, text: string) => void;
  markVisited: (id: string) => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      completedChapters: {},
      quizResults: {},
      completedLabs: {},
      interviewDone: {},
      bookmarks: [],
      notes: {},
      visited: {},

      completeChapter: (slug) =>
        set((s) => ({
          completedChapters: { ...s.completedChapters, [slug]: Date.now() },
        })),
      uncompleteChapter: (slug) =>
        set((s) => {
          const next = { ...s.completedChapters };
          delete next[slug];
          return { completedChapters: next };
        }),
      recordQuiz: (id, correct, total) =>
        set((s) => ({
          quizResults: {
            ...s.quizResults,
            [id]: { correct, total, at: Date.now() },
          },
        })),
      completeLab: (slug) =>
        set((s) => ({ completedLabs: { ...s.completedLabs, [slug]: Date.now() } })),
      completeInterview: (slug) =>
        set((s) => ({ interviewDone: { ...s.interviewDone, [slug]: Date.now() } })),
      toggleBookmark: (slug) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(slug)
            ? s.bookmarks.filter((b) => b !== slug)
            : [...s.bookmarks, slug],
        })),
      setNote: (slug, text) =>
        set((s) => ({ notes: { ...s.notes, [slug]: text } })),
      markVisited: (id) =>
        set((s) => ({ visited: { ...s.visited, [id]: Date.now() } })),
    }),
    {
      name: "sda-progress-v1",
      onRehydrateStorage: () => () => {
        // Cross-tab synchronization listener
        if (typeof window !== "undefined") {
          window.addEventListener("storage", (e) => {
            if (e.key === "sda-progress-v1" && e.newValue) {
              try {
                const parsed = JSON.parse(e.newValue);
                if (parsed?.state) {
                  useProgress.setState(parsed.state);
                }
              } catch {}
            }
          });
        }
      },
    }
  )
);

/** Skill weights per chapter are declared in content; compute mastery here. */
export function skillScores(
  chapters: { slug: string; skills: SkillId[]; minutes: number }[]
): Record<SkillId, { done: number; total: number }> {
  const scores = {} as Record<SkillId, { done: number; total: number }>;
  const state = useProgress.getState();
  for (const ch of chapters) {
    const done = !!state.completedChapters[ch.slug];
    for (const sk of ch.skills) {
      if (!scores[sk]) scores[sk] = { done: 0, total: 0 };
      scores[sk].total += 1;
      if (done) scores[sk].done += 1;
    }
  }
  return scores;
}
