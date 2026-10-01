"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelEmailJob } from "@/app/(app)/admin/emails/actions";

export type ScheduledEmail = {
  id: string;
  kindLabel: string;
  title: string;
  recipients: string;
  /** Already formatted in Vietnam time on the server. */
  nextRun: string;
  /** Null for a one-time email. */
  repeatLabel: string | null;
};

/** Emails waiting for their time, each with a way to call it off. */
export function ScheduledEmails({ jobs }: { jobs: ScheduledEmail[] }) {
  if (jobs.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có email nào được hẹn giờ.</p>;
  }
  return (
    <ul className="divide-y">
      {jobs.map((job) => (
        <ScheduledEmailRow key={job.id} job={job} />
      ))}
    </ul>
  );
}

function ScheduledEmailRow({ job }: { job: ScheduledEmail }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-60 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{job.kindLabel}</Badge>
          <Link
            href={`/admin/emails/${job.id}`}
            className="truncate text-sm font-medium underline-offset-4 hover:underline"
          >
            {job.title}
          </Link>
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          <span>Lần tới: {job.nextRun}</span>
          {job.repeatLabel && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" />
              {job.repeatLabel}
            </span>
          )}
          <span>· {job.recipients}</span>
        </p>
      </div>
      <CancelEmailButton jobId={job.id} />
    </li>
  );
}

/** Calls off a scheduled or repeating email. */
export function CancelEmailButton({ jobId, label = "Huỷ" }: { jobId: string; label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const result = await cancelEmailJob({ jobId });
      if (result.ok) {
        toast.success("Đã huỷ email hẹn giờ.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={cancel}>
      {isPending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  );
}
