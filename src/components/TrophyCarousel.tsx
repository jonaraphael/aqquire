import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface Trophy {
  key: string;
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
                'snap-center rounded-2xl border px-4 py-3 text-left transition sm:min-w-52',
                trophy.unlocked
                  ? 'border-champagne/50 bg-gradient-to-br from-[#f0d39822] to-[#b4883a20] shadow-[0_8px_25px_rgba(220,180,100,0.22)]'
                  : 'border-zinc-400/20 bg-zinc-500/10 grayscale',
              )}
              onClick={() => setActive(trophy)}
            >
              <p className="font-display text-lg text-pearl">{trophy.title}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-pearl/60">{progressLabel(trophy)}</p>
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-champagne/35 bg-obsidian/95 p-4 shadow-2xl backdrop-blur md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg text-champagne">{active.title}</p>
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
