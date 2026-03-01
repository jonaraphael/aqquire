import { motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { currency, cn } from '@/lib/utils';

export interface FeedCardItem {
  _id: string;
  displayName: string;
  heroImageUrl: string;
  category: string;
  price: number;
  currency: string;
  whoHandle: string;
  whoAvatarUrl?: string | null;
  associatedCount: number;
  stamp: 'AQQUIRE';
  debug: {
    supplierName?: string;
    supplierUrl?: string;
    uniqueFlag?: boolean;
  } | null;
}

interface FeedCardProps {
  item: FeedCardItem;
  debugMode: boolean;
  onCommit: (itemId: string, interaction: 'swipe' | 'longPress') => Promise<void>;
}

const LONG_PRESS_MS = 650;
const SWIPE_THRESHOLD = 0.4;

function vibrate() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(12);
  }
}

function fillStep(progress: number) {
  return Math.max(0, Math.min(10, Math.round(progress * 10)));
}

export function FeedCard({ item, debugMode, onCommit }: FeedCardProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressInterval = useRef<number | null>(null);
  const committedRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [flashGold, setFlashGold] = useState(false);
  const [pendingIndicator, setPendingIndicator] = useState(false);

  const step = useMemo(() => fillStep(progress), [progress]);

  const cleanupHold = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    if (longPressInterval.current) window.clearInterval(longPressInterval.current);
    longPressTimer.current = null;
    longPressInterval.current = null;
  };

  const fireCommit = async (interaction: 'swipe' | 'longPress') => {
    if (committedRef.current) return;
    committedRef.current = true;

    setProgress(1);
    setFlashGold(true);
    setPendingIndicator(true);
    vibrate();

    window.setTimeout(() => setFlashGold(false), 180);
    window.setTimeout(() => {
      setPendingIndicator(false);
      committedRef.current = false;
      setProgress(0);
    }, 1200);

    await onCommit(item._id, interaction);
  };

  return (
    <motion.article
      ref={rowRef}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.06}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm"
      onDrag={(_event, info) => {
        const width = rowRef.current?.clientWidth ?? 1;
        const dragRatio = Math.min(1, Math.abs(info.offset.x) / width);
        setProgress(dragRatio);
      }}
      onDragEnd={(_event, info) => {
        const width = rowRef.current?.clientWidth ?? 1;
        const dragRatio = Math.min(1, Math.abs(info.offset.x) / width);
        setProgress(0);
        if (dragRatio >= SWIPE_THRESHOLD) {
          void fireCommit('swipe');
        }
      }}
      onPointerDown={() => {
        cleanupHold();
        const startedAt = Date.now();
        longPressInterval.current = window.setInterval(() => {
          const elapsed = Date.now() - startedAt;
          setProgress(Math.min(1, elapsed / LONG_PRESS_MS));
        }, 33);

        longPressTimer.current = window.setTimeout(() => {
          void fireCommit('longPress');
          cleanupHold();
        }, LONG_PRESS_MS);
      }}
      onPointerUp={() => {
        cleanupHold();
        if (!flashGold) setProgress(0);
      }}
      onPointerCancel={() => {
        cleanupHold();
        if (!flashGold) setProgress(0);
      }}
    >
      <div className="pointer-events-none absolute inset-0 flex">
        {Array.from({ length: 10 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-full flex-1 transition-colors duration-100',
              index < step || flashGold ? 'bg-gradient-to-b from-[#ffe9b6]/45 to-[#b4883a]/45' : 'bg-transparent',
            )}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center gap-3">
        <img
          src={item.heroImageUrl}
          alt={item.displayName}
          className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/15"
          loading="lazy"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-display text-lg text-pearl">{item.displayName}</p>
          <p className="text-sm tracking-wide text-pearl/85">{currency(item.price, item.currency)}</p>
          <div className="flex items-center gap-2 text-xs text-pearl/65">
            <img
              src={item.whoAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=60'}
              alt={item.whoHandle}
              className="h-5 w-5 rounded-full object-cover"
            />
            <span>{item.whoHandle}</span>
            <span className="rounded-full border border-champagne/45 px-2 py-0.5 tracking-[0.16em] text-champagne">
              AQQUIRE
            </span>
            {item.associatedCount > 1 ? <span>+{item.associatedCount - 1}</span> : null}
          </div>

          {debugMode && item.debug ? (
            <p className="text-[11px] text-pearl/55">
              {item.debug.supplierName ?? 'Source hidden'}
              {item.debug.uniqueFlag ? ' • Unique' : ''}
            </p>
          ) : null}
        </div>
      </div>

      {pendingIndicator ? (
        <span className="absolute right-3 top-3 rounded-full border border-champagne/50 bg-champagne/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-champagne">
          pending
        </span>
      ) : null}
    </motion.article>
  );
}
