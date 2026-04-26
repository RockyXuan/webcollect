/**
 * Stub for next/link in the Chrome Extension build
 * Renders a plain <a> tag instead
 */

export default function Link({ 
  href, 
  children, 
  className 
}: { 
  href: string; 
  children: React.ReactNode; 
  className?: string; 
}) {
  return <a href={href} className={className}>{children}</a>;
}
