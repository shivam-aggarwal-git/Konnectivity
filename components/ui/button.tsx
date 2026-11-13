import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn"

const buttonVariants = cva(
  [
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl touch-manipulation",
    "text-sm font-semibold leading-tight whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease)]",
    "active:scale-[0.98] motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border border-ink bg-transparent text-ink hover:bg-white/8",
        outline:
          "border border-ink bg-transparent text-ink hover:bg-white/8",
        solid:
          "border border-ink bg-ink text-bg hover:opacity-85",
        // The one call to action on any given surface.
        primary:
          "border border-transparent bg-[image:var(--accent-gradient)] text-[color:var(--primary-foreground)] hover:shadow-[var(--glow-accent)]",
        accent:
          "border border-transparent bg-[image:var(--accent-gradient)] text-[color:var(--primary-foreground)] hover:shadow-[var(--glow-accent)]",
        secondary:
          "border border-[color:var(--separator-strong)] bg-secondary text-ink hover:bg-white/10",
        ghost:
          "border border-transparent bg-transparent text-[color:var(--muted)] hover:bg-white/8 hover:text-ink",
        danger:
          "border border-[var(--destructive)] bg-[var(--destructive)] text-white hover:opacity-90",
        destructive:
          "border border-[var(--destructive)] bg-[var(--destructive)] text-white hover:opacity-90",
        link: "text-[var(--accent-2)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-9 max-md:min-h-11 px-3 py-2 text-xs",
        lg: "min-h-12 px-5 py-3 text-sm",
        icon: "size-10 max-md:size-11",
        "icon-sm": "size-8 max-md:size-11",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
        title={props.title||props["aria-label"]}
      />
    );
  },
);
Button.displayName = "Button"

export { Button, buttonVariants }
