/**
 * Platform-aware Link component
 * 
 * - In Next.js (web): renders next/link for client-side navigation
 * - In Chrome Extension: renders a plain <a> tag (no SPA routing)
 */
"use client";

import { isChromeExtension } from "@/lib/platform";

interface PlatformLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * In the extension build, next/link is not available.
 * We detect the environment and render accordingly.
 * 
 * For the extension build via Vite, next/link will be excluded
 * from the bundle through the Vite resolve.alias configuration.
 */
export function PlatformLink({ href, children, className }: PlatformLinkProps) {
  if (isChromeExtension()) {
    return <a href={href} className={className}>{children}</a>;
  }
  // In Next.js context, we dynamically render the next/link version
  // This component is only used in TopNav which is a "use client" component
  return <NextLinkFallback href={href} className={className}>{children}</NextLinkFallback>;
}

import Link from "next/link";

function NextLinkFallback({ href, children, className }: PlatformLinkProps) {
  return <Link href={href} className={className}>{children}</Link>;
}
