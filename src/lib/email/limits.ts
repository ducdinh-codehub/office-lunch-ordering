/** Input limits for /admin/emails, shared by the form and its actions. */
export const SUBJECT_MAX = 150;
/** Editor HTML, markup included. Pictures are links, so this is text only. */
export const EMAIL_BODY_MAX = 100_000;
/** An uploaded picture, after the browser has scaled it down. */
export const EMAIL_IMAGE_MAX_BYTES = 2_000_000;
/** Pictures are scaled to this width before upload — wider than any email. */
export const EMAIL_IMAGE_MAX_WIDTH = 1200;
