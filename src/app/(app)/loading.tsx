import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment a tab is tapped, inside the shell, while the page renders on
 * the server. Every page here is dynamic, so without this boundary Next keeps
 * the old page on screen until the new one is finished — and has nothing it
 * can prefetch ahead of the tap.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {[0, 1].map((card) => (
        <Card key={card}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
