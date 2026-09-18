import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Attaches Clerk's auth context to every request — nothing more.
 *
 * There is deliberately no route matching here. Clerk deprecated
 * `createRouteMatcher` because path matching in middleware can diverge from how
 * Next.js actually routes a request, leaving a protected resource reachable.
 * This app instead checks at the point of access: every protected page calls
 * `requireUser()` / `requireAdmin()`, and so does every Server Action.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static files …
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // … plus API routes.
    "/(api|trpc)(.*)",
    // … plus Clerk's auto-proxy path, which the handshake redirects through.
    "/__clerk/:path*",
  ],
};
