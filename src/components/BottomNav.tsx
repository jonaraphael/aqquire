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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4.2 8.8a7.8 7.8 0 0 0 15.6 0" />
      <circle cx="6" cy="9.2" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="8.3" cy="11.4" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="10.8" cy="12.7" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="13.2" cy="12.7" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="11.4" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="18" cy="9.2" r="0.95" fill="currentColor" stroke="none" />
      <path d="M12 13.7v2.3" />
      <path d="M10.7 17.1 12 19.6l1.3-2.5-1.3-1.2-1.3 1.2Z" />
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
