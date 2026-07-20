"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import milestonesDoc from "@/MILESTONES.md";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const GITHUB_URL = "https://github.com/vicuvi1/life_os/blob/main/MILESTONES.md";

export default function MilestonesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" /> Settings
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            View on GitHub <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 md:p-8">
          <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-h1:text-2xl prose-h2:mt-10 prose-h2:border-t prose-h2:pt-8 prose-h2:text-xl prose-a:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {milestonesDoc}
            </ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
