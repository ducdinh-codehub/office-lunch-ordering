/**
 * What this app is called. It reads as a sentence rather than a product name, so
 * the short form exists for the places that have no room for one — the header
 * beside the nav, and the drawer title on a phone.
 */
export const APP_NAME = "Hệ thống quản lý và đặt đồ ăn phòng PTPM3";
export const APP_SHORT_NAME = "PTPM3";

/** Browser tab title for a page inside the app. */
export function pageTitle(page: string): string {
  return `${page} · ${APP_SHORT_NAME}`;
}
