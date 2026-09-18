"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { decideClaim } from "@/app/(app)/admin/payments/actions";
import { formatInstant, formatServiceDateShort } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { PendingClaim } from "@/db/queries/payments";

export function PendingClaims({ claims }: { claims: PendingClaim[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  function decide(claimId: string, decision: "confirmed" | "rejected") {
    setActiveClaimId(claimId);
    startTransition(async () => {
      const result = await decideClaim({ claimId, decision });
      if (result.ok) {
        toast.success(decision === "confirmed" ? "Đã xác nhận." : "Đã đánh dấu không tìm thấy.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setActiveClaimId(null);
    });
  }

  if (claims.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chờ bạn duyệt</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          Hiện không có yêu cầu nào cần duyệt. 🎉
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Chờ bạn duyệt{" "}
          <Badge variant="secondary" className="ml-1">
            {claims.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {claims.map((claim) => {
          const busy = isPending && activeClaimId === claim.claimId;
          return (
            <div key={claim.claimId} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {claim.displayName ?? claim.email.split("@")[0]}
                  </p>
                  <p className="text-muted-foreground text-xs">{claim.email}</p>
                </div>
                <p className="text-lg font-semibold tabular-nums">
                  {formatVnd(claim.totalVnd)}
                </p>
              </div>

              <div className="flex flex-wrap gap-1">
                {claim.serviceDates.map((date) => (
                  <Badge key={date} variant="outline" className="text-xs font-normal">
                    {formatServiceDateShort(date)}
                  </Badge>
                ))}
              </div>

              {claim.note && (
                <p className="text-muted-foreground bg-muted rounded px-2 py-1 text-xs">
                  &ldquo;{claim.note}&rdquo;
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  Báo lúc {formatInstant(claim.claimedAt)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => decide(claim.claimId, "rejected")}
                  >
                    <X className="size-4" />
                    Không tìm thấy
                  </Button>
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => decide(claim.claimId, "confirmed")}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Xác nhận
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
