import { BuiltByTk } from '@/components/BuiltByTk';
import { NAV_BUTTON_CLASS } from '@/pages/Dashboard/nav-button';
import { StageGlyph } from './glyphs';
import { STAGE_NAME, nextStage, otherStages, type WizardStage } from './wizard-options';

/**
 * The wizard's nav, in the board's bar. GO sits in the middle where the board
 * has Add: on Projects and Goals it moves to the next stage, on Tasks it opens
 * the board. Either side of it are the two stages not on screen, drawn as
 * their shapes, the earlier on the left and the later on the right; a tap
 * goes straight there with what is picked so far.
 */
export function WizardNav({
  stage,
  showing,
  onStage,
  onBoard,
}: {
  stage: WizardStage;
  /** The tasks the board would show: said by GO on the last stage. */
  showing: number;
  onStage: (stage: WizardStage) => void;
  onBoard: () => void;
}) {
  const [left, right] = otherStages(stage);
  const next = nextStage(stage);

  const jump = (target: WizardStage) => (
    <button
      type="button"
      className={NAV_BUTTON_CLASS}
      aria-label={`Jump to ${STAGE_NAME[target]}`}
      onClick={() => {
        onStage(target);
      }}
      data-testid={`wizard-jump-${target}`}
    >
      <StageGlyph stage={target} className="h-5 w-5" />
      <span className="text-[10px] font-medium">{STAGE_NAME[target]}</span>
    </button>
  );

  return (
    <nav className="mobile-bottom-nav" aria-label="Wizard stages">
      <div className="flex flex-nowrap items-center justify-evenly px-2 py-2 lg:justify-around">
        {jump(left)}

        <button
          type="button"
          className="relative -mt-4 flex flex-col items-center gap-1"
          aria-label={
            next
              ? `GO to ${STAGE_NAME[next]}`
              : `GO to the board, showing ${showing} ${showing === 1 ? 'task' : 'tasks'}`
          }
          onClick={() => {
            if (next) onStage(next);
            else onBoard();
          }}
          data-testid="button-go"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg transition-transform active:scale-90">
            GO
          </span>
          <span className="text-[10px] font-medium">{next ? STAGE_NAME[next] : 'Board'}</span>
        </button>

        {jump(right)}
      </div>

      <BuiltByTk className="border-t border-border-subtle py-1 text-[9px]" />
    </nav>
  );
}
