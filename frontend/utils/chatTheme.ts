/** Shared dark-mode detection for chat UI (matches app surface #0B1A2B). */
export function isChatDarkMode(mode: string, background: string) {
  return (
    mode === 'dark' ||
    background === '#0B1A2B' ||
    background === '#000000' ||
    background === '#111114'
  );
}
