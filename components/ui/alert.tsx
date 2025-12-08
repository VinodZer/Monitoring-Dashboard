import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 ring-1 ring-border/50 shadow-sm transition-colors duration-200 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "bg-muted/40 text-foreground",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive-foreground dark:bg-destructive/20 [&>svg]:text-destructive",
        info: "border-blue-500/40 bg-blue-50 text-blue-900 dark:border-blue-400/40 dark:bg-blue-950 dark:text-blue-50 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-300",
        success:
          "border-green-500/40 bg-green-50 text-green-900 dark:border-green-400/40 dark:bg-green-950 dark:text-green-50 [&>svg]:text-green-600 dark:[&>svg]:text-green-300",
        warning:
          "border-yellow-500/50 bg-yellow-50 text-yellow-900 dark:border-yellow-400/50 dark:bg-yellow-950 dark:text-yellow-50 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

/**
 * Alert container component with variant-driven styles. For use in contexts
 * where inline alert messaging is required. Accepts children content and
 * variant prop to control visual style.
 */
const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = "Alert"

/**
 * AlertTitle is a styled heading for use inside Alert.
 */
const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  ),
)
AlertTitle.displayName = "AlertTitle"

/**
 * AlertDescription is a styled container for alert descriptive text.
 */
const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  ),
)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
