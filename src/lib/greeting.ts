/** Long enough for a proper wish, short enough to stay a banner. */
export const GREETING_MAX_LENGTH = 500;

/**
 * A short, stable fingerprint of the wish's text (djb2). The home banner
 * remembers which text a diner closed by this, so a new wish shows again.
 */
export function greetingKey(message: string): string {
  let hash = 5381;
  for (let i = 0; i < message.length; i++) {
    hash = ((hash << 5) + hash + message.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
