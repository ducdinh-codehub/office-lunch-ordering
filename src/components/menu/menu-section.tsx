"use client";

import { useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown } from "lucide-react";

/**
 * A collapsible category block — Món chính, Gọi thêm, and so on.
 *
 * A day can run to thirty dishes across five categories, which is a long scroll
 * on a phone once you already know what you want. The header stays visible while
 * collapsed and carries the summary (how many picked, how many dishes), so
 * folding a section away never hides whether it still needs attention.
 *
 * Children are passed in from a Server Component; only the open/closed state
 * lives on the client.
 */
export function MenuSection({
  emoji,
  label,
  hint,
  summary,
  defaultOpen = true,
  children,
}: {
  emoji: string;
  label: string;
  /** e.g. "chọn 2 — đã đủ" or "tính tiền riêng". */
  hint?: string;
  /** Short status shown on the right, readable while collapsed. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  // `defaultOpen` is derived from what the diner has picked, so it changes under
  // us every time a Server Action revalidates the page. Base UI seeds its state
  // from the first value and warns if a later one differs, so pin it to what it
  // was when this section mounted: the prop decides how a section *opens*, not
  // whether it folds itself away mid-order.
  const [initialOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root defaultOpen={initialOpen} render={<section className="space-y-2" />}>
      <Collapsible.Trigger
        className="group hover:bg-accent/50 -mx-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
        nativeButton
      >
        <ChevronDown
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]:rotate-180"
          aria-hidden
        />
        <span aria-hidden>{emoji}</span>
        <span className="text-muted-foreground">{label}</span>
        {hint && <span className="text-muted-foreground font-normal">({hint})</span>}
        {summary && <span className="ml-auto text-xs font-normal">{summary}</span>}
      </Collapsible.Trigger>

      {/* keepMounted so an optimistic tick inside a collapsed section isn't lost. */}
      <Collapsible.Panel keepMounted className="space-y-2 data-[closed]:hidden">
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
