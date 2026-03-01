import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

const AQQUIRE_PROCUREMENT_COMPLETE_EVENT = 'aqquire:procurement-complete';
const FEED_OPEN_FOLLOW_EVENT = 'feed:open-follow';
const TOAST_SWIPE_DISMISS_PX = 28;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAqquire = location.pathname === '/aqquire';
  const isFeed = location.pathname === '/feed';
  const isVault = location.pathname === '/vault';
  const [procurementToast, setProcurementToast] = useState<string | null>(null);
  const touchStartY = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);

  useEffect(() => {
    const handleProcurementComplete = (event: Event) => {
      const custom = event as CustomEvent<{ displayName?: string }>;
      const name = custom.detail?.displayName?.trim();
      setProcurementToast(name ? `${name} priced. Tap to open Vault.` : 'Price procured. Tap to open Vault.');
    };

    window.addEventListener(AQQUIRE_PROCUREMENT_COMPLETE_EVENT, handleProcurementComplete);
    return () => {
      window.removeEventListener(AQQUIRE_PROCUREMENT_COMPLETE_EVENT, handleProcurementComplete);
    };
  }, []);

  useEffect(() => {
    if (!procurementToast) return;
    const timeout = window.setTimeout(() => setProcurementToast(null), 10_000);
    return () => window.clearTimeout(timeout);
  }, [procurementToast]);

  return (
    <div className="min-h-dvh bg-luxury text-pearl">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-3 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between border-b border-champagne/15 pb-3">
          <div>
            <p className="font-display text-2xl tracking-[0.22em] text-champagne">AQQUIRE</p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-pearl/55">Want it. Get it.</p>
          </div>

          {isFeed ? (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent(FEED_OPEN_FOLLOW_EVENT));
              }}
              className="rounded-full border border-champagne/45 bg-champagne/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-champagne hover:bg-champagne/20"
            >
              Follow
            </button>
          ) : null}

          {isVault ? (
            <Link
              to="/vault/profile"
              className="rounded-full border border-champagne/45 bg-champagne/12 px-4 py-2 text-xs uppercase tracking-[0.18em] text-champagne"
            >
              Profile
            </Link>
          ) : null}
        </header>

        <main className={cn('flex-1', isAqquire ? 'overflow-hidden' : '')}>
          <Outlet />
        </main>

        {!isAqquire ? (
          <footer className="mt-8 pb-2 text-center text-xs text-pearl/45">
            <a
              href="https://github.com/workos/authkit-react-starter"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-champagne/40 underline-offset-4 hover:text-champagne"
            >
              Powered by WorkOS AuthKit
            </a>
          </footer>
        ) : null}
      </div>

      {procurementToast ? (
        <button
          type="button"
          onClick={() => {
            if (Date.now() < suppressClickUntil.current) return;
            setProcurementToast(null);
            void navigate('/vault');
          }}
          onTouchStart={(event) => {
            touchStartY.current = event.changedTouches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartY.current === null) return;
            const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;
            const delta = endY - touchStartY.current;
            touchStartY.current = null;
            if (delta >= TOAST_SWIPE_DISMISS_PX) {
              suppressClickUntil.current = Date.now() + 320;
              setProcurementToast(null);
            }
          }}
          onPointerDown={(event) => {
            pointerStartY.current = event.clientY;
          }}
          onPointerUp={(event) => {
            if (pointerStartY.current === null) return;
            const delta = event.clientY - pointerStartY.current;
            pointerStartY.current = null;
            if (delta >= TOAST_SWIPE_DISMISS_PX) {
              suppressClickUntil.current = Date.now() + 320;
              setProcurementToast(null);
            }
          }}
          className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-champagne/45 bg-obsidian/95 px-4 py-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-champagne">Procurement Complete</p>
          <p className="mt-1 text-sm text-pearl/90">{procurementToast}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-pearl/60">Tap to Vault · Swipe Down to Ignore</p>
        </button>
      ) : null}

      <BottomNav />
    </div>
  );
}
