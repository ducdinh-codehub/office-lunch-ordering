"use client";

import { useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown } from "lucide-react";

const TONES = {
  lunch: "bg-card hover:bg-accent/50",
  afternoon:
    "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
} as const;

/**
 * One of today's two sittings on the home page, folded to a header row.
 *
 * Used only when lunch and a party are both on screen: each is the real menu,
 * not a link, so ordering for both needs no navigation, and either can be put
 * away once done with. The header carries the summary, so a folded sitting
 * still says whether you have ordered from it.
 *
 * The menu itself is passed in from a Server Component; only the open/closed
 * state lives here.
 */
export function SlotSection({
  tone,
  emoji,
  label,
  summary,
  defaultOpen,
  children,
}: {
  tone: keyof typeof TONES;
  emoji: string;
  label: string;
  /** Short status shown on the right, readable while collapsed. */
  summary: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  // `defaultOpen` follows the diner's bookings, which change on every action's
  // revalidation. Pin it to its first value so ordering the first dish does not
  // snap the section open or shut — it decides how the section *starts*.
  const [initialOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root defaultOpen={initialOpen} render={<section className="space-y-3" />}>
      <Collapsible.Trigger
        className={`group flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${TONES[tone]}`}
        nativeButton
      >
        <span aria-hidden>{emoji}</span>
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-xs">{summary}</span>
        <ChevronDown
          className="size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]:rotate-180"
          aria-hidden
        />
      </Collapsible.Trigger>

      {/* keepMounted so an optimistic tick inside a folded menu isn't lost. */}
      <Collapsible.Panel keepMounted className="data-[closed]:hidden">
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
