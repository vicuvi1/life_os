// Goal templates — one-click starting points that pre-fill a new goal with a
// sensible measurement type and a milestone tree, so a goal arrives already
// broken into actionable steps (which the Focus/Momentum engines then light up).

import { makeMilestone } from "@/lib/goals";
import type { GoalMeasurement, GoalMilestone } from "@/lib/types";

export interface TemplateFields {
  title: string;
  description: string | null;
  category: string;
  icon: string;
  color: string;
  measurement: GoalMeasurement;
  targetValue: number | null;
  unit: string | null;
  milestones: GoalMilestone[];
}

export interface GoalTemplate {
  id: string;
  label: string;
  icon: string;
  color: string;
  blurb: string;
  apply: () => TemplateFields;
}

/** Build check-style milestones from a list of titles (ordered). */
function steps(titles: string[]): GoalMilestone[] {
  return titles.map((t, i) => {
    const m = makeMilestone(i);
    m.title = t;
    return m;
  });
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "language",
    label: "Learn a language",
    icon: "📚",
    color: "#3b82f6",
    blurb: "CEFR milestones A1 → C1",
    apply: () => ({
      title: "Learn a language",
      description: "Reach conversational fluency, level by level.",
      category: "Education",
      icon: "📚",
      color: "#3b82f6",
      measurement: "milestones",
      targetValue: null,
      unit: null,
      milestones: steps([
        "A1 — Beginner",
        "A2 — Elementary",
        "B1 — Intermediate",
        "B2 — Upper-intermediate",
        "C1 — Advanced",
      ]),
    }),
  },
  {
    id: "cert",
    label: "Get certified",
    icon: "🎓",
    color: "#8b5cf6",
    blurb: "Study → practice → pass",
    apply: () => ({
      title: "Get certified",
      description: "Earn a professional certification.",
      category: "Certification",
      icon: "🎓",
      color: "#8b5cf6",
      measurement: "milestones",
      targetValue: null,
      unit: null,
      milestones: steps([
        "Finish the study material",
        "Score 80%+ on a practice exam",
        "Book the exam",
        "Pass the exam",
      ]),
    }),
  },
  {
    id: "save",
    label: "Save money",
    icon: "💰",
    color: "#10b981",
    blurb: "Count toward a target",
    apply: () => ({
      title: "Save money",
      description: "Build up savings toward a target amount.",
      category: "Finance",
      icon: "💰",
      color: "#10b981",
      measurement: "count",
      targetValue: 1000,
      unit: "$",
      milestones: [],
    }),
  },
  {
    id: "job",
    label: "Land a job",
    icon: "💼",
    color: "#f59e0b",
    blurb: "CV → apply → offer",
    apply: () => ({
      title: "Land a new job",
      description: "From application to a signed offer.",
      category: "Career",
      icon: "💼",
      color: "#f59e0b",
      measurement: "milestones",
      targetValue: null,
      unit: null,
      milestones: steps([
        "Polish CV & LinkedIn",
        "Apply to 50 roles",
        "Land an interview",
        "Get an offer",
      ]),
    }),
  },
  {
    id: "fit",
    label: "Get fit",
    icon: "💪",
    color: "#ef4444",
    blurb: "Routine → consistency → result",
    apply: () => ({
      title: "Get fit",
      description: "Build a sustainable training routine.",
      category: "Health",
      icon: "💪",
      color: "#ef4444",
      measurement: "milestones",
      targetValue: null,
      unit: null,
      milestones: steps([
        "Set a weekly training plan",
        "Train 3× a week for a month",
        "Hit my target metric",
      ]),
    }),
  },
  {
    id: "read",
    label: "Read more",
    icon: "📖",
    color: "#14b8a6",
    blurb: "Count books read",
    apply: () => ({
      title: "Read more books",
      description: "Read consistently through the year.",
      category: "Personal",
      icon: "📖",
      color: "#14b8a6",
      measurement: "count",
      targetValue: 12,
      unit: "books",
      milestones: [],
    }),
  },
];
