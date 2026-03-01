import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const location = useLocation();
  const isAqquire = location.pathname === '/aqquire';

  return (
    <div className="min-h-dvh bg-luxury text-pearl">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-3 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between border-b border-champagne/15 pb-3">
          <div>
            <p className="font-display text-2xl tracking-[0.22em] text-champagne">AQQUIRE</p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-pearl/55">Want it. Get it.</p>
          </div>
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

      <BottomNav />
    </div>
  );
}
