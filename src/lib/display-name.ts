import { z } from "zod";

export const DISPLAY_NAME_MAX = 60;

/**
 * The one definition of what a display name may be, shared by the diner
 * renaming themselves and the admin renaming someone else — two entry points
 * writing the same column must not disagree about what is allowed.
 *
 * Whitespace runs collapse, leftover control characters are refused, and empty
 * parses to null — which every list in the app reads as "no name set" and falls
 * back to the email's local part.
 */
export const displayNameField = z
  .string()
  .trim()
  .max(DISPLAY_NAME_MAX, `Tên hiển thị tối đa ${DISPLAY_NAME_MAX} ký tự.`)
  // Whitespace of any kind — the tabs and newlines a paste drags along included
  // — collapses to a single space before anything else looks at the value, so a
  // name cannot be padded into looking like another person's in the admin lists.
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Tên hiển thị có ký tự không hợp lệ.")
  .transform((value) => value || null);

/** What the group sees for someone who has not set a name. */
export function fallbackDisplayName(email: string): string {
  return email.split("@")[0];
}
