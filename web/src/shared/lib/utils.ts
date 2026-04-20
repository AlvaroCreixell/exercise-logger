import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Extend tailwind-merge to treat custom typography utilities as a separate
// class group so they are never dropped when paired with text-color utilities.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-eyebrow",
        "text-title-serif",
        "text-hero-serif",
        "text-value",
        "text-value-sm",
        "text-meta",
        "text-body",
        "text-hero",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
