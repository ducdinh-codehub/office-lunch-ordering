import { APP_NAME } from "@/lib/app-name";
import { welcomeBoxStyle, type WelcomeContent } from "@/lib/welcome-screen";
import { cn } from "@/lib/utils";

/**
 * The centre of the welcome screen: the picture, the title and the message in
 * a see-through frame — the panel's fill and border are translucent, the text
 * is not. Drawn by /welcome and by the settings preview from the same props,
 * so what the admin sees while editing is what visitors get. The sign-in
 * button sits below it, outside the frame.
 *
 * Scales are percent of a base size — the title's 1.875rem, the message's
 * 1rem, the picture's 16rem width — and the picture never grows wider than the
 * frame, so a large scale stays on a phone screen.
 */
export function WelcomeContentBox({
  content,
  footer,
  className,
}: {
  content: WelcomeContent;
  /** A last line inside the frame, under the message — e.g. a link. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const text = content.textScale / 100;
  const empty = !content.title && !content.message && !content.imageUrl;
  // Nothing written yet: greet with the app's own name rather than an empty frame.
  const title = empty ? APP_NAME : content.title;

  return (
    <div
      className={cn(
        // Frosted glass: a see-through fill, a hairline of light around the
        // edge and a soft shadow — the admin's border, if any, sits on top.
        // On a phone a long letter covers most of the scene, so the glass is
        // frostier there to keep the text easy to read.
        "flex w-full max-w-xl flex-col items-center gap-3 bg-white/45 px-5 py-6 text-center shadow-[0_8px_40px_rgb(0_0_0/0.08)] ring-1 ring-white/70 backdrop-blur-xl ring-inset sm:gap-4 sm:bg-white/20 sm:px-10 sm:py-10 dark:bg-slate-900/45 dark:ring-white/10 dark:sm:bg-slate-900/20",
        className,
      )}
      style={welcomeBoxStyle(content)}
    >
      {empty && (
        <div aria-hidden style={{ fontSize: `${3.75 * text}rem` }} className="leading-none">
          🍽️
        </div>
      )}
      {content.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- an admin upload, served as-is
        <img
          src={content.imageUrl}
          alt=""
          className="h-auto max-w-full"
          style={{ width: `${16 * (content.imageScale / 100)}rem` }}
        />
      )}
      {title && (
        <h1
          className="font-semibold tracking-tight text-balance break-words"
          // Grows with the screen, from about 20px on a phone up to 30px.
          style={{ fontSize: `calc(${text} * clamp(1.2rem, 0.6rem + 2.4vw, 1.875rem))`, lineHeight: 1.25 }}
        >
          {title}
        </h1>
      )}
      {content.message && (
        <div
          // Left-aligned: a message may be a whole letter with bullet lines,
          // which reads badly centred.
          className="text-foreground self-stretch text-left leading-relaxed break-words"
          style={{ fontSize: `calc(${text} * clamp(0.875rem, 0.8rem + 0.3vw, 1rem))` }}
        >
          <MessageLines message={content.message} />
        </div>
      )}
      {footer}
    </div>
  );
}

const BULLET = /^\s*[•\-*·]\s/;

/**
 * The message as written, line for line: a blank line is a paragraph gap, and
 * a line starting with a bullet hangs, so its wrapped lines start under the
 * text rather than under the bullet.
 */
function MessageLines({ message }: { message: string }) {
  return message.split("\n").map((line, i) =>
    line.trim() === "" ? (
      <div key={i} aria-hidden className="h-[0.75em]" />
    ) : (
      <p key={i} className={BULLET.test(line) ? "pl-[1.1em] -indent-[1.1em]" : undefined}>
        {line.trim()}
      </p>
    ),
  );
}
