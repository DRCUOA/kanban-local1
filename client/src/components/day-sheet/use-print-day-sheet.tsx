import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Project, Stage, SubStage, Task } from '@shared/schema';
import { allocateDaySheetLines, buildDaySheet, type DaySheetSectionGroup } from '@shared/day-sheet';
import { DEFAULT_TIMEZONE } from '@shared/briefing';
import { DaySheet } from './DaySheet';
import './day-sheet.css';

/** Body sizes tried, largest first. 10pt is the floor Rich set. */
export const DAY_SHEET_SIZES_PT = [12, 11.5, 11, 10.5, 10] as const;
export const DAY_SHEET_MIN_PT = 10;

/** The printable height of A4 portrait inside 12 mm margins, in CSS px. */
const MM = 96 / 25.4;
export const DAY_SHEET_PAGE_HEIGHT_PX = (297 - 2 * 12) * MM;
/**
 * Room kept spare, so a browser's own rounding of the page box cannot push
 * the last line onto a second page.
 */
const FIT_BUDGET_PX = DAY_SHEET_PAGE_HEIGHT_PX * 0.98;
/** Re-measures allowed after a cut before printing what there is. */
const MAX_VERIFY_PASSES = 4;

const PAGE_RULE = '@page { size: A4 portrait; margin: 12mm; }';
const PRINTING_CLASS = 'day-sheet-printing';

export interface DaySheetSource {
  tasks: readonly Task[];
  columnStages: readonly Stage[];
  stages: readonly Stage[];
  subStages: readonly SubStage[];
  /** What is narrowing the board, already worded, or null when nothing is. */
  scopeLabel: string | null;
  projectById: (id: number | null | undefined) => Project | null;
}

interface Job {
  groups: DaySheetSectionGroup[];
  dateLabel: string;
  printedLabel: string;
  scopeLabel: string | null;
  projectById: DaySheetSource['projectById'];
}

type Phase = 'measure' | 'verify' | 'print';

interface Fit {
  sizePt: number;
  shown?: number[];
  phase: Phase;
}

interface CutState {
  lineHeights: number[][];
  lineBudget: number;
  moreHeight: number;
  passes: number;
}

export function formatDaySheetDate(now: Date, timeZone = DEFAULT_TIMEZONE): string {
  // "Friday 6 November 2026": en-NZ puts a comma after the weekday.
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(now)
    .replace(',', '');
}

export function formatDaySheetPrinted(now: Date, timeZone = DEFAULT_TIMEZONE): string {
  const day = new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-NZ', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
  return `${day} at ${time}`;
}

function heightOf(el: Element): number {
  return el.getBoundingClientRect().height;
}

/**
 * Measures each section's lines at the current size, and what a "+ N more"
 * row costs, so the cut can be worked out on paper rather than by trial.
 */
function measureCut(sheet: HTMLElement): Omit<CutState, 'passes'> {
  const sections = [...sheet.querySelectorAll<HTMLElement>('.ds-section')];
  const lineHeights = sections.map((section) =>
    [...section.querySelectorAll('.ds-line')].map(heightOf),
  );

  const probe = document.createElement('p');
  probe.className = 'ds-more';
  probe.textContent = '+ 99 more on the board';
  (sections[0] ?? sheet).appendChild(probe);
  const moreHeight = heightOf(probe);
  probe.remove();

  const linesTotal = lineHeights.flat().reduce((sum, h) => sum + h, 0);
  const overhead = heightOf(sheet) - linesTotal;
  return { lineHeights, lineBudget: FIT_BUDGET_PX - overhead, moreHeight };
}

/**
 * "Print day sheet": one call lays the sheet out, fits it to one A4 page and
 * opens the browser's print dialog, where Print (or Save as PDF) is the
 * confirm. The sheet is rendered into `<body>` only while a print is open.
 *
 * Fitting: the body size steps down from 12pt to 10pt until the sheet fits.
 * If it still does not, each section keeps what fits (`allocateDaySheetLines`)
 * and says how many more are on the board, and the result is measured again
 * before printing.
 */
