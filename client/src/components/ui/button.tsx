import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Controls in the wayfinding vocabulary: tracked caps, a cobalt primary that
 * rides the accent line, and — the system's own convention — an ACTIVE state
 * that gains a ring rather than swapping its fill.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)]",
    "font-medium uppercase tracking-[0.06em]",
    "transition-[background-color,border-color,box-shadow,color] duration-150 ease-out",
    "focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-45",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--color-line-cobalt)] text-[var(--color-porcelain)]",
          "hover:bg-[color-mix(in_oklab,var(--color-line-cobalt)_84%,white)]",
          "active:shadow-[0_0_0_2px_var(--color-porcelain)]",
        ].join(" "),
        secondary: [
          "border border-[var(--color-border-strong)] bg-transparent text-[var(--color-fg)]",
          "hover:bg-[var(--color-surface-2)]",
          "active:border-[var(--color-line-cobalt-text)] active:shadow-[0_0_0_1px_var(--color-line-cobalt-text)]",
        ].join(" "),
        ghost: "text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]",
        danger: [
          "bg-[var(--color-line-scarlet)] text-[var(--color-porcelain)]",
          "hover:bg-[color-mix(in_oklab,var(--color-line-scarlet)_84%,white)]",
          "active:shadow-[0_0_0_2px_var(--color-porcelain)]",
        ].join(" "),
        link: [
          "p-0 h-auto normal-case tracking-normal",
          "text-[var(--color-line-cobalt-text)] underline-offset-4 hover:underline",
        ].join(" "),
      },
      size: {
        sm: "h-8 px-3 text-[0.6875rem]",
        md: "h-9 px-4 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
