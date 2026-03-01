import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface Trophy {
  key: string;
  iconAsset?: string;
  title: string;
  description: string;
  progressType: 'count' | 'percentile' | 'binary';
  progressCurrent: number;
  progressTarget?: number;
  unlocked: boolean;
}

interface TrophyCarouselProps {
  trophies: Trophy[];
}

function progressLabel(trophy: Trophy) {
  if (trophy.progressType === 'binary') {
    return trophy.progressCurrent >= 1 ? '1 / 1' : '0 / 1';
  }
  if (trophy.progressType === 'percentile') {
    return `${trophy.progressCurrent.toFixed(3)}%`;
  }
  return `${trophy.progressCurrent} / ${trophy.progressTarget ?? '—'}`;
}

function progressRatio(trophy: Trophy) {
  if (trophy.progressType === 'binary') {
    return trophy.progressCurrent >= 1 ? 1 : 0;
  }

  if (trophy.progressType === 'percentile') {
    const target = trophy.progressTarget ?? 1;
    if (trophy.progressCurrent <= 0) return 1;
    return Math.max(0, Math.min(1, target / trophy.progressCurrent));
  }

  const target = trophy.progressTarget ?? 1;
  return Math.max(0, Math.min(1, trophy.progressCurrent / target));
}

function trophyIcon(trophy: Trophy) {
  switch (trophy.key) {
    case 'trend_setter':
      return '✦';
    case 'market_mover':
      return '♛';
    case 'taste_certified':
      return '✓';
    case 'delivery_dynamo':
      return '✈';
    case 'singular_find':
      return '◆';
    case 'bank_patron':
      return '◈';
    case 'high_roller':
      return '⟡';
    case 'vault_baron':
      return '⬢';
    case 'icon_collector':
      return '◎';
    case 'brand_loyalist':
      return '★';
    case 'private_client':
      return '♜';
    default:
      return trophy.iconAsset ? trophy.iconAsset[0]?.toUpperCase() ?? '◉' : '◉';
  }
}

export function TrophyCarousel({ trophies }: TrophyCarouselProps) {
  const [active, setActive] = useState<Trophy | null>(null);
  const extended = useMemo(() => [...trophies, ...trophies], [trophies]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl tracking-[0.14em] text-champagne">Trophy Case</h3>
        <p className="text-xs uppercase tracking-[0.18em] text-pearl/55">One line prestige</p>
      </div>

      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="flex w-max snap-x gap-3">
          {extended.map((trophy, index) => (
            <button
              type="button"
              key={`${trophy.key}-${index}`}
              title={`${trophy.title} • ${progressLabel(trophy)}`}
              className={cn(
                'snap-center rounded-2xl border px-4 py-3 text-left transition sm:min-w-56',
                trophy.unlocked
                  ? 'border-champagne/50 bg-gradient-to-br from-[#f0d39822] to-[#b4883a20] shadow-[0_8px_25px_rgba(220,180,100,0.22)]'
                  : 'border-zinc-400/20 bg-zinc-500/10 grayscale',
              )}
              onClick={() => setActive(trophy)}
            >
              <div className="mb-2 flex items-start gap-3">
                <span
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-xl border text-xl',
                    trophy.unlocked
                      ? 'border-champagne/65 bg-gradient-to-br from-[#ffecc0]/25 to-[#bc8b3d]/30 text-champagne'
                      : 'border-white/20 bg-white/5 text-pearl/60',
                  )}
                >
                  {trophyIcon(trophy)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg text-pearl">{trophy.title}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-pearl/60">{progressLabel(trophy)}</p>
                </div>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    trophy.unlocked ? 'bg-gradient-to-r from-[#f7dfaa] to-[#bd8a3c]' : 'bg-white/25',
                  )}
                  style={{ width: `${Math.max(5, progressRatio(trophy) * 100)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-champagne/35 bg-obsidian/95 p-4 shadow-2xl backdrop-blur md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-champagne/50 bg-champagne/15 text-lg text-champagne">
                  {trophyIcon(active)}
                </span>
                <p className="font-display text-lg text-champagne">{active.title}</p>
              </div>
              <p className="mt-1 text-sm text-pearl/70">{active.description}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-pearl/60">{progressLabel(active)}</p>
            </div>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="rounded-full border border-pearl/25 px-2 py-1 text-xs uppercase tracking-[0.12em] text-pearl/80"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
