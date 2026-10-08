/** Limits on what the admin can give in one go — shared by the form and the action. */

/** One write covers at most a month, so a typo in the year cannot write 365 rows. */
export const ADMIN_DISCOUNT_MAX_DAYS = 31;

/** The note sits on one line beside the amount on a diner's bill. */
export const ADMIN_DISCOUNT_NOTE_MAX = 60;
