/**
 * Stub for next-themes in the Chrome Extension build
 * Provides a simple useTheme that detects system preference
 */

export function useTheme() {
  // In extension context, detect dark mode from system preference
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return { theme: 'dark', setTheme: () => {} };
  }
  return { theme: 'light', setTheme: () => {} };
}
