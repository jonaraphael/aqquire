import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
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
  onCommit: (itemId: string, interaction: 'swipe') => Promise<void>;
}

const SWIPE_THRESHOLD = 0.3;
const SPARKLES = [
  { left: '8%', top: '20%', delay: '0s', duration: '2.1s' },
  { left: '25%', top: '62%', delay: '0.35s', duration: '2.6s' },
  { left: '44%', top: '30%', delay: '0.7s', duration: '1.95s' },
  { left: '66%', top: '68%', delay: '0.2s', duration: '2.4s' },
  { left: '82%', top: '24%', delay: '0.9s', duration: '2.15s' },
  { left: '92%', top: '58%', delay: '0.45s', duration: '2.35s' },
] as const;

function vibrate() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(12);
  }
}

export function FeedCard({ item, debugMode, onCommit }: FeedCardProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const committedRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [hasCommitted, setHasCommitted] = useState(false);
  const [pendingIndicator, setPendingIndicator] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('right');

  const fillRatio = hasCommitted ? 1 : progress;

  const fireCommit = async () => {
    if (committedRef.current) return;
    committedRef.current = true;

    setHasCommitted(true);
    setPendingIndicator(true);
    setProgress(1);
    vibrate();

    await onCommit(item._id, 'swipe');
  };

  return (
    <motion.article
      ref={rowRef}
      drag={hasCommitted ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0}
      dragMomentum={false}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3 backdrop-blur-sm transition-colors duration-500',
        hasCommitted
          ? 'border-champagne/60 bg-gradient-to-br from-[#f6d9921f] to-[#b482371e] shadow-[0_12px_34px_rgba(226,175,84,0.25)]'
          : 'border-white/10 bg-white/[0.04]',
      )}
      onDrag={(_event, info) => {
        if (hasCommitted) return;
        const width = rowRef.current?.clientWidth ?? 1;
        const offset = info.offset.x;
        if (Math.abs(offset) > 2) {
          setSwipeDirection(offset < 0 ? 'left' : 'right');
        }
        const dragRatio = Math.min(1, Math.abs(offset) / width);
        setProgress(dragRatio);
      }}
      onDragStart={() => {
        if (hasCommitted) return;
        setIsDragging(true);
      }}
      onDragEnd={(_event, info) => {
        if (hasCommitted) return;
        setIsDragging(false);
        const width = rowRef.current?.clientWidth ?? 1;
        const dragRatio = Math.min(1, Math.abs(info.offset.x) / width);
        if (dragRatio >= SWIPE_THRESHOLD) {
          void fireCommit();
        } else {
          setProgress(0);
        }
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 h-full',
            swipeDirection === 'left'
              ? 'right-0 bg-gradient-to-l from-[#f7deac26] via-[#f0cb8652] to-[#b5833955]'
              : 'left-0 bg-gradient-to-r from-[#f7deac26] via-[#f0cb8652] to-[#b5833955]',
          )}
          style={{
            width: `${fillRatio * 100}%`,
            transition: hasCommitted ? 'width 220ms ease-out' : isDragging ? 'none' : 'width 120ms ease-out',
          }}
        />
      </div>

      {hasCommitted ? <div className="pointer-events-none absolute inset-0 feed-card-shimmer" /> : null}

      {hasCommitted ? (
        <div className="pointer-events-none absolute inset-0">
          {SPARKLES.map((sparkle, index) => (
            <span
              key={index}
              className="feed-card-sparkle"
              style={{
                left: sparkle.left,
                top: sparkle.top,
                animationDelay: sparkle.delay,
                animationDuration: sparkle.duration,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative z-10 flex items-center gap-3">
        <img
          src={item.heroImageUrl}
          alt={item.displayName}
          className={cn(
            'h-20 w-20 rounded-xl object-cover ring-1 transition duration-400',
            hasCommitted ? 'ring-champagne/55 saturate-110' : 'ring-white/15',
          )}
          loading="lazy"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn('truncate font-display text-lg', hasCommitted ? 'text-[#f8e7c2]' : 'text-pearl')}>{item.displayName}</p>
          <p className={cn('text-sm tracking-wide', hasCommitted ? 'text-champagne/95' : 'text-pearl/85')}>
            {currency(item.price, item.currency)}
          </p>
          <div className={cn('flex items-center gap-2 text-xs', hasCommitted ? 'text-pearl/85' : 'text-pearl/65')}>
            <img
              src={item.whoAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=60'}
              alt={item.whoHandle}
              className="h-5 w-5 rounded-full object-cover"
            />
            <span>{item.whoHandle}</span>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 tracking-[0.16em] transition-colors',
                hasCommitted ? 'border-champagne/65 bg-champagne/20 text-champagne' : 'border-champagne/45 text-champagne',
              )}
            >
              AQQUIRE
            </span>
            {item.associatedCount > 1 ? <span>+{item.associatedCount - 1}</span> : null}
          </div>

          {debugMode && item.debug ? (
            <p className={cn('text-[11px]', hasCommitted ? 'text-pearl/75' : 'text-pearl/55')}>
              {item.debug.supplierName ?? 'Source hidden'}
              {item.debug.uniqueFlag ? ' • Unique' : ''}
            </p>
          ) : null}
        </div>
      </div>

      {pendingIndicator ? (
        <span className="absolute right-3 top-3 rounded-full border border-champagne/60 bg-gradient-to-r from-[#f1d18f33] to-[#b7843f44] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-champagne shadow-[0_0_16px_rgba(224,178,93,0.35)]">
          pending
        </span>
      ) : null}
    </motion.article>
  );
}
