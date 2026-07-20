"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getProjects, getGoals } from "@/lib/firebase/db";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Goal, Project } from "@/lib/types";

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, g] = await Promise.all([
        getProjects(user.uid),
        getGoals(user.uid),
      ]);
      setProjects(p);
      setGoals(g);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Group projects under their goal, preserving goal ordering.
  const grouped = useMemo(() => {
    const byGoal = new Map<string, Project[]>();
    for (const p of projects) {
      const arr = byGoal.get(p.goalId) ?? [];
      arr.push(p);
      byGoal.set(p.goalId, arr);
    }
    return goals
      .map((g) => ({ goal: g, projects: byGoal.get(g.id) ?? [] }))
      .filter((group) => group.projects.length > 0);
  }, [projects, goals]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Projects</h1>
        <p className="text-muted-foreground">
          Milestones that move each goal forward.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No projects yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Open a goal and add projects to break it into manageable
              milestones.
            </p>
            <Button asChild>
              <Link href="/goals">Go to goals</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ goal, projects: gp }) => (
            <section key={goal.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <Link
                  href={`/goals/${goal.id}`}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  {goal.title}
                </Link>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/goals/${goal.id}`}>
                    Open <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {gp.map((project) => (
                  <Card key={project.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">
                          {project.title}
                        </CardTitle>
                        <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>
                          {PROJECT_STATUS_LABEL[project.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    {project.description && (
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {project.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
