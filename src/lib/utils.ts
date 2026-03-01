export function currency(value: number, code = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function parseFollowToken(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const uriPrefix = 'aqquire://follow/';
  if (trimmed.startsWith(uriPrefix)) {
    return trimmed.slice(uriPrefix.length);
  }
  return trimmed;
}
