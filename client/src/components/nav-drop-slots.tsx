import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The Filing and Bin drop targets live in the bottom nav, but the board owns
 * the `DndContext`. Rather than lift drag state out of the board, the nav
 * publishes two empty DOM slots here and the board portals its droppables into
 * them: a portal keeps React context, so `useDroppable` still finds the board's
 * provider while the rects sit over the nav buttons.
 */
export interface NavDropSlots {
  filing: HTMLElement | null;
  bin: HTMLElement | null;
  setFiling: (element: HTMLElement | null) => void;
  setBin: (element: HTMLElement | null) => void;
}

const noop = () => {
  /* no provider: the board simply renders no nav droppables */
};

const NavDropSlotsContext = createContext<NavDropSlots>({
  filing: null,
  bin: null,
  setFiling: noop,
  setBin: noop,
});

export function NavDropSlotsProvider({ children }: { children: ReactNode }) {
  const [filing, setFiling] = useState<HTMLElement | null>(null);
  const [bin, setBin] = useState<HTMLElement | null>(null);
  const value = useMemo<NavDropSlots>(() => ({ filing, bin, setFiling, setBin }), [filing, bin]);
  return <NavDropSlotsContext.Provider value={value}>{children}</NavDropSlotsContext.Provider>;
}

export function useNavDropSlots(): NavDropSlots {
  return useContext(NavDropSlotsContext);
}