export function usePrintDaySheet(source: DaySheetSource): {
  printDaySheet: () => void;
  daySheetPortal: ReactNode;
} {
  const [job, setJob] = useState<Job | null>(null);
  const [fit, setFit] = useState<Fit>({ sizePt: DAY_SHEET_SIZES_PT[0], phase: 'measure' });
  const sheetRef = useRef<HTMLDivElement>(null);
  const cutRef = useRef<CutState | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const printDaySheet = useCallback(() => {
    if (job) return; // a print is already open
    const { tasks, columnStages, stages, subStages, scopeLabel, projectById } = sourceRef.current;
    const now = new Date();
    cutRef.current = null;
    setFit({ sizePt: DAY_SHEET_SIZES_PT[0], phase: 'measure' });
    setJob({
      groups: buildDaySheet({ tasks, columnStages, stages, subStages, now }),
      dateLabel: formatDaySheetDate(now),
      printedLabel: formatDaySheetPrinted(now),
      scopeLabel,
      projectById,
    });
  }, [job]);

  // Measure and fit before the browser paints, so nothing flickers.
  useLayoutEffect(() => {
    const sheet = sheetRef.current?.querySelector<HTMLElement>('.day-sheet');
    if (!job || !sheet || fit.phase === 'print') return;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      if (fit.phase === 'measure') {
        for (const size of DAY_SHEET_SIZES_PT) {
          sheet.style.fontSize = `${size}pt`;
          if (heightOf(sheet) <= FIT_BUDGET_PX) {
            setFit({ sizePt: size, phase: 'print' });
            return;
          }
        }
        // Does not fit at the floor: cut, then check the result.
        const cut = measureCut(sheet);
        cutRef.current = { ...cut, passes: 0 };
        setFit({
          sizePt: DAY_SHEET_MIN_PT,
          shown: allocateDaySheetLines(cut.lineHeights, cut.lineBudget, cut.moreHeight),
          phase: 'verify',
        });
        return;
      }

      // verify: the cut is drawn; trim again by any overflow that is left.
      const cut = cutRef.current;
      const overflow = heightOf(sheet) - FIT_BUDGET_PX;
      if (!cut || overflow <= 0 || cut.passes >= MAX_VERIFY_PASSES) {
        setFit((current) => ({ ...current, phase: 'print' }));
        return;
      }
      cut.passes += 1;
      cut.lineBudget -= Math.max(overflow, 1);
      setFit({
        sizePt: DAY_SHEET_MIN_PT,
        shown: allocateDaySheetLines(cut.lineHeights, cut.lineBudget, cut.moreHeight),
        phase: 'verify',
      });
    };

    // Lexend's weights load on first use; measure once they are in. Not every
    // runtime has a font set (jsdom), so it is read as optional.
    const fonts = (document as { fonts?: FontFaceSet }).fonts;
    if (!fonts || fonts.status === 'loaded') {
      run();
    } else {
      void fonts.ready.then(run);
    }
    return () => {
      cancelled = true;
    };
  }, [job, fit]);

  // Open the dialog once the fitted sheet is on the page.
  useEffect(() => {
    if (!job || fit.phase !== 'print') return;
    const root = document.documentElement;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      root.classList.remove(PRINTING_CLASS);
      window.removeEventListener('afterprint', finish);
      setJob(null);
    };
    window.addEventListener('afterprint', finish);
    root.classList.add(PRINTING_CLASS);
    const frame = requestAnimationFrame(() => {
      window.print();
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finish);
      root.classList.remove(PRINTING_CLASS);
    };
  }, [job, fit.phase]);

  const daySheetPortal =
    job && typeof document !== 'undefined'
      ? createPortal(
          <div className="day-sheet-host" ref={sheetRef} aria-hidden data-testid="day-sheet-host">
            <style>{PAGE_RULE}</style>
            <DaySheet
              groups={job.groups}
              shown={fit.shown}
              dateLabel={job.dateLabel}
              scopeLabel={job.scopeLabel}
              printedLabel={job.printedLabel}
              projectById={job.projectById}
              sizePt={fit.sizePt}
            />
          </div>,
          document.body,
        )
      : null;

  return { printDaySheet, daySheetPortal };
}
