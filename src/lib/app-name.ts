/**
 * What this app is called — each deployment names its own, in
 * NEXT_PUBLIC_APP_NAME and NEXT_PUBLIC_APP_SHORT_NAME. The full name may read
 * as a sentence ("the lunch ordering system for team X"), so the short form
 * exists for the places with no room for one: the header beside the nav, the
 * drawer title on a phone, browser tabs.
 *
 * NEXT_PUBLIC_ variables are written into the build, so a change needs a
 * rebuild (a redeploy on Vercel), not just a restart. The direct
 * `process.env.NEXT_PUBLIC_…` reads are what lets Next.js inline them for the
 * browser too — do not route them through a helper.
 */
const DEFAULT_NAME = "Lunch Time";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_NAME;
export const APP_SHORT_NAME =
  process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_NAME;

/** Browser tab title for a page inside the app. */
export function pageTitle(page: string): string {
  return `${page} · ${APP_SHORT_NAME}`;
}
