import { Card, CardContent } from "@/components/ui/card";

export function PagePlaceholder({
  title,
  description,
  milestone,
}: {
  title: string;
  description: string;
  milestone: string;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
          <p className="font-medium">Coming in {milestone}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The foundation is in place. This screen gets built out in the next
            milestone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
