/**
 * Server Actions return a result object rather than throwing, so the client can
 * show an inline error instead of hitting an error boundary.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export function actionOk<T = undefined>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(error: string): ActionResult<never> {
  return { ok: false, error };
}

/** Throw this for an expected, user-facing failure inside an action. */
export class ActionFailure extends Error {}

export function fail(message: string): never {
  throw new ActionFailure(message);
}

/** Turns an unknown throwable into a message safe to show a user. */
export function toActionError(cause: unknown, fallback: string): ActionResult<never> {
  if (cause instanceof ActionFailure) return actionError(cause.message);
  console.error("[action]", cause);
  return actionError(fallback);
}
