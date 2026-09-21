import { redirect } from "next/navigation";

import { todayServiceDate } from "@/lib/date";

// "today" has to be read per request, not baked in at build time.
export const dynamic = "force-dynamic";

/**
 * The nav tab has no date to point at, so it lands on today's list; the day
 * buttons on that page cover the rest.
 */
export default function AdminBookingsIndexPage() {
  redirect(`/admin/bookings/${todayServiceDate()}`);
}
