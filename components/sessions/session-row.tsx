"use client";

import {
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SESSION_CATEGORY_LABEL,
  sessionColor,
  rangeLabel,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/types";

interface Props {
  session: Session;
  conflicted?: boolean;
  /** Goal title to show as context, if linked. */
  goalTitle?: string | null;
  onEdit?: (s: Session) => void;
  onDelete?: (s: Session) => void;
  onMarkDone?: (s: Session) => void;
  onMarkSkipped?: (s: Session) => void;
  compact?: boolean;
}

export function SessionRow({
  session,
  conflicted = false,
  goalTitle,
  onEdit,
  onDelete,
  onMarkDone,
  onMarkSkipped,
  compact = false,
}: Props) {
  const color = sessionColor(session);
  const done = session.status === "done";
  const skipped = session.status === "skipped";

  return (
    <div
      className={cn(
        "animate-fade-slide-in flex items-center gap-3 px-4 py-3",
        skipped && "opacity-60"
      )}
    >
      <span
        className="h-10 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              skipped && "line-through"
            )}
          >
            {session.title}
          </span>
          {done && (
            <Badge variant="success">Done</Badge>
          )}
          {skipped && <Badge variant="secondary">Skipped</Badge>}
          {done && session.quality != null && (
            <Badge variant="outline">
              <Star className="mr-1 h-3 w-3" />
              {session.quality}/10
            </Badge>
          )}
          {conflicted && (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Overlaps
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {rangeLabel(session.startMin, session.endMin)}
          {!compact && <> · {SESSION_CATEGORY_LABEL[session.category]}</>}
          {!compact && goalTitle && <> · {goalTitle}</>}
        </p>
      </div>

      {(onEdit || onDelete || onMarkDone || onMarkSkipped) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Session actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onMarkDone && !done && (
              <DropdownMenuItem onClick={() => onMarkDone(session)}>
                <Check className="h-4 w-4" /> Mark done
              </DropdownMenuItem>
            )}
            {onMarkSkipped && !skipped && !done && (
              <DropdownMenuItem onClick={() => onMarkSkipped(session)}>
                <X className="h-4 w-4" /> Mark skipped
              </DropdownMenuItem>
            )}
            {(onMarkDone || onMarkSkipped) && (onEdit || onDelete) && (
              <DropdownMenuSeparator />
            )}
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(session)}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(session)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
