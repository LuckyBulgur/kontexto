import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge has to know the project's type scale (`--text-*` in
 * app/globals.css). Without it `text-small` reads as a text colour, so
 * `cn("text-small", "text-primary-foreground")` kept only one of the two and
 * every default button silently fell back to 16px.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "small", "body", "lead", "h3", "h2", "h1", "display"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
