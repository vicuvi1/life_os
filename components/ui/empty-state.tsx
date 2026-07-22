import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A consistent empty state used across modules. Renders inside a Card by
 * default; pass `card={false}` to drop it into an existing card/section.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  card = true,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  card?: boolean;
  className?: string;
}) {
  const inner = (
    <div className={cn("flex flex-col items-center gap-3 p-10 text-center", className)}>
      {Icon && <Icon className="h-8 w-8 text-muted-foreground" />}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
  if (!card) return inner;
  return (
    <Card>
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  );
}
