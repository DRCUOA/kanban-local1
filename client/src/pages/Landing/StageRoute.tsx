import { cn } from '@/lib/utils';
import { StageGlyph } from './glyphs';
import { STAGE_NAME, WIZARD_STAGES, type WizardStage } from './wizard-options';

/** Station x positions: the centres of three equal columns of a 300-wide route. */
const STATION_X = [50, 150, 250];
/** The route dips at the ends and rises in the middle. */
const STATION_Y = [30, 14, 30];
const LEGS = ['M50 30C88 30 106 14 150 14', 'M150 14C194 14 212 30 250 30'];

/**
 * Where the wizard is: a winding route through three stations, island, pin
 * and circle. The legs already walked are drawn solid in the accent; the
 * ones ahead are dotted. Under each station, its name and what is picked
 * there. A picture, read out as one line; the nav is where the stages are
 * jumped between.
 */
export function StageRoute({
  stage,
  picked,
}: {
  stage: WizardStage;
  /** What each stage has picked, in a word or two ("All", "2 picked"). */
  picked: Record<WizardStage, string>;
}) {
  const current = WIZARD_STAGES.indexOf(stage);
  return (
    <div
      role="img"
      aria-label={`Stage ${current + 1} of 3: ${STAGE_NAME[stage]}`}
      className="mx-auto w-full max-w-sm"
      data-testid="stage-route"
      data-stage={stage}
    >
      <svg viewBox="0 0 300 44" className="block h-auto w-full overflow-visible" aria-hidden="true">
        {LEGS.map((d, i) =>
          i < current ? (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth={2.5}
              strokeLinecap="round"
              className="stroke-primary"
            />
          ) : (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth={2}
              strokeDasharray="1 6"
              strokeLinecap="round"
              className="stroke-border-strong"
            />
          ),
        )}
        {WIZARD_STAGES.map((s, i) => {
          const x = STATION_X[i] ?? 0;
          const y = STATION_Y[i] ?? 0;
          return (
            <g key={s}>
              {/* A halo knocks the route out behind each station. */}
              <circle cx={x} cy={y} r={i === current ? 17 : 14} className="fill-background" />
              {i === current && <circle cx={x} cy={y} r={17} className="fill-primary/15" />}
              <StageGlyph
                stage={s}
                at={{ x: x - 11, y: y - 11, size: 22 }}
                variant={i > current ? 'outline' : 'fill'}
                className={
                  i === current
                    ? 'text-primary'
                    : i < current
                      ? 'text-fg-secondary'
                      : 'text-muted-foreground'
                }
              />
            </g>
          );
        })}
      </svg>
      <ol className="mt-1 grid grid-cols-3 text-center">
        {WIZARD_STAGES.map((s, i) => (
          <li key={s} className="min-w-0">
            <span
              className={cn(
                'block text-xs',
                i === current ? 'font-semibold text-foreground' : 'font-medium text-fg-secondary',
              )}
            >
              {STAGE_NAME[s]}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{picked[s]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
