import { Link } from 'react-router-dom';
import { StatusPill } from '@/components/StatusPill';
import { TrophyCarousel } from '@/components/TrophyCarousel';
import { currency } from '@/lib/utils';
import { useDebugMode } from '@/hooks/useDebugMode';
import {
  useCancelPendingVaultItem,
  useListVault,
  useTrophyCase,
  useVaultProfile,
} from '@/lib/localBackend';

export function VaultPage() {
  const profile = useVaultProfile();
  const debugMode = useDebugMode(profile?.debugEnabled);

  const vaultItems = useListVault({ debug: debugMode });
  const trophies = useTrophyCase({ debug: debugMode });

  const cancelPending = useCancelPendingVaultItem();

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-[0.14em] text-pearl">Vault</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-pearl/60">Status Ledger</p>
        </div>

        <Link
          to="/vault/profile"
          className="rounded-full border border-champagne/45 bg-champagne/12 px-4 py-2 text-xs uppercase tracking-[0.18em] text-champagne"
        >
          Profile
        </Link>
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
        {(vaultItems ?? []).map((item: any) => (
          <article
            key={item._id}
            className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 shadow-[0_16px_45px_rgba(0,0,0,0.3)]"
          >
            <img src={item.heroImageUrl} alt={item.displayName} className="h-44 w-full rounded-xl object-cover" loading="lazy" />

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-display text-xl text-pearl">{item.displayName}</p>
                <StatusPill status={item.status} />
              </div>

              <p className="text-sm uppercase tracking-[0.16em] text-pearl/70">{currency(item.priceEstimate, item.currency)}</p>

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

      {(vaultItems ?? []).length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-sm text-pearl/65">
          Your Vault is empty. Use AQQUIRE to place your first item.
        </div>
      ) : null}
    </section>
  );
}
