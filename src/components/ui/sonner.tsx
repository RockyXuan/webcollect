"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Theme-aware Toaster component.
 * In web context uses next-themes; in extension context uses prefers-color-scheme.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  // Detect theme: prefer next-themes in web, fall back to media query in extension
  let theme: string = "system"
  
  try {
    // Dynamic import only in web context - next-themes provides the useTheme hook
    // We read from the DOM attribute set by next-themes instead of calling the hook
    // to avoid conditional hook violations
    if (typeof document !== "undefined") {
      const colorScheme = document.documentElement.classList.contains("dark") ? "dark" : "light"
      theme = colorScheme
    }
  } catch {
    theme = "system"
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
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
      {...props}
    />
  )
}

export { Toaster }
