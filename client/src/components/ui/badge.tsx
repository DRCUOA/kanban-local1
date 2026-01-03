import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 border-0 focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground neo-raised",
        secondary: "bg-secondary text-secondary-foreground neo-pressed",
        destructive:
          "bg-destructive text-destructive-foreground neo-raised",
        outline: "bg-card text-foreground neo-raised",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
