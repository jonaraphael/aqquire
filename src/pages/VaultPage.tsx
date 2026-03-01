import { useRef, useState } from 'react';
import { StatusPill } from '@/components/StatusPill';
import { TrophyCarousel } from '@/components/TrophyCarousel';
import { currency } from '@/lib/utils';
import { useDebugMode } from '@/hooks/useDebugMode';
import {
  useCancelPendingVaultItem,
  useClearCanceledVaultItems,
  useListVault,
  useTrophyCase,
  useVaultProfile,
} from '@/lib/localBackend';

const IMAGE_SWIPE_THRESHOLD = 36;

function priceDisplayContent(item: any, subdued = false) {
  if (item.status === 'pending' && (!item.priceEstimate || item.priceEstimate <= 0)) {
    return (
      <span
        className={
          subdued
            ? 'inline-flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-pearl/60'
            : 'inline-flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-pearl/70'
        }
      >
        <span className="h-3 w-3 rounded-full border border-champagne/70 border-t-transparent animate-spin" />
        Procuring Price
      </span>
    );
  }
  return (
    <span className={subdued ? 'text-sm uppercase tracking-[0.16em] text-pearl/60' : 'text-sm uppercase tracking-[0.16em] text-pearl/70'}>
      {currency(item.priceEstimate, item.currency)}
    </span>
  );
}

function SwipeableVaultImage({
  item,
  className,
}: {
  item: any;
  className: string;
}) {
  const touchStartX = useRef<number | null>(null);
  const pointerStartX = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);
  const [showCaptured, setShowCaptured] = useState(false);
  const [rotationY, setRotationY] = useState(0);
  const [lastFlipDirection, setLastFlipDirection] = useState<1 | -1>(1);

  const hasCapturedVariant =
    typeof item.capturedImageUrl === 'string' &&
    item.capturedImageUrl.length > 0 &&
    item.capturedImageUrl !== item.heroImageUrl;

  const flipImage = (direction: 1 | -1) => {
    if (!hasCapturedVariant) return;
    setLastFlipDirection(direction);
    setShowCaptured((current) => !current);
    setRotationY((current) => current + 180 * direction);
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (!hasCapturedVariant || touchStartX.current === null) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        touchStartX.current = null;

        if (Math.abs(delta) >= IMAGE_SWIPE_THRESHOLD) {
          suppressClickUntil.current = Date.now() + 280;
          flipImage(delta >= 0 ? 1 : -1);
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') return;
        pointerStartX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (event.pointerType === 'touch') return;
        if (!hasCapturedVariant || pointerStartX.current === null) return;
        const delta = event.clientX - pointerStartX.current;
        pointerStartX.current = null;

        if (Math.abs(delta) >= IMAGE_SWIPE_THRESHOLD) {
          suppressClickUntil.current = Date.now() + 280;
          flipImage(delta >= 0 ? 1 : -1);
        }
      }}
      onClick={() => {
        if (!hasCapturedVariant) return;
        if (Date.now() < suppressClickUntil.current) return;
        flipImage(lastFlipDirection);
      }}
      data-facing={showCaptured ? 'captured' : 'marketing'}
      style={{ perspective: '1100px' }}
    >
      {!hasCapturedVariant ? <img src={item.heroImageUrl} alt={item.displayName} className={className} loading="lazy" /> : null}

      {hasCapturedVariant ? (
        <div
          className="relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,0.72,0.2,1)]"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotationY}deg)`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <img src={item.heroImageUrl} alt={item.displayName} className={className} loading="lazy" />
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-white/25 bg-black/45 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-pearl/85">
              Marketing
            </span>
          </div>

          <div
            className="absolute inset-0"
            style={{
              transform: 'rotateY(180deg)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <img src={item.capturedImageUrl} alt={`${item.displayName} captured`} className={className} loading="lazy" />
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-white/25 bg-black/45 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-pearl/85">
              Captured
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function VaultPage() {
  const profile = useVaultProfile();
  const debugMode = useDebugMode(profile?.debugEnabled);

  const vaultItems = useListVault({ debug: debugMode });
  const trophies = useTrophyCase({ debug: debugMode });
  const activeItems = (vaultItems ?? []).filter((item: any) => item.status !== 'canceled');
  const canceledItems = (vaultItems ?? []).filter((item: any) => item.status === 'canceled');

  const cancelPending = useCancelPendingVaultItem();
  const clearCanceled = useClearCanceledVaultItems();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-[0.14em] text-pearl">Vault</h1>
        <p className="text-xs uppercase tracking-[0.2em] text-pearl/60">Status Ledger</p>
      </div>

      <TrophyCarousel trophies={trophies?.trophies ?? []} />

      {debugMode && trophies?.debugReadout ? (
        <div className="rounded-2xl border border-champagne/30 bg-champagne/10 p-3 text-xs text-pearl/75">
          <p>Debug: trend={trophies.debugReadout.trendSetterCount}</p>
          <p>Debug: success={trophies.debugReadout.successfulCount}</p>
          <p>Debug: addresses={trophies.debugReadout.distinctAddresses}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {activeItems.map((item: any) => (
          <article
            key={item._id}
            className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 shadow-[0_16px_45px_rgba(0,0,0,0.3)]"
          >
            <SwipeableVaultImage item={item} className="h-44 w-full rounded-xl object-cover" />

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-display text-xl text-pearl">{item.displayName}</p>
                {item.status === 'pending' && item.supplierUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(item.supplierUrl, '_blank', 'noopener,noreferrer');
                    }}
                    title="Open supplier listing"
                    className="cursor-pointer"
                  >
                    <StatusPill status={item.status} label="pending." />
                  </button>
                ) : (
                  <StatusPill status={item.status} />
                )}
              </div>

              <div>{priceDisplayContent(item)}</div>

              {item.canCancel ? (
                <button
                  type="button"
                  onClick={() => {
                    void cancelPending({ vaultItemId: item._id });
                  }}
                  className="rounded-full border border-rose-300/35 bg-rose-400/10 px-3 py-1 text-xs uppercase tracking-[0.17em] text-rose-100"
                >
                  Cancel
                </button>
              ) : null}

              {debugMode && item.debug ? (
                <div className="rounded-xl border border-white/10 bg-black/25 p-2 text-xs text-pearl/70">
                  <p>Supplier: {item.debug.supplierName ?? 'N/A'}</p>
                  <p>Link: {item.debug.supplierUrl ?? 'N/A'}</p>
                  <p>Confidence: {item.debug.confidence?.toFixed(3) ?? 'N/A'}</p>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {activeItems.length === 0 && canceledItems.length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-sm text-pearl/65">
          Your Vault is empty. Use AQQUIRE to place your first item.
        </div>
      ) : null}

      {canceledItems.length > 0 ? (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-[0.12em] text-pearl/80">Canceled</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-pearl/50">Bottom archive</p>
              <button
                type="button"
                onClick={() => {
                  void clearCanceled();
                }}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-pearl/80"
              >
                Clear Canceled
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {canceledItems.map((item: any) => (
              <article
                key={item._id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 opacity-75"
              >
                <SwipeableVaultImage item={item} className="h-44 w-full rounded-xl object-cover saturate-75" />

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display text-xl text-pearl/85">{item.displayName}</p>
                    <StatusPill status={item.status} />
                  </div>
                  <div>{priceDisplayContent(item, true)}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
