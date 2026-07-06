import * as React from "react"

import { cn } from "@/shared/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full min-w-0 rounded-[var(--radius-button)] border border-line bg-paper px-2.5 py-2 text-base caret-[var(--accent-cli)] transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-accent-cli focus-visible:ring-2 focus-visible:ring-accent-cli/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm font-mono",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
