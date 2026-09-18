import Link from "next/link";
import type { ComponentProps } from "react";

import { Button } from "./button";

/**
 * A Button that navigates. Base UI's Button needs `nativeButton={false}` when it
 * renders as something other than a real <button>, or it warns about lost button
 * semantics — this keeps that detail in one place.
 */
export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> &
  Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  return (
    <Button
      nativeButton={false}
      variant={variant}
      size={size}
      className={className}
      render={<Link href={href} {...props} />}
    >
      {children}
    </Button>
  );
}
