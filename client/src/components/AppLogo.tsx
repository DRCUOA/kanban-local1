/**
 * The mark's own colour, rgb(255 69 0). The favicon, the home-screen icons
 * (script/icons/) and this inline copy all paint it; AppLogo.test.ts holds
 * them to the same value, so the header and the browser tab cannot drift.
 */
export const MARK_COLOR = '#ff4500';

/**
 * Kanbando mark: an isometric board of flat tiles with one column raised —
 * the task in focus. Painted in MARK_COLOR, not the app's accent: it is the
 * same mark as the favicon. Uses the bold mid-size geometry
 * (script/icons/mark-32.svg) because the header renders it around 20px;
 * full-detail sources live in script/icons/.
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill={MARK_COLOR}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M256 62 L332 100 L332 320 L256 358 L180 320 L180 100 Z" />
      <path d="M164 328 L240 366 L164 404 L88 366 Z" />
      <path d="M348 328 L424 366 L348 404 L272 366 Z" />
      <path d="M256 374 L332 412 L256 450 L180 412 Z" />
    </svg>
  );
}
