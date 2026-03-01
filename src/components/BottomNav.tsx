import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const AQQUIRE_CAPTURE_EVENT = 'aqquire:capture';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAqquire = location.pathname === '/aqquire';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-champagne/20 bg-obsidian/95 px-4 pb-[max(env(safe-area-inset-bottom),0.8rem)] pt-3 backdrop-blur-lg">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-3 items-center gap-4">
        <NavButton to="/feed" label="Feed" icon={<FeedIcon />} />
        <ShutterButton
          isAqquire={isAqquire}
          onPress={() => {
            if (isAqquire) {
              window.dispatchEvent(new CustomEvent(AQQUIRE_CAPTURE_EVENT));
              return;
            }
            void navigate('/aqquire');
          }}
        />
        <NavButton to="/vault" label="Vault" icon={<VaultIcon />} />
      </div>
    </nav>
  );
}

function NavButton({ to, label, icon }: { to: string; label: string; icon?: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group flex h-11 items-center justify-center gap-2 rounded-full border text-xs tracking-[0.16em] uppercase transition',
          isActive
            ? 'border-champagne bg-champagne/15 text-champagne'
            : 'border-white/15 bg-white/5 text-white/75 hover:border-champagne/50 hover:text-champagne',
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function ShutterButton({ isAqquire, onPress }: { isAqquire: boolean; onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} className="flex items-center justify-center">
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full border text-[11px] font-semibold tracking-[0.18em] uppercase transition-transform duration-200',
          'border-champagne bg-gradient-to-b from-[#f5e7c2] via-[#d8b66f] to-[#a67a35] text-obsidian shadow-[0_0_0_2px_rgba(255,231,186,0.25),0_10px_35px_rgba(214,170,92,0.45)]',
          isAqquire ? 'scale-105' : 'hover:scale-[1.02]',
        )}
      >
        AQQUIRE
      </span>
    </button>
  );
}

function FeedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3.9 7.9C5.7 11.8 8.5 14 12 14s6.3-2.2 8.1-6.1" />
      <path d="M5.9 8.9 6.65 9.65 5.9 10.4l-.75-.75.75-.75Z" fill="currentColor" stroke="none" />
      <path d="M8.35 11.25 9.1 12 8.35 12.75 7.6 12l.75-.75Z" fill="currentColor" stroke="none" />
      <path d="M10.75 12.7 11.5 13.45 10.75 14.2 10 13.45l.75-.75Z" fill="currentColor" stroke="none" />
      <path d="M13.25 12.7 14 13.45 13.25 14.2 12.5 13.45l.75-.75Z" fill="currentColor" stroke="none" />
      <path d="M15.65 11.25 16.4 12 15.65 12.75 14.9 12l.75-.75Z" fill="currentColor" stroke="none" />
      <path d="M18.1 8.9 18.85 9.65 18.1 10.4l-.75-.75.75-.75Z" fill="currentColor" stroke="none" />
      <path d="M12 14.2v1.8" />
      <path d="M12 16.1 13.5 17.7 12 19.3 10.5 17.7 12 16.1Z" fill="currentColor" stroke="none" />
      <path d="M11.1 17.7h1.8" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3.6" y="4.2" width="16.8" height="15.6" rx="2.3" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <path d="M12 7.75v2.2M12 14.05v2.2M7.75 12h2.2M14.05 12h2.2" />
      <path d="M6.3 7.4h2.1M6.3 16.6h2.1M15.6 7.4h2.1M15.6 16.6h2.1" />
    </svg>
  );
}
