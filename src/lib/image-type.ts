export type SniffedImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/**
 * What an uploaded image really is, from its magic bytes. The browser's
 * declared MIME type is attacker-controlled, and these images are served back
 * to other people, so the bytes themselves decide.
 */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  const matches = (offset: number, ...signature: number[]) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (matches(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (matches(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  // "RIFF" .... "WEBP"
  if (matches(0, 0x52, 0x49, 0x46, 0x46) && matches(8, 0x57, 0x45, 0x42, 0x50)) {
    return "image/webp";
  }
  // "GIF8"
  if (matches(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  return null;
}
