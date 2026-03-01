export const CATEGORY_OPTIONS = [
  'Handbags',
  'Timepieces',
  'Automobiles',
  'Jewelry',
  'Art',
  'Footwear',
  'Outerwear',
  'Home',
  'Tech',
  'Travel',
  'Experiences',
  'Other',
] as const;

export const VAULT_STATUSES = ['pending', 'ordered', 'shipped', 'delivered', 'canceled', 'failed'] as const;

export const STATUS_COLORS: Record<(typeof VAULT_STATUSES)[number], string> = {
  pending: 'bg-amber-400/15 text-amber-200 border-amber-200/40',
  ordered: 'bg-sky-400/15 text-sky-200 border-sky-200/40',
  shipped: 'bg-indigo-400/15 text-indigo-200 border-indigo-200/40',
  delivered: 'bg-emerald-400/15 text-emerald-200 border-emerald-200/40',
  canceled: 'bg-zinc-400/15 text-zinc-300 border-zinc-200/25',
  failed: 'bg-rose-400/15 text-rose-200 border-rose-200/40',
};

export const APP_TITLE = 'aqquire-luxury-app';
