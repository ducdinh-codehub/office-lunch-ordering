import { FoodBackdrop } from "@/components/layout/food-backdrop";
import { APP_NAME } from "@/lib/app-name";

/** Shared frame around Clerk's sign-in and sign-up widgets. */
export function AuthScreen({
  subtitle,
  children,
}: {
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden p-4">
      <FoodBackdrop />
      <div className="max-w-sm text-center">
        <div aria-hidden className="text-6xl">
          🍽️
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-balance">{APP_NAME}</h1>
        {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
