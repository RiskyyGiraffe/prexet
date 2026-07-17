import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-white shadow-[0_1px_2px_rgba(15,23,42,.15)] hover:bg-[var(--primary-hover)]",
        accent:
          "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_1px_2px_rgba(0,0,0,.12)] hover:bg-[var(--accent-hover)]",
        outline:
          "border border-[var(--border-strong)] bg-white text-[var(--foreground)] shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:border-slate-400 hover:bg-slate-50",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        subtle: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        danger: "bg-zinc-200 text-black hover:bg-zinc-300",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 px-4",
        icon: "size-9 p-0",
        "icon-sm": "size-8 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
