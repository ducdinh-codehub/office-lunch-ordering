import "server-only";

import { inArray } from "drizzle-orm";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";

import { db } from "@/db";
import { appSettings, emailImages } from "@/db/schema";

/** Where an uploaded email image is served from, for the editor and previews. */
export const EMAIL_IMAGE_PATH = "/api/email-images/";

const UPLOADED_IMAGE_SRC = /^\/api\/email-images\/([0-9a-f-]{36})$/;

/** Everything the editor can produce, and nothing else. */
const EMAIL_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3",
  "ul", "ol", "li", "blockquote", "hr", "a", "img", "span",
];

/** What an email-safe colour looks like: the editor only writes hex or rgb(). */
const COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;

/**
 * The editor's HTML, cut down to what the editor itself can produce. It runs
 * on save and again on render: the HTML ends up both in people's inboxes and
 * inside the admin's own pages, so nothing the browser sent is trusted.
 *
 * Images may only be ones uploaded here or plain https links — no data: URIs,
 * which Gmail refuses to show anyway.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: EMAIL_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt"],
      span: ["style"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
    },
    allowedStyles: {
      span: { color: [COLOR] },
      p: { "text-align": [/^(left|center|right)$/] },
      h2: { "text-align": [/^(left|center|right)$/] },
      h3: { "text-align": [/^(left|center|right)$/] },
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      !UPLOADED_IMAGE_SRC.test(frame.attribs.src ?? "") &&
      !(frame.attribs.src ?? "").startsWith("https://"),
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });
}

/**
 * Inline styles mail clients need: they ignore stylesheets, and an image
 * wider than the message would push the layout sideways. Takes sanitised HTML
 * and keeps to the same tags, so it can never widen what is allowed.
 */
export function styleForEmail(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: EMAIL_TAGS,
    allowedAttributes: { "*": ["style"], a: ["href", "target", "rel", "style"], img: ["src", "alt", "style"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https", "cid"] },
    transformTags: {
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          style: "max-width:100%;height:auto;border-radius:8px;display:block;margin:8px 0",
        },
      }),
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, style: "color:#2563eb" },
      }),
      blockquote: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          style: "margin:0 0 12px;padding-left:12px;border-left:3px solid #e7e5e4;color:#57534e",
        },
      }),
      p: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, style: `margin:0 0 12px;${attribs.style ?? ""}` },
      }),
    },
  });
}

/** The plain-text twin of a body, for the text/plain part of the email. */
export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
    ],
  }).trim();
}

/** True when a body says nothing — no text and no picture. */
export function isEmptyEmailHtml(html: string): boolean {
  return htmlToPlainText(html) === "" && !/<img\b/i.test(html);
}

/** The banner pictures a deployment has uploaded at /admin/settings. */
export type EmailBannerIds = { header: string | null; billing: string | null; footer: string | null };

/** Where each banner of an email points, or null for none. */
export type EmailBanners = { header: string | null; footer: string | null };

export const NO_BANNERS: EmailBanners = { header: null, footer: null };

export async function getEmailBannerIds(): Promise<EmailBannerIds> {
  const [row] = await db
    .select({
      header: appSettings.headerBannerImageId,
      billing: appSettings.billingBannerImageId,
      footer: appSettings.footerBannerImageId,
    })
    .from(appSettings)
    .limit(1);
  return row ?? { header: null, billing: null, footer: null };
}

/**
 * The banners one email shows: what the job switched on, of what this
 * deployment uploaded — the repository ships none, so a fresh install sends
 * plain emails. A billing email opens with its own banner when there is one,
 * the general one otherwise. They are linked like any uploaded picture, so
 * sending attaches them inline and previews load them from the app.
 */
export function emailBanners(
  ids: EmailBannerIds,
  kind: "billing" | "notice",
  show: { header: boolean; footer: boolean },
): EmailBanners {
  const header = kind === "billing" ? (ids.billing ?? ids.header) : ids.header;
  return {
    header: show.header && header ? `${EMAIL_IMAGE_PATH}${header}` : null,
    footer: show.footer && ids.footer ? `${EMAIL_IMAGE_PATH}${ids.footer}` : null,
  };
}

export type InlineAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
};

/**
 * Swaps every uploaded image for an inline attachment — pictures in the body
 * and the banners alike. Recipients then see them without their mail client
 * fetching anything from the app — which also means they show when testing
 * on localhost, and are not held back behind "display images".
 *
 * Pass every source of pictures (the body, the banners' links). Load once per
 * run, then `prepare` each recipient's rendered email: it gets its `cid:`
 * links and only the attachments it actually uses.
 */
export async function loadInlineImages(...sources: Array<string | null>): Promise<{
  prepare: (rendered: string) => { html: string; attachments: InlineAttachment[] };
}> {
  const ids = sources
    .filter((source): source is string => Boolean(source))
    .flatMap((source) =>
      [...source.matchAll(/\/api\/email-images\/([0-9a-f-]{36})/g)].map((match) => match[1]),
    );
  const unique = [...new Set(ids)];
  const rows =
    unique.length === 0
      ? []
      : await db.select().from(emailImages).where(inArray(emailImages.id, unique));
  const attachments = rows.map((row) => ({
    filename: `${row.id}.${row.type.split("/")[1]}`,
    content: Buffer.from(row.data, "base64"),
    contentType: row.type,
    cid: `${row.id}@email`,
  }));
  const found = new Set(rows.map((row) => row.id));

  return {
    prepare: (rendered) => {
      const out = rendered.replace(
        /src="\/api\/email-images\/([0-9a-f-]{36})"/g,
        (whole, id: string) => (found.has(id) ? `src="cid:${id}@email"` : whole),
      );
      // Only what this email shows is attached, or it would show as stray files.
      return { html: out, attachments: attachments.filter((a) => out.includes(`cid:${a.cid}`)) };
    },
  };
}
