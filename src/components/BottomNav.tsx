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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3" />
      <path d="M7.2 8.2h9.6M7.2 12h9.6M7.2 15.8h6.1" />
      <path d="M18.2 7.3l.4.8.9.1-.7.7.2 1-.8-.4-.8.4.2-1-.7-.7.9-.1.4-.8Z" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3.5 5.4 6.1v5.3c0 4.1 2.6 7.8 6.6 9.1 4-1.3 6.6-5 6.6-9.1V6.1L12 3.5Z" />
      <rect x="9.1" y="10.2" width="5.8" height="4.8" rx="1.1" />
      <path d="M10.3 10.2V9.1A1.7 1.7 0 0 1 12 7.4a1.7 1.7 0 0 1 1.7 1.7v1.1" />
    </svg>
  );
}
