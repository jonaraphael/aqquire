import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-champagne/20 bg-obsidian/95 px-4 pb-[max(env(safe-area-inset-bottom),0.8rem)] pt-3 backdrop-blur-lg">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-3 items-center gap-4">
        <NavButton to="/feed" label="Feed" />
        <ShutterButton />
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

function ShutterButton() {
  return (
    <NavLink to="/aqquire" className="flex items-center justify-center">
      {({ isActive }) => (
        <span
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full border text-[11px] font-semibold tracking-[0.18em] uppercase transition-transform duration-200',
            'border-champagne bg-gradient-to-b from-[#f5e7c2] via-[#d8b66f] to-[#a67a35] text-obsidian shadow-[0_0_0_2px_rgba(255,231,186,0.25),0_10px_35px_rgba(214,170,92,0.45)]',
            isActive ? 'scale-105' : 'hover:scale-[1.02]',
          )}
        >
          AQQUIRE
        </span>
      )}
    </NavLink>
  );
}

function VaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 8.8v1.4M12 13.8v1.4M8.8 12h1.4M13.8 12h1.4" />
    </svg>
  );
}
