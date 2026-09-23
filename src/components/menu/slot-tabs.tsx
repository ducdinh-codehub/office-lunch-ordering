import { LinkButton } from "@/components/ui/link-button";
import { MENU_SLOTS, SLOT_LABEL, type MenuSlot } from "@/lib/menu-slot";

export type SlotTab = {
  slot: MenuSlot;
  href: string;
  /** False when the date has no menu for this sitting yet — admin side only. */
  exists: boolean;
};

/**
 * Switches between the two sittings a date can hold.
 *
 * Renders nothing when there is only one tab worth showing, so a date with
 * lunch alone looks exactly as it did before the afternoon menu existed.
 */
export function SlotTabs({
  tabs,
  activeSlot,
}: {
  tabs: SlotTab[];
  activeSlot: MenuSlot;
}) {
  if (tabs.length < 2) return null;

  const ordered = [...tabs].sort(
    (a, b) => MENU_SLOTS.indexOf(a.slot) - MENU_SLOTS.indexOf(b.slot),
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((tab) => (
        <LinkButton
          key={tab.slot}
          href={tab.href}
          size="sm"
          variant={tab.slot === activeSlot ? "default" : "outline"}
        >
          {SLOT_LABEL[tab.slot]}
          {!tab.exists && <span className="opacity-60">chưa có</span>}
        </LinkButton>
      ))}
    </div>
  );
}
