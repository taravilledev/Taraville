import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonStyles = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm text-md font-semibold whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-primary-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-(--control-h) px-4 py-2 has-[>svg]:px-3",
        sm: "h-(--tap-min) gap-1.5 rounded-sm px-3 has-[>svg]:px-2.5",
        lg: "h-(--control-h) rounded-sm px-6 has-[>svg]:px-4",
        auto: "min-h-(--tap-min) gap-0 border px-4 py-2",
        icon: "size-(--control-h)",
        "icon-sm": "size-(--tap-min)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// twMerge so a size (e.g. auto: gap-0) can override a base class (gap-2) when used as className on a link.
function buttonVariants(props?: Parameters<typeof buttonStyles>[0]) {
  return cn(buttonStyles(props))
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonStyles> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonStyles({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
