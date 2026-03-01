import { STATUS_COLORS, VAULT_STATUSES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  status: (typeof VAULT_STATUSES)[number];
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        STATUS_COLORS[status],
      )}
    >
      {status}
    </span>
  );
}
