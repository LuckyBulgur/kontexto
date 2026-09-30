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
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Sonner paints a description in a fixed #3f3f3f for its light theme,
      // and the site's dark mode is a class it never sees, so the line was
      // dark grey on a dark popover. The token clears 4.5:1 on the popover in
      // both modes (e2e/design-audit.spec.ts, "muted-foreground on card").
      toastOptions={{ classNames: { description: "text-muted-foreground!" } }}
      {...props}
    />
  )
}

export { Toaster }
