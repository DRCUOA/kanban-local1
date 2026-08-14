/**
 * Kanbando mark: an isometric board of flat tiles with one column raised —
 * the task in focus. Inherits `currentColor`, so tint it with a text class.
 * Uses the bold mid-size geometry (script/icons/mark-32.svg) because the
 * header renders it around 20px; full-detail sources live in script/icons/.
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill="currentColor"
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
