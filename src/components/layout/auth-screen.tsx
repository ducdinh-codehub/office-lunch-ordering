/** Shared frame around Clerk's sign-in and sign-up widgets. */
export function AuthScreen({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <div aria-hidden className="text-4xl">
          🍽️
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Lunch Time</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
