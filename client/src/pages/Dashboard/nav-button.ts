/**
 * The look of a bottom-nav button: icon over a small label. Shared by the nav
 * and by the More menu's trigger when it sits in the nav on a phone.
 *
 * Sized so five of them and the Add button fit a 320px screen without
 * wrapping or spilling (5 × 3.5rem + Add 3.5rem + the bar's padding = 296px),
 * widening as the screen does.
 */
export const NAV_BUTTON_CLASS =
  'flex flex-col items-center gap-1 py-2 px-1.5 min-w-[3.5rem] md:px-2 md:min-w-[4rem] lg:px-3 lg:min-w-[4.25rem] rounded-md text-fg-secondary transition-[color,box-shadow,background-color,transform] duration-200 hover:text-foreground active:scale-90';
