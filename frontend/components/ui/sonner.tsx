"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "26rem",
        } as React.CSSProperties
      }
      // Bottom centre and a size up from Sonner's 13 px, the player's decision:
      // a toast is read in passing, and the corner was easy to miss.
      position="bottom-center"
      offset={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      mobileOffset={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      // Sonner paints a description in a fixed #3f3f3f for its light theme,
      // and the site's dark mode is a class it never sees, so the line was
      // dark grey on a dark popover. The token clears 4.5:1 on the popover in
      // both modes (e2e/design-audit.spec.ts, "muted-foreground on card").
      // Sonner's own sizes sit on attribute selectors, hence the `!`.
      toastOptions={{
        classNames: {
          toast: "gap-3! px-5! py-4! text-body!",
          title: "text-lead! font-semibold!",
          description: "text-body! text-muted-foreground!",
          icon: "size-5!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
