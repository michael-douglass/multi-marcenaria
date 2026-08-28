import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, lang = "pt-BR", ...props }, ref) => {
    const isDateLike = type === "date" || type === "time" || type === "datetime-local";

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full min-w-0 max-w-full rounded-md glass-input px-3 py-2 text-base text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isDateLike ? "overflow-visible [color-scheme:dark]" : "overflow-hidden",
          className,
        )}
        ref={ref}
        lang={lang}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
